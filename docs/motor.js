// motor.js — Las reglas del simulador, sin interfaz. Todo es determinista: la misma petición con el
// mismo contexto da siempre el mismo resultado. No se llama a ninguna IA; en la oficina real cada
// revisor es un agente que lee el cambio, aquí cada uno es una tabla de reglas que imita su criterio.
//
// Bilingüe: las reglas reconocen peticiones en inglés y en español, y cada texto que se enseña va
// como { en, es }. El idioma se pasa en `lang` ('en' por defecto); los códigos internos (nivel,
// decisión, veredicto) no cambian con el idioma.
//
// Recorrido: clasificar(texto) → señales · revisar(señales, contexto) → 4 veredictos ·
//            aprobar(señales, veredictos, contexto) → decisión, nivel y regla aplicada.
// decidirFabrica() es la misma lógica que fabricas/comprobar.mjs (las pruebas comprueban que coinciden en inglés).

export const IDIOMAS = ['en', 'es']
const idioma = (lang) => (IDIOMAS.includes(lang) ? lang : 'en')
const tr = (x, lang) => (x && typeof x === 'object' ? x[idioma(lang)] : x)

export const NIVELES = {
  verde: { nombre: { en: 'Green', es: 'Verde' }, accion: { en: 'Done alone', es: 'Se hace solo' }, orden: 0 },
  azul: { nombre: { en: 'Blue', es: 'Azul' }, accion: { en: 'Done, then reported', es: 'Se hace y avisa' }, orden: 1 },
  naranja: { nombre: { en: 'Orange', es: 'Naranja' }, accion: { en: "Waits for the human's OK", es: 'Espera tu OK' }, orden: 2 },
  rojo: { nombre: { en: 'Red', es: 'Rojo' }, accion: { en: 'Never: a person does it', es: 'Nunca: lo hace el humano' }, orden: 3 }
}

// Decisiones del Aprobador: código interno → texto en cada idioma.
export const DECISIONES = {
  solo: { en: 'DONE ALONE', es: 'SE HACE SOLO' },
  directo: { en: 'DIRECT', es: 'DIRECTO' },
  humano: { en: 'NEEDS THE HUMAN', es: 'NECESITA AL HUMANO' },
  rechazado: { en: 'REJECTED', es: 'RECHAZADO' },
  fuera: { en: 'OUTSIDE THE CIRCUIT', es: 'FUERA DEL CIRCUITO' }
}

// Veredictos de los revisores: código interno (también la clase CSS v-<código>) → texto.
export const VEREDICTOS = {
  ok: { en: 'OK', es: 'OK' },
  'con-avisos': { en: 'WITH WARNINGS', es: 'CON AVISOS' },
  bloquea: { en: 'BLOCKS', es: 'BLOQUEA' },
  'no-aplica': { en: 'N/A', es: 'NO APLICA' }
}

// Minúsculas y sin tildes, para que «producción» y «produccion» cuenten igual.
export function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

// Señales: qué se reconoce en la petición (en inglés o en español), con su nivel según REGLAS.md.
// El orden no importa: el nivel final es el más alto de todas las señales encontradas.
export const SENALES = [
  // Rojo: nunca lo hace un agente
  { id: 'secretos', nivel: 'rojo', que: { en: 'keys, tokens or passwords', es: 'claves, tokens o contraseñas' },
    re: /\b(contrasen\w*|passwords?|passphrases?|claves?|keys?|tokens?|api ?keys?|secretos?|secrets?|credencial\w*|credentials?|certificados?|certificates?)\b/ },
  { id: 'dinero', nivel: 'rojo', que: { en: 'moving money', es: 'mover dinero' },
    re: /\b(pag(ar|o|os|ue)|transferenc\w*|reembols\w*|devolver (el )?dinero|cobrar|pay|pays|paying|payments?|payouts?|refund\w*|wire|transfer (the )?(money|funds)|charge (a |the )?(card|customer)s?)\b/ },
  { id: 'borrar_clientes', nivel: 'rojo', que: { en: 'deleting customer data', es: 'borrar datos de clientes' },
    re: /\b(borr|elimin|purg|delet|eras|wip|remov)\w*\b.*\b(clientes?|usuarios?|socios?|customers?|clients?|users?|members?)\b/ },
  { id: 'cuentas', nivel: 'rojo', que: { en: 'creating accounts', es: 'crear cuentas' },
    re: /\b(crear|abrir|dar de alta)\b.*\bcuentas?\b|\b(create|open|register|sign up for|set up)\b.*\baccounts?\b/ },
  // Naranja: sale fuera, cuesta dinero o es difícil de deshacer
  { id: 'produccion', nivel: 'naranja', que: { en: 'production', es: 'producción' },
    re: /\b(produccion|despleg\w*|despliegue|deploy\w*|subir a|release|lanzar|production|prod|go live|launch|ship)\b/ },
  { id: 'publicar', nivel: 'naranja', que: { en: 'publishing', es: 'publicar' },
    re: /\b(publica\w*|tuit\w*|redes sociales|anuncios?|publish\w*|tweet\w*|social media|ads|adverts?)\b/ },
  { id: 'email_clientes', nivel: 'naranja', que: { en: 'messages to customers', es: 'mensajes a clientes' },
    re: /\b(emails?|correos?|newsletters?|sms|whatsapp|mensajes?|messages?|mail)\b.*\b(clientes?|usuarios?|suscriptores?|lista|customers?|clients?|users?|subscribers?|list|everyone)\b|\benviar (un |el )?(email|correo|boletin)\b|\bsend (an |the |a )?(email|newsletter|mailing)\b|\bemail (all |our |the )?(customers|clients|users|subscribers)\b/ },
  { id: 'datos', nivel: 'naranja', que: { en: 'the database', es: 'la base de datos' },
    re: /\b(base de datos|migracion\w*|esquema|tablas?|sql|postgres\w*|database|db|migrations?|schema|tables?)\b/ },
  { id: 'dinero_negocio', nivel: 'naranja', que: { en: 'prices or spending', es: 'precios o gastos' },
    re: /\b(precios?|tarifas?|descuentos?|gastos?|comprar|contratar|suscripcion\w*|prices?|pricing|fees?|discounts?|expenses?|spend\w*|buy|purchase|hire|subscriptions?)\b/ },
  { id: 'borrar', nivel: 'naranja', que: { en: 'deleting something', es: 'borrar algo' },
    re: /\b(borr|elimin|delet|eras|remov)\w*\b|\bwipe\b/ },
  { id: 'programadas', nivel: 'naranja', que: { en: 'scheduled tasks', es: 'tareas programadas' },
    re: /\b(tareas? programadas?|cron|programacion\w*|scheduled (tasks?|jobs?)|schedul\w*)\b/ },
  { id: 'dependencias', nivel: 'naranja', que: { en: 'dependencies', es: 'dependencias' },
    re: /\b(dependencias?|paquetes?|librerias?|npm|version|dependenc(y|ies)|packages?|librar(y|ies)|upgrade)\b/ },
  { id: 'permisos', nivel: 'naranja', que: { en: 'permissions and access', es: 'permisos y acceso' },
    re: /\b(permisos?|roles?|accesos?|login|sesion|autentica\w*|permissions?|access|log ?in|sign ?in|sessions?|auth|authenticat\w*|authori[sz]\w*)\b/ },
  { id: 'personales', nivel: 'naranja', que: { en: 'personal data', es: 'datos personales' },
    re: /\b(dni|telefonos?|salud|datos personales|direccion\w*|phone numbers?|health|personal data|home address\w*|passports?|id numbers?)\b/ },
  // Azul: pequeño y reversible
  { id: 'texto', nivel: 'azul', que: { en: 'a text', es: 'un texto' },
    re: /\b(textos?|typos?|errata\w*|ortografia|traduc\w*|titulos?|etiquetas?|texts?|spelling|translat\w*|titles?|headings?|labels?|wording)\b/ },
  { id: 'estilo', nivel: 'azul', que: { en: 'the look', es: 'el aspecto' },
    re: /\b(colou?r\w*|estilos?|css|margen\w*|fuentes?|tipografia|iconos?|botone?s?|alinea\w*|tema oscuro|styles?|styling|margins?|padding|spacing|fonts?|typography|icons?|buttons?|align\w*|dark (mode|theme))\b/ },
  { id: 'docs', nivel: 'azul', que: { en: 'documentation', es: 'documentación' },
    re: /\b(documentacion|readme|comentarios?|leeme|documentation|docs|comments?)\b/ },
  { id: 'pruebas', nivel: 'azul', que: { en: 'tests', es: 'pruebas' },
    re: /\b(tests?|pruebas?|testing)\b/ },
  // Verde: leer, informar, preparar
  { id: 'leer', nivel: 'verde', que: { en: 'reading or reporting', es: 'leer o informar' },
    re: /\b(informes?|resumen|leer|revisar|analiz\w*|estadistic\w*|metricas?|buscar|listar|vigilar|comprobar|reports?|summar\w*|read|review|analy\w*|stats|statistics|metrics?|search|find|lists?|monitor\w*|watch|check)\b/ },
  { id: 'borrador', nivel: 'verde', que: { en: 'a draft', es: 'un borrador' },
    re: /\b(borrador\w*|propuestas?|ideas?|rama propia|issues?|drafts?|proposals?|own branch|branch(es)?)\b/ }
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
const v = (veredicto, en, es) => ({ veredicto, motivo: { en, es } })

// Los cuatro revisores. Cada uno solo mira lo suyo; ninguno decide el nivel (eso es del Aprobador).
// contexto: { pruebas: true|false, grande: true|false }
export const REVISORES = [
  {
    id: 'seguridad', nombre: { en: 'Security', es: 'Seguridad' },
    revisar(c) {
      if (hay(c, 'secretos')) return v('bloquea', 'An agent never handles keys: a person rotates them at the provider and in the secrets manager.', 'Un agente no maneja claves: rotarlas lo hace una persona en el proveedor y en el gestor de secretos.')
      if (hay(c, 'dinero')) return v('bloquea', 'An agent never moves money.', 'Mover dinero nunca lo hace un agente.')
      if (hay(c, 'borrar_clientes')) return v('bloquea', 'Deleting customer data is irreversible and has legal implications.', 'Borrar datos de clientes es irreversible y tiene implicaciones legales.')
      if (hay(c, 'cuentas')) return v('bloquea', 'Creating accounts means accepting terms and storing credentials.', 'Crear cuentas implica aceptar condiciones y guardar credenciales.')
      if (hay(c, 'permisos', 'personales')) return v('con-avisos', 'Touches access or personal data: check who sees what before going on.', 'Toca acceso o datos personales: comprobar quién ve qué antes de seguir.')
      if (hay(c, 'produccion', 'datos')) return v('con-avisos', 'Affects production or the data: backup and configuration checked.', 'Afecta a producción o a los datos: copia de seguridad y configuración revisadas.')
      if (hay(c, 'dependencias')) return v('con-avisos', 'A new dependency is third-party code: check its security advisories.', 'Una dependencia nueva es código de terceros: revisar avisos de seguridad.')
      return v('ok', "Doesn't touch secrets, permissions or personal data.", 'No toca secretos, permisos ni datos personales.')
    }
  },
  {
    id: 'ux', nombre: { en: 'UX', es: 'UX' },
    revisar(c) {
      if (hay(c, 'email_clientes')) return v('con-avisos', 'Customers will read it: check who it goes to, the tone, the language and the unsubscribe link.', 'Lo leerán clientes: revisar a quién va, el tono, el idioma y el enlace de baja.')
      if (hay(c, 'publicar')) return v('con-avisos', 'Goes out to the public: review the final text before publishing.', 'Sale al público: revisar el texto final antes de publicar.')
      if (hay(c, 'borrar', 'borrar_clientes')) return v('con-avisos', 'Ask for confirmation and make it undoable.', 'Pedir confirmación y que se pueda deshacer.')
      if (hay(c, 'dinero_negocio')) return v('con-avisos', 'A price change is announced before the customer sees it.', 'Un cambio de precio se comunica antes de que lo vea el cliente.')
      if (hay(c, 'estilo', 'texto')) return v('ok', 'Small visible change; same place and same name as always.', 'Cambio visible pequeño; mismo sitio y mismo nombre de siempre.')
      return v('no-aplica', "Doesn't change anything a person uses.", 'No cambia nada de lo que usa una persona.')
    }
  },
  {
    id: 'ui', nombre: { en: 'UI', es: 'UI' },
    revisar(c) {
      if (hay(c, 'estilo')) return v('ok', 'Checked in light and dark theme and at 375 px; enough contrast.', 'Comprobado en tema claro y oscuro y a 375 px; contraste suficiente.')
      if (hay(c, 'email_clientes', 'publicar')) return v('ok', 'Uses the shared template.', 'Usa la plantilla común.')
      if (hay(c, 'texto')) return v('ok', "The text fits and doesn't break the layout.", 'El texto cabe y no rompe la maquetación.')
      return v('no-aplica', 'No visual changes.', 'Sin cambios visuales.')
    }
  },
  {
    id: 'codigo', nombre: { en: 'Code', es: 'Código' },
    revisar(c, ctx) {
      if (c.nivelBase === 'rojo') return v('no-aplica', 'No code to review: an agent doesn’t do this.', 'No hay código que revisar: esto no lo hace un agente.')
      if (c.reconocida && c.nivelBase === 'verde') return v('no-aplica', 'Only reads, reports or prepares on its own branch: doesn’t touch the working branch.', 'Solo lee, informa o prepara en su rama propia: no toca la rama de trabajo.')
      if (!c.reconocida && ctx.pruebas !== false) return v('con-avisos', 'It’s not clear what has to change: better to ask.', 'No se entiende qué hay que cambiar: mejor preguntar.')
      if (ctx.pruebas === false) return v('bloquea', 'Tests fail: the change goes back.', 'Las pruebas no pasan: el cambio vuelve atrás.')
      if (ctx.grande) return v('con-avisos', 'More than 80 lines: no longer counts as a small change.', 'Más de 80 líneas: ya no cuenta como cambio pequeño.')
      if (hay(c, 'datos')) return v('con-avisos', 'Needs a migration, tested from scratch.', 'Necesita migración y probarla desde cero.')
      if (hay(c, 'dependencias')) return v('con-avisos', 'Read the changelog of the new version.', 'Revisar el registro de cambios de la versión nueva.')
      if (hay(c, 'produccion')) return v('con-avisos', 'Only after every test passes.', 'Solo después de pasar todas las pruebas.')
      return v('ok', 'Tests green and a contained change.', 'Pruebas en verde y cambio acotado.')
    }
  }
]

// Devuelve los veredictos con el texto ya en el idioma pedido (veredicto = código, veredictoTexto = etiqueta).
export function revisar(c, ctx = {}) {
  const lang = idioma(ctx.lang)
  return REVISORES.map(r => {
    const x = r.revisar(c, ctx)
    return { id: r.id, nombre: tr(r.nombre, lang), veredicto: x.veredicto, veredictoTexto: tr(VEREDICTOS[x.veredicto], lang), motivo: tr(x.motivo, lang) }
  })
}

// El Aprobador: la primera regla que se cumple decide. El texto de `regla` es lo que enseña el simulador.
// `porque` es la razón corta que va en la pregunta del estado.json.
export const REGLAS_APROBADOR = [
  {
    id: 'rojo', si: (c) => c.nivelBase === 'rojo',
    dar: (c, vs, lang) => ({ decision: 'fuera', nivel: 'rojo', regla: {
      en: `Red in REGLAS.md: anything involving ${listar(c, 'rojo', 'en')} is always done by a person, even if the reviewers agree.`,
      es: `Rojo en REGLAS.md: ${listar(c, 'rojo', 'es')} lo hace siempre una persona, aunque los revisores estén de acuerdo.` } })
  },
  {
    id: 'bloqueo', si: (c, vs) => vs.some(x => x.veredicto === 'bloquea'),
    dar: (c, vs) => {
      const quien = vs.filter(x => x.veredicto === 'bloquea').map(x => x.nombre).join(', ')
      return { decision: 'rechazado', nivel: c.reconocida ? c.nivelBase : 'naranja', regla: {
        en: `A reviewer blocks (${quien}): the change goes back to the agent, which fixes it and repeats the circuit (two rounds at most; on the third it asks the human).`,
        es: `Un revisor bloquea (${quien}): el cambio vuelve al agente, que lo arregla y repite el circuito (máximo dos vueltas; a la tercera pregunta al humano).` } }
    }
  },
  {
    id: 'naranja', si: (c) => c.nivelBase === 'naranja',
    dar: (c) => ({ decision: 'humano', nivel: 'naranja',
      regla: { en: `Orange in REGLAS.md: it touches ${listar(c, 'naranja', 'en')}. It leaves the building, costs money or is hard to undo.`, es: `Naranja en REGLAS.md: toca ${listar(c, 'naranja', 'es')}. Sale fuera, cuesta dinero o es difícil de deshacer.` },
      porque: { en: `it touches ${listar(c, 'naranja', 'en')}`, es: `toca ${listar(c, 'naranja', 'es')}` } })
  },
  {
    id: 'duda', si: (c) => !c.reconocida,
    dar: () => ({ decision: 'humano', nivel: 'naranja',
      regla: { en: 'When in doubt, orange: the request matches no known rule, so the agent asks.', es: 'En la duda, naranja: la petición no encaja en ninguna regla conocida, así que se pregunta.' },
      porque: { en: 'it matches no known rule', es: 'no encaja en ninguna regla conocida' } })
  },
  {
    id: 'grande', si: (c, vs, ctx) => c.nivelBase === 'azul' && ctx.grande,
    dar: () => ({ decision: 'humano', nivel: 'naranja',
      regla: { en: 'Blue only covers small changes (under ~80 lines): a big one goes up to orange.', es: 'Azul solo vale para cambios pequeños (menos de ~80 líneas): uno grande sube a naranja.' },
      porque: { en: 'it is a big change', es: 'es un cambio grande' } })
  },
  {
    id: 'fabrica', si: (c, vs, ctx) => c.nivelBase === 'azul' && ctx.revisionHumana,
    dar: () => ({ decision: 'humano', nivel: 'naranja',
      regla: { en: 'This agent’s factory is “on with review”: even if it is blue, it goes out as a PR the human approves.', es: 'La fábrica de este agente está «con revisión»: aunque sea azul, sale como PR que aprueba el humano.' },
      porque: { en: 'its factory works with review', es: 'su fábrica trabaja con revisión' } })
  },
  {
    id: 'azul', si: (c) => c.nivelBase === 'azul',
    dar: (c) => ({ decision: 'directo', nivel: 'azul', regla: {
      en: `Blue in REGLAS.md: ${listar(c, 'azul', 'en')}, small and reversible, with tests green. It is merged into the working branch and reported.`,
      es: `Azul en REGLAS.md: ${listar(c, 'azul', 'es')}, pequeño y reversible, con las pruebas en verde. Se integra en la rama de trabajo y se avisa.` } })
  },
  {
    id: 'verde', si: () => true,
    dar: (c) => ({ decision: 'solo', nivel: 'verde', regla: {
      en: `Green in REGLAS.md: ${listar(c, 'verde', 'en') || 'reading or preparing'} changes nothing outside the agent’s folder.`,
      es: `Verde en REGLAS.md: ${listar(c, 'verde', 'es') || 'leer o preparar'} no cambia nada fuera de la carpeta del agente.` } })
  }
]

function listar(c, nivel, lang) {
  const q = c.senales.filter(s => s.nivel === nivel).map(s => tr(s.que, lang))
  const y = lang === 'es' ? ' y ' : ' and '
  return q.length > 1 ? q.slice(0, -1).join(', ') + y + q.at(-1) : (q[0] || '')
}

// decision = código (solo · directo · humano · rechazado · fuera); decisionTexto, regla y porque en el idioma pedido.
export function aprobar(c, vs, ctx = {}) {
  const lang = idioma(ctx.lang)
  const r = REGLAS_APROBADOR.find(x => x.si(c, vs, ctx))
  const res = r.dar(c, vs, ctx)
  return {
    decision: res.decision, decisionTexto: tr(DECISIONES[res.decision], lang), nivel: res.nivel,
    regla: tr(res.regla, lang), porque: res.porque ? tr(res.porque, lang) : undefined,
    reglaId: r.id, avisos: vs.filter(x => x.veredicto === 'con-avisos')
  }
}

// La pregunta que el agente dejaría en su estado.json (formato de PREGUNTAS.md), en el idioma pedido.
export function preguntaPara(peticion, agente, resultado, fecha, lang = 'en') {
  const es = idioma(lang) === 'es'
  const texto = String(peticion || '').trim().replace(/[.\s]+$/, '')
  if (resultado.nivel === 'rojo') {
    return {
      id: (es ? 'humano-' : 'human-') + slug(texto), fecha,
      texto: es
        ? `[demo] La persona responsable hace «${texto}» — ${agente} no puede por las reglas (rojo) — si no se hace, queda en «Tus tareas».`
        : `[demo] The person in charge does "${texto}" — ${agente} can't under the rules (red) — if nobody does it, it stays in "Your tasks".`,
      opciones: es ? ['Lo hace la persona', 'No se hace'] : ['The person does it', "It isn't done"],
      respuesta: null, atendida: false
    }
  }
  if (resultado.decision !== 'humano') return null
  return {
    id: slug(texto), fecha,
    texto: es
      ? `[demo] ${agente} hace «${texto}» — ${resultado.porque} — si no, se queda preparado en una rama sin salir.`
      : `[demo] ${agente} does "${texto}" — ${resultado.porque} — if not, it stays ready on a branch and doesn't go out.`,
    opciones: es ? ['Sí, que lo haga ' + agente, 'Cambiarlo', 'No'] : ['Yes, let ' + agente + ' do it', 'Change it', 'No'],
    respuesta: null, atendida: false
  }
}

function slug(t) {
  return normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'request'
}

// Copia de decidir() de fabricas/comprobar.mjs (sin archivos). Códigos: 0 · 3 · 4 · 5 · 2.
// En inglés los mensajes son idénticos a los de comprobar.mjs; en español, su traducción.
// f.nombre puede ser un texto o { en, es }.
export function consumoVigente(c = {}, hoy) {
  return {
    ejecucionesDia: c.dia === hoy ? (c.ejecucionesDia || 0) : 0,
    gastoMes: c.mes === hoy.slice(0, 7) ? (c.gastoMes || 0) : 0
  }
}

export function decidirFabrica(f, consumo, hoy, lang = 'en') {
  const es = idioma(lang) === 'es'
  if (!f) return { codigo: 2, trabajar: false, mensaje: es ? 'No existe esa fábrica. No hagas nada y pregúntaselo al humano.' : "That factory doesn't exist. Do nothing and ask the human." }
  const n = tr(f.nombre, lang)
  if (f.estado !== 'en_marcha') {
    const como = f.estado === 'pausada' ? (es ? 'está pausada' : 'is paused') : (es ? 'está por montar' : 'is not set up yet')
    return { codigo: 4, trabajar: false, mensaje: es ? `${n} ${como}: no hagas nada hoy.` : `${n} ${como}: do nothing today.` }
  }
  const usado = consumoVigente(consumo, hoy)
  const lim = f.limites || {}
  if (lim.ejecucionesDia != null && usado.ejecucionesDia >= lim.ejecucionesDia) {
    return { codigo: 5, trabajar: false, mensaje: es
      ? `${n} ya ha hecho ${usado.ejecucionesDia} de ${lim.ejecucionesDia} vueltas hoy: espera a mañana.`
      : `${n} has already done ${usado.ejecucionesDia} of ${lim.ejecucionesDia} runs today: wait until tomorrow.` }
  }
  if (lim.gastoMes != null && usado.gastoMes + (f.costeVuelta || 0) > lim.gastoMes) {
    const llevaria = (usado.gastoMes + (f.costeVuelta || 0)).toFixed(2)
    return { codigo: 5, trabajar: false, mensaje: es
      ? `${n} llevaría ${llevaria} de ${lim.gastoMes} de gasto este mes: no trabaja hasta el mes que viene o hasta que el humano suba el tope.`
      : `${n} would reach ${llevaria} of ${lim.gastoMes} spent this month: no work until next month or until the human raises the cap.` }
  }
  if (f.revision === 'humano') {
    return { codigo: 3, trabajar: true, revision: true, mensaje: es
      ? `${n} en marcha con revisión: trabaja, pero lo que cambie fuera de su carpeta va como borrador, rama o PR y espera el OK.`
      : `${n} on with review: it works, but anything it changes outside its folder goes out as a draft, branch or PR and waits for the OK.` }
  }
  return { codigo: 0, trabajar: true, revision: false, mensaje: es
    ? `${n} en marcha sin revisión: adelante (REGLAS.md sigue valiendo).`
    : `${n} on, no review: go ahead (REGLAS.md still applies).` }
}

// Todo el recorrido de una petición, tal como lo pinta el simulador.
export function simular(peticion, { fabrica, consumo, hoy, pruebas = true, grande = false, lang = 'en' } = {}) {
  const f = fabrica ? decidirFabrica(fabrica, consumo, hoy, lang) : { codigo: 0, trabajar: true, revision: false }
  if (!f.trabajar) return { fabrica: f, parado: true }
  const c = clasificar(peticion)
  const ctx = { pruebas, grande, revisionHumana: !!f.revision, lang }
  const veredictos = revisar(c, ctx)
  const resultado = aprobar(c, veredictos, ctx)
  return { fabrica: f, clasificacion: c, veredictos, resultado }
}
