-- ============================================================================
-- Migración: wrapper view para astrodorado.report_templates
-- Fecha: 2026-04-22
-- Objetivo:
--   Añadir `public.astrodorado_report_templates` para cerrar el gap detectado
--   entre la migración del Turno 1 y el script de ingesta del Turno 2.
--
-- Contexto:
--   Todas las tablas de negocio del schema astrodorado están expuestas al
--   cliente supabase-js mediante wrapper views en `public` (patrón verificado
--   en 10 views existentes: astrodorado_reports, astrodorado_user_reports,
--   astrodorado_daily_readings, etc.). `report_templates` es la única tabla
--   que no tiene su wrapper view, lo que hace que .schema('astrodorado')
--   desde supabase-js falle con error de "Invalid schema" o "permission denied".
--
-- Consistencia con el patrón:
--   - Grants idénticos a las otras views (full CRUD para los 3 roles).
--   - Sin filtro `is_active=true` (a diferencia de astrodorado_reports),
--     porque el script de ingesta necesita leer TODAS las versiones para
--     calcular la siguiente, y el template-loader ya filtra por is_active.
--
-- Idempotente. Reversible (DROP VIEW al final).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Wrapper VIEW expuesta a supabase-js
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.astrodorado_report_templates AS
SELECT
  id,
  slug,
  html_template,
  data_schema,
  source,
  version,
  is_active,
  notes,
  byte_size,
  created_at,
  updated_at
FROM astrodorado.report_templates;

COMMENT ON VIEW public.astrodorado_report_templates IS
  'Wrapper de astrodorado.report_templates para PostgREST. Sin filtro — el consumidor aplica is_active=true.';

-- ----------------------------------------------------------------------------
-- Permisos consistentes con el resto de wrapper views de astrodorado
-- ----------------------------------------------------------------------------
-- service_role: acceso completo para scripts de ingesta y Edge Functions
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.astrodorado_report_templates TO service_role;

-- anon/authenticated: mismos grants que las otras wrapper views; el RLS de
-- la tabla base astrodorado.report_templates sigue siendo el gate real.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.astrodorado_report_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.astrodorado_report_templates TO authenticated;

-- ----------------------------------------------------------------------------
-- Verificación post-migración (ejecutar manualmente tras aplicar)
-- ----------------------------------------------------------------------------
--   SELECT COUNT(*) FROM public.astrodorado_report_templates;  -- debe devolver 0 (ingesta aún no ejecutada)
--
--   SELECT grantee, privilege_type 
--     FROM information_schema.role_table_grants
--     WHERE table_name = 'astrodorado_report_templates'
--     ORDER BY grantee, privilege_type;
--   -- debe mostrar 3 roles con full CRUD

-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
--   DROP VIEW IF EXISTS public.astrodorado_report_templates;
--   -- La tabla base astrodorado.report_templates no se toca.
