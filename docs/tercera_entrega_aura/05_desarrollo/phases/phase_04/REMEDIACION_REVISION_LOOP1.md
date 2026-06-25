# Remediación — Revisión Adversarial Loop 1

> **Commit:** `HEAD` · **Revisión corregida:** `9a8f5e0330f1dbb5c84d60db96c4b0249e7746f4`

---

## Matriz hallazgo → corrección → test

| # | Hallazgo | Corrección | Test |
|---|---|---|---|
| H1 CRITICAL | `accessColumnDf()` producía `df_clean["_c[\"col:...\"]"]` | Reemplazado por `buildColumnReadExpression()` y `buildColumnWriteTarget()` sin `JSON.stringify` | `scriptColumnResolver.test.ts` — `buildColumnReadExpression` / `buildColumnWriteTarget` suites |
| H2 HIGH | `buildPythonLiteral()` código muerto | Eliminada función, sus exports y sus tests | Eliminado del resolver y del index |
| H3 HIGH | `buildColumnRegistryV2()` no validaba `pythonLiteral` | Validación canónica: rechaza si `pythonLiteral !== _c[JSON.stringify(columnId)]` | `rejects non-canonical pythonLiteral (H3)` |
| H4 HIGH | `resolveScriptColumn()` ignoraba `correspondenceEvidence.valid` | Añadido `context_invalid` como razón de fallo con chequeo de `evidence.valid` | `returns context_invalid when evidence.valid is false (H4)` |
| M1 MEDIUM | Sobrescritura silenciosa de `columnId` duplicado | Validación con error `DUPLICATE_COLUMN_ID` al detectar duplicado | `rejects duplicate columnId (M1)` |
| M2 MEDIUM | `byName` inner arrays y `ColumnRef` objects mutables | `ReadonlyMapView` + `Object.freeze` recursivo en ColumnRef y arrays | `Registry immutability (M2)` — 7 tests |
| M3 MEDIUM | Tests con fixtures manuales | Tests usan `buildColumnRegistry()` → `buildColumnRegistryV2()` pipeline | `Integration pipeline (M3)` — 8 tests |
| M4 MEDIUM | Vocabulario con `-` y `...` | Documentado como D15 en DECISIONES.md | N/A (decisión de política) |
| L2 LOW | `isColumnRenderizable()` nombre ambiguo | Renombrado a `isColumnStructurallyRenderable()` | `isColumnStructurallyRenderable` suite |
| L3 LOW | `ScriptValidationResultV2` redeclaraba campos | Simplificado a `extends ValidationResultV2` | `ScriptValidationResultV2` tes|

## Expresiones antes/después

### Columna única (Age)

```
BEFORE: df_clean["_c[\"col:b919e75bd6fba9f7\"]"]  ← INVALID
AFTER:  df_clean[_c["col:b919e75bd6fba9f7"]]        ← VALID
```

### Columna duplicada (Score, ordinal 0)

```
BEFORE: N/A (función no implementada)
AFTER:  df_clean.iloc[:, _c["col:6801346ad7422448"]["position"]]
```

### Columna duplicada (Score, ordinal 1)

```
BEFORE: N/A
AFTER:  df_clean.iloc[:, _c["col:8d47509054a57ad1"]["position"]]
```

## Pipeline real con buildColumnRegistry()

```
buildColumnRegistry(['Age', 'Score', 'Score'])
  → ColumnRef[] con pythonLiteral = _c["columnId"]
  → buildColumnRegistryV2(cols)
  → validate: columnId único, position única, pythonLiteral canónica
  → ReadonlyMapView + frozen ColumnRef + frozen byName arrays
  → resolveScriptColumn(columnId, context)
  → context_invalid si correspondenceEvidence.valid === false
  → buildColumnReadExpression(col) → df_clean[_c["..."]]
  → buildColumnWriteTarget(col) → df_clean[_c["..."]]
  → buildColumnAccessSpec(col) → { readExpression, writeTarget, accessMode, ... }
```

## Pruebas de inmutabilidad

| Prueba | Resultado |
|---|---|
| `(reg.byColumnId as any).set` no existe | ✓ `in` operator returns false |
| `(reg.byColumnId as any).delete` no existe | ✓ `in` operator returns false |
| `(reg.byName as any).set` no existe | ✓ `in` operator returns false |
| `reg.byName.get('A')!.push(x)` lanza | ✓ TypeError: object not extensible |
| `reg.byColumnId.get('col:A')!.name = 'x'` lanza | ✓ TypeError: cannot assign to read-only property |
| `reg.orderedColumns.push(x)` lanza | ✓ TypeError: object not extensible |
| `Object.isFrozen(byColumnId.get() returns true | ✓ |

## Resultados de tests

| Archivo | Tests |
|---|---|
| `placeholderVocabulary.test.ts` | 8 |
| `scriptContractV2.types.test.ts` | 21 |
| `scriptColumnResolver.test.ts` | 36 |
| `scriptBuildContext.test.ts` | 13 |
| **Total nuevos** | **78** |

## Resultados completos

| Verificación | Resultado |
|---|---|
| Tests Loop 1R | 78 passed |
| Suite completa | 752 passed, 6 skipped |
| Build | ✓ built in 4.74s |
| Contracts v2 validate-local | 3/3 PASS |
| Python `ast.parse` | PASS — valid Python syntax |

## Limitaciones restantes

- `resolveScriptColumn` no distingue entre `context_invalid` por fingerprint vs por column mismatch
- `buildColumnRegistryV2` lanza Error en lugar de una estructura tipada de error (RegistryBuildResult)
- El vocabulario incluye `-`, `--` y `...` — pendiente de D15
- No se compara `registryColumnIds` con `contextColumnIds` para verificar columnas extras explícitamente en el resolver
- `isColumnStructurallyRenderable` solo verifica ambigüedad, no actionType ni semanticType

---

## SHA

```
Anterior: 9a8f5e0330f1dbb5c84d60db96c4b0249e7746f4
Loop 1R: commit actual (SHA al hacer commit)
```
