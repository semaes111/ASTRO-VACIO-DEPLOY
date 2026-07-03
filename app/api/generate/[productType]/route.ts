/**
 * /api/generate/[productType] - Dispatcher de generación
 *
 * Llamado por:
 *   - /api/stripe/webhook (tras pago confirmado)
 *   - /api/stripe/checkout en modo dev/test (compras de prueba)
 *
 * Auth: x-internal-secret header (no expuesto a clientes finales).
 *
 * Comportamiento (Opción C):
 *   1. Valida productType y user_report_id
 *   2. Resuelve dispatcher de DISPATCHERS map
 *   3. Lanza la generación en background con `after()` de Next 15.1+
 *   4. Devuelve respuesta INMEDIATA con poll_url y view_url
 *
 * El cliente que llama (Stripe webhook) recibe la respuesta en ~50-200ms,
 * NO espera a que termine la generación. La generación corre en background
 * en el mismo Vercel function (vía `after()`) o, si eventualmente tarda más
 * de maxDuration, falla y se persiste status='error'.
 *
 * Polling:
 *   El frontend que muestra el informe (/ver/[id]) hace polling cada 5s
 *   a /api/informe-status?report_id=... para detectar cuando el status
 *   cambia a 'ready' (o 'error').
 */
import { NextResponse, after } from 'next/server';
import { ensureDeepSeekKey } from '@/lib/ai/ensure-deepseek-key';
import { generateAyurveda } from '@/lib/generators/ayurveda/generate';
import { generateEventoVehiculo } from '@/lib/generators/evento-vehiculo/generate';
import { generateEventoMudanza } from '@/lib/generators/evento-mudanza/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// maxDuration de 300s (5 min) sigue siendo más que suficiente para chunked
// generation. El target es 30-60s. Si excede maxDuration, el worker persiste
// status='error' y el cliente ve el error en su próximo poll.
export const maxDuration = 300;

type Ctx = { params: Promise<{ productType: string }> };

/**
 * Map productType → función generadora.
 *
 * Para añadir un nuevo producto:
 *   1. Crear lib/generators/{slug}/generate.ts con export default async function
 *   2. Importar arriba en este archivo
 *   3. Añadir entrada al map
 *
 * Si un producto NO está en el map, devolvemos 400 con detalle. Antes
 * caía en un stub default que marcaba el report como 'ready' con HTML
 * placeholder — eso era un BUG porque hacía creer al cliente que su
 * informe estaba listo cuando en realidad nunca se generó.
 */
const DISPATCHERS: Record<string, (userReportId: string) => Promise<unknown>> = {
  ayurveda: generateAyurveda,
  'evento-vehiculo': generateEventoVehiculo,
  'evento-mudanza': generateEventoMudanza,
};

export async function POST(req: Request, { params }: Ctx) {
  // Puente de secreto: carga DEEPSEEK_API_KEY desde Vault si falta en el env
  await ensureDeepSeekKey();

  // ─── Auth interna ────────────────────────────────────────
  const secretHeader = req.headers.get('x-internal-secret');
  if (secretHeader !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { productType } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const userReportId = typeof body.user_report_id === 'string' ? body.user_report_id : null;

  if (!userReportId) {
    return NextResponse.json({ error: 'missing_user_report_id' }, { status: 400 });
  }

  // ─── Resolver dispatcher ─────────────────────────────────
  const dispatcher = DISPATCHERS[productType];
  if (!dispatcher) {
    // Antes había un stub default; ahora rechazamos explícitamente para
    // evitar que un product_type inválido marque status='ready' con
    // contenido placeholder.
    return NextResponse.json(
      {
        error: 'unsupported_product_type',
        productType,
        supported: Object.keys(DISPATCHERS),
        detail:
          `El producto '${productType}' no tiene generador asignado. ` +
          `Si es un producto nuevo, añadirlo al map DISPATCHERS de este endpoint.`,
      },
      { status: 400 },
    );
  }

  // ─── Background job: la generación corre tras devolver la respuesta ──
  // `after()` ejecuta la callback DESPUÉS de que el cliente reciba la
  // respuesta. La función serverless se mantiene viva hasta que la
  // callback termina, sujeto a maxDuration.
  //
  // Errores en la callback se logean pero no se propagan al cliente
  // (que ya recibió el 200 OK). El worker interno persiste status='error'
  // en DB si algo falla, y el frontend lo detecta vía polling.
  after(async () => {
    try {
      await dispatcher(userReportId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[generate/${productType}] background error en user_report ${userReportId}:`,
        err instanceof Error ? err.message : err,
      );
      // No re-throw: el worker ya persistió status='error' en su catch interno.
    }
  });

  // ─── Respuesta inmediata ─────────────────────────────────
  // Cliente recibe esto en <200ms. Suficiente para que Stripe webhook
  // marque el pago como procesado y siga su flow.
  return NextResponse.json({
    status: 'queued',
    user_report_id: userReportId,
    product_type: productType,
    poll_url: `/api/informe-status?report_id=${userReportId}`,
    view_url: `/ver/${userReportId}`,
    message:
      'La generación ha comenzado en segundo plano. Polea poll_url cada 5s ' +
      'para detectar el estado, o redirige al usuario a view_url donde verá ' +
      'una barra de progreso y se autoredirigirá al informe cuando esté listo.',
  });
}
