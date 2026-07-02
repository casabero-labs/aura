# Phase 8 — Evidence Package Index

## Purpose

This package consolidates all evidence generated during Phase 8 loops L0 through L5 into a single navigable, traceable location. It serves as the foundation for the fourth documentary delivery, without redacting the delivery itself yet.

## Scope

- Phase 8 L0: Planning and evidence ledger initialization
- Phase 8 L1: Demo/production boundary hardening
- Phase 8 L2: Controlled dataset protocol
- Phase 8 L3: Controlled pilot run (deterministic only)
- Phase 8 L4: Provider validation opt-in protocol
- Phase 8 L5: Benchmark evidence classification

## What this package contains

- Complete artifact inventory with paths, SHAs, status, and limitations
- Claims matrix (allowed vs forbidden) per artifact
- Limitations and risks register
- Manifest in machine-readable JSON
- Quick-start README for reviewers

## What this package does NOT contain

- The fourth documentary delivery (not yet assembled)
- New technical capabilities (L6 is packaging only)
- Real dataset audits (only synthetic controlled datasets used)
- Production-ready claims
- Formal benchmark results (no AI benchmark executed)
- External validation evidence (none performed)

## Relationship L0-L5

| Loop | Name | Artifact Count | Status |
|------|------|----------------|--------|
| L0 | Plan + Ledger | 2 | Complete |
| L1 | Demo/Prod Boundary | 8 | Complete |
| L2 | Controlled Dataset | 6 | Complete |
| L3 | Controlled Pilot Run | 12 | Complete |
| L4 | Provider Opt-in | 5 | Complete |
| L5 | Benchmark Classification | 6 | Complete |
| **L6** | **Evidence Package Export** | **5** (this package) | **In progress** |

## Artifact Table by Loop

### L0 — Planning

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L0-001 | Phase 8 Plan | `../../05_desarrollo/phases/phase_08/PHASE8_PLAN.md` |
| E8-L0-002 | Evidence Ledger | `../../05_desarrollo/phases/phase_08/PHASE8_EVIDENCE_LEDGER.md` |

### L1 — Demo/Prod Boundary

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L1-001 | Demo mode tests | `../../../../../src/__tests__/demoMode.test.ts` (20/20 passed) |
| E8-L1-002 | E2E boundary specs | `../../../../../src/tests/e2e/phase8-boundary.spec.ts` (8 specs, environmental debt) |
| E8-L1-003 | Demo mode helper | `../../../../../src/utils/demoMode.ts` |
| E8-L1-004 | Demo banner UI | `../../../../../src/components/ImprovementRunPanel.tsx` |
| E8-L1-005 | Flags documentation | `../../05_desarrollo/phases/phase_08/CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md` |
| E8-L1-006 | L1 closure | `../../05_desarrollo/phases/phase_08/CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md` |

### L2 — Controlled Dataset

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L2-001 | Dataset protocol | `../../05_desarrollo/phases/phase_08/CONTROLLED_DATASET_PROTOCOL.md` |
| E8-L2-002 | Synthetic CSV | `../datasets/controlled_customers_phase8.csv` |
| E8-L2-003 | Dataset schema | `../datasets/controlled_customers_phase8.schema.json` |
| E8-L2-004 | Ground truth | `../datasets/controlled_customers_phase8_ground_truth.json` (55 issues) |
| E8-L2-005 | Claims | `../datasets/controlled_customers_phase8_claims.md` |
| E8-L2-006 | Cross-validation | Script externo (integrity verified) |

### L3 — Controlled Pilot Run

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L3-001 | Audit JSON | `../pilot_run_l3/aura_audit_controlled_customers_phase8.json` |
| E8-L3-002 | Issues CSV | `../pilot_run_l3/aura_issues_controlled_customers_phase8.csv` |
| E8-L3-003 | Detection matrix | `../pilot_run_l3/controlled_customers_phase8_detection_matrix.md` |
| E8-L3-004 | Pilot summary | `../pilot_run_l3/controlled_customers_phase8_pilot_summary.md` |
| E8-L3-005 | Script candidate | `../pilot_run_l3/script_candidate_controlled_customers_phase8.py` |
| E8-L3-006 | Notebook candidate | `../pilot_run_l3/notebook_candidate_controlled_customers_phase8.json` |
| E8-L3-007 | Improvement run | *not_generated* (requires Colab execution) |
| E8-L3-008 | Pilot manifest | `../pilot_run_l3/pilot_run_manifest.json` |
| E8-L3-009 | L3 closure | `../../05_desarrollo/phases/phase_08/CIERRE_LOOP3_CONTROLLED_PILOT_RUN.md` |
| E8-L3-010 | Build verification | Build succeed (9.88s) |
| E8-L3-011 | Typecheck | 8 pre-existing errors (0 attributable to L3) |
| E8-L3-012 | Standalone script | `../../../../../src/phase8_pilot_audit.ts` |

### L4 — Provider Opt-in

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L4-001 | Provider protocol | `../../05_desarrollo/phases/phase_08/PROVIDER_VALIDATION_OPT_IN_PROTOCOL.md` |
| E8-L4-002 | Opt-in helper | `../../../../../src/utils/providerOptIn.ts` |
| E8-L4-003 | Opt-in tests | `../../../../../src/__tests__/providerOptIn.test.ts` (30/30 passed) |
| E8-L4-004 | E2E opt-in specs | `../../../../../src/tests/e2e/phase8-provider-opt-in.spec.ts` (skipped by default) |
| E8-L4-005 | L4 closure | `../../05_desarrollo/phases/phase_08/CIERRE_LOOP4_PROVIDER_VALIDATION_OPT_IN.md` |

### L5 — Benchmark Evidence Classification

| ID | Artifact | Relative Path |
|----|----------|---------------|
| E8-L5-001 | Classification helper | `../../../../../src/utils/benchmarkEvidenceClassification.ts` |
| E8-L5-002 | Classification tests | `../../../../../src/__tests__/benchmarkEvidenceClassification.test.ts` (26/26 passed) |
| E8-L5-003 | Benchmark schema | `../benchmark/benchmark_evidence_schema.json` |
| E8-L5-004 | Evidence register | `../benchmark/benchmark_evidence_register.md` |
| E8-L5-005 | Classification doc | `../../05_desarrollo/phases/phase_08/BENCHMARK_EVIDENCE_CLASSIFICATION.md` |
| E8-L5-006 | L5 closure | `../../05_desarrollo/phases/phase_08/CIERRE_LOOP5_BENCHMARK_EVIDENCE_CLASSIFICATION.md` |

## Intended Use for Fourth Delivery

This package provides the raw evidence base for the future fourth documentary delivery. Reviewers should:

1. Start with `PHASE8_EVIDENCE_README.md` for a guided tour
2. Use `PHASE8_EVIDENCE_PACKAGE_MANIFEST.json` for machine-readable metadata
3. Consult `PHASE8_CLAIMS_MATRIX.md` to verify which claims are substantiated
4. Review `PHASE8_LIMITATIONS_AND_RISKS.md` before making any assertions about Phase 8

## Limitations

- All datasets are synthetic/controlled (no real data used)
- No AI provider was executed in mandatory mode
- No formal benchmark was executed (all planned or attempted_failed)
- No external validation was performed
- No Python execution within AURA
- 8 pre-existing TypeScript errors documented in L1-L5 ledgers
- E2E specs require Playwright server (environmental debt)

## Warning

**This is NOT the fourth documentary delivery.** It is an evidence package that organizes and indexes the Phase 8 evidence generated across L0-L5. The fourth delivery must be assembled separately in a future phase, drawing at most from this evidence base.
