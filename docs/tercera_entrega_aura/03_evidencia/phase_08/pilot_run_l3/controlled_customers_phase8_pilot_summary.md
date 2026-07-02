# Phase 8 L3 — Pilot Run Summary: controlled_customers_phase8

## Dataset

- **ID:** `controlled_customers_phase8`
- **Version:** 1.0.0
- **Type:** 100% synthetic, no PII
- **Rows:** 50
- **Columns:** 15
- **Source:** `controlled_customers_phase8.csv`

## Execution

- **Date:** 2026-07-02
- **Method:** `npx tsx phase8_pilot_audit.ts` — deterministic audit engine only
- **No AI providers used**
- **No Python executed inside AURA**
- **No real datasets accessed**

## Results

| Metric | Value |
|--------|-------|
| Audit score | 0/100 |
| Issues detected | 29 |
| Expected issues (ground truth) | 55 |
| True positives (grouped) | 19 groups covering ~47 individual GT entries |
| True positives (% of AURA issues) | 65% |
| False positives | 10 (6 substantive, 4 optional-field nulls) |
| False negatives | 36 total, ~9 substantive gaps |
| Duplicate rows detected | 0 |
| Script candidate generated | Yes (`script_candidate_controlled_customers_phase8.py`) |
| Notebook candidate generated | Yes (`notebook_candidate_controlled_customers_phase8.json`) |
| Improvement run | not_generated (see below) |

## Key Findings

### Strengths (what AURA detected correctly)

1. **Null/empty detection** — Correctly identified nulls and empty values in full_name, email, phone, city, country, plan_type.
2. **Placeholder detection** — Flagged N/A, UNKNOWN, SIN_DATO across multiple columns.
3. **Email validation** — Caught "correo-invalido" and "NOT-AN-EMAIL" as invalid formats.
4. **Casing irregularity** — Detected lowercase plans ("premium", "basic") and all-caps city ("ARICA") via Caos de Capitalización.
5. **Extra spaces** — Detected leading/trailing spaces in names, phones, and cities via Espacios Fantasma.
6. **Negative values** — Caught credits_used = -50 as Negativos Imposibles.
7. **Outliers** — Detected credits_used > total_credits as IQR-based outlier in both columns.
8. **Cola Larga Categórica** — 47 unique names and 30 unique cities flagged (informational — domain with high cardinality).

### Coverage Gaps

1. **Date validation** — AURA does not validate date content (30/02/2000, 19986 5-digit year, 2075 future date, 2025 future registration). This is a known engine limitation.
2. **Domain enforcement** — AURA does not check allowed values lists (country=CHL vs CL, plan_type=invalid_plan/desconocido).
3. **Duplicate detection** — Duplicate customer_id C001 (row 41) was not flagged.
4. **Phone format normalization** — "9-1111-0020" and "000-0000-000" not caught as non-standard format.
5. **Optional fields flagged as critical** — Company (22 nulls), tax_id (16 nulls), notes (18 nulls) are optional per schema but flagged as CRITICAL.
6. **Cognitive issues** — Age anomalies (7-year-old, 8-year-old clients) and multi-placeholder patterns require LLM/human review — out of deterministic engine scope.

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Audit JSON | `aura_audit_controlled_customers_phase8.json` | generated |
| Issues CSV | `aura_issues_controlled_customers_phase8.csv` | generated |
| Detection Matrix | `controlled_customers_phase8_detection_matrix.md` | generated |
| Pilot Summary | `controlled_customers_phase8_pilot_summary.md` | this file |
| Script Candidate | `script_candidate_controlled_customers_phase8.py` | generated |
| Notebook Candidate | `notebook_candidate_controlled_customers_phase8.json` | generated |
| Improvement Run | — | **not_generated** |
| Manifest | `pilot_run_manifest.json` | generated |

## ¿Por qué ImprovementRun = not_generated?

El flujo `runImprovementFlow` requiere:
- Un `ScriptContractV2` completo (plan de remediación + script aprobado + firma hash).
- Un before/after CSV real de fixture (el script se ejecutaría externamente en Colab).
- Reauditoría sobre output fixture.

En L3 el objetivo es **validar detección**, no ejecutar mejora. No se corrió el script en Colab, por lo tanto no hay `ReauditSummaryV1` ni `HealthDeltaV1`. El ImprovementRun se deja como pendiente para L3 running completo (cuando se valide el script externamente).

## Limitations

1. **Sintético:** Los resultados solo aplican a este dataset. No generalizan.
2. **Un solo dominio:** Clientes SaaS en Chile. No cubre salud, finanzas, etc.
3. **Tamaño:** 50 filas. No escala a big data.
4. **Sin AI:** El motor determinista no usó proveedores. Los issues cognitivos (edad improbable, múltiples placeholders) requieren LLM.
5. **Engine gaps:** Validación de fechas, domain enforcement y detección de duplicados son áreas de mejora identificadas.
6. **Agregación:** AURA agrupa issues por regla+columna, dificultando 1:1 matching con ground truth individual por fila.
7. **Script/Notebook no ejecutados:** Los artefactos se generaron pero no se validaron en Colab real.

## Claims Allowed

- AURA fue ejecutada sobre un dataset sintético controlado `controlled_customers_phase8.csv` (50 filas, 15 columnas, 0 PII).
- El motor determinista detectó 29 issues agrupados.
- El 65% de los issues agrupados detectados por AURA corresponden a entradas del ground truth.
- Se identificaron gaps en validación de fechas, domain enforcement y detección de duplicados.
- Se generaron script candidate y notebook candidate como respaldo del flujo.
- Los resultados son preliminary_valid (no benchmark formal).

## Claims Prohibited

- AURA está production-ready.
- AURA corrigió datasets reales.
- AURA tiene 100% recall sobre este dataset.
- Los resultados constituyen un benchmark formal definitivo.
- Los resultados son validación externa independiente.
- El script fue ejecutado dentro de AURA (Python siempre es externo/Colab).
- Los gaps de detección implican que el engine es inútil.
- ImprovementRun fue generado (no lo fue).

## Risks

1. **Recall bajo aparente (~35%)** es engañoso: se debe a agregación (GT registra row-level, AURA reporta column-level). El recall real cubierto es ~85% de los patrones detectables (47/55).
2. **Falsos positivos en campos opcionales:** AURA trata company/tax_id/notes como requeridos porque no tiene schema de nulabilidad por columna.
3. **No validación externa:** El dataset fue diseñado conociendo las reglas de AURA. Esto infla resultados.
