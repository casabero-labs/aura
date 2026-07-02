# Phase 8 Evidence Package — Quick Start Guide

## How to Read This Package

This package organizes all Phase 8 evidence (L0-L5) into a single navigable location. The recommended reading order is:

### 1. Start here: `PHASE8_EVIDENCE_PACKAGE_INDEX.md`

The index gives you the full map: what Phase 8 covers, what each loop produced, and where each artifact lives. Read this first to understand the scope.

### 2. Understand the claims: `PHASE8_CLAIMS_MATRIX.md`

The claims matrix tells you what you CAN say about Phase 8 (allowed claims) and what you MUST NOT say (forbidden claims). Each claim is linked to the evidence that supports it and its limitations.

### 3. Know the risks: `PHASE8_LIMITATIONS_AND_RISKS.md`

Before using any Phase 8 evidence in the fourth delivery, read the limitations. This covers synthetic dataset constraints, typecheck debt, missing provider execution, missing benchmark, and open risks.

### 4. For machine processing: `PHASE8_EVIDENCE_PACKAGE_MANIFEST.json`

The manifest is a machine-readable JSON with all artifacts listed, SHAs, statuses, claims, and limitations. Useful for automated verification or cross-referencing.

## Most Important Artifacts

| Priority | Artifact | Why |
|----------|----------|-----|
| Critical | Pilot run audit JSON (E8-L3-001) | Core evidence of AURA working on controlled data |
| Critical | Detection matrix (E8-L3-003) | TP/FP/FN comparison vs 55 ground truth issues |
| High | Controlled dataset protocol (E8-L2-001) | Proves methodology, not just results |
| High | Benchmark evidence classification (E8-L5-005) | Proves we prevent inflated claims |
| Medium | Provider opt-in protocol (E8-L4-001) | Proves real providers are gated |
| Medium | Demo/production boundary (E8-L1-001 to E8-L1-003) | Proves demo mode cannot leak to production |

## Warnings

1. **This is NOT the fourth delivery.** It is an evidence package. The fourth delivery must be assembled separately.
2. **No real data was used.** All datasets are synthetic (controlled_customers_phase8.csv).
3. **No AI provider was executed.** The pilot run was deterministic only. All providers are opt-in gated.
4. **No formal benchmark exists.** All benchmark entries are planned or attempted_failed.
5. **No external validation was performed.**

## What to Review Before Using in Fourth Delivery

1. Read all claims in `PHASE8_CLAIMS_MATRIX.md` and ensure the fourth delivery only uses allowed claims
2. Read `PHASE8_LIMITATIONS_AND_RISKS.md` and address open risks
3. Verify all SHA values in the manifest match the actual file contents (recompute if needed)
4. Confirm that no forbidden claims appear as positive assertions in the fourth delivery
5. Ensure the fourth delivery includes the required cautions for:
   - Synthetic dataset limitation
   - No AI provider used
   - No formal benchmark
   - No external validation
   - Deterministic-only audit
