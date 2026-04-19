// /informes/[id] - ULTRA MINIMA. Sin Supabase, sin async, nada.
// Si esto tambien cuelga, el problema no esta en el codigo.

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  return (
    <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh' }}>
      <h1 style={{ color: '#f0ce5a' }}>Test minimo</h1>
      <p>ID recibido: {id}</p>
      <p>Fecha: {new Date().toISOString()}</p>
    </div>
  );
}