# Evidencia — Phase 4

## Loop 1R — Remediación de revisión adversarial

### Comandos de reproducción

```bash
cd src && npm test -- scriptContractV2.types scriptBuildContext scriptColumnResolver placeholderVocabulary
# 78 passed

cd src && npm test
# 752 passed, 6 skipped

cd src && npm run build
# built in 4.74s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS

# Python syntax validation
python3 -c "import ast; ast.parse(script)" # PASS
```

### Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 1R | 78 passed |
| Suite completa | 752 passed, 6 skipped |
| Build | built in 4.74s |
| Contracts v2 validate-local | 3/3 PASS |
| Python `ast.parse` | PASS |

### Expresiones exactas (antes/después)

| Escenario | Antes | Después |
|---|---|---|
| Columna única (Age) | `df_clean["_c[\"col:...\"]"]` INVALID | `df_clean[_c["col:..."]]` VALID |
| Duplicada (Score, ord 0) | N/A | `df_clean.iloc[:, _c["col:..."]["position"]]` |
| Duplicada (Score, ord 1) | N/A | `df_clean.iloc[:, _c["col:..."]["position"]]` |

### Inmutabilidad verificada

| Prueba | Método | Resultado |
|---|---|---|
| Map.set no expuesto | `'set' in (reg.byColumnId as any)` | `false` |
| Map.delete no expuesto | `'delete' in (reg.byColumnId as any)` | `false` |
| byName inner array push | `reg.byName.get('A')!.push(x)` | TypeError |
| ColumnRef mutation | `col.name = 'MUTATED'` | TypeError |
| orderedColumns push | `(reg.orderedColumns as any).push(x)` | TypeError |
| ColumnRef frozen | `Object.isFrozen(col)` | `true` |

### Confirmaciones

- REVISION_ADVERSARIAL_LOOP1.md no cambió
- Phase 3 no cambió (archivos congelados intactos)
- Ninguna columna se resolvió por nombre
- El `pythonLiteral` canónico `_c["columnId"]` es la única representación aceptada
- `buildColumnRegistry.ts` no fue modificado

---

## Loop 1R.1 — Hardening final del registro

### Comandos de reproducción

```bash
cd src && npm test -- scriptContractV2.types scriptBuildContext scriptColumnResolver placeholderVocabulary
# 98 passed (64 resolver + 13 buildContext + 21 types)

cd src && npm test
# 780 passed, 6 skipped

cd src && npm run build
# built in 3.15s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS
```

### Python validation

| Test | Resultado |
|---|---|
| `ast.parse` syntax | PASSED |
| `clean_dataset(df)` semantic | PASSED (DataFrame: Age, Name, Name) |

### ReadonlyMap evidence

| Prueba | Check | Resultado |
|---|---|---|
| `Object.keys(view)` no contiene `_map` | `keys.includes('_map')` | `false` |
| `Object.isFrozen(view)` | isFrozen | `true` |
| `forEach` callback `map` is view | `map === view` | `true` |
| `forEach` callback `map.set` is undefined | `typeof map.set` | `undefined` |
| `forEach` callback no puede `map.set()` | mutation attempt | `false` (no mutó) |
| `forEach` callback no puede `map.delete()` | mutation attempt | `false` (no mutó) |
| Injection impossible | `view.inject()`, `_map.set()` | no paths |
| `entries()`, `values()`, `keys()` no Map | each value | no Map instance |
| ColumnRef frozen | `Object.isFrozen(col)` | `true` |
| Arrays frozen | `Object.isFrozen(arr)` | `true` |

### Duplicate metadata evidence

| Caso | Input | Resultado |
|---|---|---|
| same name, isDuplicate=false ×2 | `[{name:'A',dup:false},{name:'A',dup:false}]` | INCONSISTENT_DUPLICATE_FLAG |
| unique, isDuplicate=true | `[{name:'A',dup:true}]` | INCONSISTENT_DUPLICATE_FLAG |
| unique, duplicateOrdinal=1 | `[{name:'A',dupOrd:1}]` | INCONSISTENT_DUPLICATE_ORDINAL |
| ordinals 0,2 (gap) | `[{dupOrd:0},{dupOrd:2}]` | INCONSISTENT_DUPLICATE_ORDINAL |
| both ordinals 0 | `[{dupOrd:0},{dupOrd:0}]` | INCONSISTENT_DUPLICATE_ORDINAL |
| mixed flags | `[{dup:true},{dup:false}]` | INCONSISTENT_DUPLICATE_FLAG |
| 3x ordinals 2,0,1 | desordenados | INCONSISTENT_DUPLICATE_ORDINAL |
| valid buildColumnRegistry | Score×2, X×3, interleaved A,B,A | Aceptado |

### Fail-closed evidence

| Caso | Resultado |
|---|---|
| `correspondenceEvidence` omitted | context_invalid |
| `correspondenceEvidence` undefined | context_invalid |
| `correspondenceEvidence` null | context_invalid |
| `valid=false` | context_invalid |
| `valid=true` (via buildScriptContext) | ok: true |

### Confirmaciones

- REVISION_ADVERSARIAL_LOOP1.md no cambió
- REAUDITORIA_LOOP1R.md no cambió
- Phase 3 no cambió
- `columnRegistry.ts` no fue modificado
- `placeholderVocabulary.ts` no fue modificado
- Ninguna columna se resolvió por nombre

---

## Loop 2R — Hardening del renderer

### Comandos de reproducción

```bash
cd src && npm test -- scriptRendererV2
# 97 passed (71 existentes + 26 nuevos)

cd src && npm test
# 877 passed, 6 skipped

cd src && npm run build
# built in ~3s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS
```

### Falsificación de pythonLiteral evidence

| Ataque | Resultado |
|---|---|
| `__import__("os").system("malicious")` in pythonLiteral | RENDER_COLUMN_MISMATCH |
| `eval(__import__...)` in pythonLiteral | RENDER_COLUMN_MISMATCH |
| `exec(...)` in pythonLiteral | RENDER_COLUMN_MISMATCH |
| newline injection in pythonLiteral | RENDER_COLUMN_MISMATCH |
| comment injection in pythonLiteral | RENDER_COLUMN_MISMATCH |
| pythonLiteral from another existing column | RENDER_COLUMN_MISMATCH |

### Falsificación de metadata

| Campo alterado | Resultado |
|---|---|
| `isReservedWord` | RENDER_COLUMN_MISMATCH |
| `position` | RENDER_COLUMN_MISMATCH |
| `duplicateOrdinal` | RENDER_COLUMN_MISMATCH |
| `isDuplicate` | RENDER_COLUMN_MISMATCH |
| `name` | RENDER_COLUMN_MISMATCH |

### Parameters validation

| Entrada | Resultado |
|---|---|
| `null` | RENDER_PARAMETERS_INVALID |
| `undefined` | RENDER_PARAMETERS_INVALID |
| `"string"` | RENDER_PARAMETERS_INVALID |
| `["array"]` | RENDER_PARAMETERS_INVALID |
| `{}` (empty) | RENDER_PARAMETERS_INVALID |

### Script output sanitization

| Check | Resultado |
|---|---|
| scriptText never contains `__import__` | ✓ |
| scriptText never contains `eval(` | ✓ |
| scriptText never contains `exec(` | ✓ |

### Confirmaciones

- REVISION_ADVERSARIAL_LOOP1.md no cambió
- REAUDITORIA_LOOP1R.md no cambió
- Phase 3 no cambió
- `columnRegistry.ts` no fue modificado
- `placeholderVocabulary.ts` no fue modificado
- `scriptColumnResolver.ts` no fue modificado
- No se calculó scriptHash contractual
- No se ejecutaron transformaciones

---

## Loop 2 — Renderer determinista

### Comandos de reproducción

```bash
cd src && npm test -- scriptRendererV2
# 97 passed

cd src && npm test
# 850 passed, 6 skipped

cd src && npm run build
# built in ~3s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS

# Python syntax validation
python3 -c "import ast; ast.parse(script_text)" # PASSED
```

### Resultados

| Verificación | Resultado |
|---|---|
| Tests Loop 2 | 70 passed |
| Suite completa | 850 passed, 6 skipped |
| Build | built in ~3s |
| Contracts v2 validate-local | 3/3 PASS |
| Python `ast.parse` | PASS |

### Plantillas evidence

| actionType | Check | Resultado |
|---|---|---|
| `trim_whitespace` collapse=false | `.str.strip()` | presente |
| `trim_whitespace` collapse=true | `.str.replace(r"\\s+"` | presente |
| `drop_exact_duplicates` | `keep="first"` | presente |
| `normalize_placeholders` | 17 placeholders vía `.length` | presente |
| `normalize_placeholders` | `np.nan` | presente |
| `normalize_casing` title | `.str.title()` | presente |
| `normalize_casing` lower | `.str.lower()` | presente |
| `convert_disguised_numbers` | `errors="coerce"` | presente |
| `convert_disguised_numbers` | `str.replace(",", ".", regex=False)` | presente |
| `requires_human_review` | `# AURA review-only:` | presente |
| `requires_human_review` | reasonCode en comentario | presente |
| requires_human_review | sin `df_clean` en comentario | ✓ |
| requires_human_review | sin `=` en comentario | ✓ |

### Seguridad evidence

| Prueba | Resultado |
|---|---|
| pending action rechazada | ScriptRendererError |
| rejected action rechazada | ScriptRendererError |
| columna ambigua rechazada | RENDER_COLUMN_AMBIGUOUS |
| columnId mismatch | RENDER_COLUMN_MISMATCH |
| columna no en registry | RENDER_COLUMN_NOT_IN_REGISTRY |
| columnRef externo | RENDER_COLUMN_NOT_IN_REGISTRY |
| ninguna resolución por nombre | `byName` no usado |
| reserved word | `pythonLiteral` canónico usado |

### Determinismo evidence

| Prueba | Resultado |
|---|---|
| 3 renders idénticos | texto idéntico |
| sin generatedAt | confirmado |
| sin timestamp | confirmado |
| sin UUID | confirmado |
| orden preservado | acción[0] antes que acción[1] |

### Confirmaciones

- REVISION_ADVERSARIAL_LOOP1.md no cambió
- REAUDITORIA_LOOP1R.md no cambió
- Phase 3 no cambió
- `columnRegistry.ts` no fue modificado
- `placeholderVocabulary.ts` no fue modificado
- `scriptColumnResolver.ts` no fue modificado
- Ninguna columna se resolvió por nombre
- No se calculó scriptHash contractual
- No se ejecutaron transformaciones

---

## Loop 1 — Histórico

Ver `EVIDENCIA.md` original en el commit `53df16a`.
