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

## Loop 5R.1 — Propagación del plan y restauración de sesión

**SHA base:** `7ad83d1bf03d087f4be3483a2bf898e814632aae`
**Fecha:** 2026-06-26
**Estado:** Implementado

### Objetivo

1. Propagar el plan de remediación al parent state (MainPipeline)
2. Bloquear aprobación silenciosa sin plan/contexto
3. Verificación fresca de contratos restaurados en mount
4. Sincronización de props siempre (no condicional a `view`)
5. Tests de flujo integrado completo y restauración de sesión

### Cambios en código

#### ScriptGenerationStepV2 — `onRemediationPlanChange` prop

```typescript
export interface ScriptGenerationStepV2Props {
  // ... existentes ...
  onRemediationPlanChange: (plan: RemediationPlanV2) => void;
}
```

Flujo de propagación:
- `RemediationPlanStepV2` → useEffect interno → `onRemediationPlanChange(plan)`
- `handleGenerate` → `onRemediationPlanChange(plan)` (defensivo, antes de buildUiScriptContext)
- Ambos llaman al mismo callback del parent, asegurando que `remediationPlan` esté disponible

#### ScriptGenerationStepV2 — useEffect sync siempre

```typescript
// ANTES (condicional a view)
if (scriptContractV2 && view === 'decision') { ... }

// DESPUÉS (siempre desde props)
if (scriptContractV2) {
  setView('contract');
  setGenState({ status: 'done', contract: scriptContractV2, ... });
} else {
  setView('decision');
  setGenState({ status: 'idle' });
}
```

#### ReviewStep — Bloqueo de aprobación silenciosa

```typescript
// ANTES: return silencioso
if (!scriptContractV2 || !remediationPlanV2 || ...) { return; }

// DESPUÉS: error visible + bloqueo
if (!scriptContractV2 || !remediationPlanV2 || ...) {
  const missing: string[] = [];
  if (!scriptContractV2) missing.push('contrato');
  if (!remediationPlanV2) missing.push('plan de remediación');
  if (!structuredDiagnosis?.remediationContext) missing.push('diagnóstico estructurado');
  if (!sourceDatasetFingerprint) missing.push('fingerprint del dataset');
  setV2VerifyError(`Falta información para aprobar: ${missing.join(', ')}.`);
  setStage('pending');
  return;
}
```

#### MainPipeline — Fresh verification on mount

```typescript
useEffect(() => {
  if (!initialData?.scriptContractV2 || !isContractsV2Enabled()) return;

  // 1. Verificar que la clave restaurada coincide con la actual
  if (restoredKey !== currentKey) return;

  // 2. Construir contexto fresco
  const context = buildUiScriptContext({ structuredDiagnosis, csvFields, ... });

  // 3. Verificar contrato restaurado
  const verification = verifyScriptContractV2(contract, plan, context.buildContext);
  if (!verification.valid) → clear contract
}, []); // Run once on mount
```

#### MainPipeline — prevRefs inicializados desde initialData

```typescript
const initialDiagnosisIdentity = deriveDiagnosisIdentity(initialData?.structuredDiagnosis ?? null);
const prevDiagnosisRef = useRef<string | null>(initialDiagnosisIdentity.diagRef);
const prevEnvelopeRef = useRef<string | null>(initialDiagnosisIdentity.envelopeRef);
const prevContractKeyRef = useRef<string | null>(getInitialContractKey());
```

NOTA: Fixed en Loop 5R.2 — antes se inicializaban a `null`.

### Archivos modificados (Loop 5R.1)

| Archivo | Cambio |
|---|---|
| `src/components/ScriptGenerationStepV2.tsx` | `onRemediationPlanChange` prop, useEffect sync always |
| `src/components/RemediationPlanStepV2.tsx` | Ya tenía `onRemediationPlanChange` (no cambió) |
| `src/components/MainPipeline.tsx` | Fresh verification mount, prevRefs init from initialData |
| `src/components/ReviewStep.tsx` | Error UI para plan/contexto faltante |

### Tests (33 tests — 3 nuevos)

| Suite | Tests |
|---|---|
| Full integrated flow (null plan → build → review → approve) | 1 |
| Session restoration fresh verification | 2 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1107 passed, 6 skipped (51 files) |
| Typecheck | clean (0 errors) |
| Build | built in ~3.5s |
| Contracts v2 | 3/3 PASS |

### Decisiones Loop 5R.1

| ID | Decisión |
|---|---|
| D20 | `onRemediationPlanChange` se llama dos veces (useEffect + handleGenerate defensivo) — redundancia aceptada para garantizar disponibilidad antes de buildContext |
| D21 | Fresh verification en mount solo se ejecuta si `restoredKey === currentKey` — si no coincide, se omite (ya fue invalidado) |
| D22 | `deriveDiagnosisIdentity` extrae identidad del diagnóstico — reutilizado en plan lifecycle y fresh verification |
| D23 | `prevContractKeyRef` se inicializa con la clave calculada desde initialData — evita falsa invalidación en mount |
| D24 | Error de aprobación silenciosa muestra lista de campos faltantes — diagnóstico transparente para el usuario |

---

## Loop 5R.2 — Cierre de restauración de sesión

**SHA base:** `00e2e88a2aa953de9e0ab23e7dad4922aea316bd`
**Fecha:** 2026-06-26
**Estado:** Implementado

### Objetivo

1. Inicializar `prevDiagnosisRef` y `prevEnvelopeRef` desde `initialData` (no null)
2. Limpiar 4 estados (`scriptContractV2`, `verification`, `cleaningScript`, `approvedScript`) en todos los fallos del fresh verification
3. Preservar `approvedScript` solo si vacío o coincide con `contract.scriptText`
4. Tests reales de MainPipeline para sesión válida, inválida y flujo completo

### Cambios en código

#### MainPipeline — prevRefs inicializados desde initialData

```typescript
const initialDiagnosisIdentity = deriveDiagnosisIdentity(initialData?.structuredDiagnosis ?? null);
const prevDiagnosisRef = useRef<string | null>(initialDiagnosisIdentity.diagRef);
const prevEnvelopeRef = useRef<string | null>(initialDiagnosisIdentity.envelopeRef);
```

Sin esto, el primer mount de una sesión válida clasifica su diagnóstico como nuevo y borra el `remediationPlan`.

#### Fresh verification — cleanup completo en fallos

```typescript
// restoredKey !== currentKey → limpia 4 estados + log
// !context.ok → limpia 4 estados
// !remediationPlan → limpia 4 estados
// !verification.valid → limpia 4 estados
```

Antes: solo limpiaba 2 estados (`scriptContractV2`, `verification`). Ahora: los 4.

#### Fresh verification — restore explícito en éxito

```typescript
setScriptContractV2(initialData.scriptContractV2);
setScriptContractVerificationV2(verification); // fresh, no persistida
setCleaningScript(initialData.scriptContractV2.scriptText);
if (approvedScript && approvedScript !== contract.scriptText) setApprovedScript('');
```

No se confía en `initialData.scriptContractVerificationV2`.

### Tests (38 tests — 5 nuevos en 5R.2)

| Suite | Tests |
|---|---|
| MainPipeline valid session (script state) | 1 |
| MainPipeline valid session (review state) | 1 |
| MainPipeline invalid session (altered hash) | 1 |
| MainPipeline invalid session (incompatible fingerprint) | 1 |
| MainPipeline full flow (null plan → review → approve) | 1 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1112 passed, 6 skipped (51 files) |
| Typecheck | clean (0 errors) |
| Build | built in ~3.5s |
| Contracts v2 | 3/3 PASS |

### Decisiones Loop 5R.2

| ID | Decisión |
|---|---|
| D25 | prevDiagnosisRef y prevEnvelopeRef se inicializan desde `initialData` — evita que el plan lifecycle borre remediationPlan en sesión restaurada |
| D26 | Cleanup de 4 estados en todos los fallos de fresh verification — consistencia completa |
| D27 | `approvedScript` solo se preserva si está vacío o coincide con `contract.scriptText` — no se confía en datos potencialmente corruptos |
| D28 | Fresh verification siempre reemplaza la verificación persistida — resultado fresco en `scriptContractVerificationV2` |

### Limitaciones curadas en 5R.2

- prevDiagnosisRef/prevEnvelopeRef previamente inicializados a `null` — causaban pérdida de remediationPlan
- Fresh verification que fallaba limpiaba solo 2 de 4 estados
- Fresh verification exitosa no restauraba `cleaningScript`/`approvedScript`

## Limitaciones no bloqueantes

1. Las divergencias contractuales siguen cubiertas por V35 del validator
2. El hash solo existe en contrato final (no en candidato)
3. `syntax not_run` no significa `syntax passed` — es informativo
4. No existe ejecución Python en Phase 4 — se delega a Phase 5
5. El contrato se genera pero no se ejecuta en la UI
6. `import.meta.env` errores pre-existentes en MainPipeline.tsx (Vite-specific)
