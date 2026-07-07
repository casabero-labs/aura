# Phase 10 L19 — LLM Contract V2 Comparison Closeout

## 1. Objetivo

Crear una versión experimental de contratos LLM v2 y comparar su comportamiento contra el baseline L18 sobre el mismo fixture Titanic controlado. Medir si v2 recupera `trim_whitespace` como acción automática sin regresión en items de revisión humana.

## 2. Commit auditado

```
(SHA — completar post-push)
```

## 3. Archivos creados/modificados

| Archivo | Tipo |
|---------|------|
| `src/contracts/llm/v2/types.ts` | Creación — Tipos v2 experimentales |
| `src/contracts/llm/v2/engine.ts` | Creación — Motor de reglas v2 |
| `src/contracts/llm/v2/index.ts` | Creación — Barrel export |
| `src/__tests__/llmContractV2Comparison.test.ts` | Creación — Harness comparación (11 tests) |
| `docs/product/aura/phase_10/l19_llm_contract_v2_comparison/comparison_result.json` | Creación — JSON evidencia |
| `docs/product/aura/phase_10/L19_LLM_CONTRACT_V2_COMPARISON_CLOSEOUT.md` | Creación — Este archivo |

## 4. Relación con baseline L18

Mismo fixture Titanic (`TITANIC_CONTRACT_BASELINE_FIXTURE`), mismo modo mock, mismas 5 issues:

| Issue ID | Column | Rule | Baseline (v1) | V2 |
|----------|--------|------|:---:|:---:|
| hygiene-ghost-Name | Name | trim-whitespace | review_only | **automatic_safe** |
| integrity-null-Age | Age | null-values | review_only | human_review |
| logic-outlier-tukey-Age | Age | mild-outliers | review_only | human_review |
| semantic-long-tail-Ticket | Ticket | long-tail-categorical | not_actionable | human_review |
| semantic-id-PassengerId | PassengerId | identifier-column | review_only | human_review |

## 5. Diseño experimental v2

El módulo `src/contracts/llm/v2/` es PURAMENTE EXPERIMENTAL:
- No es importado por código productivo
- No reemplaza `runStructuredDiagnosis`
- No cambia prompts productivos
- No se activa en DiagnosisStep
- No cambia scoring

Tipos v2:
- `LlmActionability = 'automatic_safe' | 'human_review' | 'informational'`
- `LlmV2FindingDecision`: id, fieldRef, ruleRef, issueType, actionability, allowedAutomation, requiresHumanReview, riskLevel, evidenceRef, rationale
- `V2ComparisonResult`: baseline vs v2 observed, comparison flags, metrics, limits

Mejora clave sobre v1: column ambiguity no bloquea acciones automáticas reversibles, no destructivas y semánticamente neutras. `trim_whitespace` siempre es `automatic_safe` independientemente del nombre de columna.

## 6. Comportamiento esperado

```json
{ "automaticActions": ["trim_whitespace"], "humanReview": ["missing_age", "age_outlier", "high_cardinality_ticket", "passenger_id_identifier"] }
```

## 7. Comportamiento observado v2

```json
{ "automaticActions": ["trim_whitespace"], "humanReview": ["missing_age", "age_outlier", "high_cardinality_ticket", "passenger_id_identifier"] }
```

V2 coincide exactamente con expected behavior. Sin regresión.

## 8. Comparación contra baseline

| Métrica | Baseline L18 | V2 L19 |
|---------|:---:|:---:|
| trim_whitespace auto | ❌ (column ambiguity bloquea) | ✅ (automatic_safe) |
| missing_age review | ✅ | ✅ |
| age_outlier review | ✅ | ✅ |
| high_cardinality review | ❌ (not_actionable) | ✅ (human_review) |
| passenger_id review | ✅ | ✅ |
| **Human review recall** | n/a | **1.0** |
| **Automatic action precision** | n/a | **1.0** |

## 9. Métricas simples

| Métrica | Valor | Explicación |
|---------|-------|-------------|
| `automaticActionPrecision` | 1.0 | trim es el único auto, coincide con expected |
| `humanReviewRecall` | 1.0 | 4/4 items de human_review preservados |
| `regressionDetected` | false | Ningún item pasó de human_review a auto incorrectamente |
| `trimWhitespaceRecoveredAsAutomatic` | true | Recuperado respecto al baseline |
| `humanReviewItemsPreserved` | true | Todos preservados |

Métricas calculadas directamente de expected vs observed sobre el mismo fixture controlado, sin LLM real.

## 10. Evidencia JSON generada

`docs/product/aura/phase_10/l19_llm_contract_v2_comparison/comparison_result.json`

121 líneas. Incluye: baselineObserved, v2Observed, v2Decisions (5 decisiones con rationale), expectedBehavior, comparison flags, metrics, limits.

## 11. Pruebas ejecutadas

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `llmContractV2Comparison.test.ts` | 11 | ✅ |
| `llmContractBaseline.test.ts` (L18) | 18 | ✅ |
| `npm test -- --run contract` (11 suites) | 231 | ✅ |
| `npm test -- --run baseline` (3 suites) | 115 | ✅ |
| Typecheck | — | ✅ |
| Build | — | ✅ |

## 12. Greps ejecutados

| Búsqueda | Resultado |
|----------|-----------|
| `formal benchmark\|benchmark formal\|mejor modelo\|modelo ganador\|production-ready` | Solo en `limits` (como restricciones) ✅ |
| `usedRealAiProvider.*true\|AURA_E2E_REAL_CHROME_AI\|OLLAMA.*real` | No en L19 ✅ |
| `Phase 10 L20\|cuarta entrega` | No en L19 ✅ |
| `changedProductionContract.*true` | No en L19 ✅ |

## 13. Límites de claims

- Mock provider only — no real LLM inference.
- Not a formal benchmark.
- Not a production replacement.
- Single controlled fixture (6 rows).
- V2 is experimental, not activated in production UI.
- No se declara mejor modelo.
- No se inicia cuarta entrega.
- No se inicia Phase 10 L20.

## 14. Riesgos abiertos

1. **V2 no cubre todos los rules del RULE_POLICY:** Solo 6 reglas mapeadas. Las 24+ reglas restantes caen a `human_review` por defecto.
2. **Cardinality v2 diverge de v1:** En v1, `rule:long-tail-categorical` es `not_actionable` (excluido del plan). En v2, es `human_review`. Esto es intencional: v2 busca que más issues queden visibles para revisión humana en lugar de excluirlos silenciosamente.
3. **Misma limitación de fixture pequeño:** El fixture tiene 6 filas. No cubre edge cases de datasets grandes.
4. **Dependencia de fixture L18:** Si el fixture cambia, ambos baselines deben actualizarse.

## 15. Estado de issue #4

**Abierta.** L19 completó la comparación experimental v2. Queda pendiente:
- Decisión de sustituir o no sustituir el contrato productivo.
- Si se decide sustituir, implementar integración en el flujo productivo.
- Si no se sustituye, documentar por qué y cerrar #4.
