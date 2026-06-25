# Diseño del contrato ScriptContractV2 — Phase 4

> **Versión:** 1.0.0 · **Fecha:** 2026-06-25 · **Commit:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191` (Phase 3 congelada)

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
| `ScriptContractV2` type | Faltan: `excludedActionIds`, `rejectedActionIds`, `datasetFingerprint`, `scriptText`, `generatedAt`, `remediationRef` real |
| Builder de script v2 | No existe `buildScriptContractV2()` |
| Validación de script v2 | No existe `validateScriptContractV2()` |
| Renderer determinista v2 | No existe mapeo actionType → Python/Pandas basado en contrato |
| `scriptHash` | No hay función de cálculo estable |
| Column resolver | No hay resolución de `columnId` para el renderer |
| Componente de script v2 | `RemediationPlanStepV2` no conecta con script review |
| E2E harness Phase 4 | No existe |

### 1.3 Deuda técnica que puede interferir

| Deuda | Riesgo |
|---|---|
| `buildDeterministicCleaningScript` usa nombres de columna por string, no `columnId` | Columnas ambiguas pueden colisionar |
| `validateCleaningScript` traza por nombre, no por `columnId` | Falsos positivos en duplicados |
| `ReviewStep` depende de `cleaningScript` (string) y `scriptValidation` (legacy) | Necesita adaptación a contrato v2 |
| `ScriptGenerationStep` rutea a v2 con `isContractsV2Enabled() && !!structuredDiagnosis` | Debe expandirse para script v2 |
| No hay `ColumnRef` resolver en contexto de script | El renderer necesita `pythonLiteral` |

---

## 2. Propuesta contractual: ScriptContractV2

### 2.1 Campos del contrato

```typescript
export interface ScriptContractV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';

  // ── Trazabilidad ──
  remediationRef: string;
  datasetFingerprint: string;

  // ── Gobernanza HITL ──
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: Array<{
    actionId: string;
    reason: 'not_actionable' | 'rejected' | 'pending' | 'ambiguous_column' | 'unsupported_action';
  }>;

  // ── Referencias ──
  columnRefs: ColumnRef[];

  // ── Renderer ──
  rendererVersion: string;
  scriptText: string;
  cleanDatasetFn: string;
  scriptHash: string;

  // ── Validación ──
  validationResult: ValidationResultV2;

  // ── Metadata ──
  generatedAt: string;
}
```

### 2.2 Campos obligatorios

Todos los campos son obligatorios. `scriptText` puede ser string vacío si no hay acciones aprobadas (caso borde: 0 acciones → script solo con `df_clean = df.copy()` y comentario).

### 2.3 Invariantes

| # | Invariante |
|---|---|
| I1 | `acceptedActionIds ∩ rejectedActionIds = ∅` |
| I2 | Toda `actionId` en `acceptedActionIds` ∪ `rejectedActionIds` ∪ `excludedActionIds[].actionId` existe en `RemediationPlanV2.plan` |
| I3 | `acceptedActionIds` + `rejectedActionIds` + `excludedActionIds` cubren exactamente el plan original |
| I4 | Solo acciones con `approvalStatus === 'approved'` producen código en `scriptText` |
| I5 | Acciones con `approvalStatus === 'pending'` van a `excludedActionIds` con `reason: 'pending'` |
| I6 | Acciones con `approvalStatus === 'rejected'` van a `rejectedActionIds` o `excludedActionIds` |
| I7 | `columnRefs` contiene exactamente las columnas referenciadas por las acciones aprobadas |
| I8 | Ninguna columna se resuelve solo por nombre (debe tener `columnId`) |
| I9 | El mismo input canónico produce el mismo `scriptText` y `scriptHash` |
| I10 | El LLM no escribe, corrige ni completa código en ningún punto del pipeline |
| I11 | `requires_human_review` nunca produce transformación automática |
| I12 | `cleanDatasetFn` coincide exactamente con el nombre de función en `scriptText` |

### 2.4 Representación canónica

La representación canónica del contrato es el objeto JSON ordenado por claves. Se usa `canonicalJson()` (ya definida en `diagnosisPromptV2.ts`).

### 2.5 Cálculo de `scriptHash`

```
scriptHash = sha256hex(canonicalJson({
  remediationRef,
  datasetFingerprint,
  acceptedActionIds: [...sort()],
  columnRefs: [...sort by columnId],
  rendererVersion,
  scriptText,
  cleanDatasetFn,
  generatedAt
}))
```

El hash cubre el contenido del script y todas las referencias, pero no el `validationResult` (que depende de la validación, no del contenido). `rejectedActionIds` y `excludedActionIds` NO se incluyen en el hash porque son decisiones humanas que no afectan el cuerpo ejecutable.

### 2.5.1 Regla de estabilidad del hash

El hash se recalcula cada vez que cambia el script. Dos contratos con el mismo `remediationRef` y distintas decisiones HITL producirán hashes distintos solo si las decisiones cambian qué acciones están en `acceptedActionIds`.

### 2.6 Referencias cruzadas

| Desde | Hacia | Campo |
|---|---|---|
| `ScriptContractV2.remediationRef` | `RemediationPlanV2.planId` | Referencia al plan origen |
| `ScriptContractV2.datasetFingerprint` | `RemediationPlanV2.datasetFingerprint` | Mismo fingerprint |
| `ScriptContractV2.acceptedActionIds[]` | `RemediationPlanV2.plan[].actionId` | Solo acciones approved |
| `ScriptContractV2.rejectedActionIds[]` | `RemediationPlanV2.plan[].actionId` | Solo acciones rejected |
| `ScriptContractV2.excludedActionIds[].actionId` | `RemediationPlanV2.plan[].actionId` | Acciones excluidas |
| `ScriptContractV2.columnRefs[]` | `RemediationContextV2.columns[]` | Columnas referenciadas |

---

## 3. Códigos de error

### 3.1 Script Error Codes

```typescript
export type ScriptErrorCode =
  | 'SCRIPT_CONTRACT_INVALID'        // schema, campos obligatorios
  | 'SCRIPT_REFERENCE_INVALID'       // actionId/columnId no encontrado
  | 'SCRIPT_REMEDIATION_MISMATCH'    // remediationRef no coincide
  | 'SCRIPT_APPROVAL_INVALID'        // acción no aprobada en scriptText
  | 'SCRIPT_COVERAGE_INVALID'        // acciones no cubiertas
  | 'SCRIPT_COLUMN_AMBIGUOUS'        // columna resuelta solo por nombre
  | 'SCRIPT_HASH_MISMATCH'           // scriptHash no coincide con recálculo
  | 'SCRIPT_EXECUTABLE_CONTENT'      // eval/exec/subprocess detectado
  | 'SCRIPT_SYNTAX_INVALID'          // error de sintaxis Python
  | 'SCRIPT_UNAUTHORIZED_IMPORT'     // import no permitido
  | 'SCRIPT_NETWORK_ACCESS'          // acceso a red detectado
  | 'SCRIPT_FILE_ACCESS'             // acceso a archivos detectado
  | 'SCRIPT_DESTRUCTIVE_OPERATION'   // operación destructiva no autorizada
  | 'CONTRACTS_V2_DISABLED';
```

### 3.2 Condiciones de rechazo

| Condición | Código |
|---|---|
| Campos obligatorios faltantes o mal tipados | `SCRIPT_CONTRACT_INVALID` |
| `actionId` no existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| `columnId` no existe en el contexto | `SCRIPT_REFERENCE_INVALID` |
| `remediationRef` ≠ plan.planId | `SCRIPT_REMEDIATION_MISMATCH` |
| Acción `pending` o `rejected` aparece en `scriptText` | `SCRIPT_APPROVAL_INVALID` |
| No todas las acciones del plan están cubiertas | `SCRIPT_COVERAGE_INVALID` |
| Columna referenciada por nombre (sin `columnId`) | `SCRIPT_COLUMN_AMBIGUOUS` |
| `scriptHash` no coincide con recálculo | `SCRIPT_HASH_MISMATCH` |
| `eval()`, `exec()`, `__import__()` en script | `SCRIPT_EXECUTABLE_CONTENT` |
| `subprocess`, `os.system`, `socket`, `requests` | `SCRIPT_NETWORK_ACCESS` / `SCRIPT_FILE_ACCESS` |
| `open()`, `__file__`, rutas de archivo | `SCRIPT_FILE_ACCESS` |
| Import no estándar (solo `pandas`, `numpy`, `re`) | `SCRIPT_UNAUTHORIZED_IMPORT` |
| Sintaxis Python inválida | `SCRIPT_SYNTAX_INVALID` |
| `df.drop(inplace=True)`, `del df[col]` | `SCRIPT_DESTRUCTIVE_OPERATION` |

---

## 4. Renderer determinista: actionType → plantilla

### 4.1 Tabla de mapeo

| actionType | Renderiza | Plantilla Python | Parámetros | Validaciones |
|---|---|---|---|---|
| `trim_whitespace` | Siempre (si `approved`) | `df_clean[col] = df_clean[col].astype('string').str.strip()` | `trimEdges: true`, `collapseInternalWhitespace: boolean` | Columna debe ser string, no nula |
| `drop_exact_duplicates` | Siempre (si `approved`) | `df_clean = df_clean.drop_duplicates().copy()` | `keep: 'first'` | Scope dataset (no requiere columna) |
| `normalize_placeholders` | Siempre (si `approved`) | `df_clean[col] = df_clean[col].replace([...], np.nan)` | `strategy: 'controlled_vocabulary'`, `replacement: null` | Columna debe ser string/object |
| `normalize_casing` | Siempre (si `approved`) | `df_clean[col] = df_clean[col].astype('string').str.strip().str.title()` (o `.str.lower()`) | `strategy: 'title_case' \| 'lowercase'` | Columna debe ser string |
| `convert_disguised_numbers` | Siempre (si `approved`) | `df_clean[col] = pd.to_numeric(df_clean[col].astype('string').str.replace(',', '.', regex=False), errors='coerce')` | `decimalSeparator: 'auto'`, `errors: 'coerce'` | Columna debe ser string/object |
| `requires_human_review` | **NUNCA** | Sin transformación. Comentario: `# Requiere revisión humana: {reasonCode}. Sin transformación automática.` | `reasonCode` | Siempre excluida |

### 4.2 Comportamiento con columnas duplicadas o ambiguas

| Situación | Comportamiento |
|---|---|
| Columna con `isAmbiguous === true` | La acción se excluye con `reason: 'ambiguous_column'`. No se renderiza. |
| Columna con `isDuplicate === true` | Se usa `duplicateOrdinal` y `pythonLiteral` (nombre sanitizado + ordinal) del `ColumnRef`. |
| Columna con `isReservedWord === true` | Se usa `pythonLiteral` del `ColumnRef`. |
| `columnId === null` (scope dataset) | Se usa en `drop_exact_duplicates`. Para otros actionTypes, se excluye. |

### 4.3 Reglas del renderer

1. **Solo `approved` produce transformación.** `pending` y `rejected` nunca aparecen en `scriptText`.
2. **`requires_human_review` nunca produce transformación.** Siempre va a comentario.
3. **El LLM no escribe código.** El renderer es 100% determinista, basado en plantillas fijas.
4. **Mismo input → mismo output.** El hash es estable.
5. **Ninguna columna se resuelve por nombre.** Siempre se usa `columnId` y `pythonLiteral`.
6. **Imports fijos.** Solo `pandas`, `numpy`. Sin `os`, `sys`, `subprocess`, `socket`, `requests`.
7. **Sin operaciones destructivas.** Sin `inplace=True`, `del`, `drop` sin `.copy()`.

### 4.4 Motivos de exclusión

| Motivo | Código |
|---|---|
| Issue `not_actionable` | Ya excluido en `RemediationPlanV2.exclusions` |
| Acción `rejected` por HITL | Va a `rejectedActionIds` |
| Acción `pending` (no decidida) | Va a `excludedActionIds` con `reason: 'pending'` |
| Columna ambigua (`isAmbiguous`) | Va a `excludedActionIds` con `reason: 'ambiguous_column'` |
| `actionType === 'requires_human_review'` | Va a `excludedActionIds` con `reason: 'unsupported_action'` |
| `columnId === null` para actionType que requiere columna | Va a `excludedActionIds` con `reason: 'unsupported_action'` |

---

## 5. Validación del contrato

### 5.1 Validaciones de integridad

| # | Validación | Código de error |
|---|---|---|
| V1 | Campos obligatorios presentes y tipados | `SCRIPT_CONTRACT_INVALID` |
| V2 | `contractId === 'aura.script.v2'` | `SCRIPT_CONTRACT_INVALID` |
| V3 | `contractVersion === '2.0.0'` | `SCRIPT_CONTRACT_INVALID` |
| V4 | `generatedAt` es ISO 8601 válido | `SCRIPT_CONTRACT_INVALID` |
| V5 | Sin propiedades extra en el contrato | `SCRIPT_CONTRACT_INVALID` |

### 5.2 Validaciones de correspondencia

| # | Validación | Código de error |
|---|---|---|
| V6 | `remediationRef` coincide con el `planId` del plan | `SCRIPT_REMEDIATION_MISMATCH` |
| V7 | `datasetFingerprint` coincide con el plan | `SCRIPT_REFERENCE_INVALID` |
| V8 | Todo `actionId` en `acceptedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V9 | Todo `actionId` en `rejectedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V10 | Todo `actionId` en `excludedActionIds` existe en el plan | `SCRIPT_REFERENCE_INVALID` |
| V11 | Sin `actionId` duplicados entre listas | `SCRIPT_COVERAGE_INVALID` |
| V12 | Cobertura exacta del plan (todas las acciones están en alguna lista) | `SCRIPT_COVERAGE_INVALID` |

### 5.3 Validaciones de HITL

| # | Validación | Código de error |
|---|---|---|
| V13 | Solo acciones con `approvalStatus === 'approved'` en `acceptedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V14 | Solo acciones con `approvalStatus === 'rejected'` en `rejectedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V15 | Acciones `pending` solo en `excludedActionIds` | `SCRIPT_APPROVAL_INVALID` |
| V16 | `acceptedActionIds` no contiene acciones `requires_human_review` | `SCRIPT_APPROVAL_INVALID` |

### 5.4 Validaciones de columnas

| # | Validación | Código de error |
|---|---|---|
| V17 | `columnRefs` referencian columnas existentes en el contexto | `SCRIPT_REFERENCE_INVALID` |
| V18 | Ninguna columna ambigua en `columnRefs` de acciones approved | `SCRIPT_COLUMN_AMBIGUOUS` |
| V19 | `pythonLiteral` es válido para cada `ColumnRef` | `SCRIPT_REFERENCE_INVALID` |

### 5.5 Validaciones de seguridad

| # | Validación | Código de error |
|---|---|---|
| V20 | `scriptHash` coincide con recálculo | `SCRIPT_HASH_MISMATCH` |
| V21 | Sin `eval`, `exec`, `__import__` en `scriptText` | `SCRIPT_EXECUTABLE_CONTENT` |
| V22 | Sin `subprocess`, `os.system` en `scriptText` | `SCRIPT_NETWORK_ACCESS` |
| V23 | Sin `open()`, `__file__` en `scriptText` | `SCRIPT_FILE_ACCESS` |
| V24 | Solo imports permitidos (`pandas`, `numpy`) | `SCRIPT_UNAUTHORIZED_IMPORT` |
| V25 | Sin operaciones destructivas (`inplace=True`, `del`) | `SCRIPT_DESTRUCTIVE_OPERATION` |
| V26 | `cleanDatasetFn` es identificador Python válido | `SCRIPT_SYNTAX_INVALID` |

### 5.6 Validación de sintaxis Python

| # | Validación | Código de error |
|---|---|---|
| V27 | `scriptText` compila con `compile()` de Python (si está disponible) | `SCRIPT_SYNTAX_INVALID` |
| V28 | `cleanDatasetFn` existe como función en `scriptText` | `SCRIPT_REFERENCE_INVALID` |

---

## 6. Cambios al tipo `ScriptContractV2`

### 6.1 Tipo final propuesto

```typescript
export interface ScriptContractV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  datasetFingerprint: string;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: Array<{
    actionId: string;
    reason: 'not_actionable' | 'rejected' | 'pending' | 'ambiguous_column' | 'unsupported_action';
  }>;
  columnRefs: ColumnRef[];
  rendererVersion: string;
  scriptText: string;
  cleanDatasetFn: string;
  scriptHash: string;
  validationResult: ValidationResultV2;
  generatedAt: string;
}
```

### 6.2 Diferencias con el tipo actual

| Campo | Actual | Propuesto |
|---|---|---|
| `remediationRef` | `string` | `string` (sin cambio semántico, se valida contra `planId`) |
| `acceptedActionIds` | `string[]` | `string[]` (sin cambio) |
| `rejectedActionIds` | `string[]` | `string[]` (sin cambio) |
| `excludedActionIds` | No existe | `Array<{actionId, reason}>` |
| `datasetFingerprint` | No existe | `string` |
| `columnRefs` | `string[]` | `ColumnRef[]` (cambio de tipo) |
| `rendererVersion` | `string` | `string` (sin cambio) |
| `scriptText` | `string?` | `string` (obligatorio, puede ser vacío) |
| `cleanDatasetFn` | `string` | `string` (sin cambio) |
| `scriptHash` | `string` | `string` (sin cambio) |
| `validationResult` | `ValidationResultV2` | `ValidationResultV2` (sin cambio) |
| `generatedAt` | No existe | `string` |
| `excludedActionIds` | No existe | `Array<{actionId, reason}>` |

---

## 7. Claims que Phase 4 permitirá

- ✓ Script determinista generado a partir de plan de remediación validado
- ✓ Trazabilidad completa: RemediationPlanV2 → ScriptContractV2 → columnRefs → pythonLiteral
- ✓ Hash estable y verificable del script
- ✓ Validación de seguridad: sin eval, exec, subprocess, imports no autorizados
- ✓ Gobernanza HITL reflejada en el contrato (accepted/rejected/excluded)
- ✓ Columnas resueltas por `columnId`, no por nombre

## 8. Claims que Phase 4 NO permitirá

- ✗ NO afirmar ejecución real del script (eso es Phase 5)
- ✗ NO afirmar mejora del dataset (eso es Phase 5 con delta)
- ✗ NO afirmar que el LLM escribió el código
- ✗ NO afirmar que el script es óptimo o completo (es determinista, no inteligente)
- ✗ NO afirmar que las acciones `requires_human_review` se resolvieron
- ✗ NO afirmar benchmark comparativo contra scripts legacy
