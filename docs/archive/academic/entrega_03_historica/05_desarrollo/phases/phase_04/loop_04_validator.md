# Loop 4 — Validator

> **Commit:** Loop 4 sobre `c73a3de0201fc88d45ee3591af79ed5660be87af`
> **Loop 4R:** `<commit actual>` sobre `b7a7802eca9f702cf833fade6868d86b3982f57c`

---

## API

```typescript
export function validateScriptCandidateV2(
  candidate: unknown,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptValidationOptionsV2,
): ScriptValidationResultV2;

export function verifyScriptContractV2(
  contract: unknown,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptValidationOptionsV2,
): ScriptValidationResultV2;
```

---

## Códigos de error

```typescript
type ScriptErrorCode =
  | 'SCRIPT_CONTRACT_INVALID'
  | 'SCRIPT_REFERENCE_INVALID'
  | 'SCRIPT_REMEDIATION_MISMATCH'
  | 'SCRIPT_APPROVAL_INVALID'
  | 'SCRIPT_COVERAGE_INVALID'
  | 'SCRIPT_PARTITION_INVALID'
  | 'SCRIPT_COLUMN_AMBIGUOUS'
  | 'SCRIPT_HASH_MISMATCH'
  | 'SCRIPT_RENDER_MISMATCH'
  | 'SCRIPT_EXECUTABLE_CONTENT'
  | 'SCRIPT_SYNTAX_INVALID'
  | 'SCRIPT_UNAUTHORIZED_IMPORT'
  | 'SCRIPT_NETWORK_ACCESS'
  | 'SCRIPT_FILE_ACCESS'
  | 'SCRIPT_DESTRUCTIVE_OPERATION'
  | 'CONTRACTS_V2_DISABLED';

type ScriptWarningCode =
  | 'SCRIPT_SYNTAX_NOT_RUN';
```

---

## Matriz V1-V35

| # | Validación |
|---|---|
| V1-V7 | Shape: campos obligatorios, tipos, extra props, contractId, versiones |
| V8-V15 | Correspondencia: remediationRef, fingerprint, context, IDs existentes, cobertura |
| V16-V21 | HITL: approved/rejected/pending en conjuntos correctos, requires_human_review nunca accepted |
| V22-V25 | Columnas: registry matching (8 campos), no ambiguas en accepted, sorted columnRefs |
| V26-V31 | Seguridad: eval/exec/__import__, imports no autorizados, red/archivos, operaciones destructivas |
| V32-V34 | Sintaxis: tri-state (passed/failed/not_run), checker inyectado |
| V35 | Reconstrucción: buildScriptCandidateCoreV2(), comparación estructural |
| Final | Hash (solo verifyScriptContractV2) |

---

## Seguridad

### Enmascarador léxico

Enmascara strings (single/double/raw/f/triple) y comentarios (#) antes de escanear tokens.

### Política de imports (whitelist)

Solo permitidos:
```python
import pandas as pd
import numpy as np
```

Rechazados:
- `import pandas` (sin alias)
- `import pandas as pandas` (alias igual al módulo)
- `import numpy` (sin alias)
- `import numpy as numpy` (alias igual al módulo)
- `import pandas as pd, numpy as np` (múltiples en una línea)
- `from os import system` (cualquier from ... import)
- Imports dentro de clean_dataset body

### Tokens peligrosos detectados

| Categoría | Patrones | Código |
|---|---|---|
| Ejecutable | `eval(`, `exec(`, `__import__(` | SCRIPT_EXECUTABLE_CONTENT |
| Red/procesos | `subprocess`, `os.system`, `socket`, `requests`, `urllib`, `http.client` | SCRIPT_NETWORK_ACCESS |
| Archivos | `open(`, `io.open(`, `pathlib`, `__file__` | SCRIPT_FILE_ACCESS |
| Destrucción | `inplace=True`, `del` | SCRIPT_DESTRUCTIVE_OPERATION |

### Falsos positivos evitados

Columnas llamadas `eval`, `exec`, `open`, `subprocess`, `os.system`, `__file__`, `del` → no producen errores cuando aparecen únicamente dentro de strings del diccionario `_c`.

---

## Sintaxis tri-state

| Estado | Condición | Resultado |
|---|---|---|
| `passed` | Checker devuelve `state='passed'` válido | pythonSyntax=passed, sin error |
| `failed` | Checker devuelve `state='failed'` válido | pythonSyntax=failed, SCRIPT_SYNTAX_INVALID |
| `not_run` | Sin checker, checker lanza, o resultado malformado | pythonSyntax=not_run, SCRIPT_SYNTAX_NOT_RUN |

### Resultado malformado → not_run

Tratado como `not_run`:
- null, undefined
- string, array
- objeto sin `state`
- `state` no es `'passed'` | `'failed'` | `'not_run'`
- `engine` presente y no string
- `message` presente y no string
- cualquier propiedad distinta de `state`, `engine`, `message`

### No se incluye stack trace en warnings

---

## Embedded validationResult (en verifyScriptContractV2)

Validación profunda de la estructura:

### errors / warnings (cada elemento)

```typescript
{
  code: string;      // no vacío
  path: string;
  message: string;
  value?: unknown;   // opcional
  // sin propiedades adicionales
}
```

### pythonSyntax

```typescript
{
  state: 'passed' | 'failed' | 'not_run';
  engine?: string;
  message?: string;
  // sin propiedades adicionales
}
```

El embedded validationResult nunca sustituye la validación fresca.

---

## Intersecciones de partición explícitas

| Verificación | Código |
|---|---|
| accepted ∩ rejected ≠ ∅ | SCRIPT_PARTITION_INVALID |
| accepted ∩ excluded ≠ ∅ | SCRIPT_PARTITION_INVALID |
| rejected ∩ excluded ≠ ∅ | SCRIPT_PARTITION_INVALID |

---

## Reconstrucción

Usa `buildScriptCandidateCoreV2()` (no `buildScriptCandidateV2()` — sin reloj).
Compara 12 campos deterministas. No compara `generatedAt`.

---

## Hash (solo verifyScriptContractV2)

```
sha256hex(canonicalJson({
  remediationRef, datasetFingerprint, acceptedActionIds,
  columnRefs, rendererVersion, placeholderVocabularyVersion,
  scriptText, cleanDatasetFn,
}))
```

NO afectan el hash: `generatedAt`, `validationResult`, `rejectedActionIds`, `excludedActionIds`.

---

## Tests

| Suite | Tests |
|---|---|
| Shape | 19 |
| Referencias | 5 |
| Partición | 7 |
| Columnas | 3 |
| Seguridad | 12 |
| Import whitelist | 6 |
| Sintaxis | 13 |
| Reconstrucción | 4 |
| Contrato final + hash | 16 |
| Python compile real | 3 |
| **Total validator** | **88** |

---

## Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 4R | 88 passed |
| Suite completa | 1047 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Python compile | passed (python3 disponible) |

---

## SHA

```
Loop 4:  b7a7802eca9f702cf833fade6868d86b3982f57c
Loop 4R: <commit actual>
Base:    c73a3de0201fc88d45ee3591af79ed5660be87af
```
