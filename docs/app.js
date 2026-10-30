// app.js — Interfaz del simulador. Pinta lo que calcula motor.js; aquí no hay reglas de decisión.
// Todo se construye con textContent (nunca innerHTML con lo que escribe el visitante).
import { simular, decidirFabrica, preguntaPara, NIVELES } from './motor.js'

// Las mismas fábricas que fabricas.json de la raíz (GitHub Pages solo sirve docs/, por eso van copiadas).
const FABRICAS = [
  { id: 'vigia', nombre: 'Vigía de errores', horario: 'Cada día a las 8:00', estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 2, gastoMes: 3 }, costeVuelta: 0.05 },
  { id: 'seguridad', nombre: 'Revisor de seguridad', horario: 'Los lunes a las 9:00', estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 1, gastoMes: 2 }, costeVuelta: 0.2 },
  { id: 'web', nombre: 'Mantenimiento web', horario: 'Cuando hay issues pequeños', estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 4, gastoMes: 5 }, costeVuelta: 0.25 },
  { id: 'programador', nombre: 'Programador', horario: 'Cada día a las 9:30 y cuando hay cola', estado: 'en_marcha', revision: 'humano', limites: { ejecucionesDia: 3, gastoMes: 10 }, costeVuelta: 0.6 },
  { id: 'redactor', nombre: 'Redactor de borradores', horario: 'Martes y jueves', estado: 'en_marcha', revision: 'humano', limites: { ejecucionesDia: 1, gastoMes: 4 }, costeVuelta: 0.3 },
  { id: 'analista', nombre: 'Analista de métricas', horario: 'Los viernes', estado: 'pausada', revision: 'sin_revision', limites: { ejecucionesDia: 1, gastoMes: 2 }, costeVuelta: 0.15 }
]

const EJEMPLOS = [
  'Cambiar el color de un botón',
  'Corregir una errata en la portada',
  'Hacer el informe semanal de errores',
  'Subir a producción la versión nueva',
  'Enviar un email a todos los clientes',
  'Rotar una clave de la API',
  'Actualizar una dependencia',
  'Borrar los datos de un cliente',
  'Cambiar los precios'
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
const ultimaLinea = {}

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
const claseVeredicto = v => 'veredicto v-' + v.toLowerCase().replace(/\s+/g, '-')

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
for (const e of EJEMPLOS) {
  $('ejemplos').append(el('button', { type: 'button', class: 'chip', onclick: () => { $('peticion').value = e; ejecutar() } }, e))
}
function pintarSelectorAgente() {
  const sel = $('agente'), antes = sel.value
  sel.replaceChildren(...FABRICAS.map(f => el('option', { value: f.id }, f.nombre)))
  sel.value = antes || 'web'
}
$('form').addEventListener('submit', ev => { ev.preventDefault(); ejecutar() })
for (const id of ['agente', 'pruebas', 'grande']) $(id).addEventListener('change', () => { if ($('peticion').value.trim()) ejecutar() })

// ---------- Circuito ----------
function ejecutar() {
  const peticion = $('peticion').value.trim()
  if (!peticion) { $('peticion').focus(); return }
  const fabrica = FABRICAS.find(f => f.id === $('agente').value)
  const r = simular(peticion, { fabrica, consumo: consumo[fabrica.id], hoy: HOY, pruebas: $('pruebas').checked, grande: $('grande').checked })
  pintarCircuito(peticion, fabrica, r)
  // El enlace de la página guarda la petición para poder compartir el resultado.
  try { history.replaceState(null, '', '#p=' + encodeURIComponent(peticion)) } catch { /* sin historial */ }
}

function pintarCircuito(peticion, fabrica, r) {
  const caja = $('circuito')
  caja.classList.remove('vacio')
  const etapas = []
  let retraso = 0
  const anim = n => { n.classList.add('aparece'); n.style.animationDelay = (retraso += 70) + 'ms'; return n }

  // 0. La fábrica del agente
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, `Fábrica de ${fabrica.nombre}`),
    el('p', { class: 'linea' }, el('b', {}, `código ${r.fabrica.codigo}`), ' · ', r.fabrica.mensaje || 'Adelante.'))))

  if (r.parado) {
    etapas.push(anim(el('div', { class: 'resultado parado' },
      el('p', { class: 'grande' }, 'No trabaja hoy'),
      el('p', { class: 'regla' }, 'Regla aplicada: REGLAS.md, «Antes de trabajar: la fábrica». Con código 4 o 5 el agente no hace nada, apunta esta línea en su informe y termina. Cambia su estado en el panel de agentes.'))))
    caja.replaceChildren(...etapas)
    return
  }

  const c = r.clasificacion
  // 1. Petición y señales reconocidas
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, 'Petición'),
    el('div', { class: 'peticion-eco' }, peticion),
    el('div', { class: 'senales', 'aria-label': 'Qué se ha reconocido' },
      c.senales.length
        ? c.senales.map(s => el('span', { class: `senal nivel-${s.nivel}` }, `${s.que} · ${NIVELES[s.nivel].nombre.toLowerCase()}`))
        : el('span', { class: 'senal' }, 'nada reconocido')))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 2. Cuatro revisores en paralelo
  etapas.push(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, 'Revisores, en paralelo'),
    el('div', { class: 'revisores' }, r.veredictos.map(v => anim(el('article', { class: 'tarjeta' },
      el('h3', {}, v.nombre),
      el('span', { class: claseVeredicto(v.veredicto) }, v.veredicto),
      el('p', {}, v.motivo)))))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 3. Aprobador
  const res = r.resultado
  etapas.push(anim(el('div', { class: 'etapa' },
    el('p', { class: 'etapa-titulo' }, 'Aprobador'),
    el('div', { class: 'aprobador' },
      el('div', { class: 'decision' }, res.decision),
      res.avisos.length ? el('ul', {}, res.avisos.map(a => el('li', {}, `${a.nombre}: ${a.motivo}`))) : null))))
  etapas.push(el('div', { class: 'flecha', 'aria-hidden': 'true' }, '↓'))

  // 4. Nivel resultante y regla
  const nivel = NIVELES[res.nivel]
  const sub = {
    'SE HACE SOLO': `${fabrica.nombre} lo hace sin preguntar y lo cuenta en su informe.`,
    'DIRECTO': `${fabrica.nombre} lo integra en la rama de trabajo y avisa. Producción sigue siendo cosa del humano.`,
    'NECESITA AL HUMANO': `${fabrica.nombre} lo deja preparado en una rama o PR y pregunta. Sin respuesta, no se hace.`,
    'RECHAZADO': `Vuelve a ${fabrica.nombre} con la lista de arreglos y repite el circuito.`,
    'FUERA DEL CIRCUITO': 'Ningún agente lo hace. Queda como tarea para una persona.'
  }[res.decision]
  const pregunta = preguntaPara(peticion, fabrica.nombre, res, new Date().toISOString().slice(0, 19) + 'Z')
  etapas.push(anim(el('div', { class: `resultado nivel-${res.nivel}` },
    el('p', { class: 'grande' }, res.decision === 'RECHAZADO' ? 'Rechazado: vuelve atrás' : `${nivel.nombre} · ${nivel.accion}`),
    el('p', { class: 'sub' }, sub),
    el('p', { class: 'regla' }, el('strong', {}, 'Regla aplicada: '), res.regla),
    pregunta ? el('details', { class: 'pregunta' },
      el('summary', {}, 'Pregunta que deja en su estado.json'),
      el('pre', {}, JSON.stringify(pregunta, null, 2))) : null)))

  caja.replaceChildren(...etapas)
}

// ---------- Panel de agentes ----------
const ESTADOS = [
  { valor: 'en_marcha|sin_revision', texto: 'Encendido, sin revisión' },
  { valor: 'en_marcha|humano', texto: 'Encendido, con revisión' },
  { valor: 'pausada|sin_revision', texto: 'Pausado' }
]

function medidor(etiqueta, usado, tope, fmt = x => x) {
  const pct = tope ? Math.min(100, (usado / tope) * 100) : 0
  const clase = pct >= 100 ? 'lleno' : pct >= 75 ? 'medio' : ''
  return el('div', { class: 'medidor' },
    el('div', { class: 'medidor-fila' }, el('span', {}, etiqueta), el('span', {}, `${fmt(usado)} de ${fmt(tope)}`)),
    el('div', { class: 'barra', role: 'progressbar', 'aria-label': etiqueta, 'aria-valuemin': '0', 'aria-valuemax': String(tope), 'aria-valuenow': String(usado) },
      el('i', { class: clase, style: `width:${pct}%` })))
}

function pintarPanel() {
  const euros = x => x.toFixed(2).replace('.', ',') + ' €'
  $('panel').replaceChildren(...FABRICAS.map(f => {
    const d = decidirFabrica(f, consumo[f.id], HOY)
    const c = consumo[f.id] || {}
    const etiqueta = d.codigo === 4 ? ['Pausado', 'e-pausada'] : d.codigo === 5 ? ['Tope alcanzado', 'e-tope']
      : d.codigo === 3 ? ['Con revisión', 'e-revision'] : ['Encendido', 'e-marcha']
    const sel = el('select', { 'aria-label': `Estado de ${f.nombre}`, onchange: ev => {
      const [estado, revision] = ev.target.value.split('|'); f.estado = estado; f.revision = revision
      ultimaLinea[f.id] = null; pintarPanel(); if ($('peticion').value.trim()) ejecutar()
    } }, ESTADOS.map(e => el('option', { value: e.valor }, e.texto)))
    sel.value = `${f.estado}|${f.estado === 'pausada' ? 'sin_revision' : f.revision}`
    return el('article', { class: 'agente' },
      el('div', { class: 'agente-cabeza' },
        el('div', {}, el('h3', {}, f.nombre), el('p', { class: 'horario' }, `${f.horario} · id «${f.id}»`)),
        el('span', { class: 'estado ' + etiqueta[1] }, etiqueta[0])),
      medidor('Vueltas hoy', c.ejecucionesDia || 0, f.limites.ejecucionesDia),
      medidor('Gasto del mes', c.gastoMes || 0, f.limites.gastoMes, euros),
      el('div', { class: 'agente-acciones' }, sel,
        el('button', { type: 'button', onclick: () => vuelta(f) }, 'Simular una vuelta')),
      ultimaLinea[f.id] ? el('p', { class: 'linea' }, el('b', {}, `código ${ultimaLinea[f.id].codigo}`), ' · ', ultimaLinea[f.id].mensaje) : null)
  }))
}

// Una vuelta: comprobar la fábrica y, si puede trabajar, apuntar la ejecución y su coste.
function vuelta(f) {
  const d = decidirFabrica(f, consumo[f.id], HOY)
  if (d.trabajar) {
    const c = consumo[f.id] || {}
    consumo[f.id] = { dia: HOY, ejecucionesDia: (c.ejecucionesDia || 0) + 1, mes: HOY.slice(0, 7), gastoMes: Math.round(((c.gastoMes || 0) + f.costeVuelta) * 100) / 100 }
  }
  ultimaLinea[f.id] = d
  pintarPanel()
  if ($('peticion').value.trim() && $('agente').value === f.id) ejecutar()
}

$('reiniciar').addEventListener('click', () => {
  consumo = consumoInicial()
  for (const k of Object.keys(ultimaLinea)) ultimaLinea[k] = null
  pintarPanel()
  if ($('peticion').value.trim()) ejecutar()
})

pintarSelectorAgente()
pintarPanel()
// Si se llega con #p=<petición> (enlace compartido), se simula al cargar.
if (location.hash.startsWith('#p=')) {
  try { $('peticion').value = decodeURIComponent(location.hash.slice(3)).slice(0, 160) } catch { /* enlace roto */ }
  if ($('peticion').value.trim()) ejecutar()
}
