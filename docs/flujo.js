// flujo.js — Portada de una sola pantalla: los agentes conversan por sus conexiones y paran cuando
// hace falta una persona, que responde OK o No OK. Es una historia guionizada para explicar el circuito;
// las reglas reales están en motor.js y en simulador.html.
import { TEXTOS } from './textos.js'

const NS = 'http://www.w3.org/2000/svg'
const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches

// Trazos de iconos de línea (24×24). Cada cadena es un <path>; los círculos y rectángulos van aparte.
const ICONOS = {
  tu: { p: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'], c: [[12, 7, 4]] },
  vigia: { p: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  prog: { p: ['m16 18 6-6-6-6', 'm8 6-6 6 6 6'] },
  seg: { p: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'] },
  ux: { p: ['M12 18h.01'], r: [[5, 2, 14, 20]] },
  ui: { p: ['M3 9h18', 'M9 21V9'], r: [[3, 3, 18, 18]] },
  cod: { p: ['m21 21-4.3-4.3'], c: [[11, 11, 8]] },
  apr: { p: ['m9 12 2 2 4-4'], c: [[12, 12, 10]] },
  web: { p: ['M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'], c: [[12, 12, 10]] },
  ana: { p: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'] }
}

const NODOS = {
  tu: { x: 180, y: 30 },
  vigia: { x: 305, y: 30 },
  prog: { x: 180, y: 102 },
  seg: { x: 45, y: 176 },
  ux: { x: 135, y: 176 },
  ui: { x: 225, y: 176 },
  cod: { x: 315, y: 176 },
  apr: { x: 180, y: 256 },
  web: { x: 270, y: 256 },
  ana: { x: 352, y: 256 }
}
const REVISORES = ['seg', 'ux', 'ui', 'cod']

const recta = (a, b) => `M${NODOS[a].x} ${NODOS[a].y} L${NODOS[b].x} ${NODOS[b].y}`
const ENLACES = {
  'vigia-tu': recta('vigia', 'tu'),
  'tu-prog': recta('tu', 'prog'),
  'prog-seg': recta('prog', 'seg'),
  'prog-ux': recta('prog', 'ux'),
  'prog-ui': recta('prog', 'ui'),
  'prog-cod': recta('prog', 'cod'),
  'seg-apr': recta('seg', 'apr'),
  'ux-apr': recta('ux', 'apr'),
  'ui-apr': recta('ui', 'apr'),
  'cod-apr': recta('cod', 'apr'),
  'apr-web': recta('apr', 'web'),
  'web-ana': recta('web', 'ana'),
  // El aviso a la persona rodea a los revisores por la izquierda.
  'apr-tu': 'M160 256 C -80 256, -80 30, 160 30'
}

function svg(tag, attrs = {}, texto) {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  if (texto != null) n.textContent = texto
  return n
}

function icono({ p = [], c = [], r = [] }, x, y) {
  const g = svg('g', { class: 'f-ic', transform: `translate(${x - 10.5} ${y - 10.5}) scale(.875)`, 'aria-hidden': 'true' })
  for (const d of p) g.append(svg('path', { d }))
  for (const [cx, cy, radio] of c) g.append(svg('circle', { cx, cy, r: radio }))
  for (const [rx, ry, width, height] of r) g.append(svg('rect', { x: rx, y: ry, width, height, rx: 2 }))
  return g
}

function idiomaInicial() {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'es' || q === 'en') return q
  } catch { /* sin URL */ }
  try {
    const g = localStorage.getItem('idioma')
    if (g === 'es' || g === 'en') return g
  } catch { /* sin almacenamiento */ }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'
}

function iniciar(raiz) {
  const lienzo = raiz.querySelector('.f-lienzo')
  const estado = raiz.querySelector('[data-f="estado"]')
  const si = raiz.querySelector('[data-f="si"]')
  const no = raiz.querySelector('[data-f="no"]')

  const dibujo = svg('svg', { viewBox: '-30 -50 415 350', role: 'img', preserveAspectRatio: 'xMidYMid meet' })
  const capaEnlaces = svg('g')
  const capaNodos = svg('g')
  const capaPaquetes = svg('g')
  dibujo.append(capaEnlaces, capaNodos, capaPaquetes)
  lienzo.replaceChildren(dibujo)

  const caminos = {}
  for (const [id, d] of Object.entries(ENLACES)) {
    caminos[id] = svg('path', { d, class: 'f-enlace' })
    capaEnlaces.append(caminos[id])
  }

  const nodos = {}
  for (const [id, n] of Object.entries(NODOS)) {
    const marca = svg('g', { class: 'f-marca', transform: `translate(${n.x + 15} ${n.y - 15})` })
    marca.append(svg('circle', { r: 7.5 }), svg('text', { y: 3.6 }, ''))
    const nombre = svg('text', { x: n.x, y: n.y + 35, class: 'f-nombre' }, '')
    const g = svg('g', { class: 'f-nodo' })
    g.append(svg('circle', { cx: n.x, cy: n.y, r: 21, class: 'f-disco' }), icono(ICONOS[id], n.x, n.y), nombre, marca)
    capaNodos.append(g)
    nodos[id] = { g, nombre, marca: marca.lastChild }
  }

  let lang = idiomaInicial()
  let T = TEXTOS[lang]
  let turno = 0
  let fase = 'inicio'
  let burbuja = null

  const N = id => T.flujo.nombres[id]
  const poner = (id, clase, marca = '') => {
    nodos[id].g.setAttribute('class', 'f-nodo' + (clase ? ' ' + clase : '') + (marca ? ' f-con-marca' : ''))
    nodos[id].marca.textContent = marca
  }

  // Bocadillo junto al agente que habla; se recoloca dentro del lienzo aunque el agente esté en un borde.
  function hablar(id, texto) {
    if (burbuja) burbuja.remove()
    burbuja = document.createElement('div')
    burbuja.className = 'f-burbuja' + (id === 'tu' ? ' f-burbuja-tu' : '')
    burbuja.textContent = texto
    lienzo.append(burbuja)
    const m = dibujo.getScreenCTM()
    const caja = lienzo.getBoundingClientRect()
    const px = m.a * NODOS[id].x + m.e - caja.left
    const py = m.d * (NODOS[id].y - 21) + m.f - caja.top
    const ancho = burbuja.offsetWidth
    const izq = Math.max(2, Math.min(caja.width - ancho - 2, px - ancho / 2))
    burbuja.style.left = izq + 'px'
    burbuja.style.top = Math.max(0, py - burbuja.offsetHeight - 9) + 'px'
    burbuja.style.setProperty('--cola', Math.max(12, Math.min(ancho - 12, px - izq)) + 'px')
  }
  const callar = () => { if (burbuja) { burbuja.remove(); burbuja = null } }

  const espera = (ms, t) => new Promise((res, rej) =>
    setTimeout(() => (t === turno ? res() : rej(new Error('cancelado'))), REDUCIDO ? Math.min(ms, 900) : ms))

  // Mueve un punto de luz por la conexión entre dos nodos, en el sentido que toque.
  function volar(a, b, t) {
    const directo = caminos[`${a}-${b}`]
    const camino = directo || caminos[`${b}-${a}`]
    if (REDUCIDO) return Promise.resolve()
    camino.classList.add('f-activo')
    const punto = svg('circle', { r: 6, class: 'f-paquete' })
    capaPaquetes.append(punto)
    const largo = camino.getTotalLength()
    const dur = Math.min(620, 280 + largo * .75)
    const t0 = performance.now()
    return new Promise((res, rej) => {
      const paso = ahora => {
        if (t !== turno) { punto.remove(); rej(new Error('cancelado')); return }
        const p = Math.min(1, (ahora - t0) / dur)
        const suave = p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
        const q = camino.getPointAtLength((directo ? suave : 1 - suave) * largo)
        punto.setAttribute('cx', q.x)
        punto.setAttribute('cy', q.y)
        if (p < 1) { requestAnimationFrame(paso); return }
        punto.remove()
        camino.classList.remove('f-activo')
        res()
      }
      requestAnimationFrame(paso)
    })
  }

  function limpiar() {
    for (const id of Object.keys(NODOS)) poner(id, '')
    for (const c of Object.values(caminos)) c.classList.remove('f-activo')
    capaPaquetes.replaceChildren()
    callar()
  }

  function controles(modo) {
    const pregunta = modo === 'pregunta'
    const fin = modo === 'fin'
    si.disabled = !(pregunta || fin)
    no.disabled = !pregunta
    no.hidden = fin
    si.textContent = fin ? T.flujo.otraVez : T.flujo.ok
    no.textContent = T.flujo.noOk
    si.classList.toggle('f-llama', pregunta)
  }

  function textosFijos() {
    T = TEXTOS[lang]
    document.documentElement.lang = lang
    document.title = T.titulo
    document.querySelector('[data-t="titulo"]').textContent = T.titulo
    document.querySelector('[data-f="sub"]').textContent = T.flujo.sub
    dibujo.setAttribute('aria-label', T.flujo.aria)
    for (const id of Object.keys(NODOS)) nodos[id].nombre.textContent = N(id)
    for (const b of document.querySelectorAll('[data-idioma]')) b.setAttribute('aria-pressed', String(b.dataset.idioma === lang))
  }

  const silencio = e => { if (e.message !== 'cancelado') throw e }

  async function arrancar() {
    const t = ++turno
    const m = T.flujo.m
    fase = 'inicio'
    limpiar()
    controles('espera')
    estado.textContent = T.flujo.trabajando
    poner('vigia', 'f-trabaja')
    await espera(650, t)
    poner('vigia', 'f-aviso', '!')
    hablar('vigia', m.detecta)
    await volar('vigia', 'tu', t)
    poner('tu', 'f-tu')
    fase = 'tarea'
    estado.textContent = T.flujo.q1
    controles('pregunta')
  }

  async function trabajar() {
    const t = ++turno
    const m = T.flujo.m
    fase = 'trabajando'
    controles('espera')
    estado.textContent = T.flujo.trabajando
    poner('vigia', 'f-ok', '✓')
    poner('tu', 'f-ok', '✓')
    hablar('tu', m.tuSi)
    await volar('tu', 'prog', t)
    poner('prog', 'f-trabaja')
    hablar('prog', m.hace)
    await espera(850, t)

    poner('prog', 'f-ok', '✓')
    hablar('prog', m.revisad)
    await Promise.all(REVISORES.map(r => volar('prog', r, t).then(() => poner(r, 'f-trabaja'))))

    for (const [r, txt] of [['seg', m.seg], ['ui', m.ui], ['cod', m.cod]]) {
      poner(r, 'f-ok', '✓')
      hablar(r, txt)
      await espera(800, t)
    }

    // Un revisor encuentra algo: se lo devuelve al programador y lo vuelve a comprobar.
    poner('ux', 'f-aviso', '!')
    hablar('ux', m.aviso)
    await espera(750, t)
    await volar('ux', 'prog', t)
    poner('prog', 'f-trabaja')
    hablar('prog', m.arregla)
    await espera(700, t)
    poner('prog', 'f-ok', '✓')
    await volar('prog', 'ux', t)
    poner('ux', 'f-ok', '✓')
    hablar('ux', m.ahoraSi)
    await espera(650, t)

    await Promise.all(REVISORES.map(r => volar(r, 'apr', t)))
    poner('apr', 'f-trabaja')
    hablar('apr', m.decide)
    await espera(900, t)

    await volar('apr', 'tu', t)
    poner('apr', 'f-espera')
    poner('tu', 'f-tu')
    hablar('apr', m.tuOk)
    fase = 'publicar'
    estado.textContent = T.flujo.q2
    controles('pregunta')
  }

  async function publicar() {
    const t = ++turno
    const m = T.flujo.m
    fase = 'publicando'
    controles('espera')
    estado.textContent = T.flujo.trabajando
    poner('tu', 'f-ok', '✓')
    hablar('tu', m.publica)
    await volar('tu', 'apr', t)
    poner('apr', 'f-ok', '✓')
    await volar('apr', 'web', t)
    poner('web', 'f-ok', '✓')
    hablar('web', m.web)
    await espera(700, t)
    await volar('web', 'ana', t)
    poner('ana', 'f-ok', '✓')
    hablar('ana', m.ana)
    fase = 'fin'
    estado.textContent = T.flujo.fin
    controles('fin')
  }

  async function rechazarTarea() {
    const t = ++turno
    const m = T.flujo.m
    fase = 'cerrando'
    controles('espera')
    estado.textContent = T.flujo.trabajando
    poner('tu', 'f-no', '×')
    hablar('tu', m.tuNo)
    await volar('tu', 'vigia', t)
    poner('vigia', 'f-espera')
    hablar('vigia', m.vigiaNo)
    fase = 'fin'
    estado.textContent = T.flujo.finNo1
    controles('fin')
  }

  async function rechazarPublicar() {
    const t = ++turno
    const m = T.flujo.m
    fase = 'cerrando'
    controles('espera')
    estado.textContent = T.flujo.trabajando
    poner('tu', 'f-no', '×')
    hablar('tu', m.tuNoPub)
    await volar('tu', 'apr', t)
    poner('apr', 'f-no', '×')
    hablar('apr', m.aprNo)
    fase = 'fin'
    estado.textContent = T.flujo.finNo2
    controles('fin')
  }

  si.addEventListener('click', () => {
    if (fase === 'tarea') trabajar().catch(silencio)
    else if (fase === 'publicar') publicar().catch(silencio)
    else if (fase === 'fin') arrancar().catch(silencio)
  })
  no.addEventListener('click', () => {
    if (fase === 'tarea') rechazarTarea().catch(silencio)
    else if (fase === 'publicar') rechazarPublicar().catch(silencio)
  })
  for (const b of document.querySelectorAll('[data-idioma]')) {
    b.addEventListener('click', () => {
      if (b.dataset.idioma === lang) return
      lang = b.dataset.idioma
      try { localStorage.setItem('idioma', lang) } catch { /* da igual */ }
      textosFijos()
      arrancar().catch(silencio)
    })
  }

  textosFijos()
  arrancar().catch(silencio)
}

const raiz = document.getElementById('flujo')
if (raiz) iniciar(raiz)
