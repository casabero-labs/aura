# Limitaciones — Phase 4

## Loop 1 — Tipos base, ScriptBuildContextV2, column resolver, vocabulary

### Limitaciones

1. **Sin renderer:** No se implementó `scriptRendererV2`. No se generan expresiones Python finales.
2. **Sin builder:** No se implementó `scriptBuilderV2`. No hay construcción de `ScriptContractCandidateV2`.
3. **Sin validator:** No se implementó `scriptValidatorV2`. No hay validación de candidato.
4. **Sin finalizer:** No se implementó `finalizeScriptContractV2`. No hay producción de `ScriptContractV2` final.
5. **Sin UI:** No se implementó `ScriptGenerationStepV2`. No hay conexión con componentes React.
6. **Sin E2E:** No se implementó harness ni capturas Phase 4.
7. **Sin ejecución Python:** No se ejecuta sintaxis Python. `PythonSyntaxState` está definido pero no se usa.
8. **`byName` no es fallback:** El `ColumnRegistryV2` incluye `byName` para diagnóstico, pero no se usa para resolución. Toda resolución ejecutable usa `byColumnId`.

### Claims NO permitidos aún

- NO afirmar script determinista generado (falta builder)
- NO afirmar validación completa (falta validator)
- NO afirmar ejecución real (falta Phase 5)
- NO afirmar benchmark comparativo (falta E2E)