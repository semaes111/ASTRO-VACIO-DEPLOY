/**
 * Tabla de los 27 nakshatras (lunar mansions) de la astrología védica.
 * Fuente: tradición Jyotish clásica (Brihat Parashara Hora Shastra + comentarios modernos).
 *
 * Cada nakshatra tiene propiedades que influyen en la personalidad del nativo
 * (cuando la Luna natal cae dentro): símbolo, deidad, animal sagrado (yoni),
 * clase (gana), calidad (guna) y dosha ayurvédica predominante.
 */

export type Gana = 'Deva' | 'Manushya' | 'Rakshasa';
export type Guna = 'Sattva' | 'Rajas' | 'Tamas';
export type Dosha = 'Vata' | 'Pitta' | 'Kapha';
export type Varna = 'Brahmin' | 'Kshatriya' | 'Vaishya' | 'Shudra' | 'Mleccha' | 'Butcher' | 'Servant';

export interface Nakshatra {
  index: number;
  name: string;
  symbol: string;
  deity: string;
  dasha_lord: string;
  gana: Gana;
  yoni: string;
  varna: Varna;
  guna: Guna;
  dosha: Dosha;
  nature: 'Chara' | 'Sthira' | 'Ugra' | 'Mishra' | 'Laghu' | 'Mridu' | 'Tikshna';
  direction: 'Norte' | 'Sur' | 'Este' | 'Oeste';
  short_description_es: string;
}

export const NAKSHATRAS: Nakshatra[] = [
  {
    index: 0, name: 'Ashwini', symbol: 'Cabeza de caballo', deity: 'Ashwini Kumaras (médicos celestiales)',
    dasha_lord: 'Ketu', gana: 'Deva', yoni: 'Caballo masculino', varna: 'Vaishya', guna: 'Rajas', dosha: 'Vata',
    nature: 'Laghu', direction: 'Sur',
    short_description_es: 'Velocidad, curación, pionerismo. El inicio cósmico.',
  },
  {
    index: 1, name: 'Bharani', symbol: 'Yoni (órgano femenino), elefante', deity: 'Yama (señor de la muerte)',
    dasha_lord: 'Venus', gana: 'Manushya', yoni: 'Elefante masculino', varna: 'Mleccha', guna: 'Rajas', dosha: 'Pitta',
    nature: 'Ugra', direction: 'Oeste',
    short_description_es: 'Transformación profunda, pasión, gestación.',
  },
  {
    index: 2, name: 'Krittika', symbol: 'Cuchilla, llama', deity: 'Agni (fuego)',
    dasha_lord: 'Sun', gana: 'Rakshasa', yoni: 'Oveja hembra', varna: 'Brahmin', guna: 'Rajas', dosha: 'Kapha',
    nature: 'Mishra', direction: 'Norte',
    short_description_es: 'Agudeza, purificación por el fuego, corte de ilusiones.',
  },
  {
    index: 3, name: 'Rohini', symbol: 'Carro tirado por bueyes', deity: 'Brahma (creador)',
    dasha_lord: 'Moon', gana: 'Manushya', yoni: 'Serpiente masculina', varna: 'Shudra', guna: 'Rajas', dosha: 'Kapha',
    nature: 'Sthira', direction: 'Este',
    short_description_es: 'Fertilidad, belleza, abundancia material.',
  },
  {
    index: 4, name: 'Mrigashira', symbol: 'Cabeza de ciervo', deity: 'Soma (luna)',
    dasha_lord: 'Mars', gana: 'Deva', yoni: 'Serpiente femenina', varna: 'Servant', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Mridu', direction: 'Sur',
    short_description_es: 'Búsqueda, curiosidad, naturaleza gentil.',
  },
  {
    index: 5, name: 'Ardra', symbol: 'Gota de rocío, lágrima, diamante', deity: 'Rudra (forma tormentosa de Shiva)',
    dasha_lord: 'Rahu', gana: 'Manushya', yoni: 'Perra', varna: 'Butcher', guna: 'Tamas', dosha: 'Vata',
    nature: 'Tikshna', direction: 'Oeste',
    short_description_es: 'Tormentas internas, renovación tras la crisis.',
  },
  {
    index: 6, name: 'Punarvasu', symbol: 'Aljaba de flechas, arco', deity: 'Aditi (madre cósmica)',
    dasha_lord: 'Jupiter', gana: 'Deva', yoni: 'Gata', varna: 'Vaishya', guna: 'Sattva', dosha: 'Vata',
    nature: 'Chara', direction: 'Norte',
    short_description_es: 'Renovación, regreso a la luz, abundancia filosófica.',
  },
  {
    index: 7, name: 'Pushya', symbol: 'Ubre de vaca, flor de loto', deity: 'Brihaspati (guru de los dioses)',
    dasha_lord: 'Saturn', gana: 'Deva', yoni: 'Carnero', varna: 'Kshatriya', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Laghu', direction: 'Este',
    short_description_es: 'Nutrición espiritual, bendición, el nakshatra más auspicioso.',
  },
  {
    index: 8, name: 'Ashlesha', symbol: 'Serpiente enroscada', deity: 'Naga (deidades serpiente)',
    dasha_lord: 'Mercury', gana: 'Rakshasa', yoni: 'Gato masculino', varna: 'Mleccha', guna: 'Sattva', dosha: 'Kapha',
    nature: 'Tikshna', direction: 'Sur',
    short_description_es: 'Misterio, hipnotismo, poder oculto.',
  },
  {
    index: 9, name: 'Magha', symbol: 'Trono real', deity: 'Pitris (ancestros)',
    dasha_lord: 'Ketu', gana: 'Rakshasa', yoni: 'Rata masculina', varna: 'Shudra', guna: 'Tamas', dosha: 'Kapha',
    nature: 'Ugra', direction: 'Oeste',
    short_description_es: 'Linaje, herencia ancestral, liderazgo.',
  },
  {
    index: 10, name: 'Purva Phalguni', symbol: 'Cama frontal (lujo)', deity: 'Bhaga (deidad de la fortuna)',
    dasha_lord: 'Venus', gana: 'Manushya', yoni: 'Rata femenina', varna: 'Brahmin', guna: 'Rajas', dosha: 'Pitta',
    nature: 'Ugra', direction: 'Norte',
    short_description_es: 'Placer, descanso, creatividad romántica.',
  },
  {
    index: 11, name: 'Uttara Phalguni', symbol: 'Cama trasera (matrimonial)', deity: 'Aryaman (contratos)',
    dasha_lord: 'Sun', gana: 'Manushya', yoni: 'Toro', varna: 'Kshatriya', guna: 'Rajas', dosha: 'Pitta',
    nature: 'Sthira', direction: 'Este',
    short_description_es: 'Compromiso, alianzas sagradas, benevolencia.',
  },
  {
    index: 12, name: 'Hasta', symbol: 'Mano abierta', deity: 'Savitar (sol radiante)',
    dasha_lord: 'Moon', gana: 'Deva', yoni: 'Búfala', varna: 'Vaishya', guna: 'Rajas', dosha: 'Vata',
    nature: 'Laghu', direction: 'Sur',
    short_description_es: 'Maestría manual, sanación, manifestación.',
  },
  {
    index: 13, name: 'Chitra', symbol: 'Joya brillante', deity: 'Vishvakarma (arquitecto divino)',
    dasha_lord: 'Mars', gana: 'Rakshasa', yoni: 'Tigre hembra', varna: 'Servant', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Mridu', direction: 'Oeste',
    short_description_es: 'Brillo artístico, construcción, atracción magnética.',
  },
  {
    index: 14, name: 'Swati', symbol: 'Brote joven movido por el viento', deity: 'Vayu (viento)',
    dasha_lord: 'Rahu', gana: 'Deva', yoni: 'Búfalo', varna: 'Butcher', guna: 'Tamas', dosha: 'Kapha',
    nature: 'Chara', direction: 'Norte',
    short_description_es: 'Independencia, diplomacia, movimiento propio.',
  },
  {
    index: 15, name: 'Vishakha', symbol: 'Arco triunfal, raíz ramificada', deity: 'Indra-Agni (dúo de poder)',
    dasha_lord: 'Jupiter', gana: 'Rakshasa', yoni: 'Tigre masculino', varna: 'Mleccha', guna: 'Sattva', dosha: 'Kapha',
    nature: 'Mishra', direction: 'Este',
    short_description_es: 'Determinación, enfoque dual, ambición.',
  },
  {
    index: 16, name: 'Anuradha', symbol: 'Flor de loto triunfal', deity: 'Mitra (amistad)',
    dasha_lord: 'Saturn', gana: 'Deva', yoni: 'Cierva', varna: 'Shudra', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Mridu', direction: 'Sur',
    short_description_es: 'Amistad devota, cooperación, éxito colectivo.',
  },
  {
    index: 17, name: 'Jyeshtha', symbol: 'Paraguas real, pendiente', deity: 'Indra (rey de los dioses)',
    dasha_lord: 'Mercury', gana: 'Rakshasa', yoni: 'Ciervo', varna: 'Servant', guna: 'Sattva', dosha: 'Vata',
    nature: 'Tikshna', direction: 'Oeste',
    short_description_es: 'Senioridad, responsabilidad, poder oculto.',
  },
  {
    index: 18, name: 'Mula', symbol: 'Raíz, manojo de raíces atadas', deity: 'Nirriti (diosa de la destrucción)',
    dasha_lord: 'Ketu', gana: 'Rakshasa', yoni: 'Perro masculino', varna: 'Butcher', guna: 'Tamas', dosha: 'Vata',
    nature: 'Tikshna', direction: 'Norte',
    short_description_es: 'Raíces profundas, búsqueda de la verdad última, desapego.',
  },
  {
    index: 19, name: 'Purva Ashadha', symbol: 'Abanico, colmillo de elefante', deity: 'Apas (diosas del agua)',
    dasha_lord: 'Venus', gana: 'Manushya', yoni: 'Mono', varna: 'Brahmin', guna: 'Rajas', dosha: 'Pitta',
    nature: 'Ugra', direction: 'Este',
    short_description_es: 'Invencibilidad, optimismo, fluidez del agua.',
  },
  {
    index: 20, name: 'Uttara Ashadha', symbol: 'Trono de elefante', deity: 'Vishvedevas (los diez dioses universales)',
    dasha_lord: 'Sun', gana: 'Manushya', yoni: 'Mangosta', varna: 'Kshatriya', guna: 'Sattva', dosha: 'Kapha',
    nature: 'Sthira', direction: 'Sur',
    short_description_es: 'Victoria final, ética, principios universales.',
  },
  {
    index: 21, name: 'Shravana', symbol: 'Oreja, tres huellas de Vishnu', deity: 'Vishnu (preservador)',
    dasha_lord: 'Moon', gana: 'Deva', yoni: 'Mona', varna: 'Mleccha', guna: 'Rajas', dosha: 'Kapha',
    nature: 'Chara', direction: 'Oeste',
    short_description_es: 'Aprendizaje por la escucha, tradición, conservación.',
  },
  {
    index: 22, name: 'Dhanishta', symbol: 'Tambor (mridangam), flauta', deity: 'Los ocho Vasus (deidades de la luz)',
    dasha_lord: 'Mars', gana: 'Rakshasa', yoni: 'Leona', varna: 'Shudra', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Chara', direction: 'Norte',
    short_description_es: 'Ritmo, música, riqueza compartida.',
  },
  {
    index: 23, name: 'Shatabhisha', symbol: 'Círculo vacío, las 100 estrellas sanadoras', deity: 'Varuna (océano cósmico)',
    dasha_lord: 'Rahu', gana: 'Rakshasa', yoni: 'Caballo femenino', varna: 'Butcher', guna: 'Tamas', dosha: 'Vata',
    nature: 'Chara', direction: 'Este',
    short_description_es: 'Curación misteriosa, soledad, investigación profunda.',
  },
  {
    index: 24, name: 'Purva Bhadrapada', symbol: 'Dos caras, espada', deity: 'Aja Ekapada (la unicornio de un pie)',
    dasha_lord: 'Jupiter', gana: 'Manushya', yoni: 'León masculino', varna: 'Brahmin', guna: 'Sattva', dosha: 'Vata',
    nature: 'Ugra', direction: 'Sur',
    short_description_es: 'Ascetismo, visión dual, idealismo incendiario.',
  },
  {
    index: 25, name: 'Uttara Bhadrapada', symbol: 'Dos caras traseras, serpiente del mar', deity: 'Ahirbudhnya (serpiente de las profundidades)',
    dasha_lord: 'Saturn', gana: 'Manushya', yoni: 'Vaca', varna: 'Kshatriya', guna: 'Tamas', dosha: 'Pitta',
    nature: 'Sthira', direction: 'Oeste',
    short_description_es: 'Profundidad oceánica, sabiduría arcaica, compasión.',
  },
  {
    index: 26, name: 'Revati', symbol: 'Pez, tambor (damaru)', deity: 'Pushan (nutrición del viajero)',
    dasha_lord: 'Mercury', gana: 'Deva', yoni: 'Elefante femenino', varna: 'Shudra', guna: 'Sattva', dosha: 'Kapha',
    nature: 'Mridu', direction: 'Norte',
    short_description_es: 'Culminación, nutrición, el regreso al océano cósmico.',
  },
];

export function getNakshatraByIndex(index: number): Nakshatra {
  if (index < 0 || index > 26) throw new Error(`Nakshatra index fuera de rango: ${index}`);
  // Validado arriba, el acceso es seguro
  return NAKSHATRAS[index]!;
}
