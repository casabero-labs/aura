# Cierre de Phase 4 — ScriptContractV2 + Renderer

> **Fecha:** 2026-06-26  
> **Evidencia vigente:** `aa167995316962a70ff41a3970326d4824d980c0`  
> **Freeze final:** `PHASE4_REPAIR_SHA`

## Alcance final

Phase 4 implementa el pipeline contractual completo desde el plan de remediación v2 hasta la aprobación humana del script, sin ejecutarlo.

**Flujo cerrado:** RemediationPlanV2 → HITL → ScriptContractCandidateV2 → validación → finalización → hash → verificación fresca → revisión humana read-only → aprobación.

## Arquitectura final

```
RemediationPlanV2 (determinista desde DiagnosisResponseV2)
  → ScriptGenerationStepV2 (UI)
  → buildScriptCandidateV2 (builder)
  → validateScriptCandidateV2 (validator)
  → finalizeScriptContractV2 (hash + pythonSyntax)
  → verifyScriptContractV2 (verificador)
  → ReviewStep v2 (HITL read-only)
  → Aprobación
```

No se ejecuta Python en ningún punto. No se calcula HealthDelta. No se modifican datos del dataset.

## SHAs de Loops 1 a 6R.5

| Loop | SHA | Descripción |
|---|---|---|
| L1 | `04a33ae` | Base types, ScriptBuildContextV2, column resolver |
| L2 | `04a33ae` | Renderer determinista + PLACEHOLDER_VOCABULARY |
| L3 | `04a33ae` | Builder + finalizer |
| L4 | `04a33ae` | Validator + verifier |
| L5 | `04a33ae` | UI: ScriptGenerationStepV2 |
| L5R | `7ad83d1` | Reparación integración UI |
| L5R.1 | `00e2e88` | Propagación plan + restauración sesión |
| L5R.2 | `5af5d0c` | Cierre restauración sesión |
| L6 | `e1b0764` | Evidencia E2E inicial |
| L6R | `47d7d1d` | Corrección harness |
| L6R.2 | `92d331c` | Harden asserts |
| L6R.3 | `cef7a2f` | Runtime fingerprint |
| L6R.4 | `9e9ce27` | Testid + script comparison |
| L6R.5 | `aa16799` | Seal final evidence |

## Matriz de pruebas

| Tipo | Resultado |
|---|---|
| Tests unitarios | 1116 passed, 6 skipped |
| E2E (corrida 1) | 8 passed |
| E2E (corrida 2) | 8 passed |
| Typecheck | 0 errores |
| Build | ~3s |
| Contracts v2 validate | 3/3 PASS, sourceTreeDirty=false |

## Matriz de capturas

| Captura | SHA-256 | Tamaño |
|---|---|---|
| `07_phase4_remediation_hitl.png` | `1130898a716a65e6226ab8ffe514ebea370d6638581516d1730a291260950ba3` | 134234 |
| `08_phase4_script_contract_valid.png` | `51da43d56c8e189d082f13f194a3a4d219b2b52a10c0e02dffe478d2453461a3` | 126152 |
| `09_phase4_script_contract_code.png` | `7c260a5dce34cbe170dabda96ff3c53d897e63f2957afcef429d0552847df422` | 126142 |
| `10_phase4_script_review_readonly.png` | `06791453863748c796221ed9c617181e5c4de0986db5e8c9602d996805e3c970` | 123137 |
| `11_phase4_script_approved_hitl.png` | `2499c1e7929f00dfcbbb4872c1d514471ed807f2ecf8e5f1adb96536bde905d3` | 118665 |
| `12_phase4_tampered_contract_blocked.png` | `5791015e21c7d26a259bdca53808d355669e153cf1980a44c26dc803856fa012` | 120614 |

## Claims permitidos

- Script determinista generado desde acciones aprobadas.
- Contrato con hash estable SHA-256 completo.
- Referencias de columnas validadas.
- Partición HITL visible (accepted/rejected/excluded).
- Verificación fresca antes de aprobación.
- Fail-closed ante hash manipulado.
- UI read-only durante revisión.
- No ejecución en Phase 4.
- planId preservado tras decisiones HITL.
- Comparación exacta de scriptText línea por línea.

## Claims prohibidos

- Script ejecutado.
- Dataset corregido.
- Score mejorado.
- HealthDelta real.
- Benchmark LLM formal.
- Seguridad absoluta.
- Inferencia LLM demostrada por el harness.

## Limitaciones

1. `syntax not_run` no significa `syntax passed` — es informativo.
2. No existe ejecución Python en Phase 4 — se delega a Phase 5.
3. El contrato se genera pero no se ejecuta en la UI.
4. La aprobación requiere scroll del code viewer (hasReviewed).
5. Las capturas no son deterministas byte a byte entre corridas (generatedAt timestamp).
6. La verificación fresca sobreescribe la verificación persistida en restauración.
7. El hash del contrato está disponible como atributo `data-contract-hash`, no en la UI visible completa.
8. La navegación a ReviewStep requiere que el botón "Continuar a revisión" esté habilitado (contractValid).

## Frontera con Phase 5

Phase 5 ejecutará el script generado contra el dataset original, calculará HealthDelta, aplicará transformaciones y medirá la mejora real.

**Queda prohibido en Phase 4:**
- Ejecutar Python.
- Aplicar transformaciones al CSV.
- Calcular HealthDelta.
- Generar ImprovementRun.
- Re-auditar el dataset.
- Modificar datos del usuario.

**Phase 5 debe:**
- Tomar el contrato aprobado en Phase 4.
- Ejecutar `clean_dataset(df)` contra los datos originales.
- Calcular métricas pre/post.
- Generar HealthDelta.
- Producir evidencia de mejora real.
