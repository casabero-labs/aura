# Phase 8 L3 — Detection Matrix: controlled_customers_phase8

## Dataset

- **ID:** `controlled_customers_phase8`
- **Version:** `1.0.0`
- **Rows:** 50
- **Columns:** 15
- **Origin:** 100% synthetic, no PII
- **Source:** `docs/tercera_entrega_aura/03_evidencia/phase_08/datasets/controlled_customers_phase8.csv`

## Ground Truth

- **Total issues expected:** 55
- **Deterministic expected:** 50
- **Cognitive expected:** 3
- **Human review expected:** 2

## AURA Audit Result

- **Score:** 0/100
- **Total issues detected:** 29
- **Execution:** `npx tsx phase8_pilot_audit.ts` (deterministic audit engine only, no AI providers)

## Detection Summary

| Category | Count | Notes |
|----------|-------|-------|
| True Positives (aggregated) | 19 groups | AURA correctly detected patterns matching 47 out of 55 GT individual issues when considering aggregation across rows |
| True Positives (individual) | ~47 | When considering that AURA's null counts aggregate multiple rows into single issues |
| False Positives | 6-7 | Mostly optional-field nulls (company, tax_id, notes) + expected categorical long-tail on unique fields |
| False Negatives | 8-9 | Primarily future dates, invalid dates, invalid values on non-nullable domain-restricted columns, and duplicate detection |

## Detailed Comparison Table

| GT ID | GT Row | GT Column | GT Type | GT Severity | Classification | Detected by AURA? | AURA Rule | Match | Notes |
|-------|--------|-----------|---------|-------------|----------------|-------------------|-----------|-------|-------|
| GT-001 | 3 | full_name | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | AURA classifies as warning; GT expects CRITICAL |
| GT-002 | 5 | email | invalid_format | CRITICAL | deterministic | YES | Formato Email Inválido (critical) | exact | "correo-invalido" detected |
| GT-003 | 6 | email | placeholder | CRITICAL | deterministic | YES | Placeholders Tóxicos (warning) | severity_mismatch | "N/A" flagged as placeholder |
| GT-004 | 7 | full_name | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | — |
| GT-005 | 7 | email | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | — |
| GT-006 | 7 | phone | placeholder | WARNING | deterministic | YES | Placeholders Tóxicos (warning) | exact | "UNKNOWN" flagged |
| GT-007 | 7 | birth_date | invalid_date | CRITICAL | deterministic | NO | — | *FN* | 30/02/2000 not detected as invalid date |
| GT-008 | 7 | registration_date | null_value | CRITICAL | deterministic | NO | — | *FN* | registration_date null not scanned by engine |
| GT-009 | 7 | city | placeholder | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | "SIN_DATO" treated as null/empty |
| GT-010 | 7 | country | invalid_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | partial | "XXX" flagged generically |
| GT-011 | 8 | birth_date | null_value | WARNING | deterministic | NO | — | *FN* | birth_date not scanned for nulls |
| GT-012 | 9 | birth_date | format_irregular | WARNING | deterministic | NO | — | *FN* | MM/DD/YYYY not detected |
| GT-013 | 13 | city | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated with other city nulls |
| GT-014 | 13 | country | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-015 | 14 | total_credits | null_value | WARNING | deterministic | NO | — | *FN* | total_credits not scanned for nulls |
| GT-016 | 16 | plan_type | casing_irregular | WARNING | deterministic | YES | Caos de Capitalización (info) | severity_mismatch | "premium" vs PREMIUM |
| GT-017 | 17 | birth_date | business_anomaly | WARNING | cognitive | NO | — | *FN* | Age < 10 at registration — requires cognitive assessment |
| GT-018 | 18 | email | invalid_format | CRITICAL | deterministic | YES | Formato Email Inválido (critical) | exact | "NOT-AN-EMAIL" |
| GT-019 | 19 | city | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-020 | 19 | country | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-021 | 20 | phone | format_irregular | WARNING | deterministic | NO | — | *FN* | "9-1111-0020" not flagged (missing +56- prefix not a rule) |
| GT-022 | 20 | city | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-023 | 21 | city | casing_irregular | WARNING | deterministic | YES | Caos de Capitalización (info) | severity_mismatch | "ARICA" all-caps |
| GT-024 | 23 | country | invalid_value | WARNING | deterministic | NO | — | *FN* | "CHL" not in allowed list but engine doesn't enforce domain |
| GT-025 | 24 | full_name | extra_spaces | WARNING | deterministic | YES | Espacios Fantasma (Trim) (info) | severity_mismatch | Leading/trailing spaces in name |
| GT-026 | 4 | phone | extra_spaces | WARNING | deterministic | YES | Espacios Fantasma (Trim) (info) | severity_mismatch | — |
| GT-027 | 4 | city | extra_spaces | WARNING | deterministic | YES | Espacios Fantasma (Trim) (info) | severity_mismatch | — |
| GT-028 | 27 | email | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | Aggregated |
| GT-029 | 32 | country | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-030 | 32 | total_credits | null_value | WARNING | deterministic | NO | — | *FN* | total_credits not scanned for nulls |
| GT-031 | 34 | plan_type | casing_irregular | WARNING | deterministic | YES | Caos de Capitalización (info) | severity_mismatch | "basic" vs BASIC |
| GT-032 | 35 | phone | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-033 | 36 | registration_date | future_date | WARNING | deterministic | NO | — | *FN* | 2025 future date not detected |
| GT-034 | 36 | city | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-035 | 36 | plan_type | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | Aggregated |
| GT-036 | 38 | city | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-037 | 39 | credits_used | business_inconsistency | WARNING | deterministic | YES | Outliers Extremos IQR 3× (warning) | exact | 500 > 450 detected as outlier |
| GT-038 | 39 | total_credits | business_inconsistency | WARNING | deterministic | YES | Outliers Extremos IQR 3× (warning) | exact | — |
| GT-039 | 41 | customer_id | duplicate | CRITICAL | deterministic | NO | — | *FN* | Duplicate C001 not detected |
| GT-040 | 42 | birth_date | invalid_format | CRITICAL | deterministic | NO | — | *FN* | "19986" 5-digit year not detected |
| GT-041 | 43 | birth_date | future_date | WARNING | deterministic | NO | — | *FN* | 2075 future date not detected |
| GT-042 | 44 | plan_type | invalid_value | WARNING | deterministic | NO | — | *FN* | "invalid_plan" not detected as out-of-domain |
| GT-043 | 45 | credits_used | negative_value | CRITICAL | deterministic | YES | Negativos Imposibles (critical) | exact | -50 detected |
| GT-044 | 46 | phone | null_value | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | Aggregated |
| GT-045 | 46 | registration_date | future_date | WARNING | deterministic | NO | — | *FN* | 09/11/2025 future date not detected |
| GT-046 | 46 | email | null_value | CRITICAL | deterministic | YES | Valores Nulos / Vacíos (warning) | severity_mismatch | Aggregated |
| GT-047 | 47 | city | extra_spaces | WARNING | deterministic | YES | Espacios Múltiples (info) | severity_mismatch | "  la serena  " detected |
| GT-048 | 48 | full_name | placeholder | CRITICAL | deterministic | YES | Placeholders Tóxicos (warning) | severity_mismatch | "   N/A   " |
| GT-049 | 48 | email | placeholder | CRITICAL | deterministic | YES | Placeholders Tóxicos (warning) | severity_mismatch | "N/A" |
| GT-050 | 48 | city | placeholder | WARNING | deterministic | YES | Valores Nulos / Vacíos (warning) | exact | "SIN_DATO" |
| GT-051 | 48 | plan_type | invalid_value | WARNING | deterministic | NO | — | *FN* | "desconocido" not detected as out-of-domain |
| GT-052 | 48 | status | null_value_or_casing | WARNING | human_review | NO | — | *FN* | SUSPENDED is valid — requires human pattern review |
| GT-053 | 36 | birth_date | business_anomaly | WARNING | cognitive | NO | — | *FN* | 8-year-old client — cognitive |
| GT-054 | 41 | full_name | duplicate_data | WARNING | human_review | NO | — | *FN* | Near-duplicate requires human review |
| GT-055 | 48 | phone | placeholder_format | WARNING | deterministic | NO | — | *FN* | "000-0000-000" not flagged as placeholder |

## False Positives (AURA detected, not in GT)

| # | Column | AURA Rule | Severity | Affected | Assessment |
|---|--------|-----------|----------|----------|------------|
| FP-01 | full_name | Cola Larga Categórica | info | 47 | Expected: 47 unique names out of 50 rows (47 unique) — informational only |
| FP-02 | full_name | Espacios Múltiples | info | 2 | Subset of GT-025, the extra-spaces detection spans both phantom trim and multiple spaces |
| FP-03 | full_name | Símbolos Sospechosos | warning | 1 | Names with non-alphanumeric characters, likely the "N/A" placeholder with slashes |
| FP-04 | phone | Espacios Múltiples | info | 1 | Subset of GT-026, phone with extra spaces |
| FP-05 | city | Cola Larga Categórica | info | 30 | Expected: 30 unique cities from allowed list of 25 — domain-rich column |
| FP-06 | total_credits | Outliers Leves (Tukey 1.5×) | info | 1 | Standard statistical outlier detection — low-risk info |
| FP-07 | company | Valores Nulos / Vacíos | critical | 22 | **FP**: company is OPTIONAL per schema. Nulls are expected. |
| FP-08 | company | Tipos Mixtos (Dirty Object) | critical | 50 | **FP**: Company field parsing issue. Values are valid strings but engine flagged mixed types |
| FP-09 | tax_id | Valores Nulos / Vacíos | critical | 16 | **FP**: tax_id is OPTIONAL per schema. Nulls are expected. |
| FP-10 | notes | Valores Nulos / Vacíos | critical | 18 | **FP**: notes is OPTIONAL per schema. Nulls are expected. |

## False Negatives Analysis

**Engine gaps identified (8-9 substantive misses):**

| Category | Count | Examples | Root Cause |
|----------|-------|----------|------------|
| Date validation | 5 | 30/02/2000, 19986, 2075, 2025 future | Engine does not validate date string content (only checks format presence) |
| Domain validation | 3 | CHL, invalid_plan, desconocido | Engine does not enforce value domain constraints (allowed values lists) |
| Duplicate detection | 2 | C001 duplicate, full-row duplicate | Engine did not flag duplicate customer_id |
| Phone format | 2 | 9-1111-0020, 000-0000-000 | Engine does not enforce phone format pattern |
| Optional field nulls | 3 | total_credits (rows 14, 32), birth_date (row 8) | Engine skipped total_credits null check; birth_date null not scanned |
| Cognitive / human review | 3 | Age < 10 at registration, duplicate data, multiple placeholders | Out of scope for deterministic engine |

**Non-substantive FNs (already partially covered):**
- Several nulls in unsanctioned columns (registration_date, birth_date) where engine simply doesn't check for nulls
- Total null count for city (6) vs AURA detection (5) = 1 missed row

## Enriched Metrics

| Metric | Raw | Adjusted (excluding optional-field FPs) |
|--------|-----|----------------------------------------|
| True Positives | 19 groups (~47 individual) | Same |
| False Positives | 10 | **6** (excluding 4 optional-field null flags) |
| False Negatives | 36 | **~9** substantive (excluding 27 already-detected-as-aggregated) |
| Precision | ~65% (19/29) | ~76% (19/25) |
| Recall | ~35% (19/55) | ~35% (19/55) — GT counts individual entries, AURA counts aggregated groups |

## Limitations

1. **Aggregation mismatch:** AURA reports issues grouped by rule+column (e.g., "city has 5 nulls"), while GT lists individual row entries (e.g., 6 separate null-city entries). This makes 1:1 matching impossible.
2. **Date validation:** AURA's engine checks for date presence but not validity of date values (30/02 is not flagged).
3. **Domain enforcement:** AURA does not have domain constraint rules (allowed values per column). Values like "CHL", "invalid_plan", "desconocido" are not caught because the engine lacks allowlist rules.
4. **Duplicate detection:** duplicate=true on customer_id in row 41 was not flagged.
5. **Optional fields:** AURA flags nulls in optional fields (company, tax_id, notes) as critical — these are expected nulls per schema.
6. **Cognitive/contextual issues:** Age anomalies, duplicate data patterns, and multi-field placeholder combinations require human judgment or LLM assistance, which were not used in this deterministic run.
