# Loop 5: UI — Integración del ScriptContractV2 con la interfaz

**SHA:** `c0e4e6a14e6f73e635f0c2196a2bd2d150e0cd92`
**Fecha:** 2026-06-25
**Estado:** Implementado

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

Clave de invalidación:
```
f:{fingerprint}#d:{envelopeRef}#p:{planId}#c:{csvFields.join(',')}
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
handleGenerate() {
  // 1. Construir contexto
  const refs = csvFields.map((name, pos) => resolveScriptColumn(name, pos, 0));
  const buildCtx = buildScriptContext(remediationContext, refs, fingerprint);

  // 2. Construir candidato
  const candidate = buildScriptCandidateV2(plan, buildCtx);

  // 3. Validar
  const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
  if (!validation.valid) → error

  // 4. Finalizar
  const contract = finalizeScriptContractV2(candidate, validation);

  // 5. Verificar
  const fresh = verifyScriptContractV2(contract, plan, buildCtx);
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
| `src/components/ScriptGenerationStepV2.tsx` | Componente de generación de contrato v2 |
| `src/__tests__/scriptGenerationStepV2.test.tsx` | 22 tests de integración UI |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/MainPipeline.tsx` | Routing v2, estado scriptContractV2, invalidación |
| `src/components/ReviewStep.tsx` | Rama v2 con fresh verification |
| `src/components/ScriptReview.tsx` | Props readOnly, hideEditAction, approvalLabel |
| `src/components/PipelineData` (type) | Añadido scriptContractV2 y scriptContractVerificationV2 |
| `src/App.tsx` | INITIAL_PIPELINE_DATA y restore con campos v2 |
| `src/services/pipelineSession.ts` | Serialización de scriptContractV2 |
| `docs/.../IMPLEMENTACION.md` | Actualizado con Loop 5 |

## Tests (22 nuevos, 1096 total)

| Suite | Tests |
|---|---|
| Contract flow | 5 |
| Contract visual state | 6 |
| PipelineData v2 fields | 2 |
| ReviewStep v2 fresh verification | 5 |
| isContractsV2Enabled routing | 2 |
| RemediationPlanStepV2 / ScriptReview imports | 2 |

## Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1096 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Remediation plans | 3/3 built, 3/3 valid |

## Limitaciones no bloqueantes

1. Las divergencias contractuales siguen cubiertas por V35 del validator
2. El hash solo existe en contrato final (no en candidato)
3. `syntax not_run` no significa `syntax passed` — es informativo
4. No existe ejecución Python en Phase 4 — se delega a Phase 5
5. El contrato se genera pero no se ejecuta en la UI
