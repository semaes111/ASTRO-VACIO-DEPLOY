import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectSlots } from '../lib/generators/_template-engine/inject';
import { validateSlots } from '../lib/generators/_template-engine/schema';
import type { ReportTemplateSlot } from '../lib/types/report-templates';

const FIXTURE = `<!DOCTYPE html><html><head><style>.x{color:red}</style></head>
<body><header id="hero" class="k1" data-v="1"><h1>Demo Título</h1><p class="lead">Texto demo hero.</p></header>
<section id="s-karma"><h2>Karma</h2><div class="content"><p>Contenido demo karma.</p></div></section>
<section id="s-vidas"><h2>Vidas</h2><div class="content"><p>Marker aquí: {{SLOT:vidas}}</p></div></section>
<footer><p>pie intacto</p></footer></body></html>`;

const SLOTS: ReportTemplateSlot[] = [
  { key: 'hero', selector: '#hero p.lead', label: 'Hero', word_limit: 40, required: true },
  { key: 'karma', selector: '#s-karma .content', label: 'Karma', required: true },
  { key: 'vidas', label: 'Vidas (marcador literal)' },
  { key: 'fantasma', selector: '#no-existe', label: 'Selector ausente' },
];

test('validateSlots: filtra entradas inválidas y exige key', () => {
  const raw = [ ...SLOTS, { nokey: true }, 'basura', { key: 42 } ];
  const ok = validateSlots(raw);
  assert.equal(ok.length, 4);
  assert.deepEqual(ok.map((s) => s.key), ['hero', 'karma', 'vidas', 'fantasma']);
  assert.deepEqual(validateSlots(null), []);
  assert.deepEqual(validateSlots('x'), []);
});

test('injectSlots: selector reemplaza SOLO innerHTML preservando estructura y atributos', () => {
  const r = injectSlots(FIXTURE, SLOTS, {
    hero: '<p>Hola <strong>Sergio</strong>, tu energía hoy.</p>',
    karma: '<p>Tu karma real.</p><ul><li>uno</li></ul>',
    vidas: '<p>Vidas pasadas generadas.</p>',
  });
  assert.ok(r.html.includes('class="k1"') && r.html.includes('data-v="1"'), 'atributos intactos');
  assert.ok(r.html.includes('<h1>Demo Título</h1>'), 'nodos hermanos intactos');
  assert.ok(r.html.includes('Hola <strong>Sergio</strong>'), 'hero inyectado');
  assert.ok(r.html.includes('Tu karma real.') && r.html.includes('<li>uno</li>'), 'karma inyectado');
  assert.ok(!r.html.includes('Texto demo hero.') && !r.html.includes('Contenido demo karma.'), 'demo sustituido');
  assert.ok(r.html.includes('Vidas pasadas generadas.') && !r.html.includes('{{SLOT:vidas}}'), 'marcador literal sustituido');
  assert.ok(r.html.includes('pie intacto') && r.html.includes('.x{color:red}'), 'resto del documento intacto');
  assert.deepEqual(r.injected.sort(), ['hero', 'karma', 'vidas']);
  assert.deepEqual(r.missing_selector, ['fantasma']);
});

test('injectSlots: fragmento ausente ⇒ degradación invisible (demo se conserva)', () => {
  const r = injectSlots(FIXTURE, SLOTS, { hero: '<p>solo hero</p>' });
  assert.ok(r.html.includes('Contenido demo karma.'), 'zona sin fragmento conserva demo');
  assert.deepEqual(r.missing_fragment.sort(), ['karma', 'vidas']);
  assert.deepEqual(r.injected, ['hero']);
});

test('injectSlots ::content: elige el contenedor con más <p> sin heading, preservando h2 estilizado', () => {
  const kimi = `<section id="sx"><div class="wrap"><p class="eyebrow">EB</p>
  <h2 class="grad">Demo el 7</h2><div class="barra"><p>quote</p></div>
  <div class="body"><p>d1</p><p>d2</p><p>d3</p></div></div></section>`;
  const r = injectSlots(kimi, [
    { key: 't', selector: '#sx h2' },
    { key: 'b', selector: '#sx::content' },
  ], { t: 'Tu Camino real es el 4', b: '<p>real</p>' });
  assert.ok(r.html.includes('class="grad">Tu Camino real es el 4'), 'h2 conserva clases');
  assert.ok(r.html.includes('<p>real</p>') && !r.html.includes('d1'), 'cuerpo sustituido');
  assert.ok(r.html.includes('quote') && r.html.includes('EB'), 'barra y eyebrow intactos');
  assert.deepEqual(r.injected.sort(), ['b', 't']);
});
