// motor.js — Las reglas del simulador, sin interfaz. Todo es determinista: la misma petición con el
// mismo contexto da siempre el mismo resultado. No se llama a ninguna IA; en la oficina real cada
// revisor es un agente que lee el cambio, aquí cada uno es una tabla de reglas que imita su criterio.
//
// Recorrido: clasificar(texto) → señales · revisar(señales, contexto) → 4 veredictos ·
//            aprobar(señales, veredictos, contexto) → decisión, nivel y regla aplicada.
// decidirFabrica() es la misma lógica que fabricas/comprobar.mjs (las pruebas comprueban que coinciden).

export const NIVELES = {
  verde: { nombre: 'Verde', accion: 'Se hace solo', orden: 0 },
  azul: { nombre: 'Azul', accion: 'Se hace y avisa', orden: 1 },
  naranja: { nombre: 'Naranja', accion: 'Espera tu OK', orden: 2 },
  rojo: { nombre: 'Rojo', accion: 'Nunca: lo hace el humano', orden: 3 }
}

// Minúsculas y sin tildes, para que «producción» y «produccion» cuenten igual.
export function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

// Señales: qué se reconoce en la petición, con su nivel según REGLAS.md.
// El orden no importa: el nivel final es el más alto de todas las señales encontradas.
export const SENALES = [
  // Rojo: nunca lo hace un agente
  { id: 'secretos', nivel: 'rojo', que: 'claves, tokens o contraseñas', re: /\b(contrasen\w*|password|claves?|tokens?|api ?keys?|secretos?|credencial\w*|certificados?)\b/ },
  { id: 'dinero', nivel: 'rojo', que: 'mover dinero', re: /\b(pag(ar|o|os|ue)|transferenc\w*|reembols\w*|devolver (el )?dinero|cobrar)\b/ },
  { id: 'borrar_clientes', nivel: 'rojo', que: 'borrar datos de clientes', re: /\b(borr|elimin|purg)\w*\b.*\b(clientes?|usuarios?|socios?)\b/ },
  { id: 'cuentas', nivel: 'rojo', que: 'crear cuentas', re: /\b(crear|abrir|dar de alta)\b.*\bcuentas?\b/ },
  // Naranja: sale fuera, cuesta dinero o es difícil de deshacer
  { id: 'produccion', nivel: 'naranja', que: 'producción', re: /\b(produccion|despleg\w*|despliegue|deploy|subir a|release|lanzar)\b/ },
  { id: 'publicar', nivel: 'naranja', que: 'publicar', re: /\b(publica\w*|tuit\w*|redes sociales|anuncios?)\b/ },
  { id: 'email_clientes', nivel: 'naranja', que: 'mensajes a clientes', re: /\b(emails?|correos?|newsletter|sms|whatsapp|mensajes?)\b.*\b(clientes?|usuarios?|suscriptores?|lista)\b|\benviar (un |el )?(email|correo|boletin)\b/ },
  { id: 'datos', nivel: 'naranja', que: 'la base de datos', re: /\b(base de datos|migracion\w*|esquema|tablas?|sql|postgres\w*)\b/ },
  { id: 'dinero_negocio', nivel: 'naranja', que: 'precios o gastos', re: /\b(precios?|tarifas?|descuentos?|gastos?|comprar|contratar|suscripcion\w*)\b/ },
  { id: 'borrar', nivel: 'naranja', que: 'borrar algo', re: /\b(borr|elimin)\w*\b/ },
  { id: 'programadas', nivel: 'naranja', que: 'tareas programadas', re: /\b(tareas? programadas?|cron|programacion\w*)\b/ },
  { id: 'dependencias', nivel: 'naranja', que: 'dependencias', re: /\b(dependencias?|paquetes?|librerias?|npm|version)\b/ },
  { id: 'permisos', nivel: 'naranja', que: 'permisos y acceso', re: /\b(permisos?|roles?|accesos?|login|sesion|autentica\w*)\b/ },
  { id: 'personales', nivel: 'naranja', que: 'datos personales', re: /\b(dni|telefonos?|salud|datos personales|direccion\w*)\b/ },
  // Azul: pequeño y reversible
  { id: 'texto', nivel: 'azul', que: 'un texto', re: /\b(textos?|typo|errata\w*|ortografia|traduc\w*|titulos?|etiquetas?)\b/ },
  { id: 'estilo', nivel: 'azul', que: 'el aspecto', re: /\b(colou?r\w*|estilos?|css|margen\w*|fuentes?|tipografia|iconos?|botone?s?|alinea\w*|tema oscuro)\b/ },
  { id: 'docs', nivel: 'azul', que: 'documentación', re: /\b(documentacion|readme|comentarios?|leeme)\b/ },
  { id: 'pruebas', nivel: 'azul', que: 'pruebas', re: /\b(tests?|pruebas?)\b/ },
  // Verde: leer, informar, preparar
  { id: 'leer', nivel: 'verde', que: 'leer o informar', re: /\b(informes?|resumen|leer|revisar|analiz\w*|estadistic\w*|metricas?|buscar|listar|vigilar|comprobar)\b/ },
  { id: 'borrador', nivel: 'verde', que: 'un borrador', re: /\b(borrador\w*|propuestas?|ideas?|rama propia|issues?)\b/ }
]

export function clasificar(texto) {
  const t = normalizar(texto)
  const senales = SENALES.filter(s => s.re.test(t))
  // «Borrar datos de clientes» ya es rojo: no hace falta además la señal genérica de borrar.
  const ids = new Set(senales.map(s => s.id))
  const limpias = senales.filter(s => !(s.id === 'borrar' && ids.has('borrar_clientes')))
  const nivelBase = limpias.reduce((n, s) => (NIVELES[s.nivel].orden > NIVELES[n].orden ? s.nivel : n), 'verde')
  return { texto: t, senales: limpias, ids: new Set(limpias.map(s => s.id)), nivelBase, reconocida: limpias.length > 0 }
}

const hay = (c, ...ids) => ids.some(i => c.ids.has(i))
const v = (veredicto, motivo) => ({ veredicto, motivo })

// Los cuatro revisores. Cada uno solo mira lo suyo; ninguno decide el nivel (eso es del Aprobador).
// contexto: { pruebas: true|false, grande: true|false }
export const REVISORES = [
  {
    id: 'seguridad', nombre: 'Seguridad',
    revisar(c) {
      if (hay(c, 'secretos')) return v('BLOQUEA', 'Un agente no maneja claves: rotarlas lo hace una persona en el proveedor y en el gestor de secretos.')
      if (hay(c, 'dinero')) return v('BLOQUEA', 'Mover dinero nunca lo hace un agente.')
      if (hay(c, 'borrar_clientes')) return v('BLOQUEA', 'Borrar datos de clientes es irreversible y tiene implicaciones legales.')
      if (hay(c, 'cuentas')) return v('BLOQUEA', 'Crear cuentas implica aceptar condiciones y guardar credenciales.')
      if (hay(c, 'permisos', 'personales')) return v('CON AVISOS', 'Toca acceso o datos personales: comprobar quién ve qué antes de seguir.')
      if (hay(c, 'produccion', 'datos')) return v('CON AVISOS', 'Afecta a producción o a los datos: copia de seguridad y configuración revisadas.')
      if (hay(c, 'dependencias')) return v('CON AVISOS', 'Una dependencia nueva es código de terceros: revisar avisos de seguridad.')
      return v('OK', 'No toca secretos, permisos ni datos personales.')
    }
  },
  {
    id: 'ux', nombre: 'UX',
    revisar(c) {
      if (hay(c, 'email_clientes')) return v('CON AVISOS', 'Lo leerán clientes: revisar a quién va, el tono, el idioma y el enlace de baja.')
      if (hay(c, 'publicar')) return v('CON AVISOS', 'Sale al público: revisar el texto final antes de publicar.')
      if (hay(c, 'borrar', 'borrar_clientes')) return v('CON AVISOS', 'Pedir confirmación y que se pueda deshacer.')
      if (hay(c, 'dinero_negocio')) return v('CON AVISOS', 'Un cambio de precio se comunica antes de que lo vea el cliente.')
      if (hay(c, 'estilo', 'texto')) return v('OK', 'Cambio visible pequeño; mismo sitio y mismo nombre de siempre.')
      return v('NO APLICA', 'No cambia nada de lo que usa una persona.')
    }
  },
  {
    id: 'ui', nombre: 'UI',
    revisar(c) {
      if (hay(c, 'estilo')) return v('OK', 'Comprobado en tema claro y oscuro y a 375 px; contraste suficiente.')
      if (hay(c, 'email_clientes', 'publicar')) return v('OK', 'Usa la plantilla común.')
      if (hay(c, 'texto')) return v('OK', 'El texto cabe y no rompe la maquetación.')
      return v('NO APLICA', 'Sin cambios visuales.')
    }
  },
  {
    id: 'codigo', nombre: 'Código',
    revisar(c, ctx) {
      if (c.nivelBase === 'rojo') return v('NO APLICA', 'No hay código que revisar: esto no lo hace un agente.')
      if (c.reconocida && c.nivelBase === 'verde') return v('NO APLICA', 'Solo lee, informa o prepara en su rama propia: no toca la rama de trabajo.')
      if (!c.reconocida && ctx.pruebas !== false) return v('CON AVISOS', 'No se entiende qué hay que cambiar: mejor preguntar.')
      if (ctx.pruebas === false) return v('BLOQUEA', 'Las pruebas no pasan: el cambio vuelve atrás.')
      if (ctx.grande) return v('CON AVISOS', 'Más de 80 líneas: ya no cuenta como cambio pequeño.')
      if (hay(c, 'datos')) return v('CON AVISOS', 'Necesita migración y probarla desde cero.')
      if (hay(c, 'dependencias')) return v('CON AVISOS', 'Revisar el registro de cambios de la versión nueva.')
      if (hay(c, 'produccion')) return v('CON AVISOS', 'Solo después de pasar todas las pruebas.')
      return v('OK', 'Pruebas en verde y cambio acotado.')
    }
  }
]

export function revisar(c, ctx = {}) {
  return REVISORES.map(r => ({ id: r.id, nombre: r.nombre, ...r.revisar(c, ctx) }))
}

// El Aprobador: la primera regla que se cumple decide. El texto de `regla` es lo que enseña el simulador.
export const REGLAS_APROBADOR = [
  {
    id: 'rojo', si: (c) => c.nivelBase === 'rojo',
    dar: (c) => ({ decision: 'FUERA DEL CIRCUITO', nivel: 'rojo', regla: `Rojo en REGLAS.md: ${listar(c, 'rojo')} lo hace siempre una persona, aunque los revisores estén de acuerdo.` })
  },
  {
    id: 'bloqueo', si: (c, vs) => vs.some(x => x.veredicto === 'BLOQUEA'),
    dar: (c, vs) => ({ decision: 'RECHAZADO', nivel: c.reconocida ? c.nivelBase : 'naranja', regla: `Un revisor bloquea (${vs.filter(x => x.veredicto === 'BLOQUEA').map(x => x.nombre).join(', ')}): el cambio vuelve al agente, que lo arregla y repite el circuito (máximo dos vueltas; a la tercera pregunta al humano).` })
  },
  {
    id: 'naranja', si: (c) => c.nivelBase === 'naranja',
    dar: (c) => ({ decision: 'NECESITA AL HUMANO', nivel: 'naranja', regla: `Naranja en REGLAS.md: toca ${listar(c, 'naranja')}. Sale fuera, cuesta dinero o es difícil de deshacer.`, porque: `toca ${listar(c, 'naranja')}` })
  },
  {
    id: 'duda', si: (c) => !c.reconocida,
    dar: () => ({ decision: 'NECESITA AL HUMANO', nivel: 'naranja', regla: 'En la duda, naranja: la petición no encaja en ninguna regla conocida, así que se pregunta.', porque: 'no encaja en ninguna regla conocida' })
  },
  {
    id: 'grande', si: (c, vs, ctx) => c.nivelBase === 'azul' && ctx.grande,
    dar: () => ({ decision: 'NECESITA AL HUMANO', nivel: 'naranja', regla: 'Azul solo vale para cambios pequeños (menos de ~80 líneas): uno grande sube a naranja.', porque: 'es un cambio grande' })
  },
  {
    id: 'fabrica', si: (c, vs, ctx) => c.nivelBase === 'azul' && ctx.revisionHumana,
    dar: () => ({ decision: 'NECESITA AL HUMANO', nivel: 'naranja', regla: 'La fábrica de este agente está «con revisión»: aunque sea azul, sale como PR que aprueba el humano.', porque: 'su fábrica trabaja con revisión' })
  },
  {
    id: 'azul', si: (c) => c.nivelBase === 'azul',
    dar: (c) => ({ decision: 'DIRECTO', nivel: 'azul', regla: `Azul en REGLAS.md: ${listar(c, 'azul')}, pequeño y reversible, con las pruebas en verde. Se integra en la rama de trabajo y se avisa.` })
  },
  {
    id: 'verde', si: () => true,
    dar: (c) => ({ decision: 'SE HACE SOLO', nivel: 'verde', regla: `Verde en REGLAS.md: ${listar(c, 'verde') || 'leer o preparar'} no cambia nada fuera de la carpeta del agente.` })
  }
]

function listar(c, nivel) {
  const q = c.senales.filter(s => s.nivel === nivel).map(s => s.que)
  return q.length > 1 ? q.slice(0, -1).join(', ') + ' y ' + q.at(-1) : (q[0] || '')
}

export function aprobar(c, vs, ctx = {}) {
  const r = REGLAS_APROBADOR.find(x => x.si(c, vs, ctx))
  const res = r.dar(c, vs, ctx)
  return { ...res, reglaId: r.id, avisos: vs.filter(x => x.veredicto === 'CON AVISOS') }
}

// La pregunta que el agente dejaría en su estado.json (formato de PREGUNTAS.md).
export function preguntaPara(peticion, agente, resultado, fecha) {
  const texto = String(peticion || '').trim().replace(/[.\s]+$/, '')
  if (resultado.nivel === 'rojo') {
    return {
      id: 'humano-' + slug(texto), fecha,
      texto: `[demo] La persona responsable hace «${texto}» — ${agente} no puede por las reglas (rojo) — si no se hace, queda en «Tus tareas».`,
      opciones: ['Lo hace la persona', 'No se hace'], respuesta: null, atendida: false
    }
  }
  if (resultado.decision !== 'NECESITA AL HUMANO') return null
  return {
    id: slug(texto), fecha,
    texto: `[demo] ${agente} hace «${texto}» — ${resultado.porque} — si no, se queda preparado en una rama sin salir.`,
    opciones: ['Sí, que lo haga ' + agente, 'Cambiarlo', 'No'], respuesta: null, atendida: false
  }
}

function slug(t) {
  return normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'peticion'
}

// Copia de decidir() de fabricas/comprobar.mjs (sin archivos). Códigos: 0 · 3 · 4 · 5 · 2.
export function consumoVigente(c = {}, hoy) {
  return {
    ejecucionesDia: c.dia === hoy ? (c.ejecucionesDia || 0) : 0,
    gastoMes: c.mes === hoy.slice(0, 7) ? (c.gastoMes || 0) : 0
  }
}

export function decidirFabrica(f, consumo, hoy) {
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

// Todo el recorrido de una petición, tal como lo pinta el simulador.
export function simular(peticion, { fabrica, consumo, hoy, pruebas = true, grande = false } = {}) {
  const f = fabrica ? decidirFabrica(fabrica, consumo, hoy) : { codigo: 0, trabajar: true, revision: false }
  if (!f.trabajar) return { fabrica: f, parado: true }
  const c = clasificar(peticion)
  const ctx = { pruebas, grande, revisionHumana: !!f.revision }
  const veredictos = revisar(c, ctx)
  const resultado = aprobar(c, veredictos, ctx)
  return { fabrica: f, clasificacion: c, veredictos, resultado }
}
