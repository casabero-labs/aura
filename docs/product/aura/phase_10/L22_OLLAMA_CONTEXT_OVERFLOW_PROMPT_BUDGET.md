# L22 — Ollama context overflow and prompt budget

## Context

Production now shows the real Ollama error body:

```text
request (11256 tokens) exceeds the available context size (4096 tokens), try increasing it
```

This confirms that the local Ollama connection and selected model propagation are working. The remaining failure is prompt size versus model context.

## Root problem

AURA sends a diagnosis prompt that can exceed the context window of the selected local model. For the observed dataset, the request reached 11,256 prompt tokens while the model context was 4,096.

## Product interpretation

This is not a connectivity failure. It is a local model capacity mismatch:

- Ollama is connected.
- The model is selected.
- `/api/chat` is reached.
- The model rejects the request because the prompt is too large.

## Required follow-up

Implement an Ollama-specific prompt budget layer:

1. Estimate prompt size before sending to Ollama.
2. If provider is Ollama and prompt is above safe budget, generate a compact prompt.
3. Cap structured payloads:
   - top risky columns only;
   - top findings only;
   - short sample values;
   - no full pretty JSON when not needed.
4. Surface UI message:

```text
El modelo local no tiene suficiente ventana de contexto para este diagnóstico. AURA enviará una versión compacta del paquete.
```

5. Optionally allow configurable `num_ctx` for Ollama, but do not rely on it as the only fix.

## Constraints

- Do not touch deterministic scoring.
- Do not touch auditEngine.
- Do not touch freezes.
- Do not send raw dataset.
- Use mocks for tests.
