# Phase 5 Loop 4 — Cierre Reauditoría Post-Ejecución

> **Estado:** cerrado
> **Loop:** Phase 5 L4
> **Fecha:** 2026-07-01
> **Base:** Phase 5 Loop 3 (`eefe9c5a4467117a72da6d465991ee611d46435a`)

## 1. Entregable

**`src/services/reauditService.ts`** — servicio de reauditoría que importa output de Colab como fixture controlado y produce `ReauditSummaryV1` y `OutputDatasetSummaryV1`.

### Interfaces

```ts
export interface ReauditSummaryV1 {
  beforeEvidenceEnvelopeRef: string;
  afterEvidenceEnvelopeRef: string;
  beforeIssueCount: number;
  afterIssueCount: number;
  rulesCompared: string[];
}

export interface OutputDatasetSummaryV1 {
  rowCountBefore: number;
  rowCountAfter: number;
  columnCountBefore: number;
  columnCountAfter: number;
  outputFingerprint: string;
  changedCellsEstimate: number | null;
  exportedCsvRef: string | null;
}

export interface ColabOutput {
  data: Record<string, any>[];
  fields: string[];
  fingerprint: string;
  rowCount: number;
  colCount: number;
  delimiter: string;
  rawCsv: string;
}

export interface ReauditOptions {
  delimiter?: string;
  beforeEvidenceRef?: string;
  afterEvidenceRef?: string;
  datasetName?: string;
}

export interface ReauditResult {
  summary: ReauditSummaryV1;
  output: OutputDatasetSummaryV1;
  beforeReport: AuditReport;
  afterReport: AuditReport;
  beforeOutput: ColabOutput;
  afterOutput: ColabOutput;
}
```

### Funciones

| Función | Rol |
|---|---|
| `importColabOutput(csv, options?)` | Parsea CSV de output Colab, calcula fingerprint SHA256, retorna `ColabOutput` |
| `parseCsvString(csv, delimiter?)` | Wrapper de PapaParse para strings CSV |
| `computeCsvFingerprint(csv)` | SHA256 del CSV (para fingerprinting) |
| `buildEnvelopeRef(fingerprint, prefix?)` | Genera `env:<16-char-hash>` refs |
| `computeChangedCellsEstimate(before, after)` | Cuenta celdas cambiadas entre before/after |
| `runReaudit(beforeCsv, afterCsv, beforeEvidenceRef, options?)` | Orchestrates full reaudit pipeline |

### Pipeline

```
beforeCsv (fixture)
  → importColabOutput → parseCsvString → runAudit(before)
afterCsv (Colab output as fixture)
  → importColabOutput → parseCsvString → runAudit(after)
  → compare issue counts → build ReauditSummaryV1 + OutputDatasetSummaryV1
```

### Protocolo de ejecución manual en Colab

1. Ejecutar `executeControlledRun()` (L3) → genera notebook Colab
2. Subir notebook a Google Colab
3. Ejecutar celdas en orden → descarga `dataset_corregido.csv`
4. Importar `dataset_corregido.csv` como CSV string en AURA via `importColabOutput()`
5. Llamar `runReaudit(beforeCsv, afterCsv, beforeEvidenceRef)` → `ReauditSummaryV1`

## 2. Tests

**39 tests** en `src/__tests__/reauditService.test.ts`:

| Categoría | Tests | Cubren |
|---|---|---|
| parseCsvString | 7 | basic, delimiters, empty, skipEmpty, quoted fields |
| computeCsvFingerprint | 4 | deterministic, different content, hex format, trim |
| buildEnvelopeRef | 3 | format, custom prefix, deterministic |
| importColabOutput | 5 | basic import, throws empty, forced delimiter, fingerprint, row count |
| computeChangedCellsEstimate | 5 | no changes, count changes, column mismatch, column names differ, row count diff |
| runReaudit | 6 | ReauditSummaryV1, OutputDatasetSummaryV1, reports, outputs, custom refs, empty throws |
| Integration | 3 | before→after issue reduction, scores computed, rulesCompared |

## 3. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 errores** |
| `npm run build` | **exitoso** (3.11s) |
| `npm test -- --run reauditService` | **39 passed** |
| `npm test -- --run executionService` | **17 passed** |
| `npm test -- --run preflightCheck` | **17 passed** |
| `npm test -- --run runtimeSandbox` | **42 passed** |

## 4. Restricciones cumplidas

- No ejecuta Python dentro de AURA.
- Solo acepta fixtures CSV controlados (nunca dataset real del usuario).
- No implementa HealthDelta.
- No modifica contratos v2 existentes.
- No toca evidencia congelada Phase 3 ni Phase 4.
- No afirma mejora medida formalmente (issue counts son datos, no claims).
- `ReauditSummaryV1` documenta before/after sin ocultar cambios.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/reauditService.ts` | **Creado** |
| `src/__tests__/reauditService.test.ts` | **Creado** |

## 6. Claims

**Permitidos tras L4:**
- AURA puede importar output CSV de Colab como fixture controlado.
- `ReauditSummaryV1` vincula `beforeEvidenceEnvelopeRef` y `afterEvidenceEnvelopeRef`.
- `OutputDatasetSummaryV1` registra row/column counts y fingerprint del output.
- `beforeIssueCount` y `afterIssueCount` son comparables.
- `changedCellsEstimate` cuantifica cambios a nivel de celda.
- `runAudit` del motor determinista de AURA es reutilizable en reauditoría.

**No permitidos todavía:**
- HealthDelta real (delta de score, status improved/unchanged/worsened).
- Ejecución Python real dentro de AURA.
- Reauditoría automática post-Colab (requiere import manual del output).
- ImprovementRunV1 completo con todos los campos.

## 7. Próximo paso: Phase 5 Loop 5

Completar `ImprovementRunV1` con:
- `OutputDatasetSummaryV1` linkeado al output de Colab importado.
- `ReauditSummaryV1` linkeado a before/after evidence refs.
- `HealthDeltaV1` (status improved/unchanged/worsened, score delta, caveats).
- Integración del flujo completo: execute → import output → reaudit → delta.
- Tests E2E del flujo completo.
