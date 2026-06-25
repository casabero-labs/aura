# Diseño Experimental — Tercera Entrega AURA

> **Commit de evidencia:** `fe5378e3eff87de45b60111eb42e30ed89beb1cd`
> **Fecha:** 2026-06-24
> **Harness:** `run-local-dataset-validation.mjs` v1.1.0
> **sourceTreeDirty:** `false`

## 1. Pregunta de validación

¿El contrato `aura.remediation.v2` produce planes de remediación deterministas, trazables y verificables sobre datasets CSV reales, sin recurrir a inferencia LLM en tiempo de construcción?

## 2. Datasets utilizados

### 2.1 synthetic_ground_truth.csv — Dataset controlado

| Propiedad | Valor |
|---|---|
| SHA-256 | `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49` |
| Filas | 15 |
| Columnas | 9 |
| Issues inyectados | 16 |
| Propósito | Ground truth controlado; anomalías conocidas de forma exacta para validar cobertura del motor. |

Selección: dataset pequeño con anomalías inyectadas manualmente. Permite validar que cada anomalía conocida produce un hallazgo y que el plan la cubre con acción o exclusión.

### 2.2 titanic.csv — Caso aplicado principal

| Propiedad | Valor |
|---|---|
| SHA-256 | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| Filas | 891 |
| Columnas | 12 |
| Issues detectados | 10 |
| Propósito | Caso real de tamaño medio. Representa el escenario habitual: dataset público bien estudiado con anomalías naturales. |

Selección: referencia estándar en ciencia de datos. Permite comparación con literatura existente sobre calidad del Titanic.

### 2.3 adult_income.csv — Contraste de alto volumen

| Propiedad | Valor |
|---|---|
| SHA-256 | `23f713bb0be77e6b98690e1b91795e237686a71ee3ca72f5c9890214e011d21f` |
| Filas | 48.842 |
| Columnas | 15 |
| Issues detectados | 12 |
| Propósito | Contraste de escalabilidad. Valida que el pipeline no degrada con volumen y que los truncamientos de evidencia se manejan correctamente. |

Selección: dataset público de alta dimensionalidad (UCI Adult). Detecta si el motor o los prompts se saturan con más filas.

## 3. Unidad de evaluación determinista (Capa 1)

El motor determinista (`auditEngine.ts`) aplica 23+ reglas sobre cada dataset. Cada regla produce:

- **Hallazgo (issue):** identificador, columna afectada, regla violada, conteo de filas, porcentaje, muestras de evidencia.
- **Fingerprint del dataset:** SHA-256 del contenido, calculado antes de cualquier análisis.
- **Evidencia envelope:** resumen estructurado con columnas, stats, issues, muestras.

La unidad de evaluación es la **regla por columna**, no el dataset completo. Esto permite granularidad en TP/FP/FN.

## 4. Unidad de evaluación del diagnóstico

El diagnóstico (`DiagnosisResponseV2`) se construye a partir del envelope y una respuesta estructurada del LLM. En el harness actual se usa fixture determinista (sin inferencia LLM real) para validar la infraestructura del contrato:

- `diagnosisRef`: `diag:${SHA-256 de 64 hex del envelope}` (sin responseId ni generatedAt).
- `issues`: cada issue del motor se transforma en bloque de diagnóstico con `evidenceRefs` que apuntan a la evidencia original.
- `diagnosisBlocks`: mapeo 1:1 entre issue y bloque de remediation.
- `generatedAt`: marca temporal ISO 8601.

La fixture de diagnóstico no sustituye inferencia LLM real. Es un sustituto determinista para validar que el contrato `aura.diagnosis.v2` se cumple estructuralmente.

## 5. Unidad de evaluación del plan de remediación

El `RemediationPlanV2` se construye sin LLM. El constructor `buildRemediationPlanV2` recibe:

1. `DiagnosisExecutionResult` con `remediationContext` y `diagnosis`.
2. Por cada issue del contexto, consulta `remediationPolicyV2` para determinar el `actionType` autorizado.
3. Calcula `actionability` con `computeEffectiveActionability`: degrada `auto_safe` → `review_only` según 8 reglas: nivel de acciónabilidad configurado, validación de autorización automática, coincidencia de tipo de acción con el registro, presencia del issue en el diagnóstico, columna ambigua/duplicada, y `requiresHumanReview` del diagnóstico.
4. Genera `actionId` como `act:${sha256short(sha256hex(canonicalJson({ diagnosisRef, issueId, ruleId, columnId, actionType })))}`.
5. Agrupa issues no accionables en `exclusions`.

**Unidad de evaluación:** el plan completo, junto con su `planId` (SHA-256 del plan serializado). La estabilidad del hash entre ejecuciones confirma determinismo.

## 6. Construcción del ground truth sintético

El dataset `synthetic_ground_truth.csv` fue construido manualmente:

- 15 filas, 9 columnas.
- 26 anomalías inyectadas (9 tipos) con conocimiento exacto de ubicación y tipo.
- Anomalías incluyen: espacios fantasma, nulos, duplicados exactos, mayúsculas mixtas, fechas mal formateadas, placeholders tóxicos, números disfrazados, IDs corruptos.
- Ground truth documentado en `experiments/datasets/synthetic_ground_truth.json`.

Este dataset permite calcular TP/FP/FN por regla porque se conoce la verdad base.

## 7. Criterios de etiquetado

Para el motor determinista:

| Símbolo | Significado |
|---|---|
| TP | La regla detectó una anomalía que existe según ground truth. |
| FP | La regla detectó una anomalía que no existe según ground truth. |
| FN | Una anomalía existe según ground truth pero la regla no la detectó. |

Para el plan de remediación (contrato v2):

| Símbolo | Significado |
|---|---|
| Plans built | El harness construyó un plan para el dataset. |
| Plans valid | El validador aceptó el plan sin errores. |
| planHashStable | Mismo dataset produce mismo `planId` en ejecuciones sucesivas. |
| unsafeUpgrades | Una acción tiene `actionability` superior a la calculada. |
| invalidReferences | Un `actionId` o `evidenceRef` no corresponde a un diagnóstico o contexto real. |

## 8. Métricas de precisión, recall y F1

Se calculan por regla usando los resultados del harness sobre `synthetic_ground_truth.csv`. Las fórmulas:

- **Precision** = TP / (TP + FP)
- **Recall** = TP / (TP + FN)
- **F1** = 2 × Precision × Recall / (Precision + Recall)

Los resultados oficiales del motor se publican en `experiments/contracts-v2/local-validation-results/validation-results.json` y se resumen en `resultados_motor_determinista.md`.

## 9. Validación de referencias

El validador `remediationValidatorV2` comprueba:

- Cada `actionId` se recalcula como hash de `(diagnosisRef, issueId, ruleId, columnId, actionType)` y se compara con el almacenado.
- Cada `evidenceRefs` en acción coincide exactamente con `evidenceRefs` del contexto.
- `diagnosisRef` coincide con `buildDiagnosisRef(diagnosis)`.
- `evidenceEnvelopeRef` coincide entre plan, contexto y diagnosisExecution.
- `datasetFingerprint` coincide entre plan y contexto.

Cualquier discrepancia produce un error con código `REMEDIATION_REFERENCE_INVALID`.

## 10. Estabilidad de hashes

- `planId` es `plan:${sha256short(hash)}` del plan serializado (orden canónico de campos), usando `sha256short` con longitud por defecto (8 caracteres).
- `actionId` es `act:${sha256short(sha256hex(...))}` de la tupla `(diagnosisRef, issueId, ruleId, columnId, actionType)`.
- `planHashStable` en el harness confirma que dos ejecuciones del mismo dataset producen el mismo `planId`.

Esta propiedad garantiza **reproducibilidad**: cualquier actor que implemente el mismo algoritmo sobre el mismo envelope y diagnóstico llegará al mismo plan.

## 11. Unsafe upgrades

Un upgrade inseguro ocurre cuando el plan asigna `auto_safe` a una acción que debería ser `review_only` según `computeEffectiveActionability`. El validador comprueba que cada `actionabilityMap[issueId]` coincide con el cálculo esperado. Si el plan dice `auto_safe` pero la función calcula `review_only`, el validador lo rechaza con código `REMEDIATION_ACTIONABILITY_UPGRADE`.

En los tres datasets del harness: **0 unsafe upgrades**.

## 12. Estados del plan

| Estado | Significado |
|---|---|
| `pending` | Acción creada pero no revisada por humano. |
| `approved` | Humano autorizó la acción. Puede proceder a script. |
| `rejected` | Humano rechazó la acción. No se genera script para ella. |

El flujo HITL exige que toda acción pase por `pending → approved|rejected` antes de generar script.

## 13. Limitaciones conocidas

1. **Fixture determinista ≠ inferencia LLM real.** El diagnóstico usa fixture, no modelo. Los resultados de cobertura y actionability refleja las reglas del motor, no la interpretación de un LLM.
2. **Auto-safe = 0 en todos los datasets.** Refleja que los datasets no satisfacen todas las condiciones de `computeEffectiveActionability` para `auto_safe` (8 reglas de degradación). No es una incapacidad del sistema, sino una consecuencia de la política conservadora activa que asigna `review_only` cuando alguna condición no se cumple.
3. **Ground truth limitado al dataset sintético.** Solo el dataset sintético tiene verdad base conocida. Titanic y Adult Income no permiten TP/FP/FN absolutos.
4. **Truncamientos de evidencia** pueden reducir la información disponible para diagnóstico en envelopes reducidos. El harness registra truncamientos por configuración.
5. **Sin ejecución real de scripts.** El harness valida la estructura del plan, no la ejecución de las transformaciones. La ejecución real requiere export a Colab o Pyodide.
