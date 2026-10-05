## Design Context

Impeccable y cualquier trabajo visual leen `CLAUDE.md` (sección Design Context). Destino: Casabero Editorial 1.2 exclusivo. Secuencia: `docs/plans/2026-09-14-aura-editorial-orden-ejecucion.md`. El `DESIGN.md` Warm/Ink es deuda hasta LOOP-01.

## Invariantes del pipeline — no romper

Promesas del producto que ya se rompieron en producción. Cada una tiene un test en `src/__tests__/invariants/` que corre en el pre-push y en CI; `production` (lo que despliega Coolify) solo avanza si pasan.

| # | Invariante | Dónde vive | Test |
|---|---|---|---|
| INV-1 | Las estadísticas por columna del motor (`ColumnStats`: `uniqueCount`, `topFreq`, campos planos) llegan al LLM; nunca ceros por un nombre de campo distinto | `normalizeColumnStatsInput` en `contracts/llm/evidenceEnvelopeV2.ts` | `pipelineInvariants` INV-1 |
| INV-2 | Todo wrapper `Lazy*Provider` reexpone cada capacidad del provider real (`generateStructuredFragment`, `preloadModel`, `unloadModel`, …) | `services/aiProvider.ts` | INV-2 |
| INV-3 | Gemini Nano (contexto ~9k) se diagnostica **por hallazgo**, con `responseConstraint`, chunks `string`, sesión limpia por solicitud y cada solicitud < 2/3 del contexto | `contracts/llm/diagnosisFragmentsV2.ts`, `diagnosisSelector.ts`, `providers/chromeProvider.ts` | INV-3 |
| INV-4 | La sesión persistida nunca contiene filas del dataset | `services/pipelineSession.ts` | INV-4 |
| INV-5 | Salidas reales de Nano siguen pasando el parser y el validador estrictos; la evidencia y los prompts por hallazgo no cambian sin recapturar | `__tests__/fixtures/nano-titanic-fragments.fixture.json` | `nanoGoldenFixture` |

Reglas:
- No debilitar un invariante para que un cambio pase. Si la promesa cambia, cambiar también el texto de la UI que la afirma y explicarlo en el commit.
- El parser de diagnóstico es estricto a propósito: no quitar bloques ```` ```json ````, no reparar JSON. Si un modelo falla el formato, se arregla en el prompt, en el esquema nativo o en la estrategia (como Nano por hallazgo), no en el parser.
- Un recibo nunca certifica lo que no ocurrió (parámetros no aplicados → `null`; datos de relleno → prohibido).
- **Recapturar Nano** (cuando INV-5 falla por un cambio deliberado de evidencia o prompts): en Chrome con Gemini Nano, `npm run dev`, cargar `experiments/datasets/titanic.csv`, generar el diagnóstico y exportar `{report, envelopeOptions, inputMode, inputSnapshot, fragments, receipt}` de `localStorage['aura_pipeline_session_v1']` al fixture. Nunca editar el fixture a mano.
- Instalar la barrera local una vez por clon: `./scripts/install-git-hooks.sh` (pre-push → `npm run verify` en `src/`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
