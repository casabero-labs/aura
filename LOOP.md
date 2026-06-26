# LOOP.md — Casabero-Labs/Aura

> Documenta los loops de orquestación AI que mantienen este repo. Sigue el patrón de [loop-engineering](https://github.com/cobusgreyling/loop-engineering) adaptado al stack Hermes + cronjob + delegate_task.

## Loop activo

### `aura-weekly-status` — Daily Triage (L1, report-only, weekly)

- **Cronjob ID**: `09919b032f69`
- **Cadencia**: `30 7 * * 1` (todos los lunes a las 07:30 hora Bogotá)
- **Skills cargadas**: ninguna
- **Trigger**: scheduler de Hermes
- **Deliver**: `telegram`
- **Kill switch**: pausar el cronjob o setear `state=paused` en `~/.hermes/cron/jobs.json`

### Pasos del loop

1. `curl -o /dev/null -w '%{http_code}' https://aura.casabero.com/` → deploy responde
2. GH API → últimos commits y PRs abiertos
3. Snapshot del estado del desarrollo (reglas activas, benchmark, pendientes TFM)
4. Genera briefing con próximos pasos del TFM UNIR

### Output

Reporte semanal en español colombiano con emojis. Incluye contexto académico (TFM, entregas, métricas del motor determinista).

### Patrón equivalente en upstream

[Daily Triage](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/daily-triage.md) — L1 (adaptado a weekly).

## Loops potenciales (no activos todavía)

| Loop | Patrón | Por qué no activado |
|------|--------|---------------------|
| `aura-benchmark-runner` | Changelog Drafter / Goal | Benchmark LLM pendiente de ejecución real con credenciales |
| `aura-paper-drafter` | Goal (no loop) | El TFM requiere escritura humana; goal-engineering no aplica aquí |

> **Nota**: Aura es principalmente investigación + entrega de TFM. Los loops no encajan bien porque el trabajo es bounded y humano-intensivo. La skill `aura-tfm-workflow` y `aura-status-sop` ya cubren la metodología.

## State y memoria

- **STATE.md**: no creado aún (briefing semanal es suficiente).
- **Histórico**: memoria persistente del agente (`memory` tool) lleva el contexto del TFM.

## Métricas

- **Tokens/run**: ~6k (más largo que health-checks por contexto TFM)
- **Runs/month**: 4 (semanal)
- **Costo mensual estimado**: despreciable

## Notas operativas

- Este loop es especial: **incluye contexto del TFM UNIR** (entregas, métricas del motor, benchmark) hardcodeado en el prompt del cronjob.
- Si el TFM entra en fase final, considerar aumentar frecuencia a daily durante la semana previa a entrega.
- Human gate: Joseph revisa el briefing semanal y decide acciones.

## Cómo agregar un loop nuevo

1. Crear skill en `~/.hermes/skills/loop-<name>/SKILL.md`
2. Crear cronjob con `cronjob action='create'` referenciando la skill
3. Documentar acá arriba en "Loop activo"
4. Si toca código: worktree aislado, verifier antes de commit

## Referencias

- Skill: `~/.hermes/skills/loop-engineering/SKILL.md`
- Skills relacionadas: `aura-tfm-workflow`, `aura-status-sop`, `goal-mode-sop`
- Framework: https://github.com/cobusgreyling/loop-engineering
- Cron source: `~/.hermes/cron/jobs.json` (id `09919b032f69`)

---

*Mantenido por Casabito · 2026-06-26*