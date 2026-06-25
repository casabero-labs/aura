# Evidencia — Phase 4

## Loop 1 — Base types, ScriptBuildContextV2, column resolver, vocabulary

### Comandos de reproducción

```bash
# Tests específicos
cd src && npm test -- scriptContractV2.types scriptBuildContext scriptColumnResolver placeholderVocabulary

# Suite completa
cd src && npm test

# Build
cd src && npm run build

# Contracts v2 validación local
cd src && npm run contracts:v2:validate-local
```

### Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 1 | 59 passed |
| Suite completa | 733 passed, 6 skipped |
| Build | ✓ built in 4.19s |
| Contracts v2 validate-local | 3/3 PASS (Phase 3 remediation) |

### SHA

```
Base: c048a7e601088cb7f433085748f489f01b81b91d
Loop 1: HEAD (sha completo al hacer commit)
```

### Tabla de resolución de columnas

| columnId | name | isDuplicate | isAmbiguous | isReservedWord | accessMode | pythonLiteral |
|---|---|---|---|---|---|---|
| `col:A` | A | false | false | false | label | A |
| `col:Name_0` | Name | true | false | false | position | Name_0 |
| `col:Name_1` | Name | true | false | false | position | Name_1 |
| `col:class` | class | false | false | true | label | `df['class']` |
| `col:ambiguous` | col | true | true | false | N/A | N/A |

### Vocabulario final

- **PLACEHOLDER_VOCABULARY_V2.length:** 17
- **Versión:** 1.0.0
- **Valores:** `''`, `'n/a'`, `'N/A'`, `'na'`, `'NA'`, `'null'`, `'NULL'`, `'none'`, `'None'`, `'?'`, `'-'`, `'--'`, `'...'`, `'NaN'`, `'NAN'`, `'nan'`, `'N/a'`

### Confirmaciones

- Phase 3 NO cambió (archivos congelados intactos)
- Ninguna columna se resolvió por nombre
- `RemediationContextColumnV2.pythonLiteral` NO se comparó (tipo no existe)
- `correspondenceEvidence` verifica fingerprint, count, existence, name, position, ordinal, flags

### Archivos modificados (git diff --name-only)

```
src/contracts/llm/index.ts
src/contracts/llm/types.ts
```

### Archivos creados

```
src/contracts/llm/placeholderVocabulary.ts
src/contracts/llm/scriptColumnResolver.ts
src/contracts/llm/scriptBuildContext.ts
src/__tests__/placeholderVocabulary.test.ts
src/__tests__/scriptColumnResolver.test.ts
src/__tests__/scriptBuildContext.test.ts
src/__tests__/scriptContractV2.types.test.ts
```