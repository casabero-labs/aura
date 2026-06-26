# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 5 implementado. Pendiente de revisión focalizada antes del harness E2E de Loop 6.**

## Loop 5 — UI — Contrato v2 con revisión humana

Pipeline de script completo: build → validate → finalize → verify → UI → revisión humana.

- `ScriptGenerationStepV2`: decisión (Vista A), contrato (Vista B), generación, loading, error, done
- `ReviewStep`: rama v2 con fresh `verifyScriptContractV2()` antes de aprobar
- `ScriptReview`: `readOnly=true`, `hideEditAction=true`, sin botón Editar
- Invalidation: fingerprint, envelopeRef, planId, csvFields
- 22 tests. Suite: 1096 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

No iniciar Phase 5 hasta congelar Phase 4. Loop 6 cierra Phase 4.
