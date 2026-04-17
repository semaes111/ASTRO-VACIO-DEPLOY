-- =====================================================================
-- Tests de integridad: migración 001 astrodorado_landing
-- Ejecutar DESPUÉS de aplicar la migración
-- Cada assertion debe devolver 'PASS'; cualquier otra cosa = FAIL
-- =====================================================================

-- Test 1: schema existe
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'astrodorado')
  THEN 'PASS: schema astrodorado exists'
  ELSE 'FAIL: schema astrodorado missing'
END AS test_1_schema;

-- Test 2: las 4 tablas existen
SELECT CASE
  WHEN (SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'astrodorado'
          AND table_name IN ('zodiac_signs','daily_horoscopes','telegram_subscribers','site_settings')) = 4
  THEN 'PASS: 4 core tables exist'
  ELSE 'FAIL: missing core tables'
END AS test_2_tables;

-- Test 3: seed de 12 signos cargado
SELECT CASE
  WHEN (SELECT count(*) FROM astrodorado.zodiac_signs) = 12
  THEN 'PASS: 12 zodiac signs seeded'
  ELSE 'FAIL: expected 12 zodiac signs, found ' || (SELECT count(*) FROM astrodorado.zodiac_signs)::TEXT
END AS test_3_seed;

-- Test 4: RLS activo en todas las tablas
SELECT CASE
  WHEN (SELECT count(*) FROM pg_tables
        WHERE schemaname = 'astrodorado'
          AND tablename IN ('zodiac_signs','daily_horoscopes','telegram_subscribers','site_settings')
          AND rowsecurity = true) = 4
  THEN 'PASS: RLS enabled on 4 tables'
  ELSE 'FAIL: RLS missing on some tables'
END AS test_4_rls;

-- Test 5: constraint de check en area_destacada impide basura
DO $$
BEGIN
  BEGIN
    INSERT INTO astrodorado.daily_horoscopes
      (sign_id, reading_date, energia_general, area_destacada, consejo, numero_suerte, color_dia,
       nivel_amor, nivel_fortuna, nivel_salud, nivel_trabajo, nivel_energia)
    VALUES
      (1, CURRENT_DATE, 'test energia general con minimo de 40 caracteres aqui', 'invalid_area', 'test consejo', 42, 'rojo', 50, 50, 50, 50, 50);
    RAISE EXCEPTION 'FAIL: check constraint on area_destacada did NOT fire';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: check constraint on area_destacada works';
  END;
END $$;

-- Test 6: no se pueden insertar dos horóscopos para el mismo signo+fecha
DO $$
BEGIN
  BEGIN
    INSERT INTO astrodorado.daily_horoscopes
      (sign_id, reading_date, energia_general, area_destacada, consejo, numero_suerte, color_dia,
       nivel_amor, nivel_fortuna, nivel_salud, nivel_trabajo, nivel_energia)
    VALUES
      (1, '2026-01-01', 'Energia test 1 con los minimos caracteres requeridos', 'amor', 'Consejo del dia', 42, 'rojo', 50, 50, 50, 50, 50);
    INSERT INTO astrodorado.daily_horoscopes
      (sign_id, reading_date, energia_general, area_destacada, consejo, numero_suerte, color_dia,
       nivel_amor, nivel_fortuna, nivel_salud, nivel_trabajo, nivel_energia)
    VALUES
      (1, '2026-01-01', 'Energia test 2 con los minimos caracteres requeridos', 'amor', 'Consejo del dia', 42, 'rojo', 50, 50, 50, 50, 50);
    RAISE EXCEPTION 'FAIL: duplicate (sign_id, reading_date) was allowed';
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM astrodorado.daily_horoscopes WHERE reading_date = '2026-01-01' AND sign_id = 1;
    RAISE NOTICE 'PASS: unique constraint on (sign_id, reading_date) works';
  END;
END $$;

-- Test 7: vista current_horoscopes devuelve 12 filas (una por signo) con o sin horóscopo
SELECT CASE
  WHEN (SELECT count(*) FROM astrodorado.current_horoscopes) = 12
  THEN 'PASS: current_horoscopes view returns 12 rows'
  ELSE 'FAIL: current_horoscopes view returned ' || (SELECT count(*) FROM astrodorado.current_horoscopes)::TEXT || ' rows'
END AS test_7_view;

-- Test 8: policies definidas correctamente
SELECT CASE
  WHEN (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'astrodorado'
          AND policyname IN ('zodiac_public_read','horoscope_public_read_past_and_today','settings_public_read')) = 3
  THEN 'PASS: 3 public read policies defined'
  ELSE 'FAIL: missing public read policies'
END AS test_8_policies;

-- Test 9: site_settings tiene las 4 settings iniciales
SELECT CASE
  WHEN (SELECT count(*) FROM astrodorado.site_settings
        WHERE key IN ('hero_cta','vip_pricing','telegram_bot_url','site_tagline')) = 4
  THEN 'PASS: 4 initial site_settings seeded'
  ELSE 'FAIL: missing initial site_settings'
END AS test_9_settings;

-- Test 10: trigger updated_at funciona en site_settings
DO $$
DECLARE
  v_old TIMESTAMPTZ;
  v_new TIMESTAMPTZ;
BEGIN
  SELECT updated_at INTO v_old FROM astrodorado.site_settings WHERE key = 'hero_cta';
  PERFORM pg_sleep(0.5);
  UPDATE astrodorado.site_settings
    SET value = value || jsonb_build_object('touched', true)
    WHERE key = 'hero_cta';
  SELECT updated_at INTO v_new FROM astrodorado.site_settings WHERE key = 'hero_cta';
  IF v_new > v_old THEN
    RAISE NOTICE 'PASS: updated_at trigger works';
  ELSE
    RAISE EXCEPTION 'FAIL: updated_at trigger not firing';
  END IF;
  -- cleanup
  UPDATE astrodorado.site_settings
    SET value = value - 'touched'
    WHERE key = 'hero_cta';
END $$;

-- =====================================================================
-- RESUMEN
-- Al ejecutar este archivo, todos los SELECT deben devolver líneas con 'PASS:'
-- y los bloques DO $$ deben emitir NOTICE con 'PASS:'
-- =====================================================================
