# Limitaciones — Phase 4

## Loop 2R — Hardening del renderer

### Limitaciones

1. **Sin builder:** No se implementó `scriptBuilderV2`. No hay construcción de `ScriptContractCandidateV2`.
2. **Sin validator:** No se implementó `scriptValidatorV2`. No hay validación de candidato.
3. **Sin finalizer:** No se implementó `finalizeScriptContractV2`. No hay producción de `ScriptContractV2` final.
4. **Sin UI:** No se implementó `ScriptGenerationStepV2`. No hay conexión con componentes React.
5. **Sin E2E:** No se implementó harness ni capturas Phase 4.
6. **Sin ejecución Python:** No se ejecuta sintaxis Python en runtime. `ast.parse` confirma sintaxis válida pero no ejecución.
7. **`byName` no es fallback:** El `ColumnRegistryV2` incluye `byName` para diagnóstico, pero no se usa para resolución.
8. **`resolveScriptColumn` no distingue causa de `context_invalid`:** Un contexto inválido retorna `context_invalid` sin diferenciar si es por fingerprint o column mismatch.
9. **Vocabulario incluye `-`, `--`, `...`:** Riesgo de falsos positivos documentado en D15.
10. **Registry usa `throw` en lugar de `RegistryBuildResult`:** Errores de validación lanzan Error en lugar de retornar resultado tipado.
11. **`isColumnStructurallyRenderable` solo verifica ambigüedad:** No verifica actionType ni semanticType.
12. **Renderer no calcula `scriptHash`:** Eso pertenece a Loop 3.
13. **`requires_human_review` no genera transformación:** Loop 3 excluirá esta acción de `acceptedActionIds`.
14. **El renderer no decide la partición:** Recibe acciones ya seleccionadas, solo las renderiza.

### Curados en Loop 2R

- ColumnRef no confiable: `validateColumnRef` compara 8 campos contra registry
- pythonLiteral falsificado: rechazado con RENDER_COLUMN_MISMATCH
- Helpers oficiales: importa de scriptColumnResolver.ts
- Parámetros malformados: validación pre-casting
- `action.columnId === null` para acciones por columna: RENDER_COLUMN_REQUIRED
- `drop_exact_duplicates` con columnRef no nulo: RENDER_COLUMN_NOT_ALLOWED
- `requires_human_review` con referencias incoherentes: reglas de consistencia

### Claims NO permitidos aún

- NO afirmar script determinista generado (falta builder — Loop 3)
- NO afirmar validación completa (falta validator — Loop 4)
- NO afirmar ejecución real (falta Phase 5)
- NO afirmar benchmark comparativo (falta E2E)
- NO afirmar que los valores del vocabulario son universalmente nulos (D15)
