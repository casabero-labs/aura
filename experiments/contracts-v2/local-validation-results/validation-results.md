# Contracts v2 — Local Dataset Validation

**Generated:** 2026-06-25T03:51:35.139Z
**Datasets dir:** /Users/casabero/Documents/GitHub/aura/experiments/datasets

| Status | Count |
|--------|-------|
| PASS | 3 |
| FAIL | 0 |
| UNSUPPORTED | 3 |

## Remediation (Phase 3)

| Metric | Value |
|--------|-------|
| Plans built | 3 |
| Plans valid | 3 |
| planHashStable | true |
| unsafeUpgrades | 0 |
| invalidReferences | 0 |

## ⚠️ .DS_Store

- **Status:** UNSUPPORTED
- **SHA-256:** `N/A`
- **Size:** N/A
- **Rows:** 0 × **Cols:** 0
- **Issues:** 0
- **Duplicate columns:** 0
- **Duration:** 0ms
- **Error:** Unsupported extension: (none)

## ⚠️ README.md

- **Status:** UNSUPPORTED
- **SHA-256:** `N/A`
- **Size:** N/A
- **Rows:** 0 × **Cols:** 0
- **Issues:** 0
- **Duplicate columns:** 0
- **Duration:** 0ms
- **Error:** Unsupported extension: .md

## ⚠️ synthetic_ground_truth.json

- **Status:** UNSUPPORTED
- **SHA-256:** `N/A`
- **Size:** N/A
- **Rows:** 0 × **Cols:** 0
- **Issues:** 0
- **Duplicate columns:** 0
- **Duration:** 0ms
- **Error:** Unsupported extension: .json

## ✅ adult_income.csv

- **Status:** PASS
- **SHA-256:** `23f713bb0be77e6b98690e1b91795e237686a71ee3ca72f5c9890214e011d21f`
- **Size:** 5.0MB
- **Rows:** 48842 × **Cols:** 15
- **Issues:** 12
- **Duplicate columns:** 0
- **Duration:** 3222ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 15.2KB | 15 | 15 | 12 | 0 | 0 |
| local_full_reduced | | 7.2KB | 0 | 5 | 7 | 8 | 0 |
| local_full_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 5835) |
| cloud_minimized_default | | 13.4KB | 0 | 15 | 12 | 0 | 0 |
| cloud_minimized_reduced | | 7.8KB | 0 | 5 | 7 | 8 | 0 |
| cloud_minimized_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 6409) |
| cloud_no_samples_default | | 13.1KB | 0 | 15 | 12 | 0 | 0 |
| cloud_no_samples_reduced | | 7.7KB | 0 | 5 | 7 | 3 | 0 |
| cloud_no_samples_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 5690) |

**Remediation Plan:** ✅ Valid
- **planId:** `plan:bb4d70d4`
- **planHash:** `327f5b6e6dc1d9d8` (stable: true)
- **Actions:** 12 total · 0 auto_safe · 12 review_only
- **Exclusions:** 0 not_actionable
- **Pending:** 12
- **unsafeUpgrades:** 0
- **invalidReferences:** 0
- **validation:** ✅ PASS (0 errors)

## ✅ synthetic_ground_truth.csv

- **Status:** PASS
- **SHA-256:** `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`
- **Size:** 1.3KB
- **Rows:** 15 × **Cols:** 9
- **Issues:** 16
- **Duplicate columns:** 0
- **Duration:** 10ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 12.4KB | 0 | 9 | 16 | 1 | 0 |
| local_full_reduced | — | — | — | — | — | — | Cannot reduce envelope to 8000 chars (actual: 8611) |
| local_full_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 6017) |
| cloud_minimized_default | | 13.0KB | 0 | 9 | 16 | 1 | 0 |
| cloud_minimized_reduced | — | — | — | — | — | — | Cannot reduce envelope to 8000 chars (actual: 9185) |
| cloud_minimized_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 6591) |
| cloud_no_samples_default | | 12.7KB | 0 | 9 | 16 | 1 | 0 |
| cloud_no_samples_reduced | — | — | — | — | — | — | Cannot reduce envelope to 8000 chars (actual: 8184) |
| cloud_no_samples_tight | — | — | — | — | — | — | Cannot reduce envelope to 4000 chars (actual: 5872) |

**Remediation Plan:** ✅ Valid
- **planId:** `plan:91c4fcd1`
- **planHash:** `64b6d2c7ed93a0f7` (stable: true)
- **Actions:** 16 total · 0 auto_safe · 16 review_only
- **Exclusions:** 0 not_actionable
- **Pending:** 16
- **unsafeUpgrades:** 0
- **invalidReferences:** 0
- **validation:** ✅ PASS (0 errors)

## ✅ titanic.csv

- **Status:** PASS
- **SHA-256:** `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`
- **Size:** 58.9KB
- **Rows:** 891 × **Cols:** 12
- **Issues:** 10
- **Duplicate columns:** 0
- **Duration:** 33ms

| Level | Budget | Size | Samples | Columns | Issues | Trunc | PII Leaks |
|-------|--------|------|---------|---------|--------|-------|-----------|
| local_full_default | | 15.5KB | 15 | 12 | 10 | 2 | 0 |
| local_full_reduced | | 6.8KB | 4 | 5 | 2 | 5 | 0 |
| local_full_tight | | 3.7KB | 0 | 3 | 0 | 4 | 0 |
| cloud_minimized_default | | 13.9KB | 15 | 12 | 10 | 2 | 0 |
| cloud_minimized_reduced | | 7.4KB | 4 | 5 | 2 | 5 | 0 |
| cloud_minimized_tight | | 3.7KB | 0 | 3 | 0 | 4 | 0 |
| cloud_no_samples_default | | 11.1KB | 0 | 12 | 10 | 2 | 0 |
| cloud_no_samples_reduced | | 5.5KB | 0 | 5 | 2 | 3 | 0 |
| cloud_no_samples_tight | | 3.7KB | 0 | 3 | 0 | 2 | 0 |

**Remediation Plan:** ✅ Valid
- **planId:** `plan:15734607`
- **planHash:** `8119fc5f52ec31fc` (stable: true)
- **Actions:** 9 total · 0 auto_safe · 9 review_only
- **Exclusions:** 1 not_actionable
- **Pending:** 9
- **unsafeUpgrades:** 0
- **invalidReferences:** 0
- **validation:** ✅ PASS (0 errors)
