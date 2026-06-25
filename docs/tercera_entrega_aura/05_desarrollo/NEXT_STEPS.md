# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 está **diseñada (v2.0.0)** — esperando aprobación para implementación.

## Siguiente tarea

Esperar aprobación del diseño corregido de Phase 4 antes de iniciar implementación.

Documentos de diseño Phase 4 (corregidos):

- `05_desarrollo/phases/phase_04/DISENO_SCRIPT_CONTRACT_V2.md` — contrato, ScriptBuildContextV2, candidate→validate→finalize, invariantes, PLACEHOLDER_VOCABULARY_V2, renderer, validación tri-state, reconstrucción exacta
- `05_desarrollo/phases/phase_04/PLAN_LOOPS_PHASE4.md` — 6 loops con rutas E2E corregidas (`src/tests/e2e/`)
- `05_desarrollo/phases/phase_04/DECISIONES.md` — 14 decisiones (D1–D14)
- `05_desarrollo/phases/phase_04/ARQUITECTURA.md` — flujo candidate→validate→finalize, capas
- `05_desarrollo/phases/phase_04/README.md` — estado, scope, claims

## Correcciones aplicadas (v2.0.0)

1. `generatedAt` eliminado de `scriptHash`
2. `ScriptBuildContextV2` definido sin modificar `RemediationContextV2`
3. `pythonLiteral` en `ColumnRef`, columnas duplicadas por posición, helpers `readColumn`/`writeColumn`
4. Flujo candidate → validate → finalize separado
5. Validación por reconstrucción exacta (`SCRIPT_RENDER_MISMATCH`)
6. `PLACEHOLDER_VOCABULARY_V2` constante cerrada y versionada
7. Partición única: `rejected` nunca en `excludedActionIds`
8. Script con cero acciones: función Python válida
9. Sintaxis Python tri-state: `passed`/`failed`/`not_run`
10. Badge "Contrato válido" (no "Seguro")
11. Rutas E2E corregidas: `src/tests/e2e/harness/Phase4ScriptHarness.ts`, `src/tests/e2e/fourth-delivery-evidence.spec.ts`

## Pendientes

1. Aprobación del diseño corregido
2. Implementación de 6 loops (en orden L1 → L6)
3. Cada loop: código → tests → artefacto → commit
4. Congelamiento de Phase 4
5. Inicio de Phase 5 (ejecución, reauditoría, delta)

## Regla

No iniciar implementación hasta que el diseño corregido sea aprobado. No iniciar Phase 5 hasta congelar Phase 4.
