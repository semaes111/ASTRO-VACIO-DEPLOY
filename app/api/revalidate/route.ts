import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Endpoint protegido por token para invalidar el cache ISR.
 * Llamado por n8n al completar la generación diaria de horóscopos.
 *
 * Uso desde n8n:
 *   POST /api/revalidate
 *   Header: x-revalidate-token: <REVALIDATE_TOKEN>
 *   Body: { "paths": ["/", "/aries", "/tauro", ...] }
 */

interface RevalidateBody {
  paths?: string[];
  tags?: string[];
}

const VALID_PATH_REGEX = /^\/[a-z0-9/-]*$/i;

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-revalidate-token');

  if (!token || token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const paths = Array.isArray(body.paths) ? body.paths : [];

  // Validar que todos los paths son seguros (no path traversal)
  const invalid = paths.filter((p) => !VALID_PATH_REGEX.test(p));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: 'Invalid paths', invalid },
      { status: 400 },
    );
  }

  const revalidated: string[] = [];
  for (const path of paths) {
    try {
      revalidatePath(path);
      revalidated.push(path);
    } catch (err) {
      // Log pero no abortar — seguimos con los siguientes
      console.error(`Failed to revalidate ${path}:`, err);
    }
  }

  return NextResponse.json({
    revalidated,
    count: revalidated.length,
    timestamp: new Date().toISOString(),
  });
}
