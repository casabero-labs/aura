# Phase 8 — Claims Matrix

## Allowed Claims

| Claim | Status | Supporting Evidence | Limitation | Usable in 4th Delivery | Requires Caution |
|-------|--------|---------------------|------------|------------------------|-------------------|
| Phase 8 defined a controlled dataset protocol | ALLOWED | E8-L2-001 (protocol doc), E8-L2-002 (CSV), E8-L2-003 (schema), E8-L2-004 (ground truth) | Synthetic only; 50 rows, single domain | Yes | Mention synthetic limitation |
| Phase 8 executed a controlled pilot run on synthetic dataset | ALLOWED | E8-L3-001 (audit JSON), E8-L3-002 (issues CSV), E8-L3-003 (detection matrix), E8-L3-004 (summary) | Deterministic only; no AI providers used; precision 65% raw | Yes | Mention no AI providers used |
| Phase 8 separated real providers via opt-in mechanism | ALLOWED | E8-L4-001 (protocol), E8-L4-002 (helper), E8-L4-003 (30 tests), E8-L4-004 (8 E2E specs) | Opt-in mode only; no mandatory provider use | Yes | Mention opt-in constraint |
| Phase 8 classified benchmark evidence to prevent inflated claims | ALLOWED | E8-L5-001 (classifier), E8-L5-002 (26 tests), E8-L5-003 (schema), E8-L5-004 (register) | 0 formal_valid entries; classification only, not execution | Yes | Mention no AI benchmark executed |
| Phase 8 does not constitute final production | ALLOWED | All artifacts (L0-L5) are controlled/synthetic/deterministic | — | Yes | — |
| Phase 8 does not constitute a definitive formal benchmark | ALLOWED | E8-L5-004 shows 0 formal_valid; no AI provider executed | — | Yes | — |
| Demo/production mode boundary is separated by a centralized helper | ALLOWED | E8-L1-001 (20 tests), E8-L1-002 (8 E2E specs), E8-L1-003 (helper) | E2E specs not executed (environmental debt); query-param only | Yes | Mention E2E environmental debt |
| AURA can audit synthetic datasets in deterministic mode | ALLOWED | E8-L3-001, E8-L3-002, E8-L3-003, E8-L3-004 | 29 issues detected, precision 65% raw; aggregation mismatch present | Yes, with caution | Mention precision and aggregation limitations |
| Phase 8 evidence is packaged and traceable | ALLOWED | E8-L6-001 (this package): index, manifest, claims matrix, limitations, README | — | Yes | — |

## Forbidden Claims

| Claim | Status | Why Forbidden |
|-------|--------|---------------|
| AURA is production-ready | FORBIDDEN | All Phase 8 evidence uses synthetic/controlled datasets; no real data validated |
| AURA corrected real datasets | FORBIDDEN | Only synthetic dataset used (controlled_customers_phase8.csv) |
| AURA executes Python internally | FORBIDDEN | Python scripts were generated as candidates for external Colab use, never embedded in AURA runtime |
| Chrome AI / Gemini Nano is always available | FORBIDDEN | Providers are opt-in only; no provider was ever executed in mandatory mode |
| A formal definitive benchmark exists | FORBIDDEN | E8-L5-004 register shows 0 formal_valid; no AI benchmark executed. All entries are planned or attempted_failed |
| Independent external validation exists | FORBIDDEN | No external validation was performed at any point in Phase 8 |
| The fourth delivery is already built | FORBIDDEN | Phase 8 L6 only packages evidence; the fourth delivery is not yet assembled |
| AURA detected all 55 ground truth issues | FORBIDDEN | ~47/55 covered; 6 substantive FPs, 9 substantive FNs |
| AURA's audit score (0/100) reflects final quality | FORBIDDEN | Score reflects deterministic audit only; AI providers not used |
| Phase 8 evidence is sufficient for production deployment | FORBIDDEN | Synthetic datasets, no real providers, no benchmark, no external validation |
