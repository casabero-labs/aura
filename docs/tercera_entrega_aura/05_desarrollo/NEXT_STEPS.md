# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 4 cerrado técnicamente. Pendiente de verificación directa antes de Loop 5.**

## Loop 4 — Cerrado técnicamente

Validator fail-closed con hardening completo:
- `validateScriptCandidateV2()` y `verifyScriptContractV2()`
- 16 errores + 1 warning (scriptErrorCodes.ts)
- 88 tests. Suite: 1047 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS
- Syntax checker: tri-state fail-closed; resultados malformados → not_run
- Imports: whitelist estricto (solo `import pandas as pd` y `import numpy as np`)
- Embedded validationResult: validación profunda (code, path, message, value)
- Partición: intersecciones explícitas (accepted∩rejected, accepted∩excluded, rejected∩excluded)
- Seguridad: enmascarador léxico con triple strings y prefijos (r, f, b)
- Python compile: checker real con python3; graceful not_run si no disponible
- Hash: excluye generatedAt, validationResult, rejectedActionIds, excludedActionIds

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 5 puede iniciarse tras revisión focalizada de Loop 4R. No iniciar Phase 5 hasta congelar Phase 4.
