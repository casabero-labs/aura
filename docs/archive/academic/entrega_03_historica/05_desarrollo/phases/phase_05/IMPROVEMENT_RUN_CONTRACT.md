# ImprovementRunV1 — contrato documental preliminar

> **Estado:** diseño preliminar para Phase 5  
> **No implementado:** este documento no autoriza ejecución todavía.

## 1. Rol del contrato

`ImprovementRunV1` será el artefacto que registre una ejecución controlada de un `ScriptContractV2` aprobado contra una copia del dataset original.

Su función es vincular:

```text
contrato aprobado
→ ejecución controlada
→ dataset resultante
→ reauditoría
→ HealthDelta
→ exportación
```

## 2. Principio de diseño

Un `ImprovementRunV1` no debe demostrar intención, sino resultado medido. Si el delta es cero o negativo, el contrato debe registrarlo sin suavizarlo.

## 3. Campos propuestos

```ts
export interface ImprovementRunV1 {
  contractId: 'aura.improvement_run.v1';
  contractVersion: '1.0.0';

  runId: string;
  createdAt: string;

  sourceDatasetFingerprint: string;
  sourceEvidenceEnvelopeRef: string;

  scriptContractRef: string;
  scriptHash: string;
  remediationPlanId: string;
  acceptedActionIds: string[];

  execution: ExecutionSummaryV1;
  outputDataset: OutputDatasetSummaryV1;
  reaudit: ReauditSummaryV1;
  healthDelta: HealthDeltaV1;

  limitations: string[];
  claims: {
    permitted: string[];
    prohibited: string[];
  };
}
```

## 4. ExecutionSummaryV1

```ts
export interface ExecutionSummaryV1 {
  runtime: 'pyodide' | 'local_python' | 'other';
  runtimeVersion: string;
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  sandbox: {
    networkDisabled: boolean;
    filesystemRestricted: boolean;
    timeoutMs: number;
    memoryLimitMb: number | null;
    allowedImports: string[];
  };
}
```

## 5. OutputDatasetSummaryV1

```ts
export interface OutputDatasetSummaryV1 {
  rowCountBefore: number;
  rowCountAfter: number;
  columnCountBefore: number;
  columnCountAfter: number;
  outputFingerprint: string;
  changedCellsEstimate: number | null;
  exportedCsvRef: string | null;
}
```

## 6. ReauditSummaryV1

```ts
export interface ReauditSummaryV1 {
  beforeEvidenceEnvelopeRef: string;
  afterEvidenceEnvelopeRef: string;
  beforeIssueCount: number;
  afterIssueCount: number;
  rulesCompared: string[];
}
```

## 7. HealthDeltaV1

```ts
export interface HealthDeltaV1 {
  status: 'improved' | 'unchanged' | 'worsened' | 'inconclusive';
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  issueDelta: number;
  summary: string;
  caveats: string[];
}
```

## 8. Bloqueos obligatorios

Debe bloquearse la ejecución si:

- el contrato no fue aprobado;
- el hash no coincide;
- el fingerprint del dataset cambió;
- hay acciones pendientes o rechazadas dentro del script;
- el runtime no puede aislar la ejecución;
- el script contiene imports fuera de lista blanca;
- `clean_dataset` no existe.

## 9. Evidencia mínima para cerrar Phase 5

Phase 5 no puede cerrarse solo con ejecución. Debe dejar:

- tests unitarios;
- E2E de ejecución controlada;
- dataset fixture;
- `ImprovementRunV1` exportado;
- reauditoría reproducible;
- HealthDelta documentado;
- capturas y manifest;
- claims permitidos y prohibidos.
