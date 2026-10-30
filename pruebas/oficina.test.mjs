// oficina.test.mjs — Pruebas de las reglas del simulador y de comprobar.mjs (node --test, sin dependencias).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simular, decidirFabrica, preguntaPara } from '../docs/motor.js'
import { TEXTOS } from '../docs/textos.js'
import { decidir, comprobar, apuntar } from '../fabricas/comprobar.mjs'

// Las mismas peticiones en inglés y en español tienen que acabar en el mismo nivel.
// decision es el código interno: solo · directo · humano · rechazado · fuera.
const casos = [
  ['Change the colour of a button', 'Cambiar el color de un botón', 'azul', 'directo'],
  ['Fix a typo on the home page', 'Corregir una errata en la portada', 'azul', 'directo'],
  ['Write the weekly error report', 'Hacer el informe semanal de errores', 'verde', 'solo'],
  ['Open a branch to try a new layout', 'Preparar una propuesta en su rama propia', 'verde', 'solo'],
  ['Deploy the new version to production', 'Subir a producción la versión nueva', 'naranja', 'humano'],
  ['Send an email to all customers', 'Enviar un email a todos los clientes', 'naranja', 'humano'],
  ['Email customers about the new opening hours', 'Mandar un correo a los clientes', 'naranja', 'humano'],
  ['Update a dependency', 'Actualizar una dependencia', 'naranja', 'humano'],
  ['Change the prices', 'Cambiar los precios', 'naranja', 'humano'],
  ['Add a column to the database', 'Añadir una columna a la base de datos', 'naranja', 'humano'],
  ['Delete an old branch', 'Borrar una rama vieja', 'naranja', 'humano'],
  ['Rotate an API key', 'Rotar una clave de la API', 'rojo', 'fuera'],
  ['Change the admin password', 'Cambiar la contraseña del admin', 'rojo', 'fuera'],
  ['Delete a customer’s data', 'Borrar los datos de un cliente', 'rojo', 'fuera'],
  ['Pay the server invoice', 'Pagar la factura del servidor', 'rojo', 'fuera'],
  ['Refund a booking', 'Hacer un reembolso de una reserva', 'rojo', 'fuera'],
  ['Do some magic', 'Hacer magia', 'naranja', 'humano']
]
for (const [en, es, nivel, decision] of casos) {
  for (const [peticion, lang] of [[en, 'en'], [es, 'es']]) {
    test(`[${lang}] "${peticion}" -> ${nivel}`, () => {
      const r = simular(peticion, { lang })
      assert.equal(r.resultado.nivel, nivel)
      assert.equal(r.resultado.decision, decision)
      assert.equal(r.veredictos.length, 4)
    })
  }
}

// Los ejemplos del simulador cubren los cuatro niveles en cada idioma.
test('los ejemplos de textos.js caen en verde, azul, naranja y rojo', () => {
  for (const lang of ['en', 'es']) {
    const niveles = new Set(TEXTOS[lang].ejemplos.map(e => simular(e, { lang }).resultado.nivel))
    assert.deepEqual([...niveles].sort(), ['azul', 'naranja', 'rojo', 'verde'])
  }
})

test('los textos salen en el idioma pedido', () => {
  const en = simular('Send an email to all customers', { lang: 'en' })
  const es = simular('Send an email to all customers', { lang: 'es' })
  assert.equal(en.resultado.decisionTexto, 'NEEDS THE HUMAN')
  assert.equal(es.resultado.decisionTexto, 'NECESITA AL HUMANO')
  assert.match(en.resultado.regla, /^Orange in REGLAS\.md: it touches messages to customers\./)
  assert.match(es.resultado.regla, /^Naranja en REGLAS\.md: toca mensajes a clientes\./)
  assert.equal(en.veredictos[0].nombre, 'Security')
  assert.equal(es.veredictos[0].nombre, 'Seguridad')
  const q = preguntaPara('Send an email to all customers', 'Programmer', en.resultado, 'x', 'en')
  assert.deepEqual(q.opciones, ['Yes, let Programmer do it', 'Change it', 'No'])
  assert.match(q.texto, /^\[demo\] Programmer does "Send an email to all customers" — it touches messages to customers — /)
  const rojo = simular('Rotar una clave', { lang: 'es' })
  assert.deepEqual(preguntaPara('Rotar una clave', 'Programador', rojo.resultado, 'x', 'es').opciones, ['Lo hace la persona', 'No se hace'])
  assert.equal(simular('Rotate a key').resultado.decisionTexto, 'OUTSIDE THE CIRCUIT')
})

test('pruebas en rojo: rechazado', () => {
  assert.equal(simular('Change the colour of a button', { pruebas: false }).resultado.decision, 'rechazado')
  assert.equal(simular('Cambiar el color de un botón', { pruebas: false, lang: 'es' }).resultado.decisionTexto, 'RECHAZADO')
})
test('cambio grande: azul sube a naranja', () => {
  const r = simular('Change the colour of a button', { grande: true }).resultado
  assert.equal(r.nivel, 'naranja'); assert.equal(r.reglaId, 'grande')
})
test('fábrica con revisión: azul sale como PR', () => {
  const fabrica = { id: 'p', nombre: 'P', estado: 'en_marcha', revision: 'humano', limites: {} }
  assert.equal(simular('Fix a typo', { fabrica, hoy: '2026-01-15' }).resultado.reglaId, 'fabrica')
  assert.equal(simular('Corregir una errata', { fabrica, hoy: '2026-01-15', lang: 'es' }).resultado.reglaId, 'fabrica')
})
test('la fábrica nunca rebaja un rojo', () => {
  const fabrica = { id: 'p', nombre: 'P', estado: 'en_marcha', revision: 'sin_revision', limites: {} }
  assert.equal(simular('Rotate a key', { fabrica, hoy: '2026-01-15' }).resultado.nivel, 'rojo')
  assert.equal(simular('Rotar una clave', { fabrica, hoy: '2026-01-15', lang: 'es' }).resultado.nivel, 'rojo')
})
test('mensajes de la fábrica en los dos idiomas', () => {
  const f = { id: 'p', nombre: { en: 'Programmer', es: 'Programador' }, estado: 'pausada', limites: {} }
  assert.equal(decidirFabrica(f, undefined, '2026-01-15', 'es').mensaje, 'Programador está pausada: no hagas nada hoy.')
  assert.equal(decidirFabrica(f, undefined, '2026-01-15').mensaje, 'Programmer is paused: do nothing today.')
})

// Fábricas: la copia del simulador (en inglés) y comprobar.mjs tienen que decidir igual, con el mismo mensaje.
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
    assert.equal(decidirFabrica(f, c, hoy, 'es').codigo, codigo)
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
