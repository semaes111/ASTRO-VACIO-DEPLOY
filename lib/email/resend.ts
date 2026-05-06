// ============================================================
// lib/email/resend.ts - Wrapper transactional email para Resend
//
// Resend es el proveedor recomendado para Next.js + Vercel:
//   - Integración oficial con Vercel (env var auto-añadida)
//   - 3000 emails/mes free tier
//   - DKIM/SPF/DMARC automáticos para dominios verificados
//   - DX: tipos TS de primera clase
//
// Configuración requerida:
//   RESEND_API_KEY      → desde resend.com/api-keys
//   EMAIL_FROM_ADDRESS  → "AstroDorado <hola@astrodorado.com>"
//                          (el dominio debe estar verificado en Resend)
//
// Notas de operación:
//   - Las llamadas son fire-and-forget. Si falla el email, el informe
//     sigue disponible vía URL (no bloqueamos la generación).
//   - Errores de Resend se loguean pero no se propagan (un email
//     fallido no debe romper el flujo principal).
//
// Ref: https://resend.com/docs/send-with-nextjs
// ============================================================

import { Resend } from 'resend';

interface ReportReadyEmailInput {
  to: string;
  userName: string;
  productLabel: string;
  reportUrl: string;
}

interface SendResult {
  ok: boolean;
  emailId?: string;
  error?: string;
}

let _client: Resend | null = null;
function getClient(): Resend {
  if (!_client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY env var is required');
    }
    _client = new Resend(process.env.RESEND_API_KEY);
  }
  return _client;
}

/**
 * Envía email transactional cuando un informe ha terminado de generarse.
 *
 * Diseño robusto:
 *   - Errores de red → catch interno, retorna ok:false con detalle
 *   - El caller debe loguear pero NO propagar (email opcional, no crítico)
 *   - Si RESEND_API_KEY está sin configurar, retorna ok:false sin lanzar
 *     (permite que el sistema funcione en local sin Resend)
 */
export async function sendReportReadyEmail(
  input: ReportReadyEmailInput
): Promise<SendResult> {
  // Modo "soft": si no hay API key, no enviamos pero tampoco rompemos
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado, saltando email');
    return { ok: false, error: 'resend_not_configured' };
  }

  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ?? 'AstroDorado <hola@astrodorado.com>';

  try {
    const client = getClient();
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: [input.to],
      subject: `Tu informe "${input.productLabel}" está listo`,
      html: buildReportReadyHtml(input),
      // Resend soporta plain text fallback automático cuando solo se da html
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { ok: false, error: String(error.message ?? error) };
    }

    return { ok: true, emailId: data?.id };
  } catch (err) {
    console.error('[email] Exception:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    };
  }
}

/**
 * Plantilla HTML inline para el email "informe listo".
 *
 * Decisión: HTML inline en lugar de React Email por ahora.
 * Razón: 1 sola plantilla, baja frecuencia de cambio, evita añadir
 * @react-email/* (otra dep). Si en el futuro tenemos 5+ plantillas,
 * migrar a React Email es trivial.
 *
 * Se mantiene compatible con clientes de email modernos (Gmail,
 * Outlook web, Apple Mail) usando solo CSS inline. No depende de
 * fuentes externas ni JavaScript.
 */
function buildReportReadyHtml(input: ReportReadyEmailInput): string {
  const { userName, productLabel, reportUrl } = input;
  const safeName = escapeHtml(userName);
  const safeProduct = escapeHtml(productLabel);
  const safeUrl = escapeHtml(reportUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tu informe está listo · AstroDorado</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1ea;font-family:Georgia,'Times New Roman',serif;color:#2a1f10;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f1ea;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:48px 48px 24px 48px;text-align:center;">
              <h1 style="margin:0 0 8px 0;font-size:32px;color:#b8924c;letter-spacing:0.5px;">AstroDorado</h1>
              <p style="margin:0;color:#7a6a4f;font-style:italic;font-size:14px;">Tu cielo, tu tiempo</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px 48px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;color:#2a1f10;">Hola ${safeName},</h2>
              <p style="margin:0 0 16px 0;line-height:1.6;font-size:16px;">
                Tu informe <strong>${safeProduct}</strong> está listo. Lo hemos preparado
                con cuidado, calculando posiciones planetarias precisas y revisando ventanas
                de tiempo favorables específicas para ti.
              </p>
              <p style="margin:0 0 32px 0;line-height:1.6;font-size:16px;">
                Puedes leerlo cuando quieras desde el siguiente enlace:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}" style="display:inline-block;background-color:#b8924c;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;letter-spacing:0.3px;">
                      Ver mi informe
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0 0;line-height:1.6;font-size:14px;color:#7a6a4f;">
                Si el botón no funciona, copia este enlace en tu navegador:<br>
                <a href="${safeUrl}" style="color:#b8924c;word-break:break-all;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #e8dfd1;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9a8a6f;line-height:1.6;">
                Este informe estará disponible durante los próximos 30 días.<br>
                Si tienes dudas, responde a este email y te ayudaremos.
              </p>
              <p style="margin:16px 0 0 0;font-size:12px;color:#b5a78a;">
                AstroDorado · El Ejido, Almería · España<br>
                <a href="https://astrodorado.com" style="color:#b8924c;text-decoration:none;">astrodorado.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
