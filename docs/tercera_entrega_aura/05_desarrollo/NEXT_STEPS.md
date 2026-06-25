# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 3 implementado. Pendiente de revisión focalizada antes de Loop 4.**

## Loop 3 — Implementado

Builder + Finalizer:
- `buildScriptCandidateCoreV2()` — core puro (sin reloj)
- `buildScriptCandidateV2()` — core + generatedAt
- `buildScriptHashPayloadV2()` / `computeScriptHashV2()` — hash estable
- `finalizeScriptContractV2()` — contrato final con hash
- Partición: accepted/rejected/excluded (disjuntos, exhaustivos)
- 51 tests. Suite: 928 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

Loop 4 puede iniciarse tras revisión focalizada de Loop 3. No iniciar Phase 5 hasta congelar Phase 4.
