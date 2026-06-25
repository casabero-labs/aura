# Loop 1R — Schema y Columns (Remediación)

## SHA

```
Anterior: 9a8f5e0330f1dbb5c84d60db96c4b0249e7746f4
Loop 1R: HEAD (sha completo al hacer commit)
```

## Tabla de resolución de columnas (con buildColumnRegistry real)

| columnId | name | isDuplicate | isAmbiguous | isReservedWord | Resultado | accessMode |
|---|---|---|---|---|---|---|
| `col:...` (Age) | Age | false | false | false | ok: true | label |
| `col:...` (class) | class | false | false | true | ok: true | label |
| `col:...` (Score_0) | Score | true | false | false | ok: true | position |
| `col:...` (Score_1) | Score | true | false | false | ok: true | position |
| `col:...` (col) | col | false | true | false | ok: false, ambiguous_column | N/A |
| `col:...` (Customer Name) | Customer Name | false | false | false | ok: true | label |
| `col:nonexistent` | - | - | - | - | ok: false, missing_column | N/A |
| `null` | - | - | - | - | ok: false, missing_column | N/A |
| Evidencia inválida | - | - | - | - | ok: false, context_invalid | N/A |

Nota: `Name` es ambiguo en `buildColumnRegistry` (patrón `name` en AMBIGUOUS_PATTERNS). Se usó `Passenger` y `Score` en su lugar.

## Expresiones correctas

### Columna única

```
pythonLiteral: _c["col:b919e75bd6fba9f7"]
readExpression: df_clean[_c["col:b919e75bd6fba9f7"]]
writeTarget:    df_clean[_c["col:b919e75bd6fba9f7"]]
accessMode:     label
```

### Columna duplicada

```
pythonLiteral: _c["col:6801346ad7422448"]
readExpression: df_clean.iloc[:, _c["col:6801346ad7422448"]["position"]]
writeTarget:    df_clean.iloc[:, _c["col:6801346ad7422448"]["position"]]
accessMode:     position
```

## Vocabulario final

Sin cambios respecto a Loop 1: 17 placeholders, version 1.0.0, frozen.

## Tests

| Archivo | Tests |
|---|---|
| `placeholderVocabulary.test.ts` | 8 |
| `scriptContractV2.types.test.ts` | 21 |
| `scriptColumnResolver.test.ts` | 36 |
| `scriptBuildContext.test.ts` | 13 |
| **Total** | **78** |

## Pipeline validado

```
buildColumnRegistry(columnNames)
  → ColumnRef[] con pythonLiteral canónico _c["columnId"]
  → buildColumnRegistryV2(cols) validate + freeze
  → buildScriptContext(ctx, cols, fingerprint)
  → resolveScriptColumn(columnId, context) [fail-closed]
  → buildColumnAccessSpec(col) { readExpression, writeTarget }
  → buildColumnReadExpression(col) / buildColumnWriteTarget(col)
```

## Confirmaciones

1. **pythonLiteral canónico:** Solo `_c["columnId"]`. No se aceptan formatos alternativos.
2. **Ninguna expresión usa JSON.stringify sobre pythonLiteral.**
3. **Ningún nombre crudo se usa como fallback.**
4. **ColumnRef y arrays son runtime-immutables.**
5. **Phase 3 no cambió.**
6. **`buildColumnRegistry.ts` no fue modificado.**
7. **Python ast.parse PASS.**
