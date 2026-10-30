// oficina.test.mjs — Pruebas de las reglas del simulador y de comprobar.mjs (node --test, sin dependencias).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simular, decidirFabrica } from '../docs/motor.js'
import { decidir, comprobar, apuntar } from '../fabricas/comprobar.mjs'

const casos = [
  ['Cambiar el color de un botón', 'azul', 'DIRECTO'],
  ['Corregir una errata en la portada', 'azul', 'DIRECTO'],
  ['Hacer el informe semanal de errores', 'verde', 'SE HACE SOLO'],
  ['Subir a producción la versión nueva', 'naranja', 'NECESITA AL HUMANO'],
  ['Enviar un email a todos los clientes', 'naranja', 'NECESITA AL HUMANO'],
  ['Actualizar una dependencia', 'naranja', 'NECESITA AL HUMANO'],
  ['Cambiar los precios', 'naranja', 'NECESITA AL HUMANO'],
  ['Rotar una clave de la API', 'rojo', 'FUERA DEL CIRCUITO'],
  ['Borrar los datos de un cliente', 'rojo', 'FUERA DEL CIRCUITO'],
  ['Pagar la factura del servidor', 'rojo', 'FUERA DEL CIRCUITO'],
  ['Hacer magia', 'naranja', 'NECESITA AL HUMANO']
]
for (const [peticion, nivel, decision] of casos) {
  test(`"${peticion}" -> ${nivel}`, () => {
    const r = simular(peticion)
    assert.equal(r.resultado.nivel, nivel)
    assert.equal(r.resultado.decision, decision)
    assert.equal(r.veredictos.length, 4)
  })
}

test('pruebas en rojo: rechazado', () => {
  assert.equal(simular('Cambiar el color de un botón', { pruebas: false }).resultado.decision, 'RECHAZADO')
})
test('cambio grande: azul sube a naranja', () => {
  const r = simular('Cambiar el color de un botón', { grande: true }).resultado
  assert.equal(r.nivel, 'naranja'); assert.equal(r.reglaId, 'grande')
})
test('fábrica con revisión: azul sale como PR', () => {
  const fabrica = { id: 'p', nombre: 'P', estado: 'en_marcha', revision: 'humano', limites: {} }
  assert.equal(simular('Corregir una errata', { fabrica, hoy: '2026-01-15' }).resultado.reglaId, 'fabrica')
})
test('la fábrica nunca rebaja un rojo', () => {
  const fabrica = { id: 'p', nombre: 'P', estado: 'en_marcha', revision: 'sin_revision', limites: {} }
  assert.equal(simular('Rotar una clave', { fabrica, hoy: '2026-01-15' }).resultado.nivel, 'rojo')
})

// Fábricas: la copia del simulador y comprobar.mjs tienen que decidir igual.
const hoy = '2026-01-15'
const base = { id: 'x', nombre: 'X', estado: 'en_marcha', revision: 'sin_revision', limites: { ejecucionesDia: 2, gastoMes: 1 }, costeVuelta: 0.4 }
const escenarios = [
  [base, undefined, 0],
  [{ ...base, revision: 'humano' }, undefined, 3],
  [{ ...base, estado: 'pausada' }, undefined, 4],
  [{ ...base, estado: 'por_montar' }, undefined, 4],
  [base, { dia: hoy, ejecucionesDia: 2, mes: '2026-01', gastoMes: 0 }, 5],
  [base, { dia: '2026-01-14', ejecucionesDia: 9, mes: '2026-01', gastoMes: 0 }, 0],
  [base, { dia: hoy, ejecucionesDia: 0, mes: '2026-01', gastoMes: 0.7 }, 5],
  [base, { dia: hoy, ejecucionesDia: 0, mes: '2025-12', gastoMes: 0.9 }, 0],
  [undefined, undefined, 2]
]
for (const [i, [f, c, codigo]] of escenarios.entries()) {
  test(`fábrica, escenario ${i + 1} -> codigo ${codigo} en los dos sitios`, () => {
    assert.equal(decidir(f, c, hoy).codigo, codigo)
    assert.deepEqual(decidirFabrica(f, c, hoy), decidir(f, c, hoy))
  })
}

test('comprobar + apuntar sobre archivos de verdad', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oficina-'))
  try {
    const rutaFabricas = join(dir, 'fabricas.json'), rutaConsumo = join(dir, 'consumo.json')
    writeFileSync(rutaFabricas, JSON.stringify({ fabricas: [{ ...base, id: 'vigia' }] }))
    assert.equal(comprobar('vigia', { rutaFabricas, rutaConsumo, hoy }).codigo, 0)
    assert.equal(comprobar('nadie', { rutaFabricas, rutaConsumo, hoy }).codigo, 2)
    apuntar('vigia', 0.4, { rutaConsumo, hoy })
    apuntar('vigia', 0.4, { rutaConsumo, hoy })
    assert.deepEqual(JSON.parse(readFileSync(rutaConsumo, 'utf8')).vigia, { dia: hoy, ejecucionesDia: 2, mes: '2026-01', gastoMes: 0.8 })
    assert.equal(comprobar('vigia', { rutaFabricas, rutaConsumo, hoy }).codigo, 5)
    assert.equal(comprobar('vigia', { rutaFabricas, rutaConsumo, hoy: '2026-02-01' }).codigo, 0)
    assert.equal(comprobar('vigia', { rutaFabricas: join(dir, 'no-existe.json'), rutaConsumo, hoy }).codigo, 2)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
