#!/usr/bin/env node
// comprobar.mjs — Lo llama cada agente antes de trabajar para saber si su fábrica está encendida,
// si su trabajo pasa por revisión humana y si le queda cupo de ejecuciones y de gasto.
//
//   node fabricas/comprobar.mjs <id>                    ¿Puedo trabajar?
//   node fabricas/comprobar.mjs <id> --apuntar <coste>  Apunta una vuelta hecha (al terminar)
//
// Imprime una línea para el agente y sale con un código:
//   0 = adelante, sin revisión
//   3 = adelante, pero lo que cambie fuera de su carpeta va como borrador, rama o PR
//   4 = fábrica pausada o por montar: no hagas nada
//   5 = tope de ejecuciones del día o de gasto del mes alcanzado: no hagas nada
//   2 = no se puede leer la configuración o el agente no existe: tampoco hagas nada
//
// Rutas: FABRICAS_JSON y CONSUMO_JSON (por defecto, fabricas.json y consumo.json en la raíz del repo).
// También se puede importar: import { comprobar, decidir } from './comprobar.mjs'
// La misma lógica (decidir) está copiada en docs/motor.js para el simulador; pruebas/ comprueba que coinciden.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
export const RUTA_FABRICAS = process.env.FABRICAS_JSON || join(RAIZ, 'fabricas.json')
export const RUTA_CONSUMO = process.env.CONSUMO_JSON || join(RAIZ, 'consumo.json')

// Día y mes en hora local, para que el tope se reinicie a medianoche de quien lo usa.
export function hoyLocal(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Consumo vigente: lo de otro día no cuenta para el tope diario, ni lo de otro mes para el mensual.
export function consumoVigente(c = {}, hoy) {
  return {
    ejecucionesDia: c.dia === hoy ? (c.ejecucionesDia || 0) : 0,
    gastoMes: c.mes === hoy.slice(0, 7) ? (c.gastoMes || 0) : 0
  }
}

// Decisión pura: sin archivos, para poder probarla y reutilizarla.
export function decidir(f, consumo, hoy) {
  if (!f) return { codigo: 2, trabajar: false, mensaje: 'No existe esa fábrica. No hagas nada y pregúntaselo al humano.' }
  if (f.estado !== 'en_marcha') {
    const como = f.estado === 'pausada' ? 'está pausada' : 'está por montar'
    return { codigo: 4, trabajar: false, mensaje: `${f.nombre} ${como}: no hagas nada hoy.` }
  }
  const usado = consumoVigente(consumo, hoy)
  const lim = f.limites || {}
  if (lim.ejecucionesDia != null && usado.ejecucionesDia >= lim.ejecucionesDia) {
    return { codigo: 5, trabajar: false, mensaje: `${f.nombre} ya ha hecho ${usado.ejecucionesDia} de ${lim.ejecucionesDia} vueltas hoy: espera a mañana.` }
  }
  if (lim.gastoMes != null && usado.gastoMes + (f.costeVuelta || 0) > lim.gastoMes) {
    return { codigo: 5, trabajar: false, mensaje: `${f.nombre} llevaría ${(usado.gastoMes + (f.costeVuelta || 0)).toFixed(2)} de ${lim.gastoMes} de gasto este mes: no trabaja hasta el mes que viene o hasta que el humano suba el tope.` }
  }
  if (f.revision === 'humano') {
    return { codigo: 3, trabajar: true, revision: true, mensaje: `${f.nombre} en marcha con revisión: trabaja, pero lo que cambie fuera de su carpeta va como borrador, rama o PR y espera el OK.` }
  }
  return { codigo: 0, trabajar: true, revision: false, mensaje: `${f.nombre} en marcha sin revisión: adelante (REGLAS.md sigue valiendo).` }
}

function leerJSON(ruta, siNoExiste) {
  if (siNoExiste !== undefined && !existsSync(ruta)) return siNoExiste
  return JSON.parse(readFileSync(ruta, 'utf8'))
}

export function comprobar(id, { rutaFabricas = RUTA_FABRICAS, rutaConsumo = RUTA_CONSUMO, hoy = hoyLocal() } = {}) {
  let fabricas, consumo
  try {
    fabricas = leerJSON(rutaFabricas).fabricas
    consumo = leerJSON(rutaConsumo, {})
  } catch (e) {
    return { codigo: 2, trabajar: false, mensaje: `No se puede leer la configuración (${e.message}). No hagas nada.` }
  }
  const f = fabricas.find(x => x.id === id)
  if (!f) return { codigo: 2, trabajar: false, mensaje: `No hay ninguna fábrica «${id}» en fabricas.json. No hagas nada y pregúntaselo al humano.` }
  return { ...decidir(f, consumo[id], hoy), fabrica: f }
}

// Apunta una vuelta hecha. Escribe a .tmp y renombra para no dejar el archivo a medias.
export function apuntar(id, coste, { rutaConsumo = RUTA_CONSUMO, hoy = hoyLocal() } = {}) {
  const todo = leerJSON(rutaConsumo, {})
  const usado = consumoVigente(todo[id], hoy)
  todo[id] = {
    dia: hoy,
    ejecucionesDia: usado.ejecucionesDia + 1,
    mes: hoy.slice(0, 7),
    gastoMes: Math.round((usado.gastoMes + coste) * 100) / 100
  }
  writeFileSync(rutaConsumo + '.tmp', JSON.stringify(todo, null, 2) + '\n')
  renameSync(rutaConsumo + '.tmp', rutaConsumo)
  return todo[id]
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [id, opcion, valor] = process.argv.slice(2)
  if (!id) { console.error('Uso: node fabricas/comprobar.mjs <id> [--apuntar <coste>]'); process.exit(2) }
  if (opcion === '--apuntar') {
    const coste = Number(valor)
    if (!Number.isFinite(coste) || coste < 0) { console.error('El coste tiene que ser un número >= 0'); process.exit(2) }
    const c = apuntar(id, coste)
    console.log(`Apuntado: ${id} lleva ${c.ejecucionesDia} ${c.ejecucionesDia === 1 ? 'vuelta' : 'vueltas'} hoy y ${c.gastoMes} de gasto este mes.`)
    process.exit(0)
  }
  const r = comprobar(id)
  console.log(r.mensaje)
  process.exit(r.codigo)
}
