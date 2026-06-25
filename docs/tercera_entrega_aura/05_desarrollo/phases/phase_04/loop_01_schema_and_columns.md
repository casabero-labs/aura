# Loop 1 — Schema y Columns

## SHA

```
Base: c048a7e601088cb7f433085748f489f01b81b91d
Loop 1: HEAD (sha completo al hacer commit)
```

## Tipos implementados

### ScriptExclusionReasonV2

```typescript
type ScriptExclusionReasonV2 = 'pending' | 'ambiguous_column' | 'missing_column' | 'unsupported_action';
```

Motivos mínimos de exclusión según spec:
- `pending`: acción sin decisión HITL
- `ambiguous_column`: columna con `isAmbiguous === true`
- `missing_column`: `columnId` no encontrado en registry
- `unsupported_action`: `actionType` no soportado o `columnId` null en acción que requiere columna

**Nota:** `'rejected'` NO es un `ScriptExclusionReasonV2`. Las acciones rejected van a `rejectedActionIds[]` (string array), no a `excludedActionIds[]`.

### ScriptExcludedActionV2

```typescript
interface ScriptExcludedActionV2 {
  actionId: string;
  reason: ScriptExclusionReasonV2;
}
```

### ColumnRegistryV2

```typescript
interface ColumnRegistryV2 {
  orderedColumns: readonly ColumnRef[];
  byColumnId: ReadonlyMap<string, ColumnRef>;
  byName: ReadonlyMap<string, readonly ColumnRef[]>;
}
```

- `orderedColumns`: ColumnRefs en orden de posición
- `byColumnId`: lookup O(1) por columnId
- `byName`: solo para diagnóstico, NO para resolución

### CorrespondenceEvidenceV2

```typescript
interface CorrespondenceEvidenceV2 {
  fingerprintMatch: boolean;
  columnsMatch: boolean;
  missingColumnIds: readonly string[];
  mismatchedColumns: readonly string[];
  columnsFromContext: number;
  columnsInRegistry: number;
  valid: boolean;
}
```

Verifica:
- `sourceDatasetFingerprint` vs `remediationContext.datasetFingerprint`
- `remediationContext.columns.length` vs `columnRegistry.byColumnId.size`
- Existencia exacta de cada `columnId`
- name, position, duplicateOrdinal, isAmbiguous, isDuplicate

**NO verifica:** `RemediationContextColumnV2.pythonLiteral` (tipo no existe en RemediationContext)

### ScriptBuildContextV2

```typescript
interface ScriptBuildContextV2 {
  remediationContext: RemediationContextV2;
  sourceDatasetFingerprint: string;
  columnRegistry: ColumnRegistryV2;
  correspondenceEvidence: CorrespondenceEvidenceV2;
}
```

### ColumnAccessSpecV2

```typescript
type ColumnAccessMode = 'label' | 'position';

interface ColumnAccessSpecV2 {
  columnId: string;
  pythonLiteral: string;
  accessMode: ColumnAccessMode;
  position: number;
  duplicateOrdinal: number;
}
```

- Unique columns → `accessMode = 'label'`
- Duplicate columns → `accessMode = 'position'`

### PythonSyntaxState

```typescript
type PythonSyntaxState = 'passed' | 'failed' | 'not_run';
```

### ScriptValidationResultV2

```typescript
interface ScriptValidationResultV2 extends Omit<ValidationResultV2, 'errors' | 'warnings'> {
  valid: boolean;
  errors: ValidationErrorV2[];
  warnings: ValidationErrorV2[];
  pythonSyntax: {
    state: PythonSyntaxState;
    engine?: string;
    message?: string;
  };
}
```

## Casos de correspondencia

| Escenario | fingerprintMatch | columnsMatch | missingColumnIds | mismatchedColumns | valid |
|---|---|---|---|---|---|
| Contexto válido | true | true | [] | [] | true |
| Fingerprint diferente | false | true | [] | [] | false |
| Columna faltante en registry | true | false | ['col:X'] | [] | false |
| Nombre diferente | true | false | [] | ['col:X'] | false |
| Posición diferente | true | false | [] | ['col:X'] | false |
| Ordinal diferente | true | false | [] | ['col:X'] | false |
| Flags diferentes | true | false | [] | ['col:X'] | false |
| Columnas adicionales | true | false | [] | [] | false |

## Tabla de resolución de columnas

| columnId | name | isDuplicate | isAmbiguous | isReservedWord | Resultado | accessMode |
|---|---|---|---|---|---|---|
| `col:A` | A | false | false | false | ok: true | label |
| `col:B` | B | false | false | true | ok: true | label |
| `col:Name_0` | Name | true | false | false | ok: true | position |
| `col:Name_1` | Name | true | false | false | ok: true | position |
| `col:ambiguous` | col | true | true | false | ok: false, reason: ambiguous_column | N/A |
| `col:nonexistent` | - | - | - | - | ok: false, reason: missing_column | N/A |
| `null` | - | - | - | - | ok: false, reason: missing_column | N/A |

## Vocabulario final

```typescript
export const PLACEHOLDER_VOCABULARY_VERSION = '1.0.0';

export const PLACEHOLDER_VOCABULARY_V2: readonly string[] = Object.freeze([
  '', 'n/a', 'N/A', 'na', 'NA',
  'null', 'NULL', 'none', 'None',
  '?', '-', '--', '...', 'NaN',
  'NAN', 'nan', 'N/a',
]);
```

- **Longitud calculada:** 17 (`.length`)
- **Frozen:** Sí
- **Versioned:** 1.0.0
- **Sin duplicados exactos:** Sí
- **Sin valores LLM:** Sí

## Tests

| Archivo | Tests | Pasaron |
|---|---|---|
| `placeholderVocabulary.test.ts` | 8 | 8 |
| `scriptColumnResolver.test.ts` | 22 | 22 |
| `scriptBuildContext.test.ts` | 11 | 11 |
| `scriptContractV2.types.test.ts` | 18 | 18 |
| **Total** | **59** | **59** |

## Build

```
✓ built in 4.19s
```

## Contracts v2 validate-local

```
Total: 6
PASS:  3
FAIL:  0
UNSUPPORTED: 3

=== REMEDIATION (Phase 3) ===
Plans built: 3
Plans valid: 3
planHashStable: true
unsafeUpgrades: 0
invalidReferences: 0
```

Phase 3 sigue 3/3 PASS.

## Confirmaciones

1. **Ninguna columna se resolvió por nombre:** `resolveScriptColumn` solo usa `columnId`. `byName` es diagnóstico.
2. **Phase 3 no cambió:** `git diff --name-only c048a7e` solo muestra `index.ts` y `types.ts` (permitidos).
3. **`RemediationContextColumnV2.pythonLiteral` no se comparó:** El tipo no existe en `RemediationContextV2`.
4. **duplicateOrdinal=0 válido para primera columna duplicada:** Implementado y testeado.
5. **isAmbiguous=true rechaza la columna:** Implementado y testeado.
