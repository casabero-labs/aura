/**
 * Contracts v2 — Vite Import Smoke Test.
 * Verifies that contracts/llm/index.ts imports cleanly into Vite's build graph
 * without node:crypto or other Node-only dependencies causing failures.
 */

import { describe, it, expect } from 'vitest';

describe('Contracts v2 — Vite bundle compatibility', () => {
  it('imports Contracts v2 index without node:crypto errors', async () => {
    // Dynamic import to verify no build-time side effects
    const mod = await import('../contracts/llm/index');
    expect(mod).toBeDefined();
    expect(typeof mod.buildColumnRegistry).toBe('function');
    expect(typeof mod.buildEvidenceEnvelopeV2).toBe('function');
    expect(typeof mod.sha256hex).toBe('function');
  });

  it('sha256hex works in browser-like environment', async () => {
    const { sha256hex } = await import('../contracts/llm/index');
    const h = sha256hex('test');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('buildColumnRegistry works without node:crypto', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/index');
    const cols = buildColumnRegistry(['A', 'B', 'C']);
    expect(cols).toHaveLength(3);
    expect(cols[0].columnId).toMatch(/^col:[a-f0-9]{16}$/);
  });

  it('hashValue works without node:crypto', async () => {
    const { hashValue } = await import('../contracts/llm/index');
    const h = hashValue('sensitive data');
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
