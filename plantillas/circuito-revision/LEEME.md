# Circuito de revisión para Claude Code

Cuatro revisores en paralelo y un aprobador, como subagentes de Claude Code, más una skill `/revisar` que los orquesta.

## Instalar en un proyecto

```bash
mkdir -p .claude/agents .claude/skills
cp plantillas/circuito-revision/agents/*.md   <tu-proyecto>/.claude/agents/
cp -r plantillas/circuito-revision/skills/revisar <tu-proyecto>/.claude/skills/
```

Después, en cada archivo, sustituye lo que va entre `<…>`: el stack, los perfiles de usuario y, sobre todo, en `aprobador.md`, **la lista de zonas sensibles** que siempre necesitan al humano. Es la línea que más pesa de todo el circuito.

## Modelos
Cada revisor declara su modelo en la cabecera: el visual con uno ligero, seguridad y código con uno medio y el aprobador con el más capaz, porque es el único que decide. Ajústalo a tu plan.

## Uso
En una sesión de Claude Code dentro del proyecto: `/revisar` (cambios sin guardar), `/revisar ultimo` o `/revisar abc123..HEAD`.
