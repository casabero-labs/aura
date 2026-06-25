# Loop 3 — Builder y Finalizer

> **Commit:** Loop 3 sobre `8012078404dcc193a67234959fc3f68a7b23defe`

---

## API implementada

```typescript
export const SCRIPT_CONTRACT_VERSION = '2.0.0';
export const CLEAN_DATASET_FN = 'clean_dataset';

export interface ScriptCandidateBuildOptionsV2 {
  generatedAt?: string;
}

export type ScriptContractCandidateCoreV2 =
  Omit<ScriptContractCandidateV2, 'generatedAt'>;

export function buildScriptCandidateCoreV2(
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
): ScriptContractCandidateCoreV2;

export function buildScriptCandidateV2(
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptCandidateBuildOptionsV2,
): ScriptContractCandidateV2;

export function buildScriptHashPayloadV2(
  candidate: ScriptContractCandidateV2,
): Record<string, unknown>;

export function computeScriptHashV2(
  candidate: ScriptContractCandidateV2,
): string;

export function finalizeScriptContractV2(
  candidate: ScriptContractCandidateV2,
  validationResult: ScriptValidationResultV2,
): ScriptContractV2;
```

### Errores del builder

```typescript
export type ScriptBuilderErrorCode =
  | 'SCRIPT_BUILD_CONTEXT_INVALID'
  | 'SCRIPT_BUILD_REMEDIATION_MISMATCH'
  | 'SCRIPT_BUILD_REFERENCE_INVALID'
  | 'SCRIPT_BUILD_RENDER_FAILED'
  | 'SCRIPT_BUILD_GENERATED_AT_INVALID'
  | 'SCRIPT_FINALIZATION_VALIDATION_REQUIRED'
  | 'SCRIPT_FINALIZATION_VALIDATION_FAILED'
  | 'SCRIPT_FINALIZATION_SYNTAX_FAILED';
```

---

## Reglas de partición

| Estado | Destino |
|---|---|
| `rejected` | `rejectedActionIds` |
| `pending` | `excludedActionIds` (reason: `'pending'`) |
| `approved` + `requires_human_review` | `excludedActionIds` (reason: `'unsupported_action'`) |
| `approved` + columna missing | `excludedActionIds` (reason: `'missing_column'`) |
| `approved` + columna ambigua | `excludedActionIds` (reason: `'ambiguous_column'`) |
| `approved` + actionType desconocido | `excludedActionIds` (reason: `'unsupported_action'`) |
| `approved` + renderizable | `acceptedActionIds` |

---

## Matriz de exclusiones

| Motivo | Conjunto | Reason |
|---|---|---|
| `approvalStatus === 'rejected'` | `rejectedActionIds` | — |
| `approvalStatus === 'pending'` | `excludedActionIds` | `'pending'` |
| `actionType === 'requires_human_review'` | `excludedActionIds` | `'unsupported_action'` |
| Columna no encontrada en registry | `excludedActionIds` | `'missing_column'` |
| Columna ambigua | `excludedActionIds` | `'ambiguous_column'` |
| actionType no reconocido | `excludedActionIds` | `'unsupported_action'` |

---

## Payload del hash

Campos incluidos en `canonicalJson()`:

```typescript
{
  remediationRef,
  datasetFingerprint,
  acceptedActionIds: [...sort()],
  columnRefs: [...sort by columnId],
  rendererVersion,
  placeholderVocabularyVersion,
  scriptText,
  cleanDatasetFn,
}
```

Campos excluidos:

- `generatedAt`
- `validationResult`
- `rejectedActionIds`
- `excludedActionIds`

---

## Reconstrucción

`buildScriptCandidateCoreV2()` es puro. Mismo plan + contexto → mismo core (sin `generatedAt`).

Loop 4 reutilizará el core para reconstrucción exacta.

---

## Tests

| Suite | Tests |
|---|---|
| Version & constants | 2 |
| Candidate: zero actions | 1 |
| Candidate: one approved | 1 |
| Candidate: multiple actions | 2 |
| Partition: exclusion rules | 7 |
| Columns: resolution | 5 |
| Context: precondition validation | 4 |
| Renderer integration | 3 |
| Reconstruction: determinism | 2 |
| Hash: stability & sensitivity | 8 |
| generatedAt | 3 |
| Finalizer | 8 |
| Candidate shape | 4 |
| **Total** | **51** |

---

## Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 3 | 51 passed |
| Suite completa | 928 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |

---

## Limitaciones

1. No ejecuta validación de sintaxis Python (Loop 4)
2. No ejecuta transformaciones (Phase 5)
3. No añade UI components (Loop 5)
4. El finalizer requiere un validationResult externo (Loop 4)

---

## SHA

```
Loop 3: <commit actual>
Base: 8012078404dcc193a67234959fc3f68a7b23defe
```
