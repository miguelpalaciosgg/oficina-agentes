# Preguntas al humano

Un agente nunca se queda esperando en una conversación: deja la pregunta escrita en su `estado.json` y en su informe, y sigue con lo demás. El humano contesta cuando puede (en el chat, en el issue o aprobando el PR) y el agente la atiende en su siguiente vuelta.

## Formato del texto

```
[proyecto] Qué hará quién (con su nombre) — por qué — qué pasa si no
```

- **Quién**: siempre con nombre, nunca «yo» ni «tú» («lo hace el Programador», «lo hace la persona»).
- **Por qué**: una frase.
- **Qué pasa si no**: para que decir que no también sea una decisión informada.
- Si hay rama, PR o issue, el enlace al final.

## En `estado.json`

```json
{
  "id": "dep-actualizar-libreria",
  "fecha": "2026-01-15T09:30:00+01:00",
  "texto": "[web] El Programador actualiza la librería de gráficos a la versión 5 — tiene un fallo de seguridad alto — si no, sigue el aviso en cada revisión semanal. Rama agente/T-0042-graficos.",
  "opciones": ["Sí, juntarlo", "Cambiarlo (el Programador lo rehace)", "No, descartarlo"],
  "tarea": { "repo": "web", "texto": "Actualizar la librería de gráficos y comprobar que las tres páginas de informes siguen pintando." },
  "respuesta": null,
  "atendida": false
}
```

| Campo | Para qué |
|---|---|
| `id` | Único dentro del agente; sirve para no preguntar dos veces lo mismo |
| `fecha` | ISO con **día y hora**, para ordenar la bandeja |
| `opciones` | Botones de respuesta; la primera es la recomendada |
| `tarea` | Opcional. Si lo que se propone es un cambio de código, qué repo y qué hay que hacer, escrito para alguien que no ha leído el informe. Con el «Sí» pasa a la cola del Programador |
| `respuesta` | La rellena el humano (o la app que use) |
| `atendida` | La pone el agente a `true` cuando ha hecho lo que se le dijo |

## Ciclo de vida

```
pregunta (respuesta: null) → el humano contesta → el agente la atiende (atendida: true)
                           ↘ 48 h sin respuesta → se recuerda una vez en el informe
```

Si la respuesta es «lo hace la persona», la pregunta lleva `humanoHecha` (fecha) cuando se marca como hecha. Una semana sin marcar: se recuerda una vez.
