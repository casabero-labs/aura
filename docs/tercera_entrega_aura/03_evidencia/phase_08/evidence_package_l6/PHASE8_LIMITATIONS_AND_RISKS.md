# Phase 8 — Limitations and Risks

## Limitations by Category

### Synthetic Dataset Limitations

- All data in L2 and L3 is synthetic (controlled_customers_phase8.csv: 50 rows, 15 columns, single domain)
- Ground truth (55 issues) was designed with knowledge of AURA detection rules, not blind
- Results may not generalize to real-world datasets with unknown schemas, multi-domain data, or larger volumes
- No real customer data was audited or corrected

### Typecheck Limitations

- 8 pre-existing TypeScript errors exist in the codebase:
  - `components/ImprovementRunPanel.tsx` (4 errors): mock objects missing fields from ExecutionSummaryV1, OutputDatasetSummaryV1, ReauditSummaryV1
  - `components/ReviewStep.tsx` (1 error): type mismatch on props
  - `__tests__/scriptGenerationStepV2.test.tsx` (2 errors): missing @testing-library/react and @testing-library/user-event type declarations
  - `tests/e2e/phase7-claims-visible.spec.ts` (2 errors): untyped function calls, unknown property access
- None of these errors are attributable to Phase 8 code
- They are documented as pre-existing debt in L1, L3, and L5 ledgers

### Provider / AI Limitations

- No AI provider (Chrome AI, Ollama, Gemini Cloud, WebLLM) was executed in mandatory mode
- All provider interactions are gated by `AURA_PROVIDER_VALIDATION` opt-in (L4)
- E2E provider specs (phase8-provider-opt-in.spec.ts) are skipped in CI
- E2E boundary specs (phase8-boundary.spec.ts) require Playwright dev server (environmental debt)

### Benchmark Limitations

- No formal AI benchmark was executed (0 formal_valid in register)
- L5 only provides classification infrastructure, not benchmark results
- L3 pilot run was deterministic, not an AI benchmark
- All benchmark entries are planned or attempted_failed

### Validation Limitations

- No external validation was performed at any point
- No independent review of the detection matrix or pilot results
- Pilot run was self-evaluated by the team using known ground truth

### Execution Limitations

- No Python execution within AURA runtime (scripts are external candidates for Colab)
- Improvement run (E8-L3-007) was not generated (requires Colab + reaudit)
- Script and notebook candidates (E8-L3-005, E8-L3-006) were not executed
- No real dataset was processed end-to-end through AURA

### Infrastructure Limitations

- E2E tests require Playwright dev server (not available in current environment)
- Provider E2E tests require `AURA_PROVIDER_VALIDATION` environment variable
- Line ending noise on Windows (CRLF vs LF) is purely cosmetic

## Open Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| 8 pre-existing TypeScript errors could mask new errors | Low | Documented in all ledgers; 0 errors attributable to Phase 8 |
| E2E boundary not executed | Medium | Specs exist and are syntactically valid; requires manual execution with dev server |
| E2E provider opt-in not executed | Medium | Specs exist and are syntactically valid; gated by env var |
| No AI provider validation performed | Medium | Opt-in protocol exists (L4); can be activated with env var |
| Synthetic dataset only | Medium | Documented as controlled; real data testing deferred to future phases |
| Detection matrix aggregation mismatch | Low | Column vs row accounting difference; precision ranges documented (65% raw, 76% adjusted) |
| No external review | High | Documented as limitation; should be addressed before fourth delivery |
| No real benchmark | High | Infrastructure ready (L5 classifier); deferred to future phases |
| Line ending noise on Windows | Low | `git config core.autocrlf false` applied; purely cosmetic |

## Recommendations for L7 (Freeze)

1. Update all SHA references in evidence ledger with final L6 commit SHA
2. Verify all artifact paths are reachable from evidence package
3. Document which open risks must be resolved before fourth delivery vs which can be carried forward
4. Verify no code, tests, services, components, contracts, or phase freezes were modified in Phase 8
5. Confirm Phase 8 did not touch Phase 5, Phase 6, or Phase 7 freezes
6. Generate FREEZE_PHASE8.md with final snapshot of all Phase 8 evidence
