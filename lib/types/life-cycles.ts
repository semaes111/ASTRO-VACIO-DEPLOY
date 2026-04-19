// Tipos para los 5 ciclos AMORC (calc_amorc_cycles RPC)
// Basado en "El Dominio del Destino" de H. Spencer Lewis (AMORC, 1929)

export type LifeCyclePeriod = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type LifeCycleLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type AlmaPolaridad = 'A' | 'B';

export interface CicloVida {
  periodo: LifeCyclePeriod;
  dias_en_periodo: number;
  dias_restantes: number;
  progreso_pct: number;
}

export interface CicloNegocios {
  periodo: LifeCyclePeriod;
  dias_en_periodo: number;
  dias_restantes: number;
}

export interface CicloSalud {
  periodo: LifeCyclePeriod;
  dias_en_periodo: number;
  dias_restantes: number;
}

export interface CicloDiario {
  letra: LifeCycleLetter;
  horas_desde_nacimiento: number;
}

export interface CicloAlma {
  periodo: LifeCyclePeriod;
  polaridad: AlmaPolaridad;
  nombre: string;
}

export interface AmorcCyclesSnapshot {
  calculated_at: string;
  birth_date: string;
  birth_time: string;
  target_date: string;
  ciclo_vida: CicloVida;
  ciclo_negocios: CicloNegocios;
  ciclo_salud: CicloSalud;
  ciclo_diario: CicloDiario;
  ciclo_alma: CicloAlma;
  n_inicial: number;
  desplazamiento: number;
  dias_transcurridos_desde_aniversario: number;
}

// Descripciones humanas de los 7 periodos de Vida
export const PERIODOS_VIDA: Record<LifeCyclePeriod, { titulo: string; desc: string; relaciones: string }> = {
  1: { titulo: 'Expansión Personal', desc: 'Nuevos comienzos, iniciativas y desarrollo de proyectos personales. Energía ascendente.', relaciones: 'Excelente momento para conocer gente nueva. Magnetismo personal elevado. En pareja: renovación de la pasión.' },
  2: { titulo: 'Consolidación',      desc: 'Estabilidad, construcción sobre bases sólidas. Evitar cambios drásticos.',           relaciones: 'Período de compromiso y profundización de vínculos. Conversaciones importantes sobre el futuro.' },
  3: { titulo: 'Expresión Creativa', desc: 'Expresión artística, comunicación y socialización. Alta creatividad.',               relaciones: 'Comunicación fluida, expresión de sentimientos. Ideal para citas románticas y alegría en pareja.' },
  4: { titulo: 'Trabajo Interno',    desc: 'Introspección, planificación y preparación. Fortalecer fundamentos.',                relaciones: 'Momento de evaluar relaciones con calma. Puede haber distanciamiento temporal necesario.' },
  5: { titulo: 'Libertad y Cambio',  desc: 'Transformaciones, viajes y experiencias nuevas. Adaptabilidad necesaria.',           relaciones: 'Cambios en relaciones. Situaciones inesperadas. Necesidad de libertad individual dentro de la pareja.' },
  6: { titulo: 'Responsabilidad',    desc: 'Asumir deberes, familia y relaciones. Balance entre dar y recibir.',                 relaciones: 'Máxima atención a familia y pareja. Resolver problemas pendientes. Matrimonio favorable.' },
  7: { titulo: 'Reflexión Profunda', desc: 'Análisis, estudio espiritual y cierre de ciclos. Preparación para nuevo inicio.',    relaciones: 'Evaluación profunda de relaciones. Posible necesidad de soledad. Cierre de ciclos afectivos.' },
};

// Descripciones del Ciclo Diario (letras A-G)
export const CICLO_DIARIO: Record<LifeCycleLetter, { titulo: string; desc: string; relaciones: string }> = {
  A: { titulo: 'Poder Mental',   desc: 'Decisiones importantes, planificación, trabajo intelectual.',                       relaciones: 'Conversaciones profundas. Resolver conflictos con lógica. Claridad mental en el corazón.' },
  B: { titulo: 'Relaciones',     desc: 'Interacciones sociales, negociaciones y encuentros.',                              relaciones: 'Período óptimo para citas, propuestas, conocer gente nueva. Alta receptividad de otros hacia ti.' },
  C: { titulo: 'Creatividad',    desc: 'Inspiración artística, comunicación y expresión.',                                 relaciones: 'Expresar amor creativamente. Sorprender a tu pareja. Comunicación fluida y encantadora.' },
  D: { titulo: 'Rutina',         desc: 'Tareas habituales, trabajo mecánico y organización.',                              relaciones: 'Asuntos prácticos de pareja. Organizar vida doméstica. No momento para declaraciones románticas.' },
  E: { titulo: 'Aventura',       desc: 'Cambios, riesgos calculados y nuevas experiencias.',                               relaciones: 'Romper rutina en pareja. Aventuras compartidas. Atracción intensa pero inestable.' },
  F: { titulo: 'Servicio',       desc: 'Ayudar a otros, responsabilidades y deberes.',                                     relaciones: 'Demostrar amor con acciones concretas. Ayudar a pareja o familia. Compromiso mutuo florece.' },
  G: { titulo: 'Introspección',  desc: 'Descanso, meditación y recarga espiritual.',                                       relaciones: 'Necesidad de espacio personal. Evitar discusiones. Soledad temporal beneficiosa.' },
};