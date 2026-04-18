import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reportId = url.searchParams.get('report_id');
  if (!reportId) return NextResponse.json({ error: 'missing_report_id' }, { status: 400 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('astrodorado_user_reports')
    .select('status')
    .eq('id', reportId)
    .single();

  return NextResponse.json({ status: data?.status || 'unknown' });
}
