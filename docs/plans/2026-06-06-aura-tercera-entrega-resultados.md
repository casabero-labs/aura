# AURA Tercera Entrega Results Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Produce formal, reproducible evidence for AURA third delivery and the scientific article.
**Architecture:** Add a small experimental protocol layer around existing deterministic, benchmark, validation and export services instead of rewriting the product flow.
**Tech Stack:** React 19, TypeScript, Vite, Vitest, PapaParse, WebLLM/Gemini providers, existing `experiments/` scripts.
---

## Task 1: Experiment Protocol Model

**Files:**
- Create: `src/services/benchmark/experimentProtocol.ts`
- Test: `src/__tests__/experimentProtocol.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createExperimentId, evidenceStatusForRun, normalizeExperimentProtocol } from '../services/benchmark/experimentProtocol';

describe('experiment protocol', () => {
  it('normalizes required fields for formal benchmark runs', () => {
    const protocol = normalizeExperimentProtocol({
      dataset: 'synthetic_ground_truth.csv',
      model: 'gemini-2.0-flash',
      providerType: 'cloud',
      inputMode: 'smart_sample',
      temperature: 0.1,
      repetitions: 3,
    });

    expect(protocol.dataset).toBe('synthetic_ground_truth.csv');
    expect(protocol.temperature).toBe(0.1);
    expect(protocol.repetitions).toBe(3);
    expect(protocol.evidenceStatus).toBe('planned');
    expect(createExperimentId(protocol)).toContain('synthetic_ground_truth');
  });

  it('marks failed or incomplete runs as not formal', () => {
    expect(evidenceStatusForRun({ status: 'error', exportPath: '' })).toBe('attempted_failed');
    expect(evidenceStatusForRun({ status: 'completed', exportPath: 'x.json' })).toBe('formal_valid');
  });
});
```

**Step 2: Verify Failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- experimentProtocol
```

Expected: module `experimentProtocol` does not exist.

**Step 3: Implementation**

Create `src/services/benchmark/experimentProtocol.ts` with:

```ts
export type EvidenceStatus = 'planned' | 'attempted_failed' | 'preliminary_valid' | 'formal_valid';

export interface ExperimentProtocolInput {
  dataset: string;
  model: string;
  providerType: 'local' | 'cloud' | 'chrome';
  inputMode: 'smart_sample' | 'prompt_libre';
  temperature: number;
  repetitions?: number;
}

export interface ExperimentProtocol extends Required<ExperimentProtocolInput> {
  evidenceStatus: EvidenceStatus;
  createdAt: string;
}

export const normalizeExperimentProtocol = (input: ExperimentProtocolInput): ExperimentProtocol => ({
  ...input,
  repetitions: input.repetitions ?? 1,
  evidenceStatus: 'planned',
  createdAt: new Date().toISOString(),
});

export const createExperimentId = (protocol: ExperimentProtocol): string => {
  const safeDataset = protocol.dataset.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const safeModel = protocol.model.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  return `${safeDataset}_${protocol.providerType}_${safeModel}_${protocol.inputMode}_t${protocol.temperature}`;
};

export const evidenceStatusForRun = (run: { status: string; exportPath?: string }): EvidenceStatus => {
  if (run.status !== 'completed') return 'attempted_failed';
  return run.exportPath ? 'formal_valid' : 'preliminary_valid';
};
```

**Step 4: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- experimentProtocol
```

Expected: PASS.

## Task 2: Deterministic Results Table Export

**Files:**
- Modify: `experiments/benchmarks/validate_deterministic.ts`
- Create: `docs/tablas/resultados_motor_determinista_por_regla.md`

**Step 1: Write failing test**

Create `experiments/tests/test_deterministic_results_export.js`:

```js
const fs = require('fs');
const path = require('path');

const resultPath = path.resolve(__dirname, '../results/deterministic_validation.json');
const tablePath = path.resolve(__dirname, '../../docs/tablas/resultados_motor_determinista_por_regla.md');

if (!fs.existsSync(resultPath)) throw new Error('Missing deterministic_validation.json');
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
if (!result.metrics) throw new Error('Missing global metrics');
if (!result.details) throw new Error('Missing rule details');
if (!fs.existsSync(tablePath)) throw new Error('Missing markdown table export');
```

**Step 2: Verify Failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/experiments
node tests/test_deterministic_results_export.js
```

Expected: fails until the table exists.

**Step 3: Implementation**

After computing `results` in `validate_deterministic.ts`, write a markdown table with columns:

```md
| Regla ground truth | Estado | Esperado | Detectado |
|---|---|---:|---:|
```

Use `fs.writeFileSync(path.join(__dirname, '../../docs/tablas/resultados_motor_determinista_por_regla.md'), markdown)`.

**Step 4: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/experiments
npx tsx benchmarks/validate_deterministic.ts
node tests/test_deterministic_results_export.js
```

Expected: PASS and markdown table updated.

## Task 3: Formal Benchmark Export Contract

**Files:**
- Modify: `src/services/benchmark/evaluationService.ts`
- Test: `src/__tests__/benchmarkExportContract.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { exportBenchmarkJson } from '../services/benchmark/evaluationService';
import { BenchmarkResult } from '../types';

const baseResult: BenchmarkResult = {
  id: 'run-1',
  provider: 'Gemini',
  providerType: 'cloud',
  inputMode: 'smart_sample',
  model: 'gemini-2.0-flash',
  temperature: 0.1,
  latencyMs: 1000,
  firstTokenMs: 200,
  tokensGenerated: 100,
  tokensPerSecond: 100,
  formatCompliance: true,
  pythonScriptIncluded: true,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'formal_valid',
  startedAt: '2026-06-06T00:00:00.000Z',
  completedAt: '2026-06-06T00:00:01.000Z',
  timestamp: '2026-06-06T00:00:01.000Z',
  status: 'completed',
};

describe('benchmark export contract', () => {
  it('exports evidence status and input mode for article tables', () => {
    const exported = JSON.parse(exportBenchmarkJson([baseResult]));
    expect(exported.experiments[0].config.inputMode).toBe('smart_sample');
    expect(exported.experiments[0].evidenceStatus).toBe('formal_valid');
    expect(exported.summary.experimentCount).toBe(1);
  });
});
```

**Step 2: Verify Failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- benchmarkExportContract
```

Expected: fails because `evidenceStatus` is not exported in experiment entries and summary lacks `experimentCount`.

**Step 3: Implementation**

Add `evidenceStatus` to each `ExperimentEntry` and add `experimentCount` to `summary`.

**Step 4: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- benchmarkExportContract
```

Expected: PASS.

## Task 4: Article Results Skeleton

**Files:**
- Create: `docs/publicacion/aura_resultados_articulo.md`

**Step 1: Create evidence-driven structure**

Add sections:

```md
# AURA resultados para articulo

## Claims permitidos
## Resultados deterministas
## Benchmark LLM
## Ciclo HITL
## Impacto aplicado
## Limites
## Tablas listas para paper
```

**Step 2: Verification**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura
rg -n "Claims permitidos|Benchmark LLM|Limites" docs/publicacion/aura_resultados_articulo.md
```

Expected: all headings found.

## Task 5: Full Verification

**Files:**
- No new files.

**Step 1: Run frontend tests**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test
```

Expected: PASS.

**Step 2: Run deterministic experiment**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/experiments
npx tsx benchmarks/validate_deterministic.ts
```

Expected: updates `experiments/results/deterministic_validation.json`.

**Step 3: Review git scope**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura
git status --short
```

Expected: only third-delivery planning, deterministic result export, and intentional table/result files changed.
