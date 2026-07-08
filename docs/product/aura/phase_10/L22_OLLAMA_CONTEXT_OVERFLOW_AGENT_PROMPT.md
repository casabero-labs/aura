# Agent prompt — L22 Ollama context overflow

Work on repo `casabero-labs/aura`.

Problem observed in production:

```text
Ollama error 400: {"error":{"code":400,"message":"request (11256 tokens) exceeds the available context size (4096 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":11256,"n_ctx":4096}}
```

This means Ollama is connected and the selected model is being called. The failure is prompt size versus context window.

Implement a safe fix:

- add an Ollama prompt budget layer;
- estimate or approximate prompt size before sending;
- if provider is Ollama and prompt is too large, use a compact diagnosis prompt;
- cap columns, issues, samples and pretty JSON;
- normalize this error as context overflow, not generic model rejected;
- optionally allow `num_ctx` in Ollama options, but do not rely only on it;
- add tests using mocks.

Do not touch auditEngine, deterministic scoring, freezes or dataset raw-data boundaries.

Run typecheck, build and Ollama/prompt tests.
