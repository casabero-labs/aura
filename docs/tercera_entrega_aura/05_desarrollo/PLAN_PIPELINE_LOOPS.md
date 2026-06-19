# AURA Pipeline Matrix And Development Loops Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Convert AURA's six visible pipeline stages into academic development loops with clear evidence, objectives, weaknesses, strengths and E2E gates.
**Architecture:** Keep the current pipeline intact and add structured planning data, UI matrix, tests and third-delivery documentation around the existing flow.
**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Markdown docs.
---

## Task 1: Pipeline Matrix Contract

**Files:**
- Create: `src/services/pipelineDevelopmentMatrix.ts`
- Test: `src/__tests__/pipelineDevelopmentMatrix.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { PIPELINE_DEVELOPMENT_MATRIX, PIPELINE_STAGE_ORDER } from '../services/pipelineDevelopmentMatrix';

describe('AURA pipeline development matrix', () => {
  it('covers the six visible stages', () => {
    expect(PIPELINE_STAGE_ORDER).toEqual(['upload', 'profile', 'diagnosis', 'script', 'review', 'export']);
    expect(PIPELINE_DEVELOPMENT_MATRIX).toHaveLength(6);
  });
});
```

**Step 2: Verify Failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- pipelineDevelopmentMatrix
```

Expected: module does not exist.

**Step 3: Implementation**

Create a typed matrix with one row per `PipelineState`. Each row must include:

- `currentState`
- `reviewRequirement`
- `strengths`
- `weaknesses`
- `developmentObjectives`
- `loop.id`
- `loop.visibleResult`
- `loop.e2eGate`

**Step 4: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- pipelineDevelopmentMatrix
```

Expected: PASS.

## Task 2: Visible Matrix In AURA

**Files:**
- Create: `src/components/PipelineDevelopmentMatrix.tsx`
- Modify: `src/components/DevelopmentLoopsPanel.tsx`
- Modify: `src/index.css`
- Test: `src/tests/e2e/aura-development-loops.spec.ts`

**Step 1: Write failing E2E assertions**

```ts
await expect(page.getByRole('heading', { name: /Relacion entre flujo actual/i })).toBeVisible();
await expect(page.getByRole('columnheader', { name: 'Lo que tenemos actualmente' })).toBeVisible();
await expect(page.getByTestId('pipeline-matrix-row-upload')).toContainText('Subir CSV');
```

**Step 2: Verify Failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm run test:e2e
```

Expected: matrix heading and rows are missing.

**Step 3: Implementation**

Render the matrix below the existing development loops. Use a real table with contained horizontal scroll, stage icons and the columns requested by the review workflow:

- Etapa
- Lo que tenemos actualmente
- Requerido por la revision
- Fortalezas
- Debilidades
- Objetivos de desarrollo
- Loop y puerta E2E

**Step 4: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm run test:e2e
```

Expected: PASS.

## Task 3: Third-Delivery Documentation

**Files:**
- Create/modify: `docs/tercera_entrega_aura/02_metodologia/MATRIZ_PIPELINE_DESARROLLO_AURA.md`
- Modify: `docs/tercera_entrega_aura/00_LEEME.md`

**Step 1: Write document structure**

The document must include:

- executive reading;
- matrix by the six AURA stages;
- development directive;
- recommended loop sequence;
- completion criterion.

**Step 2: Verification**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura
rg -n "MATRIZ_PIPELINE_DESARROLLO_AURA|Subir CSV|L03-A|Criterio de cierre" docs/tercera_entrega_aura
```

Expected: index and matrix document are discoverable.

## Task 4: Next Loop L02-A/L02-B

**Files:**
- Modify: `src/components/FileUpload.tsx`
- Modify: `src/components/ProfileStep.tsx`
- Modify: `src/services/executionEvidence.ts`
- Modify: `src/services/auditEngine.ts`
- Create/Modify: `experiments/benchmarks/validate_deterministic.ts`
- Create: `src/__tests__/ingestionEvidence.test.ts`
- Create: `src/__tests__/deterministicRuleMetrics.test.ts`
- Create: `src/tests/e2e/aura-ingestion-profile.spec.ts`

**Step 1: Write failing tests**

Add tests that require:

- dataset protocol metadata;
- ingestion evidence in exported JSON;
- rule-level metrics with TP, FP, FN, precision, recall and F1;
- E2E upload fixture -> profile -> evidence feedback.

**Step 2: Implementation**

Add protocol metadata and deterministic validation exports without changing the existing upload/profile flow.

**Step 3: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test
npm run test:e2e
```

Expected: PASS.

## Task 5: Next Loop L03-A

**Files:**
- Modify: `src/components/BenchmarkLab.tsx`
- Modify: `src/services/benchmark/evaluationService.ts`
- Modify: `src/services/benchmarkService.ts`
- Create: `src/__tests__/benchmarkEvidenceStatus.test.ts`
- Create: `src/tests/e2e/aura-benchmark-lab.spec.ts`

**Step 1: Write failing tests**

Require each benchmark row/export to include:

- dataset;
- model;
- provider;
- input mode;
- temperature;
- repetition;
- evidence status;
- hallucination/unsupported-claim metrics.

**Step 2: Implementation**

Add formal status labels: planned, attempted_failed, preliminary_valid and formal_valid.

**Step 3: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- benchmarkEvidenceStatus
npm run test:e2e -- aura-benchmark-lab
```

Expected: PASS.

## Task 6: Next Loop L04-A/L04-B/L05-A

**Files:**
- Modify: `src/services/scriptValidationService.ts`
- Modify: `src/components/ScriptGenerationStep.tsx`
- Modify: `src/components/ReviewStep.tsx`
- Modify: `src/services/improvementService.ts`
- Modify: `src/App.tsx`
- Create: `src/__tests__/hitlDecisionEvidence.test.ts`
- Create: `src/tests/e2e/aura-hitl-export.spec.ts`

**Step 1: Write failing tests**

Require:

- script validation score;
- destructive operation policy;
- structured HITL decision;
- health delta table;
- export completeness checklist by objective.

**Step 2: Implementation**

Convert review/export into evidence-producing gates for TFM and article claims.

**Step 3: Verify Success**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test
npm run test:e2e
npm run build
```

Expected: PASS and no console errors in browser validation.
