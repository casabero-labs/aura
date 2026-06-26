# Loop 5R: UI — Reparación de integración ScriptContractV2

**SHA base:** `04a33ae732003f80b0e0fe50a098c96a822d9fc4`
**Fecha:** 2026-06-26
**Estado:** Implementado (reparación)

## Objetivo

Conectar el flujo contractual completo con la interfaz de usuario:

```
RemediationPlanV2
  → ScriptBuildContextV2
  → ScriptContractCandidateV2
  → validateScriptCandidateV2
  → ScriptContractV2
  → verifyScriptContractV2
  → revisión humana (HITL v2)
```

## Arquitectura de estado

### PipelineData — campos v2

```typescript
interface PipelineData {
  // ... campos existentes ...
  scriptContractV2: ScriptContractV2 | null;
  scriptContractVerificationV2: ScriptValidationResultV2 | null;
}
```

### Invalidation

El contrato se invalida automáticamente cuando cambia cualquiera de:

- `auditEvidence.datasetFingerprint`
- `structuredDiagnosis.evidenceEnvelopeRef`
- `remediationPlan.planId`
- `csvFields`
- `approvalStatus` de alguna acción (D17)

Clave de invalidación (JSON.stringify):
```
JSON.stringify({ fingerprint, envelopeRef, planId, approvals: [actionId, approvalStatus], csvFields })
```

## Flujo de componentes

### Routing en MainPipeline

```typescript
// Paso 'script'
{state === 'script' && isContractsV2Enabled() && !!structuredDiagnosis?.remediationContext
  ? <ScriptGenerationStepV2 ... />
  : <ScriptGenerationStep legacy />}
```

### ScriptGenerationStepV2

Propiedades (`ScriptGenerationStepV2Props`):

| Prop | Tipo | Descripción |
|---|---|---|
| `report` | `AuditReport` | Reporte de auditoría |
| `csvFields` | `string[]` | Campos del CSV |
| `sourceDatasetFingerprint` | `string \| null` | Fingerprint del dataset |
| `structuredDiagnosis` | `DiagnosisExecutionResult \| null` | Diagnóstico estructurado |
| `remediationPlan` | `RemediationPlanV2 \| null` | Plan de remediación |
| `scriptContractV2` | `ScriptContractV2 \| null` | Contrato actual |
| `scriptContractVerificationV2` | `ScriptValidationResultV2 \| null` | Verificación fresca |
| `onScriptContractChange` | `(contract, verification) => void` | Callback al generar |
| `onContinue` | `() => void` | Ir a revisión |
| `onLog` | `(stage, msg) => void` | Logging |

**Vista A — Decisión:** Muestra `RemediationPlanStepV2` con botón "Generar contrato de script".

**Vista B — Contrato:** Muestra estado contractual, script Python, partición, errores/warnings, hash abreviado.

### Flujo de generación

```typescript
// buildUiScriptContext — helper compartido (D18)
const contextResult = buildUiScriptContext({ structuredDiagnosis, csvFields, sourceDatasetFingerprint });

handleGenerate(plan) {
  // 1. Construir contexto (shared helper)
  if (!contextResult.ok) → error

  // 2. Construir candidato
  const candidate = buildScriptCandidateV2(plan, contextResult.buildContext);

  // 3. Validar
  const validation = validateScriptCandidateV2(candidate, plan, contextResult.buildContext);
  if (!validation.valid) → error

  // 4. Finalizar
  const contract = finalizeScriptContractV2(candidate, validation);

  // 5. Verificar
  const fresh = verifyScriptContractV2(contract, plan, contextResult.buildContext);
  if (!fresh.valid) → error

  // 6. Guardar
  onScriptContractChange(contract, fresh);
}
```

### Estados visuales

| Condición | Etiqueta |
|---|---|
| `validationResult.valid && freshVerification.valid` | `Contrato válido` (verde) |
| `!validationResult.valid \|\| !freshVerification.valid` | `Validación fallida` (rojo) |
| Sin contrato generado | `Sin validar` |
| `pythonSyntax.state === 'not_run'` | Warning informativo: "syntax: not_run" |

**NO se muestra:** Seguro, Safety score, 100% seguro, AI, LLM, score.

### Partición

Una sola partición sin duplicar contadores:

- aceptadas (verde)
- rechazadas (rojo)
- excluidas (naranja) + lista de `actionId` + `reason`
- columnas referenciadas
- renderer version + placeholder version + hash (12 chars)

### ReviewStep v2

Props añadidas:

```typescript
interface ReviewStepProps {
  // ... existentes ...
  scriptContractV2?: ScriptContractV2 | null;
  remediationPlanV2?: RemediationPlanV2 | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  sourceDatasetFingerprint?: string | null;
}
```

**Rama v2:** Se activa cuando `scriptContractV2 && isContractsV2Enabled()`.

Antes de aprobar, se ejecuta `verifyScriptContractV2()` fresco. Si falla → bloqueo. Si pasa → aprobación registrada.

### ScriptReview v2

Props añadidas:

```typescript
interface ScriptReviewProps {
  // ... existentes ...
  readOnly?: boolean;
  hideEditAction?: boolean;
  approvalLabel?: string;
}
```

En v2: `readOnly=true`, `hideEditAction=true`. Copiar y descargar disponibles. Código mostrado = `contract.scriptText` exactamente.

### Phase 5 — Restricciones

En la rama v2 queda **prohibido** llamar:
- `createImprovementRun`
- `runSimulation`
- servicios de ejecución
- Pyodide / Python
- re-audit
- healthDelta
- afirmación de mejora del dataset

## Archivos creados

| Archivo | Descripción |
|---|---|
| `src/services/scriptContractUiContext.ts` | Helper compartido: `buildUiScriptContext()`, `buildScriptContractInputKey()` |
| `src/components/ScriptGenerationStepV2.tsx` | Componente de generación de contrato v2 (reescrito en 5R) |
| `src/__tests__/scriptGenerationStepV2.test.tsx` | 29 tests de integración UI (Loop 5R) |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/MainPipeline.tsx` | `initialData` prop, `buildScriptContractInputKey` para invalidación, limpieza de estado local |
| `src/components/RemediationPlanStepV2.tsx` | Props `continueLabel` y `onContinueWithPlan` (D19) |
| `src/components/ReviewStep.tsx` | Usa `buildUiScriptContext`, `TriangleAlert`, `ok === false` narrow |
| `src/components/ScriptReview.tsx` | Props readOnly, hideEditAction, approvalLabel |
| `src/App.tsx` | Pasa `initialData={pipelineData}` a MainPipeline |

## Tests (29 nuevos, 1103 total)

| Suite | Tests |
|---|---|
| buildUiScriptContext | 7 |
| buildScriptContractInputKey | 6 |
| Contract pipeline (real) | 3 |
| ScriptGenerationStepV2 component | 6 |
| RemediationPlanStepV2 props | 3 |
| ScriptReview v2 props | 2 |

## Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1103 passed, 6 skipped (51 files) |
| Build | built in ~3s |
| Typecheck | clean (only pre-existing `import.meta.env` errors) |
| Contracts v2 | 3/3 PASS |
| Remediation plans | 3/3 built, 3/3 valid |

## Decisiones Loop 5R

| ID | Decisión |
|---|---|
| D16 | Fresh verification before approval — `verifyScriptContractV2()` fresco antes de aprobar |
| D17 | Invalidation by composite key — JSON.stringify con `approvalStatus` por acción |
| D18 | ScriptGenerationStepV2 es unidireccional — sin edición inline, solo generar o volver |
| D19 | Routing por flag + contexto — `isContractsV2Enabled() && !!structuredDiagnosis?.remediationContext` |

## Limitaciones no bloqueantes

1. Las divergencias contractuales siguen cubiertas por V35 del validator
2. El hash solo existe en contrato final (no en candidato)
3. `syntax not_run` no significa `syntax passed` — es informativo
4. No existe ejecución Python en Phase 4 — se delega a Phase 5
5. El contrato se genera pero no se ejecuta en la UI
6. `import.meta.env` errores pre-existentes en MainPipeline.tsx (Vite-specific)
