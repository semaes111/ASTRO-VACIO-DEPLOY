/**
 * Queries centralizadas del dominio AstroDorado.
 *
 * REGLA: todas las queries viven aquí, nunca inline en componentes.
 * REGLA: usar columnas explícitas en .select(), nunca select('*').
 * REGLA: queries paralelas con Promise.all cuando no hay dependencias.
 *
 * Schema: astrodorado (aislado del resto del ecosistema NextHorizont).
 */

import { createPublicClient } from '@/lib/supabase/public';
import type {
  CurrentHoroscope,
  ZodiacSign,
  ZodiacSlug,
  DailyReading,
  SiteSettingsMap,
  SiteSettingKey,
} from '@/lib/types/astrodorado';

// ---------------------------------------------------------------------
// getZodiacSigns — catálogo completo para generateStaticParams y landing
// ---------------------------------------------------------------------
export async function getZodiacSigns(): Promise<ZodiacSign[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('astrodorado_zodiac_signs')
    .select(
      'id, slug, name_es, name_en, ruling_planet, element, modality, date_start, date_end, image_url, hex_primary, seo_description, created_at',
    )
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`getZodiacSigns: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------
// getZodiacBySlug — para la página /[sign]
// ---------------------------------------------------------------------
export async function getZodiacBySlug(slug: ZodiacSlug): Promise<ZodiacSign | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('astrodorado_zodiac_signs')
    .select(
      'id, slug, name_es, name_en, ruling_planet, element, modality, date_start, date_end, image_url, hex_primary, seo_description, created_at',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`getZodiacBySlug(${slug}): ${error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------
// getCurrentHoroscopes — vista agregada para la home (12 filas)
// Usa la vista 'current_horoscopes' que hace JOIN zodiac_signs + daily_readings
// ---------------------------------------------------------------------
export async function getCurrentHoroscopes(): Promise<CurrentHoroscope[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('astrodorado_current_horoscopes')
    .select(
      'sign_id, slug, name_es, name_en, ruling_planet, element, modality, hex_primary, image_url, seo_description, date_start, date_end, reading_id, reading_date, energy_general, advice, featured_area, dominant_planet, compatibility, costar_phrase, vip_reading, nivel_amor, nivel_fortuna, nivel_salud, nivel_trabajo, nivel_energia, lucky_number, lucky_color, reading_created_at',
    )
    .order('sign_id', { ascending: true });

  if (error) {
    throw new Error(`getCurrentHoroscopes: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------
// getReadingBySignAndDate — horóscopo específico
// Usa los nombres de columna REALES: sign (text) + date
// ---------------------------------------------------------------------
export async function getReadingBySignAndDate(
  sign: ZodiacSlug,
  date: string = new Date().toISOString().split('T')[0]!,
): Promise<DailyReading | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('astrodorado_daily_readings')
    .select(
      'id, date, sign, energy_general, featured_area, advice, dominant_planet, compatibility, costar_phrase, vip_reading, created_at, nivel_amor, nivel_fortuna, nivel_salud, nivel_trabajo, nivel_energia, lucky_number, lucky_color, model_used, tokens_in, tokens_out, generation_cost_usd',
    )
    .eq('sign', sign)
    .eq('date', date)
    .maybeSingle();

  if (error) {
    throw new Error(`getReadingBySignAndDate(${sign},${date}): ${error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------
// getPublicSetting — setting pública tipada por clave
// ---------------------------------------------------------------------
export async function getPublicSetting<K extends SiteSettingKey>(
  key: K,
): Promise<SiteSettingsMap[K] | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('astrodorado_site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`getPublicSetting(${key}): ${error.message}`);
  }
  if (!data) return null;
  return data.value as SiteSettingsMap[K];
}

// ---------------------------------------------------------------------
// getLandingData — bundler paralelo para la home
// ---------------------------------------------------------------------
export async function getLandingData(): Promise<{
  horoscopes: CurrentHoroscope[];
  hero: SiteSettingsMap['hero_cta'] | null;
  pricing: SiteSettingsMap['vip_pricing'] | null;
  telegramBot: SiteSettingsMap['telegram_bot_url'] | null;
  tagline: SiteSettingsMap['site_tagline'] | null;
}> {
  const [horoscopes, hero, pricing, telegramBot, tagline] = await Promise.all([
    getCurrentHoroscopes(),
    getPublicSetting('hero_cta'),
    getPublicSetting('vip_pricing'),
    getPublicSetting('telegram_bot_url'),
    getPublicSetting('site_tagline'),
  ]);

  return { horoscopes, hero, pricing, telegramBot, tagline };
}

/**
 * RLS aplicadas (migraciones ya ejecutadas):
 * - zodiac_signs:    lectura pública (policy zodiac_public_read)
 * - daily_readings:  RLS habilitado — policies existentes del proyecto
 * - telegram_subscribers: sin policies públicas, solo service_role
 * - site_settings:   lectura pública solo si value->>'public' = 'true'
 * - payment_events:  sin policies públicas, solo service_role
 */
