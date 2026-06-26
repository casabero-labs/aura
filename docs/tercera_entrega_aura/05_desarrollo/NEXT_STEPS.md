# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

**Loop 5R y 5R.1 completados. Integración UI reparada y plan propagado. Pendiente Loop 6 (E2E + capturas).**

## Loop 5R — UI — Reparación de integración

Reparación de la integración UI del ScriptContractV2:

- `buildUiScriptContext()` — helper compartido centraliza construcción de contexto
- `buildScriptContractInputKey()` — clave de invalidación con `approvalStatus` por acción
- `RemediationPlanStepV2` — reutilizable con `continueLabel` y `onContinueWithPlan`
- `ScriptGenerationStepV2` — reescrito: Vista A reutiliza `RemediationPlanStepV2`
- `ReviewStep` — fresh verification antes de approve
- `MainPipeline` — `initialData` prop para restauración de sesión
- 29 tests. Suite: 1103 passed, 6 skipped. Build: ~3s. Contracts: 3/3 PASS

## Loop 5R.1 — Propagación del plan y restauración de sesión

Conexión del plan de remediación al parent state y verificación fresca de contratos restaurados:

- `onRemediationPlanChange` — prop en ScriptGenerationStepV2, propagación defensiva
- Fresh verification on mount — `verifyScriptContractV2` para contratos restaurados
- `deriveDiagnosisIdentity` — helper centraliza derivación de identidad
- `prevContractKeyRef` — inicializado desde initialData (evita falsa invalidación)
- ReviewStep — error UI visible para aprobación silenciosa (D24)
- 33 tests. Suite: 1107 passed, 6 skipped. Build: ~3.5s. Contracts: 3/3 PASS

## Loop 5R.2 — Cierre de restauración de sesión

Cierre definitivo de la restauración de sesión con contratos v2:

- `prevDiagnosisRef` y `prevEnvelopeRef` inicializados desde initialData (D25)
- Fresh verification limpia 4 estados en todos los fallos (D26)
- `approvedScript` preservado condicionalmente (D27)
- Fresh verification reemplaza persistida (D28)
- 5 tests reales de MainPipeline (sesión válida, inválida hash, inválida fingerprint, flujo completo a review)
- 38 tests total en scriptGenerationStepV2. Suite: 1112 passed, 6 skipped. Build: ~3.5s. Contracts: 3/3 PASS

**Loop 5 cerrado técnicamente. Pendiente de verificación directa antes de Loop 6.**

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

No iniciar Phase 5 hasta congelar Phase 4. Loop 6 cierra Phase 4.
