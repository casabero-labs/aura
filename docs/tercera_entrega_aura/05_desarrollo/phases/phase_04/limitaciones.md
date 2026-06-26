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

---

## Loop 5 — UI: Integración del contrato v2

### Limitaciones

1. **Sin E2E:** No se implementó harness E2E (falta Loop 6)
2. **Sin ejecución Python:** El contrato se genera pero no se ejecuta en la UI (falta Phase 5)
3. **Solo 3 estados visuales:** "Contrato válido", "Validación fallida", "Sin validar" — sin scores ni badges intermedios
4. **Re-verificación síncrona:** `verifyScriptContractV2` en ReviewStep es async pero sin retry automático
5. **Routing sin fallback granular:** Si `remediationContext` falta, cae a legacy sin aviso específico
6. **No hay exportación de contrato:** Solo se muestra el script — no se exporta el JSON del contrato completo
7. **Hash abreviado:** Solo se muestran 12 caracteres del hash en la UI

### Curados en Loop 5

- Invalidation por clave compuesta (D17) — no requiere hooks múltiples
- Fresh verification antes de approve (D16) — previene aprobaciones obsoletas
- ScriptReview readOnly (D18) — previene ediciones que rompan trazabilidad
- Routing por flag + contexto (D19) — fallback seguro al legacy

### Claims NO permitidos aún

- NO afirmar ejecución real (falta Phase 5)
- NO afirmar benchmark comparativo (falta E2E)
- NO afirmar que los valores del vocabulario son universalmente nulos (D15)
- NO afirmar que el contrato fue auditado end-to-end (falta Loop 6)
