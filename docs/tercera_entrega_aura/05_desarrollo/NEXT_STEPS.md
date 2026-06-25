# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 Loop 1 **completado**. Loops 2–6 pendientes.

## Loop 1 — Completado ✓

SHA: `c048a7e601088cb7f433085748f489f01b81b91d` → `HEAD`

Entrega:
- Tipos: `ScriptExclusionReasonV2`, `ScriptExcludedActionV2`, `ColumnRegistryV2`, `CorrespondenceEvidenceV2`, `ScriptBuildContextV2`, `ColumnAccessSpecV2`, `PythonSyntaxState`, `ScriptValidationResultV2`
- Archivos: `placeholderVocabulary.ts`, `scriptColumnResolver.ts`, `scriptBuildContext.ts`
- Tests: 59 passing
- Build: ✓
- Contracts v2: 3/3 PASS (Phase 3 remediation)

## Siguiente tarea

Loop 2: Renderer determinista (`scriptRendererV2.ts`)

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L2 | Renderer determinista | `scriptRendererV2.ts` |
| L3 | Builder + Finalizer | `scriptBuilderV2.ts` |
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

No implementar Loop 2 hasta hacer commit de Loop 1. No iniciar Phase 5 hasta congelar Phase 4.
