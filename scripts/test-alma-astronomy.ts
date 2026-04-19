/**
 * Test de validación para lib/astronomy/planets.ts usando Alma Suárez.
 * Ejecutar con: npx tsx scripts/test-alma-astronomy.ts
 *
 * Alma Suárez: 1985-03-15 07:30 local (UTC+1) en Madrid (40.4168, -3.7038)
 * → UTC: 1985-03-15 06:30
 */

import { computeNatalChart, ayanamsaLahiri } from '../lib/astronomy/planets';

const almaBirth = new Date('1985-03-15T06:30:00Z');
const madridLat = 40.4168;
const madridLon = -3.7038;

console.log('=== TEST: Carta natal de Alma Suárez ===');
console.log(`Fecha UTC: ${almaBirth.toISOString()}`);
console.log(`Madrid: ${madridLat}°N, ${madridLon}°E`);
console.log('');

const ayan = ayanamsaLahiri(almaBirth);
console.log(`Ayanamsa Lahiri: ${ayan.toFixed(4)}° (esperado ~23.65°)`);
console.log('');

const chart = computeNatalChart(almaBirth, madridLat, madridLon);

console.log('Sol:');
console.log(`  Tropical:  ${chart.sun.longitude_tropical.toFixed(2)}° → ${chart.sun.sign_tropical} ${chart.sun.degree_in_sign_tropical.toFixed(2)}°`);
console.log(`  Sidereo:   ${chart.sun.longitude_sidereal.toFixed(2)}° → ${chart.sun.sign_sidereal} ${chart.sun.degree_in_sign_sidereal.toFixed(2)}°`);
console.log(`  Esperado tropical: piscis ~24-25° (15-marzo)`);
console.log(`  Esperado sidereo:  acuario ~0-1° (tras restar ayanamsa)`);
console.log('');

console.log('Luna:');
console.log(`  Tropical:  ${chart.moon.longitude_tropical.toFixed(2)}° → ${chart.moon.sign_tropical} ${chart.moon.degree_in_sign_tropical.toFixed(2)}°`);
console.log(`  Sidereo:   ${chart.moon.longitude_sidereal.toFixed(2)}° → ${chart.moon.sign_sidereal} ${chart.moon.degree_in_sign_sidereal.toFixed(2)}°`);
console.log(`  Nakshatra: ${chart.moon.nakshatra.index} ${chart.moon.nakshatra.name} pada ${chart.moon.nakshatra.pada}`);
console.log(`  Dasha lord natal: ${chart.moon.nakshatra.dasha_lord}`);
console.log(`  Grados dentro del nakshatra: ${chart.moon.nakshatra.degree_within.toFixed(2)}°`);
console.log('');

console.log(`Mercurio: ${chart.mercury.sign_sidereal} ${chart.mercury.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Venus:    ${chart.venus.sign_sidereal} ${chart.venus.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Marte:    ${chart.mars.sign_sidereal} ${chart.mars.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Jupiter:  ${chart.jupiter.sign_sidereal} ${chart.jupiter.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Saturno:  ${chart.saturn.sign_sidereal} ${chart.saturn.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Rahu:     ${chart.rahu.sign_sidereal} ${chart.rahu.degree_in_sign_sidereal.toFixed(2)}° (sid)`);
console.log(`Ketu:     ${chart.ketu.sign_sidereal} ${chart.ketu.degree_in_sign_sidereal.toFixed(2)}° (sid)`);

if (chart.ascendant) {
  console.log('');
  console.log(`Ascendente tropical: ${chart.ascendant.sign_tropical} ${chart.ascendant.degree_in_sign_tropical.toFixed(2)}°`);
  console.log(`Ascendente sidereo:  ${chart.ascendant.sign_sidereal} ${chart.ascendant.degree_in_sign_sidereal.toFixed(2)}°`);
}

console.log('');
console.log('=== VALIDACIONES ===');
const sunTropOk = chart.sun.longitude_tropical > 350 && chart.sun.longitude_tropical < 360;
const sunSidOk = chart.sun.longitude_sidereal > 325 && chart.sun.longitude_sidereal < 340;
const ayanOk = ayan > 23.4 && ayan < 23.9;

console.log(sunTropOk ? '[OK]' : '[FAIL]', 'Sol tropical entre 350-360° (Piscis final)');
console.log(sunSidOk ? '[OK]' : '[FAIL]', 'Sol sidereo entre 325-340° (Acuario)');
console.log(ayanOk ? '[OK]' : '[FAIL]', 'Ayanamsa entre 23.4-23.9°');

if (sunTropOk && sunSidOk && ayanOk) {
  console.log('');
  console.log('D1.A OK: astronomy module operativo.');
  process.exit(0);
} else {
  console.log('');
  console.log('D1.A FAIL: revisar formulas.');
  process.exit(1);
}
