# Phase 10 L18 — LLM Contract Baseline Closeout

## 1. Objetivo

Crear un harness reproducible para evaluar el comportamiento actual del contrato/prompt LLM sobre un caso controlado Titanic, sin modificar el flujo productivo. Medir el baseline antes de implementar contratos v2.

## 2. Commit auditado

```
3345d580dec7d645ca42fc6014101174ddf2c42c
```

## 3. Archivos creados/modificados

| Archivo | Tipo |
|---------|------|
| `src/tests/fixtures/titanicContractBaseline.ts` | Creación — Fixture Titanic controlado (AuditReportInput, 6 filas, 5 issues) |
| `src/__tests__/llmContractBaseline.test.ts` | Creación — Harness baseline (18 tests) |
| `docs/product/aura/phase_10/l18_llm_contract_baseline/baseline_result.json` | Creación — JSON de evidencia |
| `docs/product/aura/phase_10/L18_LLM_CONTRACT_BASELINE_CLOSEOUT.md` | Creación — Este archivo |

## 4. Fixture Titanic usado

`titanicContractBaseline.ts` — `TITANIC_CONTRACT_BASELINE_FIXTURE`

AuditReportInput con 6 filas controladas y 5 issues:

| Issue | Column | Rule | Acción esperada |
|-------|--------|------|-----------------|
| `hygiene-ghost-Name` | Name | `rule:trim-whitespace` | Trim auto |
| `integrity-null-Age` | Age | `rule:null-values` | Revisión humana |
| `logic-outlier-tukey-Age` | Age | `rule:mild-outliers` | Revisión humana |
| `semantic-long-tail-Ticket` | Ticket | `rule:long-tail-categorical` | Revisión humana |
| `semantic-id-PassengerId` | PassengerId | `rule:identifier-column` | Revisión humana |

Cubre: trim (auto), nulos (review), outliers (review), alta cardinalidad (review), identificadores (review).

## 5. Comportamiento esperado

```json
"automaticActions": ["trim_whitespace"],
"humanReview": ["missing_age", "age_outlier", "high_cardinality_ticket", "passenger_id_identifier"]
```

## 6. Comportamiento observado

```json
"automaticActions": [],
"humanReview": ["hygiene-ghost-Name", "missing_age", "age_outlier", "passenger_id_identifier"]
```

**Hallazgo clave:** La columna `Name` es marcada como *ambiguous* por `columnRegistry.ts` (patrón `/^(name)_?\d*$/i`). Esto fuerza a que **todos** los issues referenciando `Name` requieran revisión humana, incluso aquellos con `actionability: 'auto_safe'` y `authorized: true`. El trim_whitespace es `auto_safe` en el envelope pero `review_only` en el remediation plan.

`high_cardinality_ticket` no aparece en observed `humanReview` porque `rule:long-tail-categorical` es `not_actionable` y se excluye del plan.

## 7. Métricas

No calculadas. El harness usa mock adapter (no LLM real). No hay ground truth de comparación.

```
Métricas no calculadas porque el baseline usa salida mock/fixture y no proveedor real.
```

## 8. Evidencia JSON generada

`docs/product/aura/phase_10/l18_llm_contract_baseline/baseline_result.json`

Contiene: phase, mode, dataset, expectedBehavior, observedBehavior, actionabilityMap, planId, envelopeRef, limits, flags.

## 9. Pruebas ejecutadas

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `llmContractBaseline.test.ts` | 18 | ✅ |
| `npm test -- --run contract` (10 suites) | 220 | ✅ |
| Typecheck | — | ✅ |
| Build | — | ✅ |

## 10. Greps ejecutados

| Búsqueda | Resultado |
|----------|-----------|
| `formal benchmark\|benchmark formal\|mejor modelo\|modelo ganador\|production-ready` | Solo en `limits` (como restricciones) ✅ |
| `usedRealAiProvider.*true\|AURA_E2E_REAL_CHROME_AI\|OLLAMA.*real` | No en L18 ✅ |
| `Phase 10 L19\|cuarta entrega` | Solo en agent prompts antiguos (no L18) ✅ |

## 11. Límites de claims

- No se declara benchmark formal.
- No se declara mejor modelo.
- No se declara production-ready.
- No se inicia cuarta entrega.
- No se inicia Phase 10 L19.

## 12. Riesgos abiertos

1. **Hallazgo activo:** Column ambiguity (`Name`) bloquea auto_safe incluso para trim_whitespace. Cualquier columna con nombre `name` (case insensitive) es marcada como ambigua por `columnRegistry.ts` y fuerza revisión humana. Esto afecta el contrato actual y debe considerarse en el diseño de v2.
2. **Solo 5 issues:** El fixture cubre las categorías principales pero no todos los 30+ rules del RULE_POLICY. Un baseline ampliado requeriría más fixtures.
3. **Mock adapter:** El harness usa adapter mock, no LLM real. Las métricas de precisión/recall no se pueden calcular sin inferencia real.
4. **rule:identifier-column no existe en RULE_POLICY:** El fixture incluye PassengerId con `rule:identifier-column`, que no está registrada en las 30 reglas de `evidenceEnvelopeV2.ts`. Cae a `review_only` por defecto.

## 13. Estado de issue #4

**Abierta.** L18 completó el baseline del contrato actual. Falta:
- Implementar contratos v2 (si procede).
- Comparación antes/después.
- Decisión de sustitución o no sustitución.
