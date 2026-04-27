-- =============================================================================
-- Migración: auto-activación de productos al ingestar su template
-- Fecha:     2026-04-28
-- Contexto:  PR #1 — opción B del calendario alternativo
-- Estado:    APLICADA EN PRODUCCIÓN el 2026-04-28 vía MCP Supabase
-- =============================================================================
-- Problema:
--   Los 22 productos del nuevo patrón (evento-mudanza, evento-vehiculo, ...)
--   tienen is_active=false hasta que su template HTML está ingestado en
--   astrodorado.report_templates. Sin template, el worker fallaría en runtime.
--
-- Solución:
--   Trigger AFTER INSERT en report_templates que, al insertar un template,
--   pone is_active=true en el registro correspondiente de reports (matched
--   por slug). Idempotente: si ya estaba activo, el UPDATE no cambia nada.
--
-- Por qué un trigger en DB y no lógica en el script de ingesta:
--   - Atómico: el activado y la inserción del template están en la misma tx
--   - No dependiente del código: cualquier inserción (manual, dashboard,
--     script automatizado, restore de backup) activa el producto
--   - Auditable: queda en el changelog de la DB, no en código de aplicación
--   - Reversible: admin puede UPDATE reports SET is_active=false en cualquier
--     momento; el trigger no re-activa al UPDATE de templates, solo al INSERT
--
-- Política de borrado:
--   No se desactiva al borrar un template (DELETE). Si admin borra un template
--   manualmente, debe decidir si desactivar el producto o re-ingestar.
--
-- Validación (2026-04-28):
--   - INSERT de prueba en evento-mudanza: trigger activó is_active=true
--   - Timestamps idénticos al µs entre report.updated_at y template.created_at
--   - DELETE + UPDATE manual restauró el estado pre-test correctamente
-- =============================================================================

-- 1. Función del trigger
CREATE OR REPLACE FUNCTION astrodorado.activate_report_on_template_ingest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Activar el producto correspondiente al slug del template ingestado.
  -- WHERE is_active = false para no tocar updated_at innecesariamente
  -- en productos que ya estaban activos.
  UPDATE astrodorado.reports
  SET is_active = true,
      updated_at = NOW()
  WHERE slug = NEW.slug
    AND is_active = false;
  RETURN NEW;
END;
$$;

-- 2. Trigger (idempotente: drop si existe antes de crear)
DROP TRIGGER IF EXISTS trg_activate_report_on_template ON astrodorado.report_templates;

CREATE TRIGGER trg_activate_report_on_template
  AFTER INSERT ON astrodorado.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION astrodorado.activate_report_on_template_ingest();

COMMENT ON TRIGGER trg_activate_report_on_template ON astrodorado.report_templates IS
'Auto-activa el producto en astrodorado.reports cuando se ingesta su template HTML. Garantiza que los productos del nuevo patrón solo aparezcan en la web cuando tienen template renderizable. Aplicado en PR #1.';

COMMENT ON FUNCTION astrodorado.activate_report_on_template_ingest() IS
'Función del trigger trg_activate_report_on_template. SECURITY DEFINER porque el ingest corre con service_role pero los UPDATE a reports los hacen con permisos del owner del schema. Idempotente: WHERE is_active=false evita updates redundantes.';
