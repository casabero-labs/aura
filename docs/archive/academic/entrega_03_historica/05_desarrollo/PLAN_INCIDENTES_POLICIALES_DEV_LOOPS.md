# AURA Incidentes Policiales Dev Loops Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Convert the Incidentes_Policiales test run into closed dev loops that first stabilize the human export/session flow and then improve AURA's semantic detection beyond Gemini Nano.
**Architecture:** Evidence-first dev loops: stabilize UX/export/session, then add deterministic semantic rules, then produce a comparison artifact.
**Tech Stack:** React, TypeScript, Vitest, Playwright, PapaParse, jsPDF, graphify, repomix-output.xml.
---

## Baseline Evidence

- Source folder: `experiments/tests/`.
- Dataset: `experiments/tests/Incidentes_Policiales.csv`.
- Local CSV facts: 10,048 rows, 7 columns.
- Browser/app facts: `src/services/csvService.ts` now parses the full CSV by default; `preview` is only available as an explicit optional parameter for controlled tests.
- Deterministic audit reproduced from code:
  - Full 10,048 rows: score 95, 5 issues, `truncated=false`.
- Gemini Nano report:
  - Repeats deterministic findings.
  - Treats `CrimeId` as symbols/outliers.
  - Does not detect that 319 `CrimeId` values are actually `Disposition` vocabulary values.
- Main semantic gap:
  - `CrimeId` non-numeric values: 319 / 10,048 = 3.17%.
  - All 319 overlap `Disposition`: `Handled/Advised`, `Not Recorded`, `Arrest/Citation`, `Gone/Unable to Locate`.
  - Example affected row: `City=160920001`, `CrimeId=Handled/Advised`, `Disposition=Traffic/Parking/Sidewalk`, `OriginalCrimeTypeName=None`.
- UI/PDF gap:
  - Browser-print PDFs include blank trailing pages.
  - Script review code appears horizontally compressed.
  - Review metadata can concatenate text (`requeridaafecta...`).
  - Export E2E only checks button visibility, not actual download success.

## Non-Negotiable Loop Rules

1. Do not start Loop 2 until Loop 1 passes unit, build, E2E, and visual/human-flow validation.
2. Do not add Pyodide or real Python execution in Loop 1.
3. Do not claim the script was executed if the app only ran deterministic simulation.
4. Do not compare Gemini Nano against AURA without stating whether the evidence came from a historical 5,000-row preview or the current full-CSV parser.
5. After code changes, run `graphify update .`.

## Loop 1: AURA-EXPORT-SESSION-01

**Outcome:** A user can complete review, see the full script legibly, export artifacts, reload without losing the session, and explicitly destroy the session at the end.

### Task 1: Fix Script Layout
**Files:**
- Modify: `src/index.css`
- Test: `src/tests/e2e/aura-development-loops.spec.ts`

**Step 1: Write failing E2E assertion**

Add assertions after script generation and review:

```ts
const scriptLines = reviewStage.locator('.script-line');
await expect(scriptLines.first()).toBeVisible();
const firstBox = await scriptLines.nth(0).boundingBox();
const secondBox = await scriptLines.nth(1).boundingBox();
expect(secondBox!.y).toBeGreaterThan(firstBox!.y);
await expect(reviewStage.locator('.script-scroll')).not.toHaveJSProperty('scrollWidth', 0);
```

**Step 2: Verify Failure**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: layout assertion fails because `.script-code` lays lines horizontally.

**Step 3: Implementation**

Change the script code block to a vertical, wrapping layout:

```css
.script-code {
  display: block;
  padding: 2px var(--space-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.script-line {
  display: grid;
  grid-template-columns: 28px auto minmax(0, 1fr);
  gap: var(--space-sm);
  border-bottom: 1px solid var(--border-faint);
}

.script-line code {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

**Step 4: Verify Success**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: script lines stack vertically and review remains approvable.

### Task 2: Add Pipeline Session Snapshot Service
**Files:**
- Create: `src/services/pipelineSession.ts`
- Create: `src/__tests__/pipelineSession.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { clearPipelineSession, loadPipelineSession, savePipelineSession } from '../services/pipelineSession';

describe('pipelineSession', () => {
  beforeEach(() => localStorage.clear());

  it('saves and restores serializable pipeline data without raw File objects', () => {
    savePipelineSession({
      state: 'export',
      file: new File(['a,b\n1,2'], 'demo.csv', { type: 'text/csv' }),
      report: { rowCount: 1, colCount: 2 } as any,
      auditEvidence: null,
      rawData: [{ a: 1, b: 2 }],
      csvFields: ['a', 'b'],
      csvDelimiter: ',',
      cleaningScript: 'print("ok")',
      approvedScript: 'print("ok")',
      healthDelta: null,
      aiAnalysis: 'diagnosis',
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
    });

    const restored = loadPipelineSession();
    expect(restored?.state).toBe('export');
    expect(restored?.file).toBeNull();
    expect(restored?.fileMeta?.name).toBe('demo.csv');
  });

  it('clears the saved session', () => {
    localStorage.setItem('aura_pipeline_session_v1', '{}');
    clearPipelineSession();
    expect(loadPipelineSession()).toBeNull();
  });
});
```

**Step 2: Verify Failure**
Command: `cd src && npm test -- pipelineSession`
Expected: module missing.

**Step 3: Implementation**

Implement a small storage adapter:

```ts
import { PipelineData } from '../components/MainPipeline';

const STORAGE_KEY = 'aura_pipeline_session_v1';

export type PipelineSessionSnapshot = Omit<PipelineData, 'file'> & {
  file: null;
  fileMeta?: { name: string; size: number; type: string; lastModified: number };
  savedAt: string;
};

export const toPipelineSessionSnapshot = (data: PipelineData): PipelineSessionSnapshot => ({
  ...data,
  file: null,
  fileMeta: data.file ? {
    name: data.file.name,
    size: data.file.size,
    type: data.file.type,
    lastModified: data.file.lastModified,
  } : undefined,
  savedAt: new Date().toISOString(),
});

export const savePipelineSession = (data: PipelineData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toPipelineSessionSnapshot(data)));
};

export const loadPipelineSession = (): PipelineSessionSnapshot | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PipelineSessionSnapshot;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearPipelineSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};
```

**Step 4: Verify Success**
Command: `cd src && npm test -- pipelineSession`
Expected: tests pass.

### Task 3: Integrate Restore And Destroy Session In App
**Files:**
- Modify: `src/App.tsx`
- Test: `src/tests/e2e/aura-development-loops.spec.ts`

**Step 1: Write failing E2E**

Add to the end of the flow:

```ts
await page.reload();
await expect(page.locator('[data-testid="export-stage"]')).toBeVisible();
await expect(page.getByText(/Tu evidencia está lista/i)).toBeVisible();
await page.getByRole('button', { name: /Cerrar y destruir sesión/i }).click();
await expect(page.getByText(/Sesión destruida/i)).toBeVisible();
await page.reload();
await expect(page.locator('input[type="file"]')).toBeVisible();
```

**Step 2: Verify Failure**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: reload loses state and destroy button is missing.

**Step 3: Implementation**

In `App.tsx`:
- Initialize `pipelineData` from `loadPipelineSession()` if present.
- Save when `pipelineData.report` exists.
- Add `handleDestroySession()`:

```ts
const handleDestroySession = () => {
  clearPipelineSession();
  setPipelineData(INITIAL_PIPELINE_DATA);
  setHasExported(false);
  setPdfProgressStatus('idle');
  setPdfProgressMsg('Sesion destruida');
};
```

Render a secondary action in export stage:

```tsx
<button className="btn-s" onClick={handleDestroySession}>
  Cerrar y destruir sesión
</button>
```

**Step 4: Verify Success**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: reload restores export state, destroy clears it.

### Task 4: Make PDF Export Testable And Robust
**Files:**
- Modify: `src/services/pdfGenerator.ts`
- Create: `src/__tests__/pdfGenerator.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing unit test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { generatePdfReport } from '../services/pdfGenerator';

it('generates a PDF when the approved script has long lines', () => {
  const saveSpy = vi.fn();
  const longScript = Array.from({ length: 140 }, (_, i) =>
    `df["very_long_column_${i}"] = df["very_long_column_${i}"].astype(str).str.strip().str.lower()`
  ).join('\n');

  expect(() => generatePdfReport(fakeAuditReport(), {
    ...fakeExecutiveContent(),
    python_script: longScript,
  }, 'diagnosis', fakeScriptValidation(), saveSpy)).not.toThrow();
  expect(saveSpy).toHaveBeenCalled();
});
```

**Step 2: Verify Failure**
Command: `cd src && npm test -- pdfGenerator`
Expected: test helper/injection missing.

**Step 3: Implementation**

Refactor `generatePdfReport` to accept an optional save callback and return metadata:

```ts
export const generatePdfReport = (
  auditReport: AuditReport,
  executiveContent: ExecutiveReportContent,
  llmDiagnosis?: string,
  scriptValidation?: ScriptValidationResult,
  save: (doc: jsPDF, filename: string) => void = (doc, filename) => doc.save(filename)
) => {
  // build doc...
  addFooters();
  const filename = 'Aura_Data_Lab_Diagnostico.pdf';
  save(doc, filename);
  return { filename, pageCount: doc.getNumberOfPages() };
};
```

While writing script lines, check page break for every wrapped fragment before `doc.text(...)`.

**Step 4: Verify Success**
Commands:
- `cd src && npm test -- pdfGenerator`
- `cd src && npm run build`
Expected: no thrown PDF generation errors.

### Task 5: Assert Real Downloads In E2E
**Files:**
- Modify: `src/tests/e2e/aura-development-loops.spec.ts`

**Step 1: Write failing download checks**

```ts
const [pdfDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Reporte PDF ejecutivo/i }).click(),
]);
expect(pdfDownload.suggestedFilename()).toMatch(/\\.pdf$/);

const [jsonDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /JSON técnico/i }).click(),
]);
expect(jsonDownload.suggestedFilename()).toMatch(/\\.json$/);
```

**Step 2: Verify Failure**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: fails until PDF export and download event are stable.

**Step 3: Implementation**
Use Task 4 export changes and keep download buttons in export stage.

**Step 4: Verify Success**
Command: `cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts`
Expected: PDF and JSON downloads are captured.

### Loop 1 Final Gate

Run:

```bash
cd src
npm test
npm run build
npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts
cd ..
graphify update .
```

Manual/human validation:
- Load `experiments/tests/Incidentes_Policiales.csv`.
- Complete upload -> profile -> diagnosis -> script -> review -> export.
- Confirm script lines are readable without horizontal-only layout.
- Confirm PDF, JSON, issues CSV, and script downloads work.
- Reload and confirm session restoration.
- Destroy session and confirm reload starts fresh.

Stop condition:
- If any command or human-flow check fails, do not start Loop 2.

## Loop 2: AURA-INCIDENTES-SEMANTIC-01

**Outcome:** AURA detects the semantic issue Gemini Nano missed: ID/categorical column leakage and probable column shift/coalescence.

### Task 1: Lock The Incidentes Failure As A Test
**Files:**
- Modify: `src/__tests__/auditEngine.test.ts`

**Step 1: Write failing synthetic test**

```ts
it('detects ID column contamination by neighboring categorical vocabulary', () => {
  const rows = [
    { City: '160920001', CrimeId: 'Handled/Advised', Disposition: 'Traffic/Parking/Sidewalk', OriginalCrimeTypeName: '' },
    { City: 'San Francisco', CrimeId: 160903280, Disposition: 'Report Taken', OriginalCrimeTypeName: 'Violent Crime/Assault' },
    { City: 'San Francisco', CrimeId: 160912272, Disposition: 'Gone/Unable to Locate', OriginalCrimeTypeName: 'Homeless Related' },
    { City: '160920002', CrimeId: 'Not Recorded', Disposition: 'Suspicious Activity', OriginalCrimeTypeName: '' },
  ];

  const report = runAudit(rows, ['City', 'CrimeId', 'Disposition', 'OriginalCrimeTypeName'], ',');
  expect(report.issues.some(issue =>
    issue.ruleName === 'Contaminación Semántica de ID' &&
    issue.column === 'CrimeId'
  )).toBe(true);
});
```

**Step 2: Verify Failure**
Command: `cd src && npm test -- auditEngine`
Expected: rule does not exist.

**Step 3: Implementation**

Add deterministic helper logic in `src/services/auditEngine.ts`:

```ts
const looksLikeIdentifierColumn = (col: string, stats: ColumnStats) => {
  const lower = col.toLowerCase();
  return lower.includes('id') || lower.endsWith('code') || lower.endsWith('key') || stats.semanticType === 'uuid';
};

const detectVocabularyLeakage = (
  field: string,
  values: any[],
  allFields: string[],
  data: Record<string, any>[],
  rowCount: number
) => {
  const foreignVocabulary = new Set<string>();
  allFields
    .filter(other => other !== field)
    .forEach(other => {
      const otherValues = data.map(row => row[other]).filter(v => typeof v === 'string').map(normalizeCategoryValue);
      const unique = new Set(otherValues);
      if (unique.size > 1 && unique.size <= Math.max(50, rowCount * 0.2)) {
        unique.forEach(value => foreignVocabulary.add(value));
      }
    });

  const hits = values
    .map(value => normalizeCategoryValue(value))
    .filter(value => value && foreignVocabulary.has(value));

  return { count: hits.length, samples: Array.from(new Set(hits)).slice(0, 5) };
};
```

If an ID-like column has leakage >= 1% and at least 3 rows, push:
- ruleName: `Contaminación Semántica de ID`
- category: `IssueCategory.SEMANTIC`
- severity: `IssueSeverity.WARNING`
- description: ID column contains values that match another categorical vocabulary; probable column shift, coalescence, or ETL mapping error.

**Step 4: Verify Success**
Command: `cd src && npm test -- auditEngine`
Expected: new rule fires on synthetic fixture.

### Task 2: Fix False Positive Rule Gates Exposed By Incidentes
**Files:**
- Modify: `src/services/auditEngine.ts`
- Modify: `src/__tests__/auditEngine.test.ts`

**Step 1: Add failing tests**

Add three assertions:
- `CallDateTime` ISO values must not be reported as `Números Disfrazados`.
- `Disposition` must not be treated as URL just because it contains the substring `sitio`.
- `OriginalCrimeTypeName` values with `/` must not be treated as suspicious symbols when the column is categorical, not an identifier.

**Step 2: Verify Failure**
Command: `cd src && npm test -- auditEngine`
Expected: current rules still flag at least one false positive.

**Step 3: Implementation**

Specific changes:
- Skip disguised-number rule when `looksLikeDateTimeColumn(col, values, rowCount)` is true.
- Replace `lower.includes('sitio')` URL hint with token-boundary matching, not substring matching.
- Restrict symbol chaos to ID/name-person columns, not any column containing `name` when cardinality is low categorical taxonomy.

**Step 4: Verify Success**
Command: `cd src && npm test -- auditEngine`
Expected: synthetic Incidentes-like fixture reports the semantic leakage, not misleading URL/date/symbol issues.

### Loop 2 Final Gate

Run:

```bash
cd src
npm test -- auditEngine
npm test
npm run build
cd ..
graphify update .
```

Stop condition:
- Do not start Loop 3 until the new rule catches `CrimeId` leakage and the exposed false positives are removed.

## Loop 3: AURA-GEMINI-COMPARISON-01

**Outcome:** Produce a reproducible comparison artifact for Incidentes Policiales.

Files:
- Create: `docs/tercera_entrega_aura/03_evidencia/results/incidentes_policiales_aura_vs_gemini.md`
- Create or update: `docs/tercera_entrega_aura/04_resultados/resultados_benchmark_llm.md`

Required content:
- Dataset profile: full rows vs app preview rows.
- AURA before Loop 2: score 79, 8 issues, truncated.
- AURA after Loop 2: expected new semantic rule and reduced false positives.
- Gemini Nano: detected generic issues but missed cross-column leakage.
- Claim boundary: Gemini output is interpretive; AURA deterministic output is reproducible only for the processed row set.

Verification:
- File cites exact commands and outputs.
- No absolute claim such as "Gemini failed" without context; say "Gemini Nano no identifico este patron en la corrida analizada".

## Loop 4: AURA-PDF-EVIDENCE-01

**Outcome:** Exported PDFs become evidence artifacts, not browser-print screenshots with blank pages.

Scope:
- Harden `src/services/pdfGenerator.ts` for executive report.
- Add a separate "captura de flujo humano" artifact only if needed.
- Improve print CSS only after the jsPDF export path is stable.

Validation:
- Render generated PDFs with `pdftoppm`.
- Inspect all pages for blank trailing pages, clipped code, headers/footers, and legible hierarchy.

## Loop 5: AURA-PYTHON-EXECUTION-DECISION-01

**Outcome:** Decide, with evidence, whether AURA should execute Python in browser, export a notebook/script for Colab, or keep only script download + deterministic simulation.

### Decision (ver `DECISION_EJECUCION_PYTHON_AURA.md` para detalle completo)

- **Recommended (next step): Option B — export `.ipynb` notebook for Google Colab.**
- **Discarded as sole path: Option C — keep only script + deterministic JS simulation.**
- **Medium-term goal: Option A — Pyodide in browser, conditional on COOP/COEP infra resolution.**

Spike evidence: Pyodide npm v0.26.4 available, WASM core ~10 MB (jsDelivr CDN). Cold start estimated 10-25s. Headless Chromium spike timed out at 30s (possible CDN block). Colab notebook viable with 0 KB bundle increase, simple tests.

Execution contract defined for both paths: input CSV + approved script → corrected CSV + execution log + hash + audited delta.

Next loop proposed: **AURA-COLAB-EXPORT-01** — implement `.ipynb` export from AURA export section.

### Loop 5b: AURA-COLAB-EXPORT-01 (COMPLETED)

**Outcome:** Implemented `.ipynb` notebook export for Google Colab via `src/services/colabExporter.ts`.

- 11 unit tests pass (nbformat 4, privacy warning, script verbatim, re-audit instructions).
- Botón "Notebook Colab" en sección export, habilitado solo con script aprobado.
- E2E verifica descarga `.ipynb`, presencia de `"nbformat": 4` y advertencia de privacidad.
- Contrato de ejecución: el notebook incluye upload de CSV, lectura pandas, ejecución de clean_dataset, descarga de corregido, y checklist post-ejecución.
- Claim permitido: "AURA exporta un notebook ejecutable externo para Google Colab."

### Loop 5c: AURA-COLAB-REAL-DELTA-01 (COMPLETED)

**Outcome:** Validated external Python execution against a controlled fixture, producing real delta evidence re-audited with the official AURA `runAudit` engine (not a JS minimal reimplementation).

- Fixture: `experiments/tests/fixtures/incidentes_semantic_sample.csv` (10 rows, CrimeId contaminated).
- Script: `experiments/tests/fixtures/incidentes_clean_script.py` (flags contamination, normalizes City, trims spaces; preserves evidence via auxiliary columns).
- Wrapper: `experiments/tests/run_audit_wrapper.ts` — TypeScript thin wrapper invoked via `npx tsx` that calls `runAudit` from `src/services/auditEngine.ts`.
- Runner: `experiments/tests/run_colab_delta_fixture.mjs` (Python external → corrected CSV → tsx+runAudit on both → delta JSON).
- Real re-audit results: `beforeScore=65` (5 issues), `afterScore=26` (7 issues). Score worsens: the script corrects Caos de Capitalización but introduces critical issues via auxiliary columns (Tipos Mixtos on crimeid_original, Valores Nulos/Vacíos on crimeid_correction_note). Score decrease is honest evidence that the script's evidence-preserving design (auxiliary columns) has a runAudit cost.
- Test: `src/__tests__/colabDeltaFixture.test.ts` (19 tests) validates delta JSON with `reAuditEngine="aura_runAudit"`, full beforeReport/afterReport, correctedRules, newRulesAfterScript, y `remediationClassification: "source_debt_preserved"`.
- Claim permitido: "Se ejecutó Python externo sobre fixture controlado y el resultado fue re-auditado con el motor determinista oficial de AURA (runAudit vía tsx). La remediación preserva trazabilidad, pero el score oficial no mejora debido a la deuda preexistente en CrimeId."
- No permitido: "AURA ejecuta Python internamente." / "Validado en Colab real." / "El script mejora el score."

Do not begin until Loops 1-4 pass.

### Loop 5d: AURA-SCRIPT-SCORING-ALIGNMENT-01 (COMPLETED)

**Outcome:** Confirmed that on this fixture, no remediation strategy improves the runAudit score. CrimeId was already broken in the original (mixed types, contamination); any fix introduces new issues. The "preservation with debt" claim is honest.

Estrategia aplicada:
- No inventar CrimeId numéricos (constraint: no fake IDs).
- Placeholder no-tóxico: "CORRUPTED_ID_REQUIRES_SOURCE_REVIEW" (string, no slashes).
- Auxiliary columns completas: crimeid_original (valor original conservado), crimeid_corrupted (flag booleano), crimeid_correction_note (nota de corrección).
- No dejar CrimeId nulo: se usa placeholder en lugar de np.nan.

Resultado bajo runAudit oficial:
- Score: 65 → 26 (delta −39).
- Causa raíz del empeoramiento:
  1. crimeid_correction_note es columna mixed-type (strings + NaN float para filas limpias) → critical null penalty.
  2. crimeid_original conserva los datos originales contaminados → sigue disparando Contaminación Semántica de ID, Tipos Mixtos, Símbolos Sospechosos.
  3. El placeholder "CORRUPTED_ID_REQUIRES_SOURCE_REVIEW" en CrimeId mantiene tipo mixto (5 numeric strings + 5 placeholder strings).
- Lo único que mejora: Caos de Capitalización (City normalizado).
- La Contaminación Semántica de ID migra de CrimeId a crimeid_original (evidencia preservada, no destruida).

Claim permitido:
> "La remediación externa preserva trazabilidad (crimeid_original, crimeid_corrupted, crimeid_correction_note), pero el score oficial bajo runAudit no mejora. La deuda de CrimeId es de origen, no remediável a nivel de columna sin inventar datos."

Limitaciones:
- Fixture pequeño (10 filas).
- El score no mejora bajo ninguna estrategia de remediación probada.
- La solución real para CrimeId requiere intervención en el sistema fuente, no corrección a nivel de CSV.

Do not begin until Loop 5c passes.

### Loop 7: AURA-SOURCE-DEBT-GOVERNANCE-01 (COMPLETED)

**Outcome:** Distinguish "remediation that improves quality" vs "preservation of source debt" so the UI, PDF, manifest, and claims correctly reflect the CrimeId case without asserting false improvement.

Changes applied:
- `evidenceManifest.ts`: Nuevo parámetro `remediationClassification?: 'source_debt_preserved' | 'improvement'`. Cuando `source_debt_preserved`: artifact `sourceDebtEvidence (delta JSON)` + limitaciones específicas de deuda de fuente.
- `pdfGenerator.ts`: Nueva sección "Preservacion de Deuda de Fuente" en PDF cuando `healthDelta.scoreDelta <= 0`. Caja roja con mensaje de advertencia.
- `ReviewStep.tsx`: Nuevo estado de warning cuando `scoreDelta < 0 || criticalDelta > 0`. Mensaje: "Preservación de deuda de fuente: el score no mejora."
- `App.tsx`: Pasa `improvementRun?.healthDelta ?? null` como 6to parámetro a `generatePdfReport`.
- `colabDeltaFixture.test.ts`: +4 tests para `remediationClassification` (15 → 19 tests).
- `evidenceManifest.test.ts`: +2 tests para `source_debt_preserved` (sourceDebtEvidence artifact, limitaciones).
- Delta fixture runner: `remediationClassification: "source_debt_preserved"` en JSON de resultado.

Clasificación de remediación:
- `improvement`: `scoreDelta > 0 && criticalDelta <= 0`
- `source_debt_preserved`: todo lo demás (score no mejora o critical empeora)

Claims:
- Permitido: "La remediación preserva deuda de fuente: el score no mejora bajo runAudit porque la deuda de CrimeId es de origen."
- No permitido: "AURA ejecuta Python internamente." / "El script mejora el score cuando delta < 0."

Gates: 261 tests pass, build pass, graphify 1389 nodes.

Do not begin until Loop 5d passes.

## Prompt For Agent 2: Loop 1 Only

```text
Trabaja en /Users/casabero/Documents/GitHub/aura. Eres agente 2 ejecutor del loop AURA-EXPORT-SESSION-01. No avances a reglas semanticas, Pyodide ni cambios de benchmark.

Objetivo cerrado: que un humano complete review -> export, vea el script completo de forma legible, descargue PDF/JSON/script, recargue sin perder la sesion, y pueda cerrar/destruir la sesion con confirmacion.

Lee primero:
- AGENTS.md
- docs/tercera_entrega_aura/05_desarrollo/PLAN_INCIDENTES_POLICIALES_DEV_LOOPS.md
- src/App.tsx
- src/components/MainPipeline.tsx
- src/components/ScriptGenerationStep.tsx
- src/components/ReviewStep.tsx
- src/components/ScriptReview.tsx
- src/services/pdfGenerator.ts
- src/index.css
- src/tests/e2e/aura-development-loops.spec.ts

Tareas:
1. Corrige el layout del script para que las lineas se apilen verticalmente y puedan envolver texto largo sin quedar como franja horizontal.
2. Crea servicio de sesion local serializable para PipelineData sin guardar File crudo.
3. Integra restauracion y destruccion explicita de sesion en App.
4. Refactoriza export PDF para poder probarlo y para que scripts largos no rompan el PDF.
5. Amplia el E2E para verificar descargas reales, restore por reload y destroy por reload.

Gates obligatorios:
- cd src && npm test
- cd src && npm run build
- cd src && npm run test:e2e -- tests/e2e/aura-development-loops.spec.ts
- cd .. && graphify update .

Stop condition:
Si falla cualquier gate o si el humano no puede completar el flujo, no abras Loop 2. Reporta el fallo exacto, archivo/linea y siguiente fix minimo.
```
