---
name: revisar
description: Circuito de revisión antes de guardar o subir un cambio — Seguridad, UX, UI y Código en paralelo, luego el Aprobador, y según su decisión vuelve atrás, va directo a la rama de trabajo o queda esperando el OK del humano. Úsalo con «/revisar», «revisa este cambio», «pásalo por los revisores» o antes de hacer commit de un bloque de trabajo.
---

# /revisar — circuito de revisores

```
petición → [Seguridad · UX · UI · Código] en paralelo → Aprobador ─┬─ RECHAZADO → arreglar y repetir (máx. 2 vueltas)
                                                                   ├─ DIRECTO → commit en la rama de trabajo
                                                                   └─ NECESITA AL HUMANO → propuesta, el humano decide
                                                     producción: solo el humano
```

Argumento opcional: `ultimo` (revisar el último commit), un rango (`abc123..HEAD`) o nada (cambios sin guardar).

## 1. Qué se revisa
- Sin argumento: `git diff HEAD` más los archivos nuevos sin seguimiento que sean del cambio (`git status --short`). Si no hay nada, el último commit.
- `ultimo`: `git show HEAD`. Rango: `git diff <rango>`.
- Apunta la rama actual, los archivos tocados y las líneas cambiadas (`git diff --stat`). Si el diff pasa de ~1500 líneas, pasa a los revisores la lista de archivos y que lean ellos.
- Escribe en una frase **qué se pidió**.

## 2. Los cuatro revisores, a la vez
Lanza **en un solo mensaje** cuatro subagentes: `revisor-seguridad`, `revisor-ux`, `revisor-ui`, `revisor-codigo`. A cada uno: la petición, la rama, la lista de archivos y el diff (o cómo obtenerlo). Si el cambio no toca nada visual ni de uso (solo backend interno, pruebas, documentación), puedes saltarte UI y/o UX y anotarlo como «no aplica».

## 3. El aprobador
Un subagente `aprobador` con la petición, el diff y los cuatro informes completos.

## 4. Según la decisión
- **RECHAZADO**: enseña la lista de arreglos. Si el cambio es de esta conversación, arréglalo y vuelve al paso 1 (máximo 2 vueltas; a la tercera, para y pregunta). Si era un commit ya hecho, no lo deshagas: propón los arreglos.
- **APROBADO · DIRECTO**: pasa las pruebas del proyecto y haz commit en la rama actual. Nunca en la rama principal si no es la de trabajo, nunca `push`, nunca desplegar.
- **APROBADO · NECESITA AL HUMANO**: no hagas commit. Deja los cambios y haz la pregunta del aprobador. Con un «sí», commit como arriba.
- **Producción**: solo si el humano lo pide expresamente después, con las pruebas pasadas.

## 5. Dejar constancia
- Guarda el resultado en `docs/revisiones/AAAA-MM-DD-<tema>.md`: petición, archivos, veredicto de cada revisor (resumido), decisión del aprobador y qué se hizo.
- Si necesita al humano, añade la pregunta al `estado.json` del agente (formato de `PREGUNTAS.md`).
- Al final, en 4–6 líneas: qué se revisó, decisión, qué se hizo y qué queda en manos del humano.
