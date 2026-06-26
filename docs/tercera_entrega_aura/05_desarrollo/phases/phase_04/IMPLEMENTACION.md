# Implementación — Phase 4

## Loop 1R: Remediación de revisión adversarial

**SHA:** `9a8f5e0330f1dbb5c84d60db96c4b0249e7746f4` → `HEAD`

### Hallazgos cerrados

| # | Severidad | Corrección |
|---|---|---|
| H1 | CRITICAL | `accessColumnDf`/`writeColumnLiteral` reemplazados por `buildColumnReadExpression`/`buildColumnWriteTarget` (sin JSON.stringify) |
| H2 | HIGH | `buildPythonLiteral()` eliminada |
| H3 | HIGH | `buildColumnRegistryV2()` valida `pythonLiteral` canónico `_c["columnId"]` |
| H4 | HIGH | `resolveScriptColumn()` rechaza `context_invalid` |
| M1 | MEDIUM | `buildColumnRegistryV2()` detecta `DUPLICATE_COLUMN_ID` |
| M2 | MEDIUM | `ReadonlyMapView` + `Object.freeze` recursivo en ColumnRef y arrays |
| M3 | MEDIUM | Tests con `buildColumnRegistry()` real + pipeline integration |
| M4 | MEDIUM | Documentado D15 en DECISIONES.md |
| L2 | LOW | Renombrado a `isColumnStructurallyRenderable()` |
| L3 | LOW | `ScriptValidationResultV2` simplificado |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `types.ts` | `ColumnResolutionFailureReasonV2`, `unexpectedColumnIds`, `ColumnAccessSpecV2` con readExpression/writeTarget, `ScriptValidationResultV2` simplificado |
| `scriptColumnResolver.ts` | Reescritura: `ReadonlyMapView`, `buildColumnReadExpression`, `buildColumnWriteTarget`, validación canónica, `context_invalid` |
| `scriptBuildContext.ts` | `unexpectedColumnIds` en evidencia, listas ordenadas |
| `index.ts` | Exportaciones actualizadas |

### Tests (78)

| Archivo | Tests |
|---|---|
| `scriptColumnResolver.test.ts` | 36 tests (integración real con `buildColumnRegistry()`, validación, inmutabilidad) |
| `scriptBuildContext.test.ts` | 13 tests (`unexpectedColumnIds`, sorted lists) |
| `scriptContractV2.types.test.ts` | 21 tests (exprs, ColumnAccessSpecV2 fields) |
| `placeholderVocabulary.test.ts` | 8 tests (sin cambios) |

### Python syntax validation

`ast.parse` del script generado: **PASS** — expresiones label (`df_clean[_c["col:..."]`) y posicionales (`df_clean.iloc[:, _c["col:..."]["position"]]`) son sintácticamente válidas.

---

## Loop 1R.1: Hardening final del registro

**SHA:** `HEAD` (sobre Loop 1R)

### Hallazgos cerrados

| # | Severidad | Corrección |
|---|---|---|
| H-NEW-1 | HIGH | `createReadonlyMapView` basado en closure — sin propiedad `_map`, vista congelada |
| H-NEW-2 | HIGH | `forEach` entrega la vista readonly como tercer argumento |
| M-NEW-1 | MEDIUM | `resolveScriptColumn` fail-closed: `correspondenceEvidence` obligatorio |
| M-DUP | MEDIUM | Validación de metadata de duplicados: flags, ordinales, gaps, incoherencias |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `scriptColumnResolver.ts` | `createReadonlyMapView` (closure), fail-closed resolver, validación metadata duplicados |
| `scriptColumnResolver.test.ts` | 28 nuevos tests (encapsulación, metadata, fail-closed) |

### Tests (64 total, +28)

| Suite | Tests |
|---|---|
| Integración pipeline | 8 |
| buildColumnReadExpression | 4 |
| buildColumnWriteTarget | 2 |
| buildColumnAccessSpec | 2 |
| resolveScriptColumn edge | 5 → 9 (+4 fail-closed) |
| buildColumnRegistryV2 validation | 5 → 13 (+8 metadata) |
| Immutability | 7 |
| isColumnStructurallyRenderable | 2 |
| **Nuevos: Encapsulación** | **14** (Object.keys, forEach, injection, freeze) |
| **Nuevos: Metadata** | **9** (flags, ordinales, gaps) |
| **Nuevos: Fail-closed** | **4** (omit, undefined, null, valid=false) |

### Python validation

| Test | Resultado |
|---|---|
| `ast.parse` syntax | PASSED |
| `clean_dataset(df)` semantic | PASSED (DataFrame con Age, Name, Name) |

### ReadonlyMap evidence

- `Object.keys(view)` no contiene `_map`
- `Object.isFrozen(view)` → true
- `forEach` pasa la vista readonly (sin `set`/`delete`/`clear`)
- `entries()`, `values()`, `keys()` no exponen Map mutable
- ColumnRef y arrays congelados

---

## Loop 4: Validator

**SHA:** `<commit actual>`

### API

| Función | Descripción |
|---|---|
| `validateScriptCandidateV2(candidate, plan, ctx, opts?)` | Valida candidato (fail-closed, nunca lanza) |
| `verifyScriptContractV2(contract, plan, ctx, opts?)` | Verifica contrato final (hash + candidate) |

### Códigos

16 errores + 1 warning. Ver `scriptErrorCodes.ts`.

### Matriz V1-V35
Shape (V1-V7) → Referencias (V8-V15) → Cobertura → HITL (V16-V21) → Columnas (V22-V25) → Seguridad (V26-V31) → Sintaxis (V32-V34) → Reconstrucción (V35) → Hash (final).

### Seguridad
Enmascarador léxico: strings + comentarios. 0 falsos positivos en columnas `eval(`, `open(`, `os.system`.

### Archivos creados

| Archivo | Descripción |
|---|---|
| `scriptErrorCodes.ts` | 16 errores + 1 warning |
| `scriptValidatorV2.ts` | Validator fail-closed |
| `scriptValidatorV2.test.ts` | 42 tests |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.ts` | Exports |
| `DISENO_SCRIPT_CONTRACT_V2.md` | V24, V25, V26, V35 corregidos |

### Tests (42)

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

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1001 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |

---

## Loop 4R: Hardening del validator

**SHA:** `<commit actual>`

### Defectos cerrados (Loop 4R.1)

| # | Defecto | Corrección |
|---|---|---|
| R1 | pythonSyntax checker con resultado malformado | Validación estricta: null/undefined/array/string → not_run; state debe ser passed/failed/not_run; engine/message deben ser string o ausentes; sin propiedades extras |
| R2 | Política de imports no cerrada | Whitelist explícito: solo `import pandas as pd` y `import numpy as np`. Rechaza: import sin alias, alias igual al módulo, múltiples en una línea, from ... import |
| R3 | validationResult incrustado con forma libre | Validación profunda: keys exactas (valid, errors, warnings, pythonSyntax); errors/warnings: código no vacío, path string, message string, value unknown, sin extras |
| R4 | Falta de tests de seguridad directos | Tests directos por categoría: SCRIPT_EXECUTABLE_CONTENT, SCRIPT_NETWORK_ACCESS, SCRIPT_FILE_ACCESS, SCRIPT_DESTRUCTIVE_OPERATION |
| R5 | Sin prueba real de compile | Checker real con python3: compile(sys.stdin.read(), '<aura>', 'exec'); graceful not_run si Python no disponible |
| R6 | validateShape salía temprano tras scriptText inválido | Continúa validando otros campos de forma segura tras error en scriptText |
| R7 | position/duplicateOrdinal sin validación runtime | safeNonNegativeInteger + Number.isFinite para ambos campos |
| R8 | validatePartition sin intersecciones explícitas | accepted∩rejected, accepted∩excluded, rejected∩excluded → SCRIPT_PARTITION_INVALID |
| R9 | Enmascarador sin triple strings ni prefijos | Soporta ''', """, r, R, f, F, b, B, fr, rf, etc.; escapes en strings |
| R10 | compareColumnIdsStable() vacía y no usada | Eliminada |
| R11 | Warning ausente para checker válido not_run | Cuando checker devuelve { state: 'not_run' } válido → se añade SCRIPT_SYNTAX_NOT_RUN exactamente 1 vez; valid=true si no hay otros errores |
| R12 | Whitelist de imports permite formas no canónicas | Verificación línea a línea: indentación (no permitido), duplicados (no permitido), cada import en su propia línea, sin punto y coma, sin continuación con barra invertida |
| R13 | Propiedades adicionales en raíz de validationResult | Se exigen las 4 claves exactas en raíz; cualquier extra → SCRIPT_CONTRACT_INVALID con path $.validationResult.extraField |
| R14 | Razones de exclusión no validadas directamente | deriveExpectedReason(plan, registry) por cada acción; comparison contra excludedActionIds; SCRIPT_APPROVAL_INVALID con reason específico |

### API (sin cambios)

| Función | Descripción |
|---|---|
| `validateScriptCandidateV2(candidate, plan, ctx, opts?)` | Valida candidato (fail-closed) |
| `verifyScriptContractV2(contract, plan, ctx, opts?)` | Verifica contrato final (hash + candidate) |

### Shape tri-estado del syntax checker

| Resultado del checker | pythonSyntax.state | Error/Warning |
|---|---|---|
| `{ state: 'passed' }` | `passed` | ninguno |
| `{ state: 'failed', message: '...' }` | `failed` | SCRIPT_SYNTAX_INVALID |
| null, undefined, array, string, sin state, state desconocido, engine/message no string, propiedad extra | `not_run` | SCRIPT_SYNTAX_NOT_RUN |
| checker lanza | `not_run` | SCRIPT_SYNTAX_NOT_RUN (sin stack trace) |

### Política exacta de imports

```
PERMITIDO (cada uno, exactamente una vez, nivel superior, línea propia):
  import pandas as pd
  import numpy as np

RECHAZADO:
  import pandas
  import pandas as pandas
  import numpy
  import numpy as numpy
  import pandas as pd, numpy as np
  import pandas, numpy
  import pandas as pd; import numpy as np
  import pandas as pd \
    , numpy as np
  from os import system
  from os import *
  cualquier import indentado (dentro de clean_dataset body)
  import duplicado de pandas o numpy
```

El análisis se realiza sobre el texto enmascarado (strings y comentarios ya eliminados).

### Intersecciones de partición

| Verificación | Código |
|---|---|
| accepted ∩ rejected ≠ ∅ | SCRIPT_PARTITION_INVALID |
| accepted ∩ excluded ≠ ∅ | SCRIPT_PARTITION_INVALID |
| rejected ∩ excluded ≠ ∅ | SCRIPT_PARTITION_INVALID |

### security: tokens peligrosos enmascarados por string lexer

Tokens dentro de `_c` dict strings → no producen error:

- `eval(`, `exec(`, `__import__(`, `open(`, `io.open(`, `pathlib`, `__file__`, `subprocess`, `os.system`, `socket`, `requests`, `urllib`, `http.client`, `del`, `inplace=True`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `scriptValidatorV2.ts` | validateSyntax fail-closed, validateImportWhitelist, maskStringsAndComments triple strings, validatePartition intersecciones, validateEmbeddedValidationResult, safeNonNegativeInteger, safeFiniteNumber |
| `scriptValidatorV2.test.ts` | 115 tests (99 nuevas) |
| `loop_04_validator.md` | Actualizado con hardening |

### Tests (115 total, +27)

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

### Verificaciones

| Verificación | Resultado |
|---|---|
| Tests Loop 4R (scriptValidatorV2) | 115 passed |
| Suite completa | 1074 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Remediation plans built/valid | 3/3 |

---

## Loop 3R: Hardening del finalizer

**SHA:** `<commit actual>`

### Defectos cerrados

| # | Defecto | Corrección |
|---|---|---|
| F1 | pythonSyntax opcional/ausente | `validatePythonSyntax`: state debe ser `passed`, `not_run` o `failed` |
| F2 | Alias mutable de validationResult | `copyValidationResult` defensiva (errors, warnings, pythonSyntax) |
| F3 | generatedAt no canónico | `validateGeneratedAt`: `parsed.toISOString() === generatedAt` |
| F4 | Pérdida de actionId al fallar el renderer | `validateActionWithRenderer` individual, cause con actionId |
| F5 | Shape runtime sin defensa | `validatePlanShape`: plan, plan.plan, action objects, approvalStatus |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `scriptBuilderV2.ts` | `validatePlanShape`, `validateActionWithRenderer`, `validateGeneratedAt` canónico, `validatePythonSyntax`, `copyValidationResult` |
| `scriptBuilderV2.test.ts` | +31 tests |

### Tests (82 total, +31)

| Suite nueva | Tests |
|---|---|
| pythonSyntax strict | 10 |
| Defensive copy | 7 |
| generatedAt canonical | 7 |
| Renderer error attribution | 1 |
| Runtime shape | 6 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 959 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |

---

## Loop 3: Builder y Finalizer

**SHA:** `<commit actual>`

### API implementada

| Función | Descripción |
|---|---|
| `SCRIPT_CONTRACT_VERSION` | `'2.0.0'` |
| `CLEAN_DATASET_FN` | `'clean_dataset'` |
| `buildScriptCandidateCoreV2(plan, ctx)` | Core puro (sin reloj) |
| `buildScriptCandidateV2(plan, ctx, opts?)` | Core + `generatedAt` |
| `buildScriptHashPayloadV2(candidate)` | Payload del hash |
| `computeScriptHashV2(candidate)` | `sha256hex(canonicalJson(payload))` |
| `finalizeScriptContractV2(candidate, vr)` | Contrato final con hash |

### Reglas de partición

| Estado | Destino |
|---|---|
| `rejected` | `rejectedActionIds` |
| `pending` | `excludedActionIds` (reason: `'pending'`) |
| `approved` + `requires_human_review` | `excludedActionIds` (reason: `'unsupported_action'`) |
| `approved` + columna missing | `excludedActionIds` (reason: `'missing_column'`) |
| `approved` + columna ambigua | `excludedActionIds` (reason: `'ambiguous_column'`) |
| `approved` + renderizable | `acceptedActionIds` |

### Hash

```typescript
sha256hex(canonicalJson({
  remediationRef, datasetFingerprint, acceptedActionIds,
  columnRefs, rendererVersion, placeholderVocabularyVersion,
  scriptText, cleanDatasetFn,
}))
```

NO incluye: `generatedAt`, `validationResult`, `rejectedActionIds`, `excludedActionIds`.

### Archivos creados

| Archivo | Descripción |
|---|---|
| `scriptBuilderV2.ts` | Builder con 8 códigos de error |
| `scriptBuilderV2.test.ts` | 51 tests |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.ts` | Exports del builder |

### Tests (51)

| Suite | Tests |
|---|---|
| Versión y constantes | 2 |
| Candidate: cero/una/varias acciones | 4 |
| Partición | 7 |
| Columnas | 5 |
| Contexto | 4 |
| Integración renderer | 3 |
| Reconstrucción | 2 |
| Hash | 8 |
| generatedAt | 3 |
| Finalizer | 8 |
| Candidate shape | 4 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 928 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Hash: Node vs pure JS | idéntico |

---

## Loop 2R: Hardening del renderer

**SHA:** `<commit actual>`

### Defectos cerrados

| # | Defecto | Corrección |
|---|---|---|
| F1 | `ColumnRef.pythonLiteral` falsificado | `validateColumnRef` compara 8 campos (incl pythonLiteral, isReservedWord); retorna registryCol |
| F2 | `buildReadExpression` / `buildWriteTarget` duplicados | Eliminados; usa `buildColumnReadExpression` / `buildColumnWriteTarget` de scriptColumnResolver.ts |
| F3 | `action.columnId === null` para acciones por columna | `RENDER_COLUMN_REQUIRED` si `action.columnId === null` |
| F4 | `drop_exact_duplicates` con `columnRef !== null` | `RENDER_COLUMN_NOT_ALLOWED` |
| F5 | `requires_human_review` con referencias incoherentes | Reglas de consistencia action.columnId ↔ columnRef |
| F6 | Parámetros null/undefined/string/array | `validateParameters` pre-casting |
| F7 | `isReservedWord` no validado | Incluido en `columnsMatch` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `scriptRendererV2.ts` | Reescritura con validateColumnRef (8 campos), import de helpers oficiales, validateParameters |
| `scriptRendererV2.test.ts` | +26 tests (falsified pythonLiteral, isReservedWord, params, consistency) |

### Tests (97 total, +26)

| Suite nueva | Tests |
|---|---|
| Falsified pythonLiteral | 8 |
| Falsified isReservedWord | 5 |
| Null columnId for required-column actions | 2 |
| drop_exact_duplicates with non-null columnRef | 1 |
| requires_human_review consistency | 3 |
| Parameters validation | 5 |
| Script output sanitization | 3 |
| **Total nuevos** | **27** |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 877 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Python `ast.parse` | PASSED |

### Ataque rechazado (ejemplo)

```typescript
// pythonLiteral falsificado
const fakeCol = { ...registryCol, pythonLiteral: `__import__("os").system("malicious")` };
renderActionV2(action, fakeCol, registry);
// → ScriptRendererError: RENDER_COLUMN_MISMATCH
// El texto malicioso nunca aparece en scriptText
```

---

## Loop 2: Renderer determinista

**SHA:** `fe96be289684c821c53b6ecc6d77065af5196bca`

### API implementada

| Función | Descripción |
|---|---|
| `SCRIPT_RENDERER_VERSION` | `'2.0.0'` |
| `renderActionV2(action, columnRef, registry)` | Renderiza una acción a Python |
| `buildScriptHeader(registry)` | Imports + `_c` dict + `def clean_dataset(df):` |
| `buildScriptFooter()` | `return df_clean` |
| `buildScriptText(actions, registry)` | Script completo |

### actionType → plantilla

| actionType | Parámetros | Plantilla |
|---|---|---|
| `trim_whitespace` | `collapseInternalWhitespace: false` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].astype("string").str.strip()` |
| `trim_whitespace` | `collapseInternalWhitespace: true` | + `.str.replace(r"\\s+", " ", regex=True)` |
| `drop_exact_duplicates` | `keep: "first"`, `columnId: null` | `df_clean = df_clean.drop_duplicates(keep="first").copy()` |
| `normalize_placeholders` | `strategy: "controlled_vocabulary"`, `replacement: null` | `df_clean[_c["col:..."]] = df_clean[_c["col:..."]].replace([...17 placeholders...], np.nan)` |
| `normalize_casing` | `strategy: "title_case"` | `...str.title()` |
| `normalize_casing` | `strategy: "lowercase"` | `...str.lower()` |
| `convert_disguised_numbers` | `decimalSeparator: "auto"`, `errors: "coerce"` | `pd.to_numeric(...str.replace(",", ".", regex=False), errors="coerce")` |
| `requires_human_review` | cualquier `reasonCode` válido | `# AURA review-only: reasonCode=...; no transformation rendered` |

### Archivos creados

| Archivo | Descripción |
|---|---|
| `scriptRendererV2.ts` | Renderer con 8 códigos de error |
| `scriptRendererV2.test.ts` | 70 tests |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.ts` | Exports del renderer |

### Tests (70)

| Suite | Tests |
|---|---|
| Header y footer | 11 |
| trim_whitespace | 5 |
| drop_exact_duplicates | 5 |
| normalize_placeholders | 7 |
| normalize_casing | 4 |
| convert_disguised_numbers | 6 |
| requires_human_review | 7 |
| Seguridad: approvalStatus | 2 |
| Seguridad: referencias | 4 |
| Nombres especiales | 4 |
| Determinismo | 4 |
| Script completo | 3 |
| Códigos de error | 5 |
| Versión | 1 |
| **Total** | **70** |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 850 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Python `ast.parse` | PASSED |

### Limitaciones

1. No decide partición approved/rejected/pending
2. No construye `ScriptContractCandidateV2`
3. No calcula `scriptHash` contractual
4. No valida el contrato completo
5. No consulta al LLM
6. No añade timestamps, UUIDs o información del modelo
7. `requires_human_review` no genera transformación

---

## Loop 1: Base types, ScriptBuildContextV2, column resolver y vocabulario (histórico)

Ver `loop_01_schema_and_columns.md` y `REVISION_ADVERSARIAL_LOOP1.md` para el estado original (rechazado).

## Loop 5: UI — Integración del contrato v2 con la interfaz

**SHA:** `<commit actual>`

### API implementada

| Componente | Descripción |
|---|---|
| `ScriptGenerationStepV2` | Pipeline completo: build → validate → finalize → verify → UI |
| `ReviewStep` v2 branch | Fresh verification + approve sin simulation/HealthDelta |
| `ScriptReview` props | `readOnly`, `hideEditAction`, `approvalLabel` |

### PipelineData — campos v2

```typescript
scriptContractV2: ScriptContractV2 | null;
scriptContractVerificationV2: ScriptValidationResultV2 | null;
```

### Archivos creados

| Archivo | Descripción |
|---|---|
| `src/components/ScriptGenerationStepV2.tsx` | Componente de generación de contrato v2 |
| `src/__tests__/scriptGenerationStepV2.test.tsx` | 22 tests de integración UI |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/MainPipeline.tsx` | Routing v2, estado, invalidación |
| `src/components/ReviewStep.tsx` | Rama v2 con fresh verification |
| `src/components/ScriptReview.tsx` | Props readOnly, hideEditAction |
| `src/App.tsx` | INITIAL_PIPELINE_DATA, session restore |

### Tests (22 nuevos)

| Suite | Tests |
|---|---|
| Contract flow | 5 |
| Contract visual state | 6 |
| PipelineData v2 fields | 2 |
| ReviewStep v2 fresh verification | 5 |
| Routing | 2 |
| Imports | 2 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1096 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Remediation plans | 3/3 built, 3/3 valid |

---

## Loop 5R: Reparación de integración UI

**SHA base:** `04a33ae732003f80b0e0fe50a098c96a822d9fc4`

### Cambios

| Archivo | Descripción |
|---|---|
| `src/services/scriptContractUiContext.ts` | **CREADO** — `buildUiScriptContext()` + `buildScriptContractInputKey()` |
| `src/components/ScriptGenerationStepV2.tsx` | **REESCRITO** — Usa `buildUiScriptContext`, reutiliza `RemediationPlanStepV2` en Vista A |
| `src/components/RemediationPlanStepV2.tsx` | **MODIFICADO** — Props `continueLabel` y `onContinueWithPlan` |
| `src/components/ReviewStep.tsx` | **MODIFICADO** — Usa `buildUiScriptContext`, `TriangleAlert`, `ok === false` narrow |
| `src/components/MainPipeline.tsx` | **MODIFICADO** — `initialData` prop, `buildScriptContractInputKey`, limpieza de estado |
| `src/App.tsx` | **MODIFICADO** — Pasa `initialData={pipelineData}` |
| `src/__tests__/scriptGenerationStepV2.test.tsx` | **REESCRITO** — 29 tests (Loop 5R completo) |

### Tests (29 nuevos, 1103 total)

| Suite | Tests |
|---|---|
| `buildUiScriptContext` | 7 |
| `buildScriptContractInputKey` | 6 |
| Contract pipeline (real) | 3 |
| ScriptGenerationStepV2 component | 6 |
| RemediationPlanStepV2 props | 3 |
| ScriptReview v2 props | 2 |

### Verificaciones

| Verificación | Resultado |
|---|---|
| Suite completa | 1103 passed, 6 skipped (51 files) |
| Typecheck | clean (pre-existing errors only) |
| Build | built in ~3s |
| Contracts v2 | 3/3 PASS |
| Remediation plans valid | 3/3 |

---

## Loops pendientes

- Loop 6: E2E + capturas
