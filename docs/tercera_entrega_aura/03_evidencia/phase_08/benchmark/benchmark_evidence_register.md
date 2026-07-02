# Phase 8 L5 — Benchmark Evidence Register

## Tabla de registro de corridas benchmark

| ID | Dataset | Provider | Model | Execution Mode | Input Mode | Classification | Reason | Evidence File | Claim Allowed | Limitation | Status |
|----|---------|----------|-------|---------------|------------|----------------|--------|---------------|---------------|------------|--------|
| bench-001 | controlled_customers_phase8 | — | — | deterministic | — | planned | Deterministic audit executed in L3, not an AI benchmark. | aura_audit_controlled_customers_phase8.json | Deterministic audit engine detected 29 issues on controlled dataset. | Not an AI provider benchmark. Deterministic only. | L3 completed |
| bench-002 | controlled_customers_phase8 | chrome_ai | gemini-nano | chrome_ai | recommended | planned | Chrome AI not available in current environment. Provider validation requires opt-in (AURA_PROVIDER_VALIDATION=chrome). | — | Chrome AI opt-in infrastructure is ready for validation. | Provider availability is enviroment-dependent. No download was attempted. | Planned |
| bench-003 | controlled_customers_phase8 | ollama | gemma3:1b (or any local) | ollama_local | recommended | planned | Ollama validation requires opt-in (AURA_PROVIDER_VALIDATION=ollama) + Ollama running on localhost:11434. | — | Ollama opt-in infrastructure is ready for validation. | Requires Ollama installed and running locally. | Planned |
| bench-004 | controlled_customers_phase8 | gemini | gemini-2.5-flash | cloud | recommended | attempted_failed | Gemini Cloud requires API key in Settings (VITE_GEMINI_API_KEY). No key configured in current environment. | — | Gemini Cloud opt-in infrastructure is ready when API key is available. | Requires API key. Do not upload keys. | Planned |
| bench-005 | — | webllm | any | webllm_experimental | — | planned | WebLLM is experimental. Not a production provider. Use only for research comparisons. | — | WebLLM is available experimentally but should NOT be used as a production benchmark claim. | Experimental mode. Do not reactivate as production. Do not download models in CI. | Out of scope |

## Estados de clasificación aplicados

| Classification | Runs in this register |
|----------------|-----------------------|
| planned | bench-001, bench-002, bench-003, bench-005 |
| attempted_failed | bench-004 (no API key) |
| preliminary_valid | None — no runs meet minimum criteria (completed + dataset + provider + output exported) |
| formal_valid | None — no runs meet all formal criteria (3+ repetitions, comparative table, limitations, human review) |

## Notes

- bench-001 is classified as `planned` (not `formal_valid`) because the L3 pilot run was deterministic, not an AI-powered run. It does not test AI provider behavior, hallucination, or model latency. Classifying it as `formal_valid` would be misleading.
- No run in this register is classified as `preliminary_valid` because no AI provider run has been actually executed yet. All AI provider entries are planned or attempted_failed.
- The register is designed to be updated when real opt-in validation runs are performed manually.
