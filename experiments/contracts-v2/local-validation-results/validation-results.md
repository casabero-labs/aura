# Contracts v2 — Local Dataset Validation

**Generated:** 2026-06-24T01:55:08.536Z
**Datasets dir:** /Users/casabero/Documents/GitHub/aura/experiments/datasets

| Status | Count |
|--------|-------|
| PASS | 3 |
| FAIL | 0 |
| UNSUPPORTED | 0 |

## ✅ adult_income.csv

- **Status:** PASS
- **SHA-256:** `23f713bb0be77e6b98690e1b91795e237686a71ee3ca72f5c9890214e011d21f`
- **Size:** 5.0MB
- **Rows:** 48842 × **Cols:** 15
- **Issues:** 12
- **Duplicate columns:** 0
- **Duration:** 3246ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 15.5KB | 15 | 15 | 12 | 0 | 0 |
| local_full_reduced | | 7.8KB | 4 | 5 | 7 | 8 | 0 |
| local_full_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 4617) |
| cloud_minimized_default | | 12.9KB | 15 | 15 | 12 | 0 | 0 |
| cloud_minimized_reduced | | 7.7KB | 4 | 5 | 7 | 8 | 0 |
| cloud_minimized_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 5191) |
| cloud_no_samples_default | | 10.2KB | 0 | 15 | 12 | 0 | 0 |
| cloud_no_samples_reduced | | 6.1KB | 0 | 5 | 7 | 3 | 0 |
| cloud_no_samples_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 4472) |

## ✅ synthetic_ground_truth.csv

- **Status:** PASS
- **SHA-256:** `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`
- **Size:** 1.3KB
- **Rows:** 15 × **Cols:** 9
- **Issues:** 16
- **Duplicate columns:** 0
- **Duration:** 8ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 15.2KB | 18 | 9 | 16 | 1 | 0 |
| local_full_reduced | | 7.2KB | 0 | 5 | 10 | 8 | 0 |
| local_full_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 4866) |
| cloud_minimized_default | | 13.0KB | 18 | 9 | 16 | 1 | 0 |
| cloud_minimized_reduced | | 7.7KB | 0 | 5 | 10 | 8 | 0 |
| cloud_minimized_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 5440) |
| cloud_no_samples_default | | 9.2KB | 0 | 9 | 16 | 1 | 0 |
| cloud_no_samples_reduced | | 6.8KB | 0 | 5 | 10 | 3 | 0 |
| cloud_no_samples_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 4721) |

## ✅ titanic.csv

- **Status:** PASS
- **SHA-256:** `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`
- **Size:** 58.9KB
- **Rows:** 891 × **Cols:** 12
- **Issues:** 10
- **Duplicate columns:** 0
- **Duration:** 31ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 13.0KB | 15 | 12 | 10 | 2 | 0 |
| local_full_reduced | | 6.1KB | 4 | 5 | 2 | 5 | 0 |
| local_full_tight | | 3.9KB | 0 | 3 | 0 | 4 | 0 |
| cloud_minimized_default | | 13.6KB | 15 | 12 | 10 | 2 | 0 |
| cloud_minimized_reduced | | 6.7KB | 4 | 5 | 2 | 5 | 0 |
| cloud_minimized_tight | | 3.7KB | 0 | 3 | 0 | 4 | 0 |
| cloud_no_samples_default | | 8.6KB | 0 | 12 | 10 | 2 | 0 |
| cloud_no_samples_reduced | | 4.8KB | 0 | 5 | 2 | 3 | 0 |
| cloud_no_samples_tight | | 3.6KB | 0 | 3 | 0 | 2 | 0 |
