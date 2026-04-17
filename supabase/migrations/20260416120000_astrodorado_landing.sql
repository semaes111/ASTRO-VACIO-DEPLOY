-- =====================================================================
-- Migración: 001 — AstroDorado landing + freemium core
-- Fecha: 2026-04-16
-- Autor: NextHorizont AI (Sergio / Claude)
-- Objetivo: soportar el Sprint 1 (landing pública + horóscopo diario)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Schema dedicado (aislamiento multi-tenant del portfolio)
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS astrodorado;
COMMENT ON SCHEMA astrodorado IS 'AstroDorado — vertical de astrología del portfolio NextHorizont';

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector ya está habilitado globalmente según memoria del proyecto

-- Función genérica para updated_at (si no existe aún en public)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- TABLA 1: zodiac_signs — catálogo estático (12 filas)
-- =====================================================================
CREATE TABLE astrodorado.zodiac_signs (
  id              SMALLINT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name_es         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  ruling_planet   TEXT NOT NULL,
  element         TEXT NOT NULL CHECK (element IN ('fuego','tierra','aire','agua')),
  modality        TEXT NOT NULL CHECK (modality IN ('cardinal','fijo','mutable')),
  date_start      TEXT NOT NULL, -- MM-DD sin año
  date_end        TEXT NOT NULL, -- MM-DD sin año
  image_url       TEXT NOT NULL, -- Supabase Storage URL
  hex_primary     TEXT NOT NULL CHECK (hex_primary ~ '^#[0-9A-Fa-f]{6}$'),
  seo_description TEXT NOT NULL CHECK (char_length(seo_description) BETWEEN 120 AND 160),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE astrodorado.zodiac_signs IS 'Catálogo estático de los 12 signos zodiacales — se carga por seed';
COMMENT ON COLUMN astrodorado.zodiac_signs.slug IS 'URL slug: aries, tauro, geminis, etc.';
COMMENT ON COLUMN astrodorado.zodiac_signs.seo_description IS 'Meta description por signo, 120-160 chars';

-- Índices
CREATE INDEX idx_zodiac_slug ON astrodorado.zodiac_signs(slug);

-- RLS: lectura pública, escritura solo service_role
ALTER TABLE astrodorado.zodiac_signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zodiac_public_read" ON astrodorado.zodiac_signs
  FOR SELECT
  USING (true); -- cualquiera puede leer el catálogo

-- No hay policy de INSERT/UPDATE/DELETE → solo service_role puede tocarlo

-- =====================================================================
-- TABLA 2: daily_horoscopes — horóscopos diarios por signo
-- =====================================================================
CREATE TABLE astrodorado.daily_horoscopes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sign_id             SMALLINT NOT NULL REFERENCES astrodorado.zodiac_signs(id),
  reading_date        DATE NOT NULL,

  -- Contenido generado por Claude Haiku vía n8n workflow
  energia_general     TEXT NOT NULL CHECK (char_length(energia_general) BETWEEN 40 AND 500),
  area_destacada      TEXT NOT NULL CHECK (area_destacada IN ('amor','trabajo','dinero','salud','familia','creatividad','viaje','espiritualidad')),
  consejo             TEXT NOT NULL CHECK (char_length(consejo) BETWEEN 20 AND 240),
  numero_suerte       SMALLINT NOT NULL CHECK (numero_suerte BETWEEN 1 AND 99),
  color_dia           TEXT NOT NULL,
  compatibilidad_dia  SMALLINT REFERENCES astrodorado.zodiac_signs(id),
  frase_impacto       TEXT CHECK (char_length(frase_impacto) <= 120),

  -- Indicadores 0-100 para el dashboard visual (fill-level icons)
  nivel_amor          SMALLINT NOT NULL CHECK (nivel_amor BETWEEN 0 AND 100),
  nivel_fortuna       SMALLINT NOT NULL CHECK (nivel_fortuna BETWEEN 0 AND 100),
  nivel_salud         SMALLINT NOT NULL CHECK (nivel_salud BETWEEN 0 AND 100),
  nivel_trabajo       SMALLINT NOT NULL CHECK (nivel_trabajo BETWEEN 0 AND 100),
  nivel_energia       SMALLINT NOT NULL CHECK (nivel_energia BETWEEN 0 AND 100),

  -- Metadata generación
  model_used          TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  tokens_in           INTEGER,
  tokens_out          INTEGER,
  generation_cost_usd NUMERIC(8,5),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- No duplicar horóscopos del mismo signo y fecha
  UNIQUE (sign_id, reading_date)
);

COMMENT ON TABLE astrodorado.daily_horoscopes IS
  'Horóscopo diario por signo. Generado por n8n workflow @ 05:30 UTC con Claude Haiku';

-- Índices para ISR rápido y admin analytics
CREATE INDEX idx_horoscope_sign_date ON astrodorado.daily_horoscopes(sign_id, reading_date DESC);
CREATE INDEX idx_horoscope_date_only ON astrodorado.daily_horoscopes(reading_date DESC);

-- RLS: lectura pública del horóscopo del día y pasados
ALTER TABLE astrodorado.daily_horoscopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horoscope_public_read_past_and_today" ON astrodorado.daily_horoscopes
  FOR SELECT
  USING (reading_date <= CURRENT_DATE);
-- Futuros solo accesibles con service_role (para scheduling interno)

-- =====================================================================
-- TABLA 3: telegram_subscribers — suscriptores freemium del canal
-- =====================================================================
CREATE TABLE astrodorado.telegram_subscribers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id      BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,

  -- Opcional: para personalización gratuita
  birth_date       DATE,
  sign_id          SMALLINT REFERENCES astrodorado.zodiac_signs(id),

  language_code    TEXT NOT NULL DEFAULT 'es' CHECK (language_code IN ('es','en','pt')),
  timezone         TEXT NOT NULL DEFAULT 'Europe/Madrid',

  -- Ciclo de vida
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at  TIMESTAMPTZ,
  is_active        BOOLEAN GENERATED ALWAYS AS (unsubscribed_at IS NULL) STORED,

  -- Tracking engagement (para detectar candidatos a upgrade VIP)
  last_message_sent_at TIMESTAMPTZ,
  messages_sent_count  INTEGER NOT NULL DEFAULT 0,
  messages_opened_count INTEGER NOT NULL DEFAULT 0,

  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE astrodorado.telegram_subscribers IS
  'Suscriptores del canal Telegram @Astrodorado_bot — funnel freemium';

CREATE INDEX idx_telegram_active ON astrodorado.telegram_subscribers(is_active) WHERE is_active;
CREATE INDEX idx_telegram_sign ON astrodorado.telegram_subscribers(sign_id);

CREATE TRIGGER trg_telegram_updated
  BEFORE UPDATE ON astrodorado.telegram_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: solo service_role puede acceder (datos personales)
ALTER TABLE astrodorado.telegram_subscribers ENABLE ROW LEVEL SECURITY;
-- Sin policies → solo service_role tiene acceso (bot backend)

-- =====================================================================
-- TABLA 4: site_settings — configuración editable desde admin
-- Sustituye la necesidad de "hardcodear" textos en el código
-- =====================================================================
CREATE TABLE astrodorado.site_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   UUID, -- referencia auth.users(id) cuando exista auth
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE astrodorado.site_settings IS
  'Configuración clave-valor del sitio (banners, CTAs, precios, textos legales)';

CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON astrodorado.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE astrodorado.site_settings ENABLE ROW LEVEL SECURITY;

-- Lectura pública de settings marcados como públicos
CREATE POLICY "settings_public_read" ON astrodorado.site_settings
  FOR SELECT
  USING ((value->>'public')::boolean IS TRUE);

-- =====================================================================
-- VISTA: current_horoscopes — lo que la landing consume
-- Une zodiac_signs + daily_horoscopes del día actual
-- =====================================================================
CREATE OR REPLACE VIEW astrodorado.current_horoscopes
WITH (security_invoker = true) AS
SELECT
  z.id              AS sign_id,
  z.slug,
  z.name_es,
  z.ruling_planet,
  z.element,
  z.hex_primary,
  z.image_url,
  h.id              AS horoscope_id,
  h.reading_date,
  h.energia_general,
  h.consejo,
  h.numero_suerte,
  h.color_dia,
  h.frase_impacto,
  h.nivel_amor,
  h.nivel_fortuna,
  h.nivel_salud,
  h.nivel_trabajo,
  h.nivel_energia,
  c.name_es         AS compatibilidad_name
FROM astrodorado.zodiac_signs z
LEFT JOIN astrodorado.daily_horoscopes h
  ON h.sign_id = z.id AND h.reading_date = CURRENT_DATE
LEFT JOIN astrodorado.zodiac_signs c
  ON c.id = h.compatibilidad_dia
ORDER BY z.id;

COMMENT ON VIEW astrodorado.current_horoscopes IS
  'Vista lista-para-consumo de la landing — agrega signo + horóscopo del día + compatibilidad';

-- =====================================================================
-- SEED: los 12 signos zodiacales
-- =====================================================================
INSERT INTO astrodorado.zodiac_signs
  (id, slug, name_es, name_en, ruling_planet, element, modality, date_start, date_end, image_url, hex_primary, seo_description)
VALUES
  (1,  'aries',       'Aries',       'Aries',       'Marte',   'fuego',  'cardinal', '03-21', '04-19', 'https://placeholder/aries.jpg',       '#E74C3C', 'Descubre tu horóscopo diario de Aries: energía, decisiones, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (2,  'tauro',       'Tauro',       'Taurus',      'Venus',   'tierra', 'fijo',     '04-20', '05-20', 'https://placeholder/tauro.jpg',       '#27AE60', 'Descubre tu horóscopo diario de Tauro: estabilidad, placer, finanzas y amor. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (3,  'geminis',     'Géminis',     'Gemini',      'Mercurio','aire',   'mutable',  '05-21', '06-20', 'https://placeholder/geminis.jpg',     '#F1C40F', 'Descubre tu horóscopo diario de Géminis: comunicación, ideas, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (4,  'cancer',      'Cáncer',      'Cancer',      'Luna',    'agua',   'cardinal', '06-21', '07-22', 'https://placeholder/cancer.jpg',      '#3498DB', 'Descubre tu horóscopo diario de Cáncer: emociones, hogar, familia y amor. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (5,  'leo',         'Leo',         'Leo',         'Sol',     'fuego',  'fijo',     '07-23', '08-22', 'https://placeholder/leo.jpg',         '#E67E22', 'Descubre tu horóscopo diario de Leo: liderazgo, creatividad, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (6,  'virgo',       'Virgo',       'Virgo',       'Mercurio','tierra', 'mutable',  '08-23', '09-22', 'https://placeholder/virgo.jpg',       '#16A085', 'Descubre tu horóscopo diario de Virgo: análisis, salud, trabajo y amor. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (7,  'libra',       'Libra',       'Libra',       'Venus',   'aire',   'cardinal', '09-23', '10-22', 'https://placeholder/libra.jpg',       '#E91E63', 'Descubre tu horóscopo diario de Libra: equilibrio, amor, relaciones y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (8,  'escorpio',    'Escorpio',    'Scorpio',     'Plutón',  'agua',   'fijo',     '10-23', '11-21', 'https://placeholder/escorpio.jpg',    '#8E44AD', 'Descubre tu horóscopo diario de Escorpio: transformación, pasión, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (9,  'sagitario',   'Sagitario',   'Sagittarius', 'Júpiter', 'fuego',  'mutable',  '11-22', '12-21', 'https://placeholder/sagitario.jpg',   '#D35400', 'Descubre tu horóscopo diario de Sagitario: aventura, expansión, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (10, 'capricornio', 'Capricornio', 'Capricorn',   'Saturno', 'tierra', 'cardinal', '12-22', '01-19', 'https://placeholder/capricornio.jpg', '#2C3E50', 'Descubre tu horóscopo diario de Capricornio: ambición, disciplina, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (11, 'acuario',     'Acuario',     'Aquarius',    'Urano',   'aire',   'fijo',     '01-20', '02-18', 'https://placeholder/acuario.jpg',     '#1ABC9C', 'Descubre tu horóscopo diario de Acuario: innovación, amistades, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.'),
  (12, 'piscis',      'Piscis',      'Pisces',      'Neptuno', 'agua',   'mutable',  '02-19', '03-20', 'https://placeholder/piscis.jpg',      '#34495E', 'Descubre tu horóscopo diario de Piscis: intuición, espiritualidad, amor y trabajo. Predicciones astrológicas personalizadas actualizadas cada día.')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- SEED: site_settings iniciales (estos serán editables desde admin)
-- =====================================================================
INSERT INTO astrodorado.site_settings (key, value, description) VALUES
  ('hero_cta', '{"public": true, "text": "Quiero recibir mi futuro diario personalizado", "url": "#suscripcion"}', 'CTA principal del hero'),
  ('vip_pricing', '{"public": true, "monthly_eur": 9.99, "quarterly_eur": 25, "annual_eur": 89}', 'Precios visibles de los planes VIP'),
  ('telegram_bot_url', '{"public": true, "url": "https://t.me/Astrodorado_bot"}', 'URL del bot de Telegram'),
  ('site_tagline', '{"public": true, "text": "El oráculo dorado del día que te dice exactamente qué hacer"}', 'Tagline debajo del logo')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- FIN DE LA MIGRACIÓN 001
-- =====================================================================
