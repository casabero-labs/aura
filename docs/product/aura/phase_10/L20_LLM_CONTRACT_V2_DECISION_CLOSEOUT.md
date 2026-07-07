# Phase 10 L20 — LLM Contract V2 Decision Closeout

## 1. Objetivo

Decidir si los contratos LLM v2 experimentales (L19) sustituyen el contrato productivo, aplicando el plan definido al cerrar L19. La decisión documenta el estado del issue #4 y consolida los resultados de L18 y L19.

## 2. HEAD base

```
059e780aea8365cd633017c7d867c3f279e6de42
```

HEAD coincide con origin/main. Repositorio limpio.

## 3. Relación con issue #4

Issue #4: "Contratos LLM v2: baseline y comparación antes/después".

| Fase | Estado | SHA |
|------|--------|-----|
| L18 — Baseline | ✅ completado | `0c96353` + `2d8aa4f` |
| L19 — Comparación v2 | ✅ completado | `9d25cf4` + `059e780` |
| L20 — Decisión | ✅ presente closeout | Este commit |

## 4. Resumen L18 — Baseline

- Titanic controlled fixture: 6 filas, 5 issues.
- Harness construye evidence envelope, ejecuta pipeline V2 con mock, build remediation plan, exporta `baseline_result.json`.
- Hallazgo clave: columna `Name` es ambigua en `columnRegistry` → `trim_whitespace` bloqueado como `review_only`.
- `rule:identifier-column` no registrado en `RULE_POLICY` → defaults a `review_only`.

## 5. Resumen L19 — Comparación v2 experimental

- Módulo `src/contracts/llm/v2/` con `applyV2Rules()`.
- Mismo fixture, mismo mock, una ejecución.
- V2 recupera `trim_whitespace` como `automatic_safe` ignorando column ambiguity.
- V2 mapea `rule:long-tail-categorical` como `human_review` (vs `not_actionable` en baseline).
- Sin regresión: los 4 items de revisión humana se preservan.
- Métricas: automaticActionPrecision=1.0, humanReviewRecall=1.0.

## 6. Decisión

**No sustituir producción todavía.**

## 7. Estado v2

`experimental_candidate`

No es `production_replacement`.

## 8. Justificación técnica

Aunque v2 mejora el fixture controlado Titanic:
- **Recupera** `trim_whitespace` como automático (mejora respecto a baseline).
- **Preserva** los 4 items de revisión humana sin regresión.
- **Zero regresión** en todos los items.

La evidencia es insuficiente para sustitución productiva:
1. Un único fixture controlado (6 filas).
2. Provider mock (no se invoca LLM real).
3. Una sola repetición.
4. Sin proveedor real (ni Chrome AI, ni Ollama, ni DeepSeek).
5. Sin evaluación sobre datasets diversos.
6. Sin validación HITL ampliada.

## 9. Pasos futuros permitidos

- Trial detrás de flag experimental en un entorno aislado.
- Más fixtures controlados (otros datasets).
- Validación HITL con revisores humanos.
- Datasets adicionales fuera del Titanic.
- Evaluación con proveedor real cuando esté disponible.

## 10. Claims bloqueados

- `production-ready`
- `formal benchmark`
- `best model`
- `universal winner`

Ninguno de estos términos aparece en los archivos de L20 salvo como claims bloqueados en `decision.json`.

## 11. Evidencia JSON

`docs/product/aura/phase_10/l20_llm_contract_v2_decision/decision.json`

Contiene: decisión, razón, métricas L18/L19, v2Status, blockedClaims, nextAllowedStep.

## 12. Validaciones ejecutadas

| Validación | Resultado |
|------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ |
| `git status --porcelain` | solo archivos L20 nuevos |
| `git diff --name-status` | solo A (add) para L20 |
| Grep: términos prohibidos | Solo en `blockedClaims` y `limits` |
| Grep: flags true | No en L20 |
| Grep: L21 / cuarta entrega | No en L20 |

## 13. Greps ejecutados

```
$ grep -R "production-ready\|benchmark formal\|formal benchmark\|mejor modelo\|best model\|modelo ganador\|ganador universal" docs/product/aura/phase_10/L20_LLM_CONTRACT_V2_DECISION_CLOSEOUT.md docs/product/aura/phase_10/l20_llm_contract_v2_decision
  => solo en blockedClaims (decision.json: "production-ready", "formal benchmark", "best model", "universal winner")

$ grep -R "productionContractChanged.*true\|usedRealAiProvider.*true\|formalBenchmark.*true" docs/product/aura/phase_10/l20_llm_contract_v2_decision
  => (ninguno, todos false)

$ grep -R "Phase 10 L21\|cuarta entrega" docs/product/aura/phase_10/L20_LLM_CONTRACT_V2_DECISION_CLOSEOUT.md docs/product/aura/phase_10/l20_llm_contract_v2_decision
  => (ninguno)
```

## 14. Estado final de issue #4

**Cerrado como completed.**

Razón: L18 (baseline reproducible) + L19 (comparación experimental v2) + L20 (decisión documentada). No hay faltantes. No se modificó el flujo productivo. No se usó proveedor real. No se declaró benchmark formal.

## 15. Limitaciones registradas

- No se activó v2 en producción.
- No se cambió `runStructuredDiagnosis`.
- No se cambió DiagnosisStep.
- No se cambiaron prompts productivos.
- No se llamó proveedor real.
- No se descargaron modelos.
- No se inició Phase 10 L21.
- No se inició cuarta entrega.

## 16. Archivos del commit

| Archivo | Tipo |
|---------|------|
| `docs/product/aura/phase_10/L20_LLM_CONTRACT_V2_DECISION_CLOSEOUT.md` | Creación |
| `docs/product/aura/phase_10/l20_llm_contract_v2_decision/decision.json` | Creación |
