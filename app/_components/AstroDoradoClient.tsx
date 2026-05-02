'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type {
  CurrentHoroscope,
  VipPricingSetting,
  TelegramBotSetting,
  SiteTaglineSetting,
} from '@/lib/types/astrodorado';

// ───────────────────────────────────────────────────────────────────
// Constantes de diseño portadas del v6-hq
// ───────────────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Mapping slug → metadata visual (NO depende de DB — es diseño)
const SIGN_META: Record<string, {
  name: string; dates: string; element: string; planet: string; symbol: string;
}> = {
  aries:       { name: 'Aries',       dates: '21 Mar - 19 Abr', element: 'fuego',  planet: 'Marte',    symbol: '♈' },
  tauro:       { name: 'Tauro',       dates: '20 Abr - 20 May', element: 'tierra', planet: 'Venus',    symbol: '♉' },
  geminis:     { name: 'Géminis',     dates: '21 May - 20 Jun', element: 'aire',   planet: 'Mercurio', symbol: '♊' },
  cancer:      { name: 'Cáncer',      dates: '21 Jun - 22 Jul', element: 'agua',   planet: 'Luna',     symbol: '♋' },
  leo:         { name: 'Leo',         dates: '23 Jul - 22 Ago', element: 'fuego',  planet: 'Sol',      symbol: '♌' },
  virgo:       { name: 'Virgo',       dates: '23 Ago - 22 Sep', element: 'tierra', planet: 'Mercurio', symbol: '♍' },
  libra:       { name: 'Libra',       dates: '23 Sep - 22 Oct', element: 'aire',   planet: 'Venus',    symbol: '♎' },
  escorpio:    { name: 'Escorpio',    dates: '23 Oct - 21 Nov', element: 'agua',   planet: 'Plutón',   symbol: '♏' },
  sagitario:   { name: 'Sagitario',   dates: '22 Nov - 21 Dic', element: 'fuego',  planet: 'Júpiter',  symbol: '♐' },
  capricornio: { name: 'Capricornio', dates: '22 Dic - 19 Ene', element: 'tierra', planet: 'Saturno',  symbol: '♑' },
  acuario:     { name: 'Acuario',     dates: '20 Ene - 18 Feb', element: 'aire',   planet: 'Urano',    symbol: '♒' },
  piscis:      { name: 'Piscis',      dates: '19 Feb - 20 Mar', element: 'agua',   planet: 'Neptuno',  symbol: '♓' },
};

// Paths SVG de los 5 gauges (amor, fortuna, salud, trabajo, energía)
const GAUGE_PATHS: Record<string, string> = {
  amor:    'M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z',
  fortuna: 'M11.8,2V4.09C9.42,4.5 7.6,6.36 7.6,8.58C7.6,11.19 9.76,12.23 11.8,12.87V17.83C10.24,17.43 9.22,16.27 9.1,14.8H7C7.15,17.17 9.08,19.12 11.8,19.56V22H13.2V19.56C15.68,19.12 17.6,17.22 17.6,14.85C17.6,12.09 15.44,11.05 13.2,10.39V5.77C14.5,6.13 15.42,7.05 15.56,8.25H17.96C17.8,5.95 15.9,4.28 13.2,3.87V2H11.8M11.8,5.81V10.17C10.48,9.71 9.68,9.12 9.68,8.25C9.68,7.2 10.52,6.19 11.8,5.81M13.2,12.93V17.79C14.68,17.39 15.5,16.42 15.5,15.23C15.5,14.1 14.68,13.35 13.2,12.93Z',
  salud:   'M2,13L5,13L7,9L9,17L11,4L13,20L15,10L17,13L19,11L22,13',
  trabajo: 'M20,6H16V4A2,2 0 0,0 14,2H10A2,2 0 0,0 8,4V6H4A2,2 0 0,0 2,8V19A2,2 0 0,0 4,21H20A2,2 0 0,0 22,19V8A2,2 0 0,0 20,6M10,4H14V6H10V4Z',
  energia: 'M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z',
};

const METRIC_KEYS: ('amor' | 'fortuna' | 'salud' | 'trabajo' | 'energia')[] =
  ['amor', 'fortuna', 'salud', 'trabajo', 'energia'];
const METRIC_LABELS = ['amor', 'fortuna', 'salud', 'trabajo', 'energía'];

function gaugeColor(v: number): string {
  if (v < 50) return '#e74c3c';
  if (v <= 70) return '#f39c12';
  return '#2ecc71';
}

function Gauge({ type, value, size = 28 }: { type: string; value: number; size?: number }) {
  const vb = 24;
  const color = gaugeColor(value);
  const fh = ((100 - value) / 100) * vb;
  const clipId = `clip-${type}-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={fh} width={vb} height={vb - fh} />
        </clipPath>
      </defs>
      <path d={GAUGE_PATHS[type] ?? ""} fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.2)" strokeWidth=".6" />
      <path
        d={GAUGE_PATHS[type] ?? ""}
        fill={color}
        clipPath={`url(#${clipId})`}
        style={{ filter: `drop-shadow(0 0 3px ${color}50)` }}
      />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────
// Signo por fecha de nacimiento
// ───────────────────────────────────────────────────────────────────
function getSignByBirth(month: number, day: number): string {
  const ranges: { id: string; f: [number, number]; t: [number, number] }[] = [
    { id: 'capricornio', f: [12, 22], t: [1, 19] },
    { id: 'acuario',     f: [1, 20],  t: [2, 18] },
    { id: 'piscis',      f: [2, 19],  t: [3, 20] },
    { id: 'aries',       f: [3, 21],  t: [4, 19] },
    { id: 'tauro',       f: [4, 20],  t: [5, 20] },
    { id: 'geminis',     f: [5, 21],  t: [6, 20] },
    { id: 'cancer',      f: [6, 21],  t: [7, 22] },
    { id: 'leo',         f: [7, 23],  t: [8, 22] },
    { id: 'virgo',       f: [8, 23],  t: [9, 22] },
    { id: 'libra',       f: [9, 23],  t: [10, 22] },
    { id: 'escorpio',    f: [10, 23], t: [11, 21] },
    { id: 'sagitario',   f: [11, 22], t: [12, 21] },
  ];
  for (const r of ranges) {
    if ((month === r.f[0] && day >= r.f[1]) || (month === r.t[0] && day <= r.t[1])) {
      return r.id;
    }
  }
  return 'capricornio';
}

// ───────────────────────────────────────────────────────────────────
// Props del componente
// ───────────────────────────────────────────────────────────────────
interface Props {
  horoscopes: CurrentHoroscope[];
  pricing: VipPricingSetting | null;
  telegramBot: TelegramBotSetting | null;
  tagline: SiteTaglineSetting | null;
}

// ───────────────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────────────
export default function AstroDoradoClient({ horoscopes, pricing, telegramBot, tagline }: Props) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'fuego' | 'tierra' | 'aire' | 'agua'>('all');
  const [userSign, setUserSign] = useState<string | null>(null);
  const [userBirthday, setUserBirthday] = useState<string | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [channel, setChannel] = useState<'telegram' | 'whatsapp' | 'email'>('telegram');
  const [openModalSign, setOpenModalSign] = useState<string | null>(null);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [subscribeFeedback, setSubscribeFeedback] = useState<string | null>(null);

  const today = new Date();
  const todayStr = `${today.getDate()} de ${MESES[today.getMonth()]} de ${today.getFullYear()}`;

  // Build lookup por slug para acceso rápido
  const horoMap = new Map<string, CurrentHoroscope>(horoscopes.map((h) => [h.slug, h]));

  // ────────────── Efectos de inicialización (1 sola vez) ──────────────
  useEffect(() => {
    // Generar 35 partículas de estrella
    const pts = document.getElementById('pts');
    if (pts && pts.childElementCount === 0) {
      for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.className = 'pt';
        p.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;--d:${2 + Math.random() * 5}s;--dl:${Math.random() * 6}s`;
        pts.appendChild(p);
      }
    }

    // Efecto vapour en el logo (split letter-by-letter)
    const vl = document.getElementById('vapourLogo');
    if (vl && !vl.querySelector('.vapour-char')) {
      const txt = vl.textContent || '';
      vl.innerHTML = '';
      for (let i = 0; i < txt.length; i++) {
        const sp = document.createElement('span');
        sp.className = 'vapour-char';
        sp.textContent = txt[i] ?? "";
        sp.style.setProperty('--vc-d', `${i * 0.08}s`);
        sp.style.animationDuration = `${1.5 + i * 0.05}s`;
        vl.appendChild(sp);
      }
    }

    // Ethereal shadow hue rotation
    const ethHue = document.getElementById('ethHue');
    if (ethHue) {
      let ethVal = 0;
      const ethLoop = () => {
        ethVal = (ethVal + 0.5) % 360;
        ethHue.setAttribute('values', String(ethVal));
        requestAnimationFrame(ethLoop);
      };
      requestAnimationFrame(ethLoop);
    }

    // 3D tilt en hover de cards
    document.querySelectorAll<HTMLElement>('.zc').forEach((c) => {
      c.addEventListener('mousemove', (e: MouseEvent) => {
        if (c.classList.contains('dim')) return;
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = `perspective(700px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-5px)`;
      });
      c.addEventListener('mouseleave', () => {
        c.style.transform = '';
      });
    });

    // ESC cierra modales
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenModalSign(null);
        setShowExampleModal(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock scroll cuando modal abierto
  useEffect(() => {
    document.body.style.overflow = (openModalSign || showExampleModal) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [openModalSign, showExampleModal]);

  // ────────────── Handlers ──────────────
  const handleBirthdayChange = (value: string) => {
    if (!value) return;
    const parts = value.split('-');
    if (parts.length < 3) return;
    const m = parseInt(parts[1]!, 10);
    const d = parseInt(parts[2]!, 10);
    const sign = getSignByBirth(m, d);
    setUserSign(sign);
    setUserBirthday(value);
    setActiveFilter('all');
    setTimeout(() => {
      const card = document.getElementById(`card-${sign}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    setTimeout(() => setShowStickyBar(true), 1500);
  };

  const handleSubscribe = () => {
    // Canal Telegram: abre @Astrodorado_bot
    if (channel === "telegram") {
      const url = telegramBot?.url || "https://t.me/Astrodorado_bot";
      window.open(url, "_blank", "noopener,noreferrer");
      const signName = userSign ? SIGN_META[userSign]!.name : "tu signo";
      setSubscribeFeedback("Abriendo @Astrodorado_bot para tu carta de " + signName + "...");
      setTimeout(() => setShowStickyBar(false), 3000);
      return;
    }
    // WhatsApp: enlace wa.me con mensaje
    if (channel === "whatsapp") {
      const signName = userSign ? SIGN_META[userSign]!.name : "mi signo";
      const msg = encodeURIComponent("Hola! Quiero recibir mi horoscopo de " + signName + " cada manana");
      window.open("https://wa.me/34640056272?text=" + msg, "_blank", "noopener,noreferrer");
      setSubscribeFeedback("Abriendo WhatsApp...");
      setTimeout(() => setShowStickyBar(false), 3000);
      return;
    }
    // Email: validacion basica
    const input = document.getElementById("sbi") as HTMLInputElement | null;
    if (!input) return;
    const v = input.value.trim();
    if (!v || !v.includes("@")) {
      input.style.borderColor = "#e74c3c";
      return;
    }
    const signName = userSign ? SIGN_META[userSign]!.name : "tu signo";
    setSubscribeFeedback("Te apuntamos! Recibiras tu carta de " + signName + " en " + v);
    setTimeout(() => setShowStickyBar(false), 4000);
  };

  // ────────────── Render ──────────────
  return (
    <>
            {/* Nav superior: volver a landing */}
      <nav className="app-nav">
        <a href="https://astrodorado.com" className="back-link">← AstroDorado</a>
        <span className="nav-brand">El oraculo dorado</span>
        <span style={{ width: 80 }} />
      </nav>

      {/* Fondo estático */}
      <div className="bg" />
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="ethFilter">
            <feTurbulence result="undulation" numOctaves={2} baseFrequency="0.0004,0.002" seed={0} type="turbulence" />
            <feColorMatrix in="undulation" type="hueRotate" values="0" id="ethHue" />
            <feColorMatrix in="dist" result="circulation" type="matrix" values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0" />
            <feDisplacementMap in="SourceGraphic" in2="circulation" scale="50" result="dist" />
            <feDisplacementMap in="dist" in2="undulation" scale="50" result="output" />
          </filter>
        </defs>
      </svg>
      <div className="eth-orb eth-orb-1" />
      <div className="eth-orb eth-orb-2" />
      <div className="eth-orb eth-orb-3" />
      <div className="noise-layer" />
      <div id="pts" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

      {/* ═══════════ HEADER ═══════════ */}
      <header>
        <div className="logo vapour" id="vapourLogo">ASTRODORADO</div>
        <div className="sub">{tagline?.text || 'Los astros hablan · la IA traduce'}</div>
        <div className="bw">
          <div className="bl">Introduce tu fecha de nacimiento</div>
          <input
            type="date"
            className="bi"
            id="bdi"
            min="1930-01-01"
            max="2012-12-31"
            onChange={(e) => handleBirthdayChange(e.target.value)}
          />
          <div className={`br ${userSign ? 'on' : ''}`}>
            {userSign && (
              <>
                {SIGN_META[userSign]!.symbol} Eres <b>{SIGN_META[userSign]!.name}</b> — {SIGN_META[userSign]!.planet} te guía
              </>
            )}
          </div>
        </div>
        <div className="dd">{todayStr}</div>
      </header>

      {/* ═══════════ FILTROS ═══════════ */}
      <div className="fb">
        {(['all', 'fuego', 'tierra', 'aire', 'agua'] as const).map((el) => (
          <button
            key={el}
            className={activeFilter === el ? 'on' : ''}
            onClick={() => setActiveFilter(el)}
          >
            {el === 'all' ? 'Todos' : el.charAt(0).toUpperCase() + el.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══════════ GRID 12 CARDS ═══════════ */}
      <div className="grid" id="gr">
        {horoscopes.map((h) => {
          const meta = SIGN_META[h.slug];
          if (!meta) return null;
          const isVisible = activeFilter === 'all' || meta.element === activeFilter;
          const isUserSign = userSign === h.slug;
          const classes = ['zc'];
          if (isUserSign) classes.push('glow');
          else if (userSign) classes.push('dim');

          // Métricas: si no hay datos del día, usar valores default (70)
          const mets: Record<string, number> = {
            amor:    h.nivel_amor    ?? 70,
            fortuna: h.nivel_fortuna ?? 70,
            salud:   h.nivel_salud   ?? 70,
            trabajo: h.nivel_trabajo ?? 70,
            energia: h.nivel_energia ?? 70,
          };

          return (
            <div
              key={h.slug}
              className={classes.join(' ')}
              data-el={meta.element}
              data-sign={h.slug}
              id={`card-${h.slug}`}
              style={{ display: isVisible ? '' : 'none' }}
              onClick={() => setOpenModalSign(h.slug)}
            >
              <div className="card-title">
                {meta.name.toUpperCase().split('').map((ch, i) => (
                  <span
                    key={i}
                    style={{
                      animationDelay: `${0.06 * (i + 1)}s, 0s`,
                      animationDuration: '1.2s, 3s',
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <Image
                src={h.image_url}
                alt={`Escultura dorada de ${meta.name}`}
                className="ci"
                width={340}
                height={491}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 340px"
              />
              <div className="cb">
                <div className="ch">
                  <div>
                    <div className="nm">{meta.name}</div>
                    <div className="dt">{meta.dates}</div>
                  </div>
                </div>
                <div className="gs">
                  {METRIC_KEYS.map((k, i) => (
                    <div key={k} className="gi">
                      <Gauge type={k} value={mets[k]!} size={28} />
                      <div className="gl">{METRIC_LABELS[i]}</div>
                      <div className="gv" style={{ color: gaugeColor(mets[k]!) }}>{mets[k]!}</div>
                    </div>
                  ))}
                </div>
                <div className="cp">
                  {h.costar_phrase ? `«${h.costar_phrase}»` : `«${meta.name} — ${meta.planet} hoy te escucha.»`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════ CTA VIP ═══════════ */}
      <div className="cta">
        <div className="cta-box">
          <div className="cta-g" />
          <div className="cta-b">Exclusivo VIP</div>
          <h2>Tu destino es único. Tu lectura también debería serlo.</h2>
          {userSign && userBirthday ? (
            <p className="cta-pp on">
              Naciste el {userBirthday.split('-').reverse().join('/')} — eres {SIGN_META[userSign]!.name} con {SIGN_META[userSign]!.planet} como planeta regente. Tu carta natal contiene 47 aspectos únicos que los 10 oráculos procesan cada mañana solo para ti.
            </p>
          ) : (
            <p className="cta-p">
              Mientras el horóscopo general muestra el clima cósmico del día, la lectura VIP cruza tu carta natal con los 10 oráculos más antiguos para revelarte exactamente qué decisiones tomar hoy.
            </p>
          )}
          <div className="cta-ft">
            <div className="cf">
              <div className="cf-i">🌌</div>
              <div className="cf-t">Carta natal completa</div>
              <div className="cf-s">Posiciones de 10 planetas al nacer</div>
            </div>
            <div className="cf">
              <div className="cf-i">🔮</div>
              <div className="cf-t">10 oráculos combinados</div>
              <div className="cf-s">Tarot, I Ching, runas, numerología...</div>
            </div>
            <div className="cf">
              <div className="cf-i">⚡</div>
              <div className="cf-t">Alertas de tránsitos</div>
              <div className="cf-s">Cuando un planeta toque tu carta</div>
            </div>
          </div>
          <a href="#suscripcion" className="cta-btn">
            {userSign
              ? `Quiero el futuro diario de ${SIGN_META[userSign]!.name}`
              : 'Quiero recibir mi futuro diario personalizado'}
          </a>
          <div>
            <span className="ej-link" onClick={() => setShowExampleModal(true)}>Ver un ejemplo</span>
          </div>
          <div className="cta-sm">
            €{pricing?.monthly_eur ?? 9.99}/mes · Cancela cuando quieras · Primera semana gratis
          </div>
        </div>
      </div>

      {/* ═══════════ STICKY BAR ═══════════ */}
      <div className={`sb ${showStickyBar ? 'on' : ''}`}>
        <div className="sb-in">
          {subscribeFeedback ? (
            <div style={{ textAlign: 'center', padding: 10, color: '#2ecc71', fontSize: 13 }}>
              {subscribeFeedback}
            </div>
          ) : (
            <>
              <div className="sb-t">
                {userSign
                  ? <>Tu carta de <b>{SIGN_META[userSign]!.name} {SIGN_META[userSign]!.symbol}</b> cada mañana</>
                  : <>Tu carta te espera cada mañana</>}
              </div>
              <input
                type="text"
                className="sb-i"
                id="sbi"
                placeholder={channel === 'email' ? 'tu@email.com' : '+34 600 000 000'}
              />
              <div className="sb-cs">
                {(['telegram', 'whatsapp', 'email'] as const).map((ch) => (
                  <button
                    key={ch}
                    className={`sb-c ${channel === ch ? 's' : ''}`}
                    onClick={() => setChannel(ch)}
                  >
                    {ch === 'telegram' ? 'Telegram' : ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </button>
                ))}
              </div>
              <button className="sb-go" onClick={handleSubscribe}>Recibir gratis</button>
              <button className="sb-x" onClick={() => setShowStickyBar(false)}>×</button>
            </>
          )}
        </div>
      </div>

      {/* ═══════════ MODAL SIGNO ═══════════ */}
      {openModalSign && (() => {
        const h = horoMap.get(openModalSign);
        const meta = SIGN_META[openModalSign]!;
        if (!h || !meta) return null;
        const isMine = userSign === openModalSign;
        const mets: Record<string, number> = {
          amor: h.nivel_amor ?? 70, fortuna: h.nivel_fortuna ?? 70,
          salud: h.nivel_salud ?? 70, trabajo: h.nivel_trabajo ?? 70,
          energia: h.nivel_energia ?? 70,
        };
        return (
          <div className="mo on" onClick={(e) => { if (e.target === e.currentTarget) setOpenModalSign(null); }}>
            <div className="mc">
              <button className="cl" onClick={() => setOpenModalSign(null)}>×</button>
              <Image src={h.image_url} alt={meta.name} className="mi" width={720} height={480} />
              <div className="mx">
                <div className="mh">
                  <h2>{meta.symbol} {meta.name}</h2>
                  <span>{meta.dates} · {meta.planet}</span>
                </div>
                <div className="me">{h.energy_general || `El clima cósmico de ${meta.name} aún se está componiendo hoy.`}</div>
                <div className="mg">
                  {METRIC_KEYS.map((k, i) => (
                    <div key={k} className="mgi">
                      <Gauge type={k} value={mets[k]!} size={40} />
                      <div className="mgl">{METRIC_LABELS[i]}</div>
                      <div className="mgv" style={{ color: gaugeColor(mets[k]!) }}>{mets[k]!}</div>
                    </div>
                  ))}
                </div>
                {h.advice && <div className="mt" dangerouslySetInnerHTML={{ __html: h.advice.replace(/\n/g, '<br>') }} />}
                {h.costar_phrase && <div className="mq">«{h.costar_phrase}»</div>}
                <div className="mf">
                  <span>Compatibilidad: <b>{h.compatibility || '—'}</b></span>
                  <span>Planeta: <b>{meta.planet}</b></span>
                  <span>Área: <b>{h.featured_area || '—'}</b></span>
                </div>
                <div className="mcta">
                  <h3>{isMine ? `Esta es tu lectura general de ${meta.name}` : 'Esto es solo el clima cósmico general'}</h3>
                  <p>
                    {isMine
                      ? `Tu carta natal del ${userBirthday} tiene 47 aspectos que hacen tu día diferente al de otros ${meta.name}. Los 10 oráculos los procesan cada mañana solo para ti.`
                      : `Tu lectura personalizada cruza tu fecha, hora y lugar de nacimiento con 10 oráculos ancestrales para decirte exactamente qué hacer hoy.`}
                  </p>
                  <a href="#suscripcion" className="mcta-btn">Quiero recibir mi futuro diario personalizado</a>
                  <div><span className="ej-link" onClick={() => { setOpenModalSign(null); setShowExampleModal(true); }}>Ver un ejemplo</span></div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ MODAL "VER UN EJEMPLO" ═══════════ */}
      {showExampleModal && (
        <div className="ej-ov" onClick={(e) => { if (e.target === e.currentTarget) setShowExampleModal(false); }}>
          <div className="ej-box">
            <button className="cl" onClick={() => setShowExampleModal(false)}>×</button>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#e74c3c', border: '1px solid rgba(231,76,60,.3)', display: 'inline-block', padding: '2px 10px', borderRadius: 8, background: 'rgba(231,76,60,.06)' }}>
                Ejemplo lectura VIP
              </div>
              <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, color: '#f5d799', marginTop: 8 }}>
                Tu lectura personalizada de hoy
              </h3>
              <p style={{ fontSize: 10, color: 'rgba(232,224,208,.3)', marginTop: 3 }}>
                Virgo · 18/09/1982 · 14:30h El Ejido
              </p>
            </div>
            <div className="ej-sec" style={{ background: 'rgba(139,92,246,.05)', borderLeft: '2px solid rgba(139,92,246,.3)' }}>
              <div className="ej-lbl" style={{ color: 'rgba(139,92,246,.7)' }}>Tus tránsitos de hoy</div>
              <b>Marte en tu casa 7</b> intensifica tensiones en relaciones. Evita confrontaciones entre 10:00-14:00.<br />
              <b>Venus trígono Neptuno</b> en casa 5: creatividad desbordante hasta las 18h.
            </div>
            <div className="ej-sec" style={{ background: 'rgba(212,168,83,.03)', borderLeft: '2px solid rgba(212,168,83,.2)' }}>
              <div className="ej-lbl" style={{ color: 'rgba(212,168,83,.7)' }}>Los 10 oráculos coinciden</div>
              El <b>I Ching</b> (hexagrama 42) y el <b>Tarot</b> (La Estrella XVII) apuntan a renovación interior.<br />
              Las <b>Runas</b> confirman con Wunjo: alegría tras la tormenta.<br />
              Tu <b>número del día</b>: 7 (introspección).
            </div>
            <div className="ej-sec" style={{ background: 'rgba(231,76,60,.04)', borderLeft: '2px solid rgba(231,76,60,.3)' }}>
              <div className="ej-lbl" style={{ color: 'rgba(231,76,60,.7)' }}>Acción recomendada</div>
              <b>Toma la decisión que llevas posponiendo antes de las 15:00.</b> Marte sale de tu casa 7 a las 18:22 y no volverá a esta posición hasta marzo de 2028.
            </div>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a href="#suscripcion" className="cta-btn" style={{ padding: '12px 32px', fontSize: 12 }}>
                Quiero esto cada mañana
              </a>
              <div style={{ fontSize: 10, color: 'rgba(232,224,208,.18)', marginTop: 6 }}>
                €9,99/mes · primera semana gratis
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ FOOTER ═══════════ */}
      <footer>
        <div className="ft1">ASTRODORADO</div>
        <div className="ft2">Powered by NextHorizont AI · <a href="https://astrodorado.com" className="ft-link">Primera vez? Conocenos</a></div>
        {telegramBot?.url && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(232,224,208,.3)' }}>
            <a href={telegramBot.url} target="_blank" rel="noreferrer" style={{ color: '#d4a853' }}>
              ¿Prefieres Telegram? @astrodorado_bot
            </a>
          </div>
        )}
      </footer>
    </>
  );
}
