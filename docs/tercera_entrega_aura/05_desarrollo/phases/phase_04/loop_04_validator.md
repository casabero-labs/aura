# Loop 4 — Validator

> **Commit:** Loop 4 sobre `c73a3de0201fc88d45ee3591af79ed5660be87af`

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

- Enmascarador léxico: strings (single/double), comentarios (#)
- Falsos positivos evitados: columnas llamadas `eval(`, `open(`, `os.system`
- Patrones: imports no autorizados, ejecutable peligroso, red/procesos, archivos, operaciones destructivas

---

## Sintaxis tri-state

| Estado | Condición |
|---|---|
| `passed` | Checker devuelve `state='passed'` |
| `failed` | Checker devuelve `state='failed'` → `SCRIPT_SYNTAX_INVALID` |
| `not_run` | Sin checker o checker lanza → warning `SCRIPT_SYNTAX_NOT_RUN` |

---

## Tests

| Suite | Tests |
|---|---|
| Shape | 12 |
| Referencias | 5 |
| Partición | 3 |
| Columnas | 2 |
| Seguridad | 8 |
| Sintaxis | 4 |
| Reconstrucción | 3 |
| Final contract | 3 |
| **Total** | **42** |

---

## Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 4 | 42 passed |
| Suite completa | 1001 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |

---

## SHA

```
Loop 4: <commit actual>
Base: c73a3de0201fc88d45ee3591af79ed5660be87af
```
