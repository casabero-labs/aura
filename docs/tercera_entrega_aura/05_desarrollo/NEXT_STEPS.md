# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 Loop 1R.1 cerrado técnicamente.

**Loop 2R implementado. Pendiente de verificación directa antes de Loop 3.**

## Loop 2R — Implementado

Hardening del renderer:
- `validateColumnRef` con 8 campos (incl pythonLiteral, isReservedWord)
- Import de helpers oficiales desde scriptColumnResolver.ts
- Parámetros validados pre-casting
- 97 tests (71 + 26 nuevos)
- Suite: 877 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS. Python: PASS.

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L3 | Builder + Finalizer | `scriptBuilderV2.ts` |
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 3 puede iniciarse tras verificación directa de Loop 2R. No iniciar Phase 5 hasta congelar Phase 4.
