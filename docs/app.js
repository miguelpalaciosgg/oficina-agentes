// app.js — Interfaz del simulador. Pinta lo que calcula motor.js; aquí no hay reglas de decisión.
// Todo se construye con textContent (nunca innerHTML con lo que escribe el visitante).
// Bilingüe: inglés por defecto, español con ?lang=es o con el selector EN/ES (se guarda en localStorage).
import { simular, decidirFabrica, preguntaPara, NIVELES } from './motor.js'
import { TEXTOS, rellenar } from './textos.js'

// Las mismas fábricas que fabricas.json de la raíz (GitHub Pages solo sirve docs/, por eso van copiadas),
// con el nombre y el horario en los dos idiomas.
const FABRICAS = [
  { id: 'vigia', nombre: { en: 'Error watcher', es: 'Vigía de errores' }, horario: { en: 'Every day at 8:00', es: 'Cada día a las 8:00' }, estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 2, gastoMes: 3 }, costeVuelta: 0.05 },
  { id: 'seguridad', nombre: { en: 'Security reviewer', es: 'Revisor de seguridad' }, horario: { en: 'Mondays at 9:00', es: 'Los lunes a las 9:00' }, estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 1, gastoMes: 2 }, costeVuelta: 0.2 },
  { id: 'web', nombre: { en: 'Website maintenance', es: 'Mantenimiento web' }, horario: { en: 'When there are small issues', es: 'Cuando hay issues pequeños' }, estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 4, gastoMes: 5 }, costeVuelta: 0.25 },
  { id: 'programador', nombre: { en: 'Programmer', es: 'Programador' }, horario: { en: 'Every day at 9:30 and when there is a queue', es: 'Cada día a las 9:30 y cuando hay cola' }, estado: 'en_marcha', revision: 'humano', limites: { ejecucionesDia: 3, gastoMes: 10 }, costeVuelta: 0.6 },
  { id: 'redactor', nombre: { en: 'Draft writer', es: 'Redactor de borradores' }, horario: { en: 'Tuesdays and Thursdays', es: 'Martes y jueves' }, estado: 'en_marcha', revision: 'humano', limites: { ejecucionesDia: 1, gastoMes: 4 }, costeVuelta: 0.3 },
  { id: 'analista', nombre: { en: 'Metrics analyst', es: 'Analista de métricas' }, horario: { en: 'Fridays', es: 'Los viernes' }, estado: 'pausada', revision: 'sin_revision', limites: { ejecucionesDia: 1, gastoMes: 2 }, costeVuelta: 0.15 }
]

const hoyLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const HOY = hoyLocal()

// Consumo de partida (inventado) para que el panel no salga vacío.
function consumoInicial() {
  return {
    vigia: { dia: HOY, ejecucionesDia: 1, mes: HOY.slice(0, 7), gastoMes: 1.1 },
    seguridad: { dia: HOY, ejecucionesDia: 0, mes: HOY.slice(0, 7), gastoMes: 0.8 },
    web: { dia: HOY, ejecucionesDia: 1, mes: HOY.slice(0, 7), gastoMes: 2.5 },
    programador: { dia: HOY, ejecucionesDia: 2, mes: HOY.slice(0, 7), gastoMes: 7.8 },
    redactor: { dia: HOY, ejecucionesDia: 1, mes: HOY.slice(0, 7), gastoMes: 1.2 },
    analista: { dia: HOY, ejecucionesDia: 0, mes: HOY.slice(0, 7), gastoMes: 0.45 }
  }
}
let consumo = consumoInicial()
// Última comprobación de cada agente en el panel; se guarda el código y se vuelve a pedir el mensaje
// al cambiar de idioma.
const ultimaLinea = {}

// ---------- Idioma ----------
// ?lang=es o ?lang=en manda; si no, lo guardado; si no, inglés.
function idiomaInicial() {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'es' || q === 'en') return q
  } catch { /* sin URL */ }
  try {
    const g = localStorage.getItem('idioma')
    if (g === 'es' || g === 'en') return g
  } catch { /* sin almacenamiento */ }
  return 'en'
}
let lang = idiomaInicial()
const T = () => TEXTOS[lang]
const nombreDe = f => f.nombre[lang]

// Ayudante para crear nodos: el('p', { class: 'x' }, 'texto', otroNodo)
function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag)
  for (const [k, val] of Object.entries(attrs)) {
    if (val == null || val === false) continue
    if (k === 'class') n.className = val
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), val)
    else n.setAttribute(k, val === true ? '' : val)
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h instanceof Node ? h : String(h))
  return n
}
const $ = id => document.getElementById(id)
// El veredicto es un código (ok, con-avisos, bloquea, no-aplica) que también es la clase CSS.
const claseVeredicto = v => 'veredicto v-' + v
// Texto con un {hueco} que es un nodo (por ejemplo, un <code>).
function conNodo(plantilla, clave, nodo) {
  const [antes, despues] = plantilla.split(`{${clave}}`)
  return [antes, nodo, despues ?? '']
}

// Textos fijos de la página según el idioma.
function pintarTextos() {
  const t = T()
  document.documentElement.lang = lang
  document.title = t.titulo
  document.querySelector('meta[name="description"]').setAttribute('content', t.descripcion)
  for (const n of document.querySelectorAll('[data-t]')) n.textContent = t[n.dataset.t]
  for (const n of document.querySelectorAll('[data-t-placeholder]')) n.setAttribute('placeholder', t[n.dataset.tPlaceholder])
  for (const n of document.querySelectorAll('[data-t-aria-label]')) n.setAttribute('aria-label', t[n.dataset.tAriaLabel])
  for (const b of document.querySelectorAll('[data-idioma]')) b.setAttribute('aria-pressed', String(b.dataset.idioma === lang))
  $('niveles').replaceChildren(...Object.entries(NIVELES).map(([id, n]) =>
    el('li', { class: 'nivel-' + id }, el('strong', {}, n.nombre[lang]), el('span', {}, n.accion[lang]))))
  $('ejemplos').replaceChildren(...t.ejemplos.map(e =>
    el('button', { type: 'button', class: 'chip', onclick: () => { $('peticion').value = e; ejecutar() } }, e)))
  $('nota-panel').replaceChildren(...conNodo(t.notaPanel, 'cmd', el('code', {}, 'node fabricas/comprobar.mjs <id>')))
  $('pie').replaceChildren(...conNodo(t.pie, 'repo', el('code', {}, 'oficina-agentes')))
}

function cambiarIdioma(nuevo) {
  if (nuevo === lang) return
  lang = nuevo
  try { localStorage.setItem('idioma', lang) } catch { /* da igual */ }
  // Si la página llegó con ?lang=, se quita para que no contradiga la elección.
  try {
    const u = new URL(location.href)
    if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u) }
  } catch { /* sin historial */ }
  pintarTextos()
  pintarSelectorAgente()
  pintarPanel()
  if ($('peticion').value.trim()) ejecutar()
}
for (const b of document.querySelectorAll('[data-idioma]')) b.addEventListener('click', () => cambiarIdioma(b.dataset.idioma))

// ---------- Tema ----------
function aplicarTema(t) {
  if (t) document.documentElement.setAttribute('data-theme', t)
  else document.documentElement.removeAttribute('data-theme')
}
try { aplicarTema(localStorage.getItem('tema')) } catch { /* sin almacenamiento: tema del sistema */ }
$('tema').addEventListener('click', () => {
  const actual = document.documentElement.getAttribute('data-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const nuevo = actual === 'dark' ? 'light' : 'dark'
  aplicarTema(nuevo)
  try { localStorage.setItem('tema', nuevo) } catch { /* da igual */ }
})

// ---------- Formulario ----------
function pintarSelectorAgente() {
  const sel = $('agente'), antes = sel.value
  sel.replaceChildren(...FABRICAS.map(f => el('option', { value: f.id }, nombreDe(f))))
  sel.value = antes || 'web'
}
$('form').addEventListener('submit', ev => { ev.preventDefault(); ejecutar() })
for (const id of ['agente', 'pruebas', 'grande']) $(id).addEventListener('change', () => { if ($('peticion').value.trim()) ejecutar() })

// ---------- Circuito ----------
function ejecutar() {
  const peticion = $('peticion').value.trim()
  if (!peticion) { $('peticion').focus(); return }
  const fabrica = FABRICAS.find(f => f.id === $('agente').value)
  const r = simular(peticion, { fabrica, consumo: consumo[fabrica.id], hoy: HOY, pruebas: $('pruebas').checked, grande: $('grande').checked, lang })
  pintarCircuito(peticion, fabrica, r)
  // El enlace de la página guarda la petición para poder compartir el resultado.
  try { history.replaceState(null, '', location.pathname + location.search + '#p=' + encodeURIComponent(peticion)) } catch { /* sin historial */ }
}

function pintarCircuito(peticion, fabrica, r) {
  const t = T(), nombre = nombreDe(fabrica)
  const caja = $('circuito')
  caja.classList.remove('vacio')
  const etapas = []
  let retraso = 0
  const anim = n => { n.classList.add('aparece'); n.style.animationDelay = (retraso += 70) + 'ms'; return n }

  // 0. La fábrica del agente
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, rellenar(t.fabricaDe, { n: nombre })),
    el('p', { class: 'linea' }, el('b', {}, rellenar(t.codigo, { c: r.fabrica.codigo })), ' · ', r.fabrica.mensaje || t.adelante))))

  if (r.parado) {
    etapas.push(anim(el('div', { class: 'resultado parado' },
      el('p', { class: 'grande' }, t.noTrabaja),
      el('p', { class: 'regla' }, t.reglaParado))))
    caja.replaceChildren(...etapas)
    return
  }

  const c = r.clasificacion
  // 1. Petición y señales reconocidas
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, t.etapaPeticion),
    el('div', { class: 'peticion-eco' }, peticion),
    el('div', { class: 'senales', 'aria-label': t.reconocidoAria },
      c.senales.length
        ? c.senales.map(s => el('span', { class: `senal nivel-${s.nivel}` }, `${s.que[lang]} · ${NIVELES[s.nivel].nombre[lang].toLowerCase()}`))
        : el('span', { class: 'senal' }, t.nadaReconocido)))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 2. Cuatro revisores en paralelo
  etapas.push(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, t.revisores),
    el('div', { class: 'revisores' }, r.veredictos.map(v => anim(el('article', { class: 'tarjeta' },
      el('h3', {}, v.nombre),
      el('span', { class: claseVeredicto(v.veredicto) }, v.veredictoTexto),
      el('p', {}, v.motivo)))))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 3. Aprobador
  const res = r.resultado
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, t.aprobador),
    el('div', { class: 'aprobador' },
      el('div', { class: 'decision' }, res.decisionTexto),
      res.avisos.length ? el('ul', {}, res.avisos.map(a => el('li', {}, `${a.nombre}: ${a.motivo}`))) : null))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 4. Nivel resultante y regla
  const nivel = NIVELES[res.nivel]
  const sub = rellenar(t.sub[res.decision], { n: nombre })
  const pregunta = preguntaPara(peticion, nombre, res, new Date().toISOString().slice(0, 19) + 'Z', lang)
  etapas.push(anim(el('div', { class: `resultado nivel-${res.nivel}` },
    el('p', { class: 'grande' }, res.decision === 'rechazado' ? t.rechazadoGrande : `${nivel.nombre[lang]} · ${nivel.accion[lang]}`),
    el('p', { class: 'sub' }, sub),
    el('p', { class: 'regla' }, el('strong', {}, t.reglaAplicada), res.regla),
    pregunta ? el('details', { class: 'pregunta' },
      el('summary', {}, t.preguntaResumen),
      el('pre', {}, JSON.stringify(pregunta, null, 2))) : null)))

  caja.replaceChildren(...etapas)
}

// ---------- Panel de agentes ----------
const ESTADOS = [
  { valor: 'en_marcha|sin_revision', clave: 'marcha' },
  { valor: 'en_marcha|humano', clave: 'revision' },
  { valor: 'pausada|sin_revision', clave: 'pausado' }
]

function medidor(etiqueta, usado, tope, fmt = x => x) {
  const pct = tope ? Math.min(100, (usado / tope) * 100) : 0
  const clase = pct >= 100 ? 'lleno' : pct >= 75 ? 'medio' : ''
  return el('div', { class: 'medidor' },
    el('div', { class: 'medidor-fila' }, el('span', {}, etiqueta), el('span', {}, rellenar(T().deTope, { u: fmt(usado), t: fmt(tope) }))),
    el('div', { class: 'barra', role: 'progressbar', 'aria-label': etiqueta, 'aria-valuemin': '0', 'aria-valuemax': String(tope), 'aria-valuenow': String(usado) },
      el('i', { class: clase, style: `width:${pct}%` })))
}

function pintarPanel() {
  const t = T()
  $('panel').replaceChildren(...FABRICAS.map(f => {
    const nombre = nombreDe(f)
    const d = decidirFabrica(f, consumo[f.id], HOY, lang)
    const c = consumo[f.id] || {}
    const etiqueta = d.codigo === 4 ? [t.etiquetas.pausado, 'e-pausada'] : d.codigo === 5 ? [t.etiquetas.tope, 'e-tope']
      : d.codigo === 3 ? [t.etiquetas.revision, 'e-revision'] : [t.etiquetas.marcha, 'e-marcha']
    const sel = el('select', { 'aria-label': rellenar(t.estadoDe, { n: nombre }), onchange: ev => {
      const [estado, revision] = ev.target.value.split('|'); f.estado = estado; f.revision = revision
      ultimaLinea[f.id] = null; pintarPanel(); if ($('peticion').value.trim()) ejecutar()
    } }, ESTADOS.map(e => el('option', { value: e.valor }, t.estados[e.clave])))
    sel.value = `${f.estado}|${f.estado === 'pausada' ? 'sin_revision' : f.revision}`
    // La línea de la última vuelta se guarda tal cual la dio la fábrica; se traduce rehaciendo la decisión
    // con el mismo consumo de aquel momento.
    const ultima = ultimaLinea[f.id] ? decidirFabrica(f, ultimaLinea[f.id].consumo, HOY, lang) : null
    return el('article', { class: 'agente' },
      el('div', { class: 'agente-cabeza' },
        el('div', {}, el('h3', {}, nombre), el('p', { class: 'horario' }, `${f.horario[lang]} · ${rellenar(t.idAgente, { id: f.id })}`)),
        el('span', { class: 'estado ' + etiqueta[1] }, etiqueta[0])),
      medidor(t.vueltasHoy, c.ejecucionesDia || 0, f.limites.ejecucionesDia),
      medidor(t.gastoMes, c.gastoMes || 0, f.limites.gastoMes, t.euros),
      el('div', { class: 'agente-acciones' }, sel,
        el('button', { type: 'button', onclick: () => vuelta(f) }, t.simularVuelta)),
      ultima ? el('p', { class: 'linea' }, el('b', {}, rellenar(t.codigo, { c: ultima.codigo })), ' · ', ultima.mensaje) : null)
  }))
}

// Una vuelta: comprobar la fábrica y, si puede trabajar, apuntar la ejecución y su coste.
function vuelta(f) {
  const antes = consumo[f.id]
  const d = decidirFabrica(f, antes, HOY, lang)
  if (d.trabajar) {
    const c = antes || {}
    consumo[f.id] = { dia: HOY, ejecucionesDia: (c.ejecucionesDia || 0) + 1, mes: HOY.slice(0, 7), gastoMes: Math.round(((c.gastoMes || 0) + f.costeVuelta) * 100) / 100 }
  }
  ultimaLinea[f.id] = { consumo: antes }
  pintarPanel()
  if ($('peticion').value.trim() && $('agente').value === f.id) ejecutar()
}

$('reiniciar').addEventListener('click', () => {
  consumo = consumoInicial()
  for (const k of Object.keys(ultimaLinea)) ultimaLinea[k] = null
  pintarPanel()
  if ($('peticion').value.trim()) ejecutar()
})

pintarTextos()
pintarSelectorAgente()
pintarPanel()
// Si se llega con #p=<petición> (enlace compartido), se simula al cargar.
if (location.hash.startsWith('#p=')) {
  try { $('peticion').value = decodeURIComponent(location.hash.slice(3)).slice(0, 160) } catch { /* enlace roto */ }
  if ($('peticion').value.trim()) ejecutar()
}
