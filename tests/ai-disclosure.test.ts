import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAiDisclosure } from '../lib/generators/_shared/ai-disclosure';

test('aviso IA: se inserta antes de </body> y cita el Reglamento', () => {
  const out = withAiDisclosure('<html><body><h1>Informe</h1></body></html>');
  assert.ok(out.includes('astrodorado-ai-disclosure'), 'marcador presente');
  assert.ok(out.includes('Reglamento (UE) 2024/1689'), 'cita el reglamento');
  assert.ok(out.includes('inteligencia artificial'), 'menciona IA');
  assert.ok(out.indexOf('astrodorado-ai-disclosure') < out.indexOf('</body>'), 'antes de </body>');
});

test('aviso IA: idempotente (no se duplica al reprocesar)', () => {
  const once = withAiDisclosure('<body>x</body>');
  const twice = withAiDisclosure(once);
  assert.equal(once, twice);
  assert.equal((twice.match(/astrodorado-ai-disclosure/g) || []).length, 1);
});

test('aviso IA: si no hay </body>, se añade al final', () => {
  const out = withAiDisclosure('<div>informe suelto</div>');
  assert.ok(out.includes('astrodorado-ai-disclosure'));
});

test('aviso IA: html vacío se devuelve intacto', () => {
  assert.equal(withAiDisclosure(''), '');
});
