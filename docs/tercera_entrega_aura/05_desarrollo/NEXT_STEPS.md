# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 4 implementado. Pendiente de revisión focalizada antes de Loop 5.**

## Loop 4 — Implementado

Validator:
- `validateScriptCandidateV2()` y `verifyScriptContractV2()`
- 16 códigos de error + 1 warning (scriptErrorCodes.ts)
- Validación V1-V35: shape, referencias, partición, columnas, seguridad, sintaxis, reconstrucción, hash
- Enmascarador léxico: strings + comentarios, 0 falsos positivos
- 42 tests. Suite: 1001 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS.

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 5 puede iniciarse tras revisión focalizada de Loop 4. No iniciar Phase 5 hasta congelar Phase 4.
