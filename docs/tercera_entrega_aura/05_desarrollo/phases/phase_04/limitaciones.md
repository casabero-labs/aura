# Limitaciones — Phase 4

## Loop 3R — Hardening del finalizer

### Limitaciones

1. **Sin validator:** No se implementó `scriptValidatorV2`. No hay validación de candidato.
2. **Sin UI:** No se implementó `ScriptGenerationStepV2`. No hay conexión con componentes React.
3. **Sin E2E:** No se implementó harness ni capturas Phase 4.
4. **Sin ejecución Python:** No se ejecuta limpieza en runtime.
5. **`byName` no es fallback:** El `ColumnRegistryV2` incluye `byName` para diagnóstico, pero no se usa.
6. **`resolveScriptColumn` no distingue causa de `context_invalid`.**
7. **Vocabulario incluye `-`, `--`, `...`:** D15.
8. **Registry usa `throw` en lugar de `RegistryBuildResult`.**
9. **`isColumnStructurallyRenderable` solo verifica ambigüedad.**
10. **`requires_human_review` no genera transformación.**
11. **El builder no valida sintaxis Python.** (Loop 4)
12. **El finalizer requiere validationResult externo.** (Loop 4)

### Curados en Loop 3R

- pythonSyntax fail-closed (debe existir, ser objeto, state exacto)
- Copia defensiva de validationResult (sin alias compartidos)
- generatedAt canónico ISO UTC (`toISOString()` roundtrip)
- Renderer error con actionId en cause
- Shape runtime con defensas para plan, plan.plan, approvalStatus

### Claims NO permitidos aún

- NO afirmar script validado (falta validator — Loop 4)
- NO afirmar ejecución real (falta Phase 5)
- NO afirmar benchmark comparativo (falta E2E)
- NO afirmar que los valores del vocabulario son universalmente nulos (D15)
