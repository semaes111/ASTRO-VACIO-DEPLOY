import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSolarReturn } from '../lib/astronomy/solar-return';

const BIRTH = new Date('1973-06-30T17:45:00Z');

test('RS: el residual del cruce solar es ~0 (retorno exacto)', () => {
  const sr = computeSolarReturn(BIRTH, 2026, 36.75, -2.94);
  assert.ok(sr.residual < 0.001, `residual ${sr.residual}`);
});

test('RS: el Sol de la RS = Sol natal (definición de Revolución Solar)', () => {
  const sr = computeSolarReturn(BIRTH, 2026, 36.75, -2.94);
  const diff = Math.abs(sr.chart.sun.longitude_tropical - sr.natalSunLongitude);
  assert.ok(diff < 0.001, `Δ Sol ${diff}`);
});

test('RS: el retorno 2026 cae el 30 de junio (PDF: 30 jun 2026)', () => {
  const sr = computeSolarReturn(BIRTH, 2026, 36.75, -2.94);
  const iso = sr.moment.toISOString();
  assert.ok(iso.startsWith('2026-06-30') || iso.startsWith('2026-06-29') || iso.startsWith('2026-07-01'), `momento ${iso}`);
});

test('RS: determinista', () => {
  const a = computeSolarReturn(BIRTH, 2026, 36.75, -2.94);
  const b = computeSolarReturn(BIRTH, 2026, 36.75, -2.94);
  assert.equal(a.moment.getTime(), b.moment.getTime());
});
