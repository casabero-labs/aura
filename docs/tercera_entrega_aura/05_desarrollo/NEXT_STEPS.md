# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 Loop 1 cerrado técnicamente con hardening final (Loop 1R.1).

Pendiente de verificación final del commit (`git status --porcelain` vacío, CI verde) para iniciar Loop 2.

## Loop 1R.1 — Completado

Hallazgos de reauditoría cerrados:
- H-NEW-1: `createReadonlyMapView` closure-based, sin `_map`
- H-NEW-2: `forEach` pasa vista readonly
- M-NEW-1: `resolveScriptColumn` fail-closed
- M-DUP: metadata de duplicados validada

Tests: 780 passed, 6 skipped. Build 3.15s. Contracts 3/3 PASS. Python syntax + semantic PASS.

## Siguiente tarea

**Loop 2: Renderer determinista.**

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L2 | Renderer determinista | `scriptRendererV2.ts` |
| L3 | Builder + Finalizer | `scriptBuilderV2.ts` |
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 2 puede iniciarse. No iniciar Phase 5 hasta congelar Phase 4.
