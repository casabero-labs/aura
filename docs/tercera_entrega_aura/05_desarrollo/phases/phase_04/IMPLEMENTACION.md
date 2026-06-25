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

## Loop 1: Base types, ScriptBuildContextV2, column resolver y vocabulario (histórico)

Ver `loop_01_schema_and_columns.md` y `REVISION_ADVERSARIAL_LOOP1.md` para el estado original (rechazado).

## Loops pendientes

- Loop 2: Renderer determinista
- Loop 3: Builder + Finalizer
- Loop 4: Validator
- Loop 5: UI
- Loop 6: E2E + capturas
