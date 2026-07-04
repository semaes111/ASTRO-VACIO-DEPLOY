import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIChing } from '../lib/astrology/iching';

test('I Ching: determinista (misma entrada → mismo hexagrama)', () => {
  const a = computeIChing('Sergio Martínez Escobar', '1973-06-30');
  const b = computeIChing('Sergio Martínez Escobar', '1973-06-30');
  assert.deepEqual(a, b);
});

test('I Ching: hexagrama en rango King Wen 1-64 y línea cambiante 1-6', () => {
  const r = computeIChing('Sergio Martínez Escobar', '1973-06-30');
  assert.ok(r.number >= 1 && r.number <= 64, `number ${r.number}`);
  assert.ok(r.changingLine >= 1 && r.changingLine <= 6, `linea ${r.changingLine}`);
  assert.ok(r.name.length > 0 && r.upperTrigram.length > 0 && r.lowerTrigram.length > 0);
});

test('I Ching: entradas distintas resuelven a hexagramas válidos', () => {
  const a = computeIChing('Ana Lopez', '1990-01-01');
  const b = computeIChing('Beto Perez', '1985-12-12');
  assert.ok(a.number >= 1 && a.number <= 64);
  assert.ok(b.number >= 1 && b.number <= 64);
});

test('I Ching: normaliza espacios, mayúsculas y ACENTOS (mismo hexagrama)', () => {
  const a = computeIChing('  Sergio Martínez Escobar  ', '1973-06-30');
  const b = computeIChing('sergio martinez escobar', '1973-06-30');
  assert.deepEqual(a, b);
});
