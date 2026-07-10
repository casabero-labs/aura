# Evidencia determinista final de AURA

- Evidencia: `aura.final-deterministic-evidence.v1`
- Generada: 2026-07-10T19:22:22.514Z
- Commit del motor: `450ba6a334812e25d67201250eaf8b0b7bd75992`
- Sustituye: `experiments/results/deterministic_validation.json`
- Unidad primaria: activación binaria de regla
- Detecciones no anotadas: reportadas aparte, sin puntuación

## Resultados comparables

| Dataset | Filas | Score AURA | Reglas | TP | FP | FN | Precisión | Recall | F1 | Adicionales no puntuadas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| synthetic_ground_truth | 15 | 0 | 13 | 12 | 1 | 0 | 92.31% | 100.00% | 96.00% | 0 |
| titanic | 891 | 58 | 3 | 3 | 0 | 0 | 100.00% | 100.00% | 100.00% | 7 |
| controlled_customers_phase8 | 50 | 0 | 29 | 16 | 0 | 13 | 100.00% | 55.17% | 71.11% | 13 |

> Precisión `conditional_no_negative_labels` significa que no existen etiquetas negativas exhaustivas; no debe presentarse como precisión global del motor.

## Reproducción byte a byte

```bash
cd /Users/casabero/Documents/GitHub/aura/src
AURA_EVIDENCE_COMMIT=450ba6a334812e25d67201250eaf8b0b7bd75992 AURA_EVIDENCE_GENERATED_AT=2026-07-10T19:22:22.514Z npm run evidence:deterministic
```

## synthetic_ground_truth

- Archivo: `experiments/datasets/synthetic_ground_truth.csv`
- SHA-256: `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`
- Alcance del ground truth: 13 reglas predeclaradas, incluida 1 regla negativa conocida
- Interpretación de precisión: `scoped_with_explicit_negatives`
- Advertencias de parseo CSV: 0
- Ocurrencias positivas esperadas: 30
- Ocurrencias detectadas sobre claves esperadas: 30
- Ocurrencias de FP conocidos: 14
- Reglas omitidas: ninguna

Limitaciones:

- La evaluación es binaria por activación; los conteos agregados no prueban coincidencia exacta por fila.

## titanic

- Archivo: `experiments/datasets/titanic.csv`
- SHA-256: `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`
- Alcance del ground truth: 3 reglas positivas predeclaradas; ground truth deliberadamente parcial
- Interpretación de precisión: `conditional_no_negative_labels`
- Advertencias de parseo CSV: 0
- Ocurrencias positivas esperadas: 927
- Ocurrencias detectadas sobre claves esperadas: 927
- Ocurrencias de FP conocidos: 0
- Reglas omitidas: ninguna

Limitaciones:

- El ground truth solo cubre tres reglas positivas; precisión=1,00 es condicional y no estima falsos positivos globales.
- Las detecciones adicionales se reportan sin puntuarlas por falta de etiquetas negativas exhaustivas.

## controlled_customers_phase8

- Archivo: `experiments/final-evaluation/datasets/controlled_customers_phase8.csv`
- SHA-256: `7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf`
- Alcance del ground truth: aura.diagnostic-oracle.v1@1.0.0; 29 claves deterministas canónicas de 51 incidencias fuente
- Interpretación de precisión: `conditional_no_negative_labels`
- Advertencias de parseo CSV: 3
- Ocurrencias positivas esperadas: 51
- Ocurrencias detectadas sobre claves esperadas: 77
- Ocurrencias de FP conocidos: 0
- Reglas omitidas: `rule:cross-constraint|credits_used,total_credits|dataset`, `rule:domain-allowed|country|column`, `rule:domain-allowed|plan_type|column`, `rule:unique-id|customer_id|column`, `rule:future-dates|birth_date|column`, `rule:future-dates|registration_date|column`, `rule:invalid-date|birth_date|column`, `rule:invalid-format|birth_date|column`, `rule:null-values|birth_date|column`, `rule:null-values|registration_date|column`, `rule:null-values|total_credits|column`, `rule:toxic-placeholders|city|column`, `rule:variable-phone-length|phone|column`

Limitaciones:

- El ground truth no contiene reglas negativas exhaustivas; precisión=1,00 es condicional al conjunto puntuado.
- Las 51 incidencias deterministas se agregan en 29 claves regla-columna; no se evalúa coincidencia exacta por fila.
- Las detecciones adicionales se reportan sin puntuarlas como FP porque el ground truth no es exhaustivo para reglas no declaradas.

## Interpretación para el TFM

- El fixture sintético permite medir activaciones esperadas y un falso positivo conocido dentro de un alcance cerrado.
- Titanic confirma tres detecciones positivas, pero su ground truth parcial no permite estimar precisión global.
- Phase 8 mide cobertura determinista sobre 29 claves canónicas: las capacidades cognitivas y HITL quedan fuera de este F1.
- Ninguna cifra histórica debe reemplazar estos resultados sin regenerar este artefacto.
- El archivo `experiments/results/deterministic_validation.json` queda como histórico y no debe citarse como resultado actual.

## Limitaciones generales

- Los conteos de ocurrencias pueden solaparse entre reglas y no representan filas únicas.
- Las métricas TP/FP/FN principales son binarias por activación de regla y no deben mezclarse con conteos de ocurrencias.
- Las detecciones no anotadas se reportan como no puntuadas; ausencia en un ground truth parcial no prueba falsedad.
- El score de salud de AURA es descriptivo y no equivale a precisión, recall ni F1.
