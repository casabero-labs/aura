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

## Loop 1 — Histórico

Ver `EVIDENCIA.md` original en el commit `53df16a`.
