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

## Loop 1: Base types, ScriptBuildContextV2, column resolver y vocabulario (histórico)

Ver `loop_01_schema_and_columns.md` y `REVISION_ADVERSARIAL_LOOP1.md` para el estado original (rechazado).

## Loops pendientes

- Loop 2: Renderer determinista
- Loop 3: Builder + Finalizer
- Loop 4: Validator
- Loop 5: UI
- Loop 6: E2E + capturas
