# Implementación — Phase 4

## Loop 1: Base types, ScriptBuildContextV2, column resolver y vocabulario

**SHA:** `c048a7e601088cb7f433085748f489f01b81b91d` → `HEAD`

### Tipos implementados

| Tipo | Archivo | Descripción |
|---|---|---|
| `ScriptExclusionReasonV2` | `types.ts` | `'pending' \| 'ambiguous_column' \| 'missing_column' \| 'unsupported_action'` |
| `ScriptExcludedActionV2` | `types.ts` | `{ actionId, reason }` |
| `ColumnRegistryV2` | `types.ts` | `orderedColumns`, `byColumnId`, `byName` |
| `CorrespondenceEvidenceV2` | `types.ts` | fingerprint, columnsMatch, missingColumnIds, mismatchedColumns, valid |
| `ScriptBuildContextV2` | `types.ts` | remediationContext, sourceDatasetFingerprint, columnRegistry, correspondenceEvidence |
| `ColumnAccessSpecV2` | `types.ts` | columnId, pythonLiteral, accessMode, position, duplicateOrdinal |
| `PythonSyntaxState` | `types.ts` | `'passed' \| 'failed' \| 'not_run'` |
| `ScriptValidationResultV2` | `types.ts` | Extiende ValidationResultV2 con pythonSyntax.state/engine/message |
| `ScriptContractCandidateV2` | `types.ts` | Sin scriptHash ni validationResult |
| `ScriptContractV2` | `types.ts` | Actualizado con excludedActionIds, placeholderVocabularyVersion, full ColumnRef[] |

### Archivos creados

| Archivo | Propósito |
|---|---|
| `placeholderVocabulary.ts` | `PLACEHOLDER_VOCABULARY_V2` (17 placeholders, frozen, v1.0.0) |
| `scriptColumnResolver.ts` | `resolveScriptColumn`, `buildColumnAccessSpec`, `accessColumnDf`, `buildPythonLiteral`, `buildColumnRegistryV2` |
| `scriptBuildContext.ts` | `buildScriptContext(remediationContext, columnRefs, sourceDatasetFingerprint)` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `types.ts` | Añadidos tipos Phase 4 |
| `index.ts` | Exportaciones de nuevos módulos y tipos |

### Tests (59 nuevos)

| Archivo | Tests |
|---|---|
| `placeholderVocabulary.test.ts` | 8 tests |
| `scriptColumnResolver.test.ts` | 22 tests |
| `scriptBuildContext.test.ts` | 11 tests |
| `scriptContractV2.types.test.ts` | 18 tests |

### Casos de resolución de columnas

| Caso | columnId | Resultado | accessMode |
|---|---|---|---|
| Columna única | `col:A` | `ok: true, columnRef` | `label` |
| Reservada | `col:class` | `ok: true, columnRef` | `label` |
| Ambigua | `col:ambiguous` (isAmbiguous=true) | `ok: false, ambiguous_column` | N/A |
| Inexistente | `col:nonexistent` | `ok: false, missing_column` | N/A |
| Null | `null` | `ok: false, missing_column` | N/A |
| Duplicada ordinal 0 | `col:Name_0` | `ok: true, columnRef` | `position` |
| Duplicada ordinal 1 | `col:Name_1` | `ok: true, columnRef` | `position` |

### Vocabulario de placeholders

- **Longitud calculada:** 17 placeholders
- **Versión:** 1.0.0
- **Frozen:** Sí (`Object.freeze`)
- **Sin duplicados exactos:** Sí
- **Sin valores LLM:** Sí

### Limitaciones

- No implementa `scriptRendererV2`
- No implementa `scriptBuilderV2`
- No implementa `scriptValidatorV2`
- No implementa `finalizeScriptContractV2`
- No genera expresiones Python finales
- No conecta con UI

---

## Loops pendientes

- Loop 2: Renderer determinista
- Loop 3: Builder + Finalizer
- Loop 4: Validator
- Loop 5: UI
- Loop 6: E2E + capturas
