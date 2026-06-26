# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 5R completado. Integración UI reparada. Pendiente Loop 6 (E2E + capturas).**

## Loop 5R — UI — Reparación de integración

Reparación de la integración UI del ScriptContractV2:

- `buildUiScriptContext()` — helper compartido centraliza construcción de contexto
- `buildScriptContractInputKey()` — clave de invalidación con `approvalStatus` por acción
- `RemediationPlanStepV2` — reutilizable con `continueLabel` y `onContinueWithPlan`
- `ScriptGenerationStepV2` — reescrito: Vista A reutiliza `RemediationPlanStepV2`
- `ReviewStep` — fresh verification antes de approve
- `MainPipeline` — `initialData` prop para restauración de sesión
- 29 tests. Suite: 1103 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

No iniciar Phase 5 hasta congelar Phase 4. Loop 6 cierra Phase 4.
