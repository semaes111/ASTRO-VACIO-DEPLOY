/**
 * Tipos centralizados del dominio AstroDorado.
 *
 * ⚠️ IMPORTANTE: estos tipos reflejan el schema REAL ya existente en Supabase,
 * no una versión ideal. Los nombres están en inglés para coincidir con la
 * estructura original (daily_readings, energy_general, advice, etc.) y se
 * han añadido los campos nivel_* aditivamente.
 *
 * REGLAS: nunca definir tipos inline, nunca usar 'any'.
 */

export type ZodiacSlug =
  | 'aries' | 'tauro' | 'geminis' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'escorpio' | 'sagitario' | 'capricornio' | 'acuario' | 'piscis';

export type ZodiacElement = 'fuego' | 'tierra' | 'aire' | 'agua';
export type ZodiacModality = 'cardinal' | 'fijo' | 'mutable';

// CHECK constraint real en daily_readings.featured_area
export type FeaturedArea =
  | 'amor' | 'trabajo' | 'salud' | 'dinero' | 'creatividad' | 'espiritualidad';

export type SubscriptionStatus = 'free' | 'vip' | 'cancelled';
export type LanguageCode = 'es' | 'en' | 'pt';

// Tabla astrodorado.zodiac_signs (NUEVA)
export interface ZodiacSign {
  id: number;
  slug: ZodiacSlug;
  name_es: string;
  name_en: string;
  ruling_planet: string;
  element: ZodiacElement;
  modality: ZodiacModality;
  date_start: string;
  date_end: string;
  image_url: string;
  hex_primary: string;
  seo_description: string;
  created_at: string;
}

// Tabla astrodorado.daily_readings (EXISTENTE + columnas nuevas nullable)
export interface DailyReading {
  id: string;
  date: string;
  sign: ZodiacSlug;
  energy_general: string;
  featured_area: FeaturedArea | null;
  advice: string;
  dominant_planet: string | null;
  compatibility: string | null;
  costar_phrase: string;
  vip_reading: string | null;
  created_at: string;
  nivel_amor: number | null;
  nivel_fortuna: number | null;
  nivel_salud: number | null;
  nivel_trabajo: number | null;
  nivel_energia: number | null;
  lucky_number: number | null;
  lucky_color: string | null;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  generation_cost_usd: number | null;
}

// Vista astrodorado.current_horoscopes (JOIN zodiac + daily de hoy)
export interface CurrentHoroscope {
  sign_id: number;
  slug: ZodiacSlug;
  name_es: string;
  name_en: string;
  ruling_planet: string;
  element: ZodiacElement;
  modality: ZodiacModality;
  hex_primary: string;
  image_url: string;
  seo_description: string;
  date_start: string;
  date_end: string;
  reading_id: string | null;
  reading_date: string | null;
  energy_general: string | null;
  advice: string | null;
  featured_area: FeaturedArea | null;
  dominant_planet: string | null;
  compatibility: string | null;
  costar_phrase: string | null;
  vip_reading: string | null;
  nivel_amor: number | null;
  nivel_fortuna: number | null;
  nivel_salud: number | null;
  nivel_trabajo: number | null;
  nivel_energia: number | null;
  lucky_number: number | null;
  lucky_color: string | null;
  reading_created_at: string | null;
}

// Tabla astrodorado.users (EXISTENTE, no tocada)
export interface AstroUser {
  id: string;
  email: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  sun_sign: ZodiacSlug | null;
  moon_sign: ZodiacSlug | null;
  rising_sign: ZodiacSlug | null;
  natal_chart_json: Record<string, unknown> | null;
  telegram_user_id: number | null;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  created_at: string;
}

// Tabla astrodorado.subscriptions (EXISTENTE, no tocada)
export interface AstroSubscription {
  id: string;
  user_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  price_eur: number;
  created_at: string;
}

// Tabla astrodorado.telegram_subscribers (NUEVA)
export interface TelegramSubscriber {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  birth_date: string | null;
  sign: ZodiacSlug | null;
  language_code: LanguageCode;
  timezone: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  is_active: boolean;
  last_message_sent_at: string | null;
  messages_sent_count: number;
  messages_opened_count: number;
  updated_at: string;
}

// Tabla astrodorado.site_settings (NUEVA)
export interface SiteSettingBase { public?: boolean }
export interface HeroCtaSetting extends SiteSettingBase { text: string; url: string }
export interface VipPricingSetting extends SiteSettingBase {
  monthly_eur: number;
  quarterly_eur: number;
  annual_eur: number;
}
export interface TelegramBotSetting extends SiteSettingBase { url: string }
export interface SiteTaglineSetting extends SiteSettingBase { text: string }

export interface SiteSettingsMap {
  hero_cta: HeroCtaSetting;
  vip_pricing: VipPricingSetting;
  telegram_bot_url: TelegramBotSetting;
  site_tagline: SiteTaglineSetting;
}
export type SiteSettingKey = keyof SiteSettingsMap;

// Tabla astrodorado.payment_events (NUEVA)
export interface PaymentEvent {
  id: string;
  stripe_event_id: string;
  stripe_event_type: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string | null;
  amount_eur: number | null;
  status: string | null;
  payload: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
}
