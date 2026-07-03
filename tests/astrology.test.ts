import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNumerology, reduceNumber, karmicLessons } from '../lib/astrology/numerology';
import {
  computeChineseZodiac,
  getChineseAnimal,
  getChineseElement,
  getChinesePolarity,
} from '../lib/astrology/chinese-zodiac';

// ── Numerología: valores reales verificados contra el PDF integral de Sergio ──
test('numerología: Sergio Martínez Escobar (30/06/1973) → 11/8/11/6, Año Personal 2026 = 1', () => {
  const n = computeNumerology('Sergio Martínez Escobar', '1973-06-30', 2026);
  assert.equal(n.lifePath, 11, 'Camino de Vida');
  assert.equal(n.expression, 8, 'Expresión');
  assert.equal(n.soulUrge, 11, 'Alma');
  assert.equal(n.personality, 6, 'Personalidad');
  assert.equal(n.personalYear, 1, 'Año Personal 2026');
});

test('reduceNumber conserva maestros 11/22/33 y reduce el resto', () => {
  assert.equal(reduceNumber(29), 11);
  assert.equal(reduceNumber(47), 11);
  assert.equal(reduceNumber(107), 8);
  assert.equal(reduceNumber(60), 6);
  assert.equal(reduceNumber(22), 22);
  assert.equal(reduceNumber(33), 33);
  assert.equal(reduceNumber(4), 4);
  assert.equal(reduceNumber(22, false), 4, 'sin maestros: 22 → 4');
});

test('numerología: los acentos no alteran el cálculo (í→i, ñ→n)', () => {
  const a = computeNumerology('Sergio Martínez Escobar', '1973-06-30', 2026);
  const b = computeNumerology('Sergio Martinez Escobar', '1973-06-30', 2026);
  assert.deepEqual(a, b);
});

// ── Fase A2: los 3 números que antes inventaba el LLM (auditoría T8) ──
test('numerología A2: Sergio → sin kármicas, cuadrado rector 3, consigna (2027) = 2', () => {
  const n = computeNumerology('Sergio Martínez Escobar', '1973-06-30', 2026);
  assert.deepEqual(n.karmicLessons, [], 'nombre kármicamente completo');
  assert.equal(n.pythagoreanRuler, 3, 'dígito más frecuente en 30061973');
  assert.equal(n.pythagoreanGrid[3], 2, 'el 3 aparece 2 veces');
  assert.equal(n.pythagoreanGrid[2], 0, 'el 2 no aparece');
  assert.equal(n.nextCycleYear, 2, 'Año Personal 2027');
});

test('lecciones kármicas: un nombre con dígitos ausentes los detecta', () => {
  // "ANA" → A=1, N=5, A=1 → presentes {1,5} → ausentes {2,3,4,6,7,8,9}
  assert.deepEqual(karmicLessons('ANA'), [2, 3, 4, 6, 7, 8, 9]);
});

// ── Zodiaco chino: valores reales verificados ──
test('zodiaco chino: 1988 → Dragón / Tierra / Yang', () => {
  const z = computeChineseZodiac(1988, 7, 21);
  assert.equal(z.animal, 'Dragón');
  assert.equal(z.element, 'Tierra');
  assert.equal(z.polarity, 'Yang');
  assert.equal(z.cnyCaveat, false);
});

test('zodiaco chino: 1973 → Buey / Agua / Yin (pilar Gui-...)', () => {
  const z = computeChineseZodiac(1973, 6, 30);
  assert.equal(z.animal, 'Buey');
  assert.equal(z.element, 'Agua');
  assert.equal(z.polarity, 'Yin');
  assert.ok(z.yearPillar.startsWith('Gui'), `pilar de año: ${z.yearPillar}`);
});

test('zodiaco chino: funciones sueltas coherentes', () => {
  assert.equal(getChineseAnimal(2020), 'Rata');
  assert.equal(getChineseAnimal(2024), 'Dragón');
  assert.equal(getChineseElement(2026), 'Fuego');
  assert.equal(getChinesePolarity(2026), 'Yang');
});

test('zodiaco chino: la ventana del Año Nuevo chino activa el caveat', () => {
  assert.equal(computeChineseZodiac(1990, 1, 15).cnyCaveat, true, 'enero → caveat');
  assert.equal(computeChineseZodiac(1990, 2, 10).cnyCaveat, true, 'principios de febrero → caveat');
  assert.equal(computeChineseZodiac(1990, 6, 15).cnyCaveat, false, 'junio → sin caveat');
});
