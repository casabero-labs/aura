# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 Loop 1R.1 cerrado técnicamente.

**Loop 2 implementado. Pendiente de revisión focalizada antes de Loop 3.**

## Loop 2 — Implementado

Renderer determinista:
- `scriptRendererV2.ts` — 8 códigos de error, 6 actionTypes
- `scriptRendererV2.test.ts` — 70 tests
- Build: ~3s. Suite: 850 passed, 6 skipped. Contracts: 3/3 PASS. Python: PASS.

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L3 | Builder + Finalizer | `scriptBuilderV2.ts` |
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 3 puede iniciarse tras revisión focalizada de Loop 2. No iniciar Phase 5 hasta congelar Phase 4.
