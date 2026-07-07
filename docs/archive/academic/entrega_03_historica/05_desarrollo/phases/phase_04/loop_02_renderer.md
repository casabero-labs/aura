# Loop 2 — Renderer determinista

> **Commit:** Loop 2 sobre `b77d0f7e5dbe73b2b6da401fac7c6cb5829c5137`

---

## API implementada

```typescript
export const SCRIPT_RENDERER_VERSION = '2.0.0';

export interface RenderableScriptActionV2 {
  action: RemediationActionV2;
  columnRef: ColumnRef | null;
}

export function renderActionV2(
  action: RemediationActionV2,
  columnRef: ColumnRef | null,
  registry: ColumnRegistryV2,
): string;

export function buildScriptHeader(registry: ColumnRegistryV2): string;

export function buildScriptFooter(): string;

export function buildScriptText(
  actions: readonly RenderableScriptActionV2[],
  registry: ColumnRegistryV2,
): string;
```

### Errores del renderer

```typescript
export type ScriptRendererErrorCode =
  | 'RENDER_ACTION_NOT_APPROVED'
  | 'RENDER_COLUMN_REQUIRED'
  | 'RENDER_COLUMN_NOT_ALLOWED'
  | 'RENDER_COLUMN_MISMATCH'
  | 'RENDER_COLUMN_AMBIGUOUS'
  | 'RENDER_COLUMN_NOT_IN_REGISTRY'
  | 'RENDER_PARAMETERS_INVALID'
  | 'RENDER_UNSUPPORTED_ACTION';

export class ScriptRendererError extends Error {
  constructor(
    public readonly code: ScriptRendererErrorCode,
    message: string,
  ) { ... }
}
```

---

## actionType → plantilla exacta

| actionType | Parámetros | Plantilla |
|---|---|---|
| `trim_whitespace` | `trimEdges: true, collapseInternalWhitespace: false` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].astype("string").str.strip()` |
| `trim_whitespace` | `trimEdges: true, collapseInternalWhitespace: true` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].astype("string").str.strip().str.replace(r"\\s+", " ", regex=True)` |
| `drop_exact_duplicates` | `keep: "first"`, `columnId: null` | `df_clean = df_clean.drop_duplicates(keep="first").copy()` |
| `normalize_placeholders` | `strategy: "controlled_vocabulary", replacement: null` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].replace([...PLACEHOLDER_VOCABULARY_V2...], np.nan)` |
| `normalize_casing` | `strategy: "title_case"` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].astype("string").str.strip().str.title()` |
| `normalize_casing` | `strategy: "lowercase"` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].astype("string").str.strip().str.lower()` |
| `convert_disguised_numbers` | `decimalSeparator: "auto", errors: "coerce"` | `df_clean[_c["col:..."]] = pd.to_numeric(df_clean[_c["col:..."]].astype("string").str.replace(",", ".", regex=False), errors="coerce")` |
| `requires_human_review` | cualquier `reasonCode` válido | `# AURA review-only: reasonCode=<reasonCode>; no transformation rendered` |

---

## Canonical header

```python
import pandas as pd
import numpy as np

_c = {
    "col:abc123...": "Age",
    "col:def456...": "Name",
}

def clean_dataset(df):
    df_clean = df.copy()
```

El diccionario `_c` proviene de `generateSafeColumnDict(registry.orderedColumns)`.

---

## Canonical footer

```python
    return df_clean
```

El script termina con `\n` (un salto de línea).

---

## Vocabulario de placeholders

Usa `PLACEHOLDER_VOCABULARY_V2` (17 valores). La longitud se obtiene de `.length`:

```typescript
PLACEHOLDER_VOCABULARY_V2.length  // 17
```

No se hardcodea "19 placeholders".

Lista canónica:
```
'', 'n/a', 'N/A', 'na', 'NA', 'null', 'NULL', 'none', 'None',
'?', '-', '--', '...', 'NaN', 'NAN', 'nan', 'N/a'
```

---

## Casos de columna única y duplicada

| Tipo | Expresión |
|---|---|
| Única | `df_clean[_c["col:..."]]` |
| Duplicada | `df_clean.iloc[:, _c["col:..."]["position"]]` |

El renderer no usa `byName` para resolver ni validar ejecución.

---

## Errores del renderer

| Código | Condición |
|---|---|
| `RENDER_ACTION_NOT_APPROVED` | `approvalStatus !== 'approved'` |
| `RENDER_COLUMN_REQUIRED` | acción requiere columna pero `columnRef === null` |
| `RENDER_COLUMN_NOT_ALLOWED` | acción no permite columna pero `columnRef !== null` |
| `RENDER_COLUMN_MISMATCH` | `action.columnId !== columnRef.columnId` |
| `RENDER_COLUMN_AMBIGUOUS` | `columnRef.isAmbiguous === true` |
| `RENDER_COLUMN_NOT_IN_REGISTRY` | `columnRef` no existe en `registry.byColumnId` |
| `RENDER_PARAMETERS_INVALID` | parámetros no coinciden con la plantilla |
| `RENDER_UNSUPPORTED_ACTION` | `actionType` no reconocido |

---

## Tests

| Suite | Tests |
|---|---|
| `SCRIPT_RENDERER_VERSION` | 1 |
| Header | 8 |
| Footer | 2 |
| Zero actions | 3 |
| trim_whitespace | 5 |
| drop_exact_duplicates | 5 |
| normalize_placeholders | 7 |
| normalize_casing | 4 |
| convert_disguised_numbers | 6 |
| requires_human_review | 7 |
| Security: approvalStatus | 2 |
| Security: column reference | 4 |
| Special column names | 4 |
| Determinism | 4 |
| Full script | 3 |
| Error codes | 5 |
| **Total** | **70** |

---

## Build

`npm run build` → built in ~3s

---

## Contracts v2

`npm run contracts:v2:validate-local` → 3/3 PASS

---

## Python syntax

```python
import ast
ast.parse(script_text)  # PASSED
```

---

## Limitaciones

1. No decide partición approved/rejected/pending (recibe acciones ya seleccionadas)
2. No construye `ScriptContractCandidateV2`
3. No calcula `scriptHash` contractual
4. No valida el contrato completo
5. No consulta al LLM
6. No añade timestamps, UUIDs, o información del modelo
7. `requires_human_review` no genera transformación (Loop 3 excluirá esta acción de `acceptedActionIds`)

---

## SHA

```
Loop 2: <commit actual>
Base: b77d0f7e5dbe73b2b6da401fac7c6cb5829c5137
```
