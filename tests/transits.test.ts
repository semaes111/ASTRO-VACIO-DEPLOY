import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTransits } from '../lib/astronomy/transits';

// Sergio: 30 jun 1973, 18:45 CET (17:45 UTC), Berja
const BIRTH = new Date('1973-06-30T17:45:00Z');
const FROM = new Date('2026-06-30T00:00:00Z');
const TO = new Date('2027-06-30T00:00:00Z');

test('tránsitos: ventana de Sergio 2026-2027 → lista no vacía, ordenada, orbe ≤ 1°', () => {
  const tr = computeTransits(BIRTH, FROM, TO);
  assert.ok(tr.length > 0, 'debe encontrar contactos');
  for (const c of tr) {
    assert.ok(c.orb <= 1.0, `orbe ${c.orb} de ${c.transiting} ${c.aspect} ${c.natalPoint}`);
    assert.ok(c.date >= '2026-06-30' && c.date <= '2027-06-30', `fecha ${c.date} en ventana`);
  }
  // ordenada por fecha
  for (let i = 1; i < tr.length; i++) {
    assert.ok(tr[i]!.date >= tr[i - 1]!.date, 'orden cronológico');
  }
});

test('tránsitos: determinista (misma entrada → misma salida)', () => {
  const a = computeTransits(BIRTH, FROM, TO);
  const b = computeTransits(BIRTH, FROM, TO);
  assert.deepEqual(a, b);
});

test('tránsitos: encuentra Júpiter oposición Júpiter natal en ago 2026 (PDF: 17 ago)', () => {
  const tr = computeTransits(BIRTH, FROM, TO);
  const jj = tr.find(
    (c) => c.transiting === 'Júpiter' && c.natalPoint === 'Júpiter' && c.aspect === 'Oposición',
  );
  assert.ok(jj, 'debe existir Júpiter ☍ Júpiter natal');
  assert.ok(jj!.date.startsWith('2026-0'), `fecha ${jj!.date} en 2026 (PDF: 17 ago 2026)`);
});
