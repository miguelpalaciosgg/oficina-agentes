# Texto de la tarea programada

La tarea programada (cron, rutina en la nube o el programador de tareas del sistema) no lleva instrucciones: solo apunta al archivo del agente. Así, para cambiar lo que hace un agente se edita su `INSTRUCCIONES.md` y no hay que tocar la programación.

```text
Estás en el repo de la oficina. Lee REGLAS.md y después plantillas/agentes/<agente>/INSTRUCCIONES.md
(o la carpeta donde viva tu agente) y hazlas. Lo primero, node fabricas/comprobar.mjs <id>.
Contesta y escribe todo en español. No hagas nada que REGLAS.md marque como naranja o rojo
sin una respuesta del humano en tu estado.json.
```

## Carpeta de cada agente

| Archivo | Para qué |
|---|---|
| `INSTRUCCIONES.md` | Su trabajo. Es lo único que se edita para cambiarlo |
| `memoria.md` | Lo que ha aprendido, una línea con fecha por cosa (qué es normal, qué ya se sabe) |
| `estado.json` | Semáforo, última vuelta, tareas y preguntas al humano (ejemplo en `estado.ejemplo.json`) |
| `informes/` | Un informe por vuelta, `AAAA-MM-DD.md` |
