# Patch: script de ingesta del Turno 2

**Archivo afectado:** `scripts/ingest-html-templates.ts`  
**Función afectada:** `upsertTemplate()` (la única que habla con Supabase)  
**Ocurrencias a cambiar:** 3 líneas  
**Motivo:** `.schema('astrodorado')` no funciona en este proyecto — consistencia con el patrón de wrapper views en `public`.

---

## Por qué hay que parchear

La inspección directa de Supabase revela que:

1. `service_role` **no tiene permisos** sobre `astrodorado.report_templates` (sin `USAGE` en schema, sin `SELECT/INSERT/UPDATE` en tabla).
2. El patrón del proyecto usa **wrapper views en `public`** con prefijo `astrodorado_*`. Hay 10 existentes, todas con grants completos para los 3 roles. `report_templates` es la única que faltaba.
3. La nueva migración `20260422_create_report_templates_view.sql` añade la wrapper view que faltaba. Desde ese punto, basta con consumirla como `astrodorado_report_templates` (sin `.schema()`).

---

## Diff exacto (3 líneas cambian)

```diff
--- a/scripts/ingest-html-templates.ts
+++ b/scripts/ingest-html-templates.ts
@@ función upsertTemplate, consulta #1 (SELECT) @@

   // 1. Obtener versión máxima actual para este slug
   const { data: existing, error: selErr } = await supabase
-    .schema('astrodorado')
-    .from('report_templates')
+    .from('astrodorado_report_templates')
     .select('version, is_active')
     .eq('slug', slug)
     .order('version', { ascending: false })
     .limit(1);

@@ función upsertTemplate, consulta #2 (UPDATE desactivar) @@

   if (existing && existing.length > 0 && existing[0].is_active === true) {
     const { error: deactErr } = await supabase
-      .schema('astrodorado')
-      .from('report_templates')
+      .from('astrodorado_report_templates')
       .update({ is_active: false })
       .eq('slug', slug)
       .eq('is_active', true);

     if (deactErr) throw new Error(`Error desactivando versión anterior: ${deactErr.message}`);
   }

@@ función upsertTemplate, consulta #3 (INSERT) @@

   // 3. Insertar la nueva versión activa
   const { error: insErr } = await supabase
-    .schema('astrodorado')
-    .from('report_templates')
+    .from('astrodorado_report_templates')
     .insert({
       slug,
       html_template: htmlTemplate,
       source: 'puppeteer_render',
       version: newVersion,
       is_active: true,
       notes,
       data_schema: [],
     });

   if (insErr) throw new Error(`Error insertando template: ${insErr.message}`);
```

**Resumen del cambio:**
- 3 ocurrencias de `.schema('astrodorado').from('report_templates')` → `.from('astrodorado_report_templates')`
- No se toca ni la lógica de versionado, ni el orden de operaciones, ni el manejo de errores
- El resto del script (unzip, Puppeteer, validación, logging) queda intacto

---

## Comando rápido para aplicar el patch

Si prefieres un one-liner en lugar de editar a mano:

```bash
# Desde la raíz del repo, después de copiar el script del Turno 2
sed -i.bak \
  -e "s/\.schema('astrodorado')\s*\n*\s*\.from('report_templates')/.from('astrodorado_report_templates')/g" \
  scripts/ingest-html-templates.ts

# El sed no es fiable para multilínea — mejor editar a mano las 3 ocurrencias
# Alternativa con python (maneja multilinea):
python3 <<'PY'
import re
p = "scripts/ingest-html-templates.ts"
s = open(p).read()
# Captura: .schema('astrodorado')\n<whitespace>.from('report_templates')
s2 = re.sub(
    r"\.schema\(['\"]astrodorado['\"]\)\s*\n\s*\.from\(['\"]report_templates['\"]\)",
    ".from('astrodorado_report_templates')",
    s,
)
assert s != s2, "No se encontró ninguna ocurrencia a parchar"
open(p, 'w').write(s2)
print("OK: patch aplicado. Revisa con git diff antes de commit.")
PY

# Verificar:
grep -n "report_templates" scripts/ingest-html-templates.ts
# Debe mostrar solo líneas con 'astrodorado_report_templates', NUNCA '.schema(' cerca.
```

---

## Verificación después del patch

1. El script debe pasar `npx tsc --noEmit scripts/ingest-html-templates.ts` sin errores de tipos (supabase-js tipa tanto `from('astrodorado_report_templates')` como el schema-qualified access — son intercambiables a efectos de tipo).
2. `npm run ingest:dry` seguirá funcionando sin tocar Supabase (dry-run solo lee, no inserta).
3. `npm run ingest:one -- --slug=evento-vehiculo` ahora sí debe insertar una fila:

```sql
-- Verificación post-run en Supabase SQL Editor
SELECT slug, version, is_active, source, byte_size, created_at
FROM public.astrodorado_report_templates
WHERE slug = 'evento-vehiculo';
-- Esperado: 1 fila con version=1, is_active=true, source='puppeteer_render'
```
