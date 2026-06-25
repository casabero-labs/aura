# Diseño del contrato ScriptContractV2 — Phase 4

> **Versión:** 2.0.0 · **Fecha:** 2026-06-25 · **Commit:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191` (Phase 3 congelada)

---

## 1. Diagnóstico del estado actual

### 1.1 Qué ya existe

| Componente | Archivo | Estado |
|---|---|---|
| Tipo `ScriptContractV2` | `src/contracts/llm/types.ts:479-491` | Parcial — faltan campos |
| Builder determinista legacy | `src/services/deterministicScriptBuilder.ts` | v1 — no usa RemediationPlanV2 |
| Validación de scripts legacy | `src/services/scriptValidationService.ts` | v1 — no usa contrato v2 |
| `RemediationPlanStepV2` | `src/components/RemediationPlanStepV2.tsx` | Cerrado — approve/reject operativo |
| `remediationApprovalV2` | `src/contracts/llm/remediationApprovalV2.ts` | Cerrado — transiciones inmutables |
| `remediationBuilderV2` | `src/contracts/llm/remediationBuilderV2.ts` | Cerrado — plan y standardParams() |
| `remediationPolicyV2` | `src/contracts/llm/remediationPolicyV2.ts` | Cerrado — ruleId → actionType |
| `remediationValidatorV2` | `src/contracts/llm/remediationValidatorV2.ts` | Cerrado — validación exhaustiva |
| `ScriptGenerationStep` | `src/components/ScriptGenerationStep.tsx` | Router v1/v2 — necesita adaptación |
| `ReviewStep` | `src/components/ReviewStep.tsx` | v1 — usa legacy validation |

### 1.2 Qué es placeholder o incompleto

| Componente | Deficiencia |
|---|---|
| `ScriptContractV2` type | Faltan: `excludedActionIds`, `datasetFingerprint`, `generatedAt`, `remediationRef` real |
| Builder de script v2 | No existe `buildScriptCandidateV2()` |
| Validación de script v2 | No existe `validateScriptCandidateV2()` |
| Finalizer de script v2 | No existe `finalizeScriptContractV2()` |
| Renderer determinista v2 | No existe mapeo actionType → Python/Pandas basado en contrato |
| `scriptHash` | No hay función de cálculo estable |
| `ScriptBuildContextV2` | No existe el contexto de build con columnRegistry |
| Column resolver | No hay helpers `readColumn` / `writeColumn` deterministas |
| `PLACEHOLDER_VOCABULARY_V2` | No existe vocabulario cerrado de placeholders |
| Componente de script v2 | `RemediationPlanStepV2` no conecta con script review |
| E2E harness Phase 4 | No existe |

### 1.3 Deuda técnica que puede interferir

| Deuda | Riesgo |
|---|---|
| `buildDeterministicCleaningScript` usa nombres de columna por string, no `columnId` | Columnas ambiguas pueden colisionar |
| `validateCleaningScript` traza por nombre, no por `columnId` | Falsos positivos en duplicados |
| `ReviewStep` depende de `cleaningScript` (string) y `scriptValidation` (legacy) | Necesita adaptación a contrato v2 |
| `ScriptGenerationStep` rutea a v2 con `isContractsV2Enabled() && !!structuredDiagnosis` | Debe expandirse para script v2 |
| `RemediationContextColumnV2` no tiene `pythonLiteral` | `pythonLiteral` pertenece a `ColumnRef`, no a `RemediationContextColumnV2` |

---

## 2. ScriptBuildContextV2

### 2.1 Definición

`ScriptBuildContextV2` es el contexto inmutable que alimenta el builder y el renderer. NO modifica `RemediationContextV2`. Se construye a partir de él, añadiendo la `columnRegistry` completa.

```typescript
interface ScriptBuildContextV2 {
  remediationContext: RemediationContextV2;
  sourceDatasetFingerprint: string;
  columnRegistry: ColumnRegistryV2;
  correspondenceEvidence: CorrespondenceEvidenceV2;
}

interface ColumnRegistryV2 {
  orderedColumns: readonly ColumnRef[];
  byColumnId: ReadonlyMap<string, ColumnRef>;
  byName: ReadonlyMap<string, readonly ColumnRef[]>;  // diagnóstico, no resolución
}

interface CorrespondenceEvidenceV2 {
  fingerprintMatch: boolean;
  columnsMatch: boolean;
  missingColumnIds: readonly string[];
  unexpectedColumnIds: readonly string[];
  mismatchedColumns: readonly string[];
  columnsFromContext: number;
  columnsInRegistry: number;
  valid: boolean;
}
```

### 2.2 Invariante de correspondencia

```
columnRegistry.byColumnId.size === remediationContext.columns.length
Para toda columna en remediationContext.columns:
  columnRegistry.byColumnId.has(col.columnId) === true
  (RemediationContextColumnV2 no contiene pythonLiteral — se obtiene del registry)
```

`correspondenceEvidence.columnsMatch` es `true` solo si se cumplen ambos invariantes.

### 2.3 Construcción

```typescript
function buildScriptContext(
  remediationContext: RemediationContextV2,
  columnRefs: ColumnRef[]  // ColumnRef con pythonLiteral incluido
): ScriptBuildContextV2
```

`columnRefs` proviene del envelope de evidencia o del contexto de remediación con `ColumnRef` completo (incluye `pythonLiteral`). `RemediationContextColumnV2` no contiene `pythonLiteral` — se obtiene del `ColumnRef` del envelope original.

---

## 3. Propuesta contractual: flujo candidate → validate → finalize

### 3.1 Fases del contrato

```
RemediationPlanV2 + ScriptBuildContextV2
        │
        ▼
┌──────────────────────────────────┐
│  buildScriptCandidateV2()        │  ← Builder
│  → ScriptContractCandidateV2     │
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  validateScriptCandidateV2()     │  ← Validator
│  → ValidationResultV2            │
└──────────────────────────────────┘
        │
        ▼ (solo si valid.valid)
┌──────────────────────────────────┐
│  finalizeScriptContractV2()      │  ← Finalizer
│  → ScriptContractV2              │
└──────────────────────────────────┘
```

### 3.2 ScriptContractCandidateV2

```typescript
interface ScriptContractCandidateV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  datasetFingerprint: string;

  // ── Gobernanza HITL (partición única) ──
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: Array<{
    actionId: string;
    reason: 'pending' | 'ambiguous_column' | 'unsupported_action';
  }>;

  // ── Referencias ──
  columnRefs: ColumnRef[];

  // ── Renderer ──
  rendererVersion: string;
  placeholderVocabularyVersion: string;
  scriptText: string;
  cleanDatasetFn: string;

  // ── Metadata ──
  generatedAt: string;
}
```

**Regla de partición única:**
- `acceptedActionIds`: solo acciones con `approvalStatus === 'approved'` Y renderizables (columna válida, actionType distinto de `requires_human_review`)
- `rejectedActionIds`: ÚNICAMENTE acciones con `approvalStatus === 'rejected'`
- `excludedActionIds`: acciones `pending` O acciones `approved` no renderizables (columna ambigua, `requires_human_review`, etc.)
- Una acción `rejected` NO puede aparecer también en `excludedActionIds`

### 3.3 ScriptContractV2 (final)

```typescript
interface ScriptContractV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  datasetFingerprint: string;

  // ── Gobernanza HITL ──
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: Array<{
    actionId: string;
    reason: 'pending' | 'ambiguous_column' | 'unsupported_action';
  }>;

  // ── Referencias ──
  columnRefs: ColumnRef[];

  // ── Renderer ──
  rendererVersion: string;
  placeholderVocabularyVersion: string;
  scriptText: string;
  cleanDatasetFn: string;
  scriptHash: string;

  // ── Validación ──
  validationResult: ValidationResultV2;

  // ── Metadata ──
  generatedAt: string;
}
```

**Diferencias candidate vs final:**
- `candidate` no tiene `scriptHash` ni `validationResult`
- `finalizeScriptContractV2()` añade `scriptHash` y `validationResult`
- `finalizeScriptContractV2()` solo se llama si `validateScriptCandidateV2().valid === true`

### 3.4 Campos obligatorios

Todos los campos son obligatorios. `scriptText` puede contener solo la función `clean_dataset(df)` que copia y retorna sin transformaciones si `acceptedActionIds` está vacío.

### 3.5 Invariantes

| # | Invariante |
|---|---|
| I1 | `acceptedActionIds ∩ rejectedActionIds = ∅` |
| I2 | `acceptedActionIds ∩ excludedActionIds[].actionId = ∅` |
| I3 | `rejectedActionIds ∩ excludedActionIds[].actionId = ∅` (una acción rejected NUNCA está en excluded) |
| I4 | Toda `actionId` en `acceptedActionIds` ∪ `rejectedActionIds` ∪ `excludedActionIds[].actionId` existe en `RemediationPlanV2.plan` |
| I5 | `acceptedActionIds + rejectedActionIds + excludedActionIds` cubren exactamente el plan original |
| I6 | Solo acciones con `approvalStatus === 'approved'` en `acceptedActionIds` |
| I7 | Solo acciones con `approvalStatus === 'rejected'` en `rejectedActionIds` |
| I8 | Acciones con `approvalStatus === 'pending'` van a `excludedActionIds` |
| I9 | Acciones `approved` no renderizables van a `excludedActionIds` |
| I10 | `columnRefs` contiene exactamente las columnas referenciadas por las acciones en `acceptedActionIds` |
| I11 | Ninguna columna se resuelve solo por nombre (debe tener `columnId`) |
| I12 | El mismo input canónico produce el mismo `scriptText` y `scriptHash` |
| I13 | El LLM no escribe, corrige ni completa código en ningún punto del pipeline |
| I14 | `requires_human_review` nunca produce transformación automática |
| I15 | `cleanDatasetFn` coincide exactamente con el nombre de función en `scriptText` |

### 3.6 Representación canónica

La representación canónica del contrato es el objeto JSON ordenado por claves. Se usa `canonicalJson()` (ya definida en `diagnosisPromptV2.ts`).

### 3.7 Cálculo de `scriptHash`

```
scriptHash = sha256hex(canonicalJson({
  remediationRef,
  datasetFingerprint,
  acceptedActionIds: [...sort()],
  columnRefs: [...sort by columnId],
  rendererVersion,
  placeholderVocabularyVersion,
  scriptText,
  cleanDatasetFn
}))
```

**`generatedAt` NO se incluye en el hash.** El hash cubre solo el contenido determinista del contrato: referencias, acciones aceptadas, columnas, versión del renderer, vocabulario y el script. `validationResult`, `rejectedActionIds` y `excludedActionIds` tampoco se incluyen (son decisiones humanas o resultados de validación).

### 3.7.1 Regla de estabilidad del hash

El hash se recalcula al finalizar (`finalizeScriptContractV2`). Dos contratos con el mismo `remediationRef` y distintas decisiones HITL producirán hashes distintos solo si las decisiones cambian qué acciones están en `acceptedActionIds`. Mismo input canónico produce mismo hash.

### 3.8 Referencias cruzadas

| Desde | Hacia | Campo |
|---|---|---|
| `ScriptContractV2.remediationRef` | `RemediationPlanV2.planId` | Referencia al plan origen |
| `ScriptContractV2.datasetFingerprint` | `RemediationPlanV2.datasetFingerprint` | Mismo fingerprint |
| `ScriptContractV2.acceptedActionIds[]` | `RemediationPlanV2.plan[].actionId` | Solo acciones approved y renderizables |
| `ScriptContractV2.rejectedActionIds[]` | `RemediationPlanV2.plan[].actionId` | Solo acciones rejected |
| `ScriptContractV2.excludedActionIds[].actionId` | `RemediationPlanV2.plan[].actionId` | Acciones pending o approved no renderizables |
| `ScriptContractV2.columnRefs[]` | `ScriptBuildContextV2.columnRegistry` | Columnas referenciadas |

---

## 4. Códigos de error

### 4.1 Script Error Codes

```typescript
export type ScriptErrorCode =
  | 'SCRIPT_CONTRACT_INVALID'        // schema, campos obligatorios
  | 'SCRIPT_REFERENCE_INVALID'       // actionId/columnId no encontrado
  | 'SCRIPT_REMEDIATION_MISMATCH'    // remediationRef no coincide
  | 'SCRIPT_APPROVAL_INVALID'        // acción no aprobada en scriptText
  | 'SCRIPT_COVERAGE_INVALID'        // acciones no cubiertas
  | 'SCRIPT_PARTITION_INVALID'       // partición incorrecta (ej: rejected en excluded)
  | 'SCRIPT_COLUMN_AMBIGUOUS'        // columna resuelta solo por nombre
  | 'SCRIPT_HASH_MISMATCH'           // scriptHash no coincide con recálculo
  | 'SCRIPT_RENDER_MISMATCH'         // reconstrucción no coincide con original
  | 'SCRIPT_EXECUTABLE_CONTENT'      // eval/exec/subprocess detectado
  | 'SCRIPT_SYNTAX_INVALID'          // error de sintaxis Python
  | 'SCRIPT_UNAUTHORIZED_IMPORT'     // import no permitido
  | 'SCRIPT_NETWORK_ACCESS'          // acceso a red detectado
  | 'SCRIPT_FILE_ACCESS'             // acceso a archivos detectado
  | 'SCRIPT_DESTRUCTIVE_OPERATION'   // operación destructiva no autorizada
  | 'CONTRACTS_V2_DISABLED';
```

### 4.2 Condiciones de rechazo

| Condición | Código |
|---|---|
| Campos obligatorios faltantes o mal tipados | `SCRIPT_CONTRACT_INVALID` |
| `actionId` no existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| `columnId` no existe en el contexto | `SCRIPT_REFERENCE_INVALID` |
| `remediationRef` ≠ plan.planId | `SCRIPT_REMEDIATION_MISMATCH` |
| Acción `pending` o `rejected` aparece en `scriptText` | `SCRIPT_APPROVAL_INVALID` |
| No todas las acciones del plan están cubiertas | `SCRIPT_COVERAGE_INVALID` |
| Acción `rejected` aparece en `excludedActionIds` | `SCRIPT_PARTITION_INVALID` |
| Columna referenciada por nombre (sin `columnId`) | `SCRIPT_COLUMN_AMBIGUOUS` |
| `scriptHash` no coincide con recálculo | `SCRIPT_HASH_MISMATCH` |
| Reconstrucción no coincide (scriptText, acceptedActionIds, columnRefs, cleanDatasetFn) | `SCRIPT_RENDER_MISMATCH` |
| `eval()`, `exec()`, `__import__()` en script | `SCRIPT_EXECUTABLE_CONTENT` |
| `subprocess`, `os.system`, `socket`, `requests` | `SCRIPT_NETWORK_ACCESS` / `SCRIPT_FILE_ACCESS` |
| `open()`, `__file__`, rutas de archivo | `SCRIPT_FILE_ACCESS` |
| Import no estándar (solo `pandas`, `numpy`) | `SCRIPT_UNAUTHORIZED_IMPORT` |
| Sintaxis Python inválida | `SCRIPT_SYNTAX_INVALID` |
| `df.drop(inplace=True)`, `del df[col]` | `SCRIPT_DESTRUCTIVE_OPERATION` |

---

## 5. Estrategia de columnas

### 5.1 `pythonLiteral` en `ColumnRef`

`pythonLiteral` es propiedad de `ColumnRef`, NO de `RemediationContextColumnV2`. Se obtiene del envelope de evidencia original o se construye en el `ScriptBuildContextV2` a partir de `columnId`.

```typescript
// Canonical: _c["columnId"]
// buildColumnRegistry produce pythonLiteral = `_c[${JSON.stringify(columnId)}]`
// Para duplicados: el renderer usa iloc[:, _c["columnId"]["position"]]
// Para reserved words: pythonLiteral sigue siendo _c["columnId"] (bracket notation)
```

### 5.2 Helpers deterministas

```typescript
// Resolución: obtiene ColumnRef desde registry (o fail-closed)
function resolveScriptColumn(columnId: string | null, buildContext: ScriptBuildContextV2): ColumnResolutionResult

// Lectura: expresión Python para leer la columna
function buildColumnReadExpression(col: ColumnRef): string  // → df_clean[_c["col:..."]] o df_clean.iloc[:, ...]

// Escritura: expresión Python para escribir la columna
function buildColumnWriteTarget(col: ColumnRef): string  // → df_clean[_c["col:..."]] o df_clean.iloc[:, ...]
```

### 5.3 Columnas duplicadas

Columnas con `isDuplicate === true` se operan por **posición** usando `duplicateOrdinal`. El `pythonLiteral` sigue siendo canónico `_c["columnId"]`; la distinción única/duplicada se resuelve en el renderer con label vs `iloc[:, _c["columnId"]["position"]]`. Esto garantiza determinismo incluso con nombres idénticos.

### 5.4 Drop exact duplicates

`drop_exact_duplicates` opera a nivel dataset (sin columna). Acepta `columnRef` nulo. La plantilla es:

```python
df_clean = df_clean.drop_duplicates(keep="first").copy()
```

---

## 6. Renderer determinista: actionType → plantilla

### 6.1 Tabla de mapeo

| actionType | Renderiza | Plantilla Python | Parámetros | columnRef |
|---|---|---|---|---|
| `trim_whitespace` | Si `approved` y columna válida | `df_clean[_c["col:..."]] = df_clean[_c["col:..."].astype("string").str.strip()` | `trimEdges: true`, `collapseInternalWhitespace: boolean` | Requerido |
| `drop_exact_duplicates` | Si `approved` | `df_clean = df_clean.drop_duplicates(keep="first").copy()` | `keep: 'first'` | Acepta null |
| `normalize_placeholders` | Si `approved` y columna válida | `df_clean[_c["col:..."]] = df_clean[_c["col:..."].replace([PLACEHOLDER_VOCABULARY], np.nan)` | `strategy: 'controlled_vocabulary'`, `replacement: null` | Requerido |
| `normalize_casing` | Si `approved` y columna válida | `df_clean[_c["col:..."]] = df_clean[_c["col:..."].astype("string").str.strip().str.title()` (o `.str.lower()`) | `strategy: 'title_case' \| 'lowercase'` | Requerido |
| `convert_disguised_numbers` | Si `approved` y columna válida | `df_clean[_c["col:..."]] = pd.to_numeric(df_clean[_c["col:..."].astype("string").str.replace(",", ".", regex=False), errors="coerce")` | `decimalSeparator: 'auto'`, `errors: 'coerce'` | Requerido |
| `requires_human_review` | **NUNCA** | `# AURA review-only: reasonCode=<reasonCode>; no transformation rendered` | `reasonCode` | Opcional |

### 6.2 Comportamiento con columnas duplicadas o ambiguas

| Situación | Comportamiento |
|---|---|
| Columna con `isAmbiguous === true` | La acción se excluye con `reason: 'ambiguous_column'`. No se renderiza. |
| Columna con `isDuplicate === true` | Se opera por posición usando `duplicateOrdinal` y `pythonLiteral` del `ColumnRef`. |
| Columna con `isReservedWord === true` | Se usa `pythonLiteral` del `ColumnRef` (canonical `_c["columnId"]`, bracket notation). |
| `columnId === null` (scope dataset) | Solo permitido en `drop_exact_duplicates` y `requires_human_review`. Para otros actionTypes, se excluye. |

### 6.3 Reglas del renderer

1. **Solo `approved` y renderizable produce transformación.** `pending` y `rejected` nunca aparecen en `scriptText`.
2. **`requires_human_review` nunca produce transformación.**
3. **El LLM no escribe código.** El renderer es 100% determinista, basado en plantillas fijas.
4. **Mismo input → mismo output.** El hash es estable.
5. **Ninguna columna se resuelve por nombre.** Siempre se usa `columnId` con `buildColumnReadExpression`/`buildColumnWriteTarget`.
6. **Imports fijos.** Solo `pandas`, `numpy`. Sin `os`, `sys`, `subprocess`, `socket`, `requests`.
7. **Sin operaciones destructivas.** Sin `inplace=True`, `del`, `drop` sin `.copy()`.

### 6.4 Motivos de exclusión

| Motivo | Va a | Reason |
|---|---|---|
| `approvalStatus === 'rejected'` | `rejectedActionIds` | (string array) |
| `approvalStatus === 'pending'` | `excludedActionIds` | `'pending'` |
| `approvalStatus === 'approved'` + columna ambigua | `excludedActionIds` | `'ambiguous_column'` |
| `approvalStatus === 'approved'` + `requires_human_review` | `excludedActionIds` | `'unsupported_action'` |
| `approvalStatus === 'approved'` + `columnId` null + actionType requiere columna | `excludedActionIds` | `'unsupported_action'` |
| Issue `not_actionable` | Ya en `RemediationPlanV2.exclusions` | (no llega al script) |

---

## 7. PLACEHOLDER_VOCABULARY_V2

### 7.1 Definición

Constante cerrada, versionada y sin valores provenientes del LLM. Define los placeholders que `normalize_placeholders` reemplaza por `np.nan`.

```typescript
const PLACEHOLDER_VOCABULARY_V2: ReadonlyArray<string> = Object.freeze([
  '', 'n/a', 'N/A', 'na', 'NA',
  'null', 'NULL', 'none', 'None',
  '?', '-', '--', '...', 'NaN',
  'NAN', 'nan', 'N/a', 'n/a'
]);

const PLACEHOLDER_VOCABULARY_VERSION = '1.0.0';
```

### 7.2 Propiedades

- **Cerrada:** No se puede mutar en runtime (`Object.freeze` + `ReadonlyArray`).
- **Versionada:** `PLACEHOLDER_VOCABULARY_VERSION` es string semántico.
- **Sin valores LLM:** Ningún placeholder proviene de salida del modelo.
- **En el hash:** `placeholderVocabularyVersion` se incluye en `scriptHash` para detectar cambios de vocabulario entre versiones del renderer.

---

## 8. Validación del contrato

### 8.1 Flujo de validación

```
candidate
  │
  ▼
validateScriptCandidateV2(candidate, plan, buildContext) → ValidationResultV2
  │
  ├─ V1–V7: Integridad
  ├─ V8–V15: Correspondencia y cobertura
  ├─ V16–V21: HITL y partición
  ├─ V22–V25: Columnas
  ├─ V26–V31: Seguridad
  ├─ V32–V34: Sintaxis Python (tri-state)
  └─ V35: Reconstrucción exacta
```

### 8.2 Validaciones de integridad

| # | Validación | Código de error |
|---|---|---|
| V1 | Campos obligatorios presentes y tipados | `SCRIPT_CONTRACT_INVALID` |
| V2 | `contractId === 'aura.script.v2'` | `SCRIPT_CONTRACT_INVALID` |
| V3 | `contractVersion === '2.0.0'` | `SCRIPT_CONTRACT_INVALID` |
| V4 | `generatedAt` es ISO 8601 válido | `SCRIPT_CONTRACT_INVALID` |
| V5 | Sin propiedades extra en el contrato | `SCRIPT_CONTRACT_INVALID` |
| V6 | `cleanDatasetFn` es identificador Python válido | `SCRIPT_CONTRACT_INVALID` |
| V7 | `placeholderVocabularyVersion` es string no vacío | `SCRIPT_CONTRACT_INVALID` |

### 8.3 Validaciones de correspondencia

| # | Validación | Código de error |
|---|---|---|
| V8 | `remediationRef` coincide con el `planId` del plan | `SCRIPT_REMEDIATION_MISMATCH` |
| V9 | `datasetFingerprint` coincide con el plan | `SCRIPT_REFERENCE_INVALID` |
| V10 | Todo `actionId` en `acceptedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V11 | Todo `actionId` en `rejectedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V12 | Todo `actionId` en `excludedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V13 | Sin `actionId` duplicados entre las tres listas | `SCRIPT_COVERAGE_INVALID` |
| V14 | Cobertura exacta del plan (todas las acciones en alguna lista) | `SCRIPT_COVERAGE_INVALID` |
| V15 | `columnRefs` referencian columnas existentes en `columnRegistry` | `SCRIPT_REFERENCE_INVALID` |

### 8.4 Validaciones de HITL y partición

| # | Validación | Código de error |
|---|---|---|
| V16 | Solo acciones con `approvalStatus === 'approved'` en `acceptedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V17 | Solo acciones con `approvalStatus === 'rejected'` en `rejectedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V18 | Ninguna acción `rejected` en `excludedActionIds` | `SCRIPT_PARTITION_INVALID` |
| V19 | Acciones `pending` solo en `excludedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V20 | `acceptedActionIds` no contiene acciones `requires_human_review` | `SCRIPT_APPROVAL_INVALID` |
| V21 | Acciones `approved` no renderizables en `excludedActionIds` | `SCRIPT_APPROVAL_INVALID` |

### 8.5 Validaciones de columnas

| # | Validación | Código de error |
|---|---|---|
| V22 | Ninguna columna ambigua en `columnRefs` de acciones accepted | `SCRIPT_COLUMN_AMBIGUOUS` |
| V23 | `pythonLiteral` es válido para cada `ColumnRef` | `SCRIPT_REFERENCE_INVALID` |
| V24 | Columnas duplicadas tienen `duplicateOrdinal` > 0 y `pythonLiteral` con ordinal | `SCRIPT_REFERENCE_INVALID` |
| V25 | `columnId === null` solo para `drop_exact_duplicates` | `SCRIPT_REFERENCE_INVALID` |

### 8.6 Validaciones de seguridad

| # | Validación | Código de error |
|---|---|---|
| V26 | `scriptHash` coincide con recálculo | `SCRIPT_HASH_MISMATCH` |
| V27 | Sin `eval`, `exec`, `__import__` en `scriptText` | `SCRIPT_EXECUTABLE_CONTENT` |
| V28 | Sin `subprocess`, `os.system` en `scriptText` | `SCRIPT_NETWORK_ACCESS` |
| V29 | Sin `open()`, `__file__` en `scriptText` | `SCRIPT_FILE_ACCESS` |
| V30 | Solo imports permitidos (`pandas`, `numpy`) | `SCRIPT_UNAUTHORIZED_IMPORT` |
| V31 | Sin operaciones destructivas (`inplace=True`, `del`) | `SCRIPT_DESTRUCTIVE_OPERATION` |

### 8.7 Validación de sintaxis Python (tri-state)

| Estado | Significado |
|---|---|
| `'passed'` | `compile(scriptText, '<script>', 'exec')` ejecutó sin errores |
| `'failed'` | `compile()` arrojó `SyntaxError` |
| `'not_run'` | Python no disponible en el entorno |

```typescript
type PythonSyntaxState = 'passed' | 'failed' | 'not_run';
```

**`not_run` NO puede considerarse validación formal aprobada.** Si `pythonSyntax === 'not_run'`, el validador emite un warning pero no bloquea la finalización. Solo `'passed'` es validación positiva. `'failed'` produce `SCRIPT_SYNTAX_INVALID`.

### 8.8 Validación por reconstrucción exacta

| # | Validación | Código de error |
|---|---|---|
| V35 | Re-renderizar desde plan + contexto produce mismo `scriptText`, `acceptedActionIds`, `columnRefs`, `cleanDatasetFn` | `SCRIPT_RENDER_MISMATCH` |

```
reconstructed = buildScriptCandidateV2(plan, buildContext)
comparar:
  candidate.scriptText === reconstructed.scriptText
  candidate.acceptedActionIds deep equals reconstructed.acceptedActionIds
  candidate.columnRefs deep equals reconstructed.columnRefs
  candidate.cleanDatasetFn === reconstructed.cleanDatasetFn
```

Si alguna comparación falla → `SCRIPT_RENDER_MISMATCH`. Esto detecta drift entre builder y validator.

---

## 9. Script con cero acciones

Cuando `acceptedActionIds` está vacío, el script debe contener una función Python **válida** que copie y retorne el dataframe sin transformaciones:

```python
import pandas as pd
import numpy as np

_c = {
    "col:...": "columnName",
}

def clean_dataset(df):
    df_clean = df.copy()
    return df_clean
```

No se permite `scriptText` vacío. La función `clean_dataset(df)` siempre existe y es sintácticamente válida.

---

## 10. Badge UI

El badge de seguridad en la UI debe mostrar:

| Estado | Badge |
|---|---|
| Contrato validado (`valid: true`) | `"Contrato válido"` |
| Contrato inválido (`valid: false`) | `"Validación fallida"` |
| Sin validar | `"Sin validar"` |

Se elimina el badge `"Seguro"`. El contrato puede ser válido (cumple invariantes) sin que eso implique seguridad de ejecución (que es responsabilidad de Phase 5).

---

## 11. Claims que Phase 4 permitirá

- ✓ Script determinista generado a partir de plan de remediación validado
- ✓ Trazabilidad completa: RemediationPlanV2 → ScriptContractV2 → columnRefs → pythonLiteral
- ✓ Hash estable y verificable del script (sin `generatedAt`)
- ✓ Validación de seguridad: sin eval, exec, subprocess, imports no autorizados
- ✓ Gobernanza HITL con partición única (accepted/rejected/excluded sin solapamiento)
- ✓ Columnas resueltas por `columnId` con helpers `readColumn`/`writeColumn`
- ✓ Vocabulario de placeholders cerrado, versionado, sin valores LLM
- ✓ Reconstrucción exacta verificable (SCRIPT_RENDER_MISMATCH)

## 12. Claims que Phase 4 NO permitirá

- ✗ NO afirmar ejecución real del script (eso es Phase 5)
- ✗ NO afirmar mejora del dataset (eso es Phase 5 con delta)
- ✗ NO afirmar que el LLM escribió el código
- ✗ NO afirmar que el script es óptimo o completo (es determinista, no inteligente)
- ✗ NO afirmar que las acciones `requires_human_review` se resolvieron
- ✗ NO afirmar benchmark comparativo contra scripts legacy
- ✗ NO afirmar validación de sintaxis Python si el estado es `not_run`
