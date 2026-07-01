# Phase 5 Loop 3 — Cierre Ejecución sobre Copia Controlada

> **Estado:** cerrado  
> **Loop:** Phase 5 L3  
> **Fecha:** 2026-07-01  
> **Base:** Phase 5 Loop 2 (`7fdbd8959429946b95667c091dd191070ec9f499`)

## 1. Entregable

**`src/services/executionService.ts`** — servicio de ejecución controlada que integra preflight, sandbox y preparación de contexto de ejecución sobre copia de fixture.

### Interfaces

```ts
export interface ExecutionSummaryV1 {
  runtime: 'colab_notebook' | 'pyodide' | 'other';
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

export interface ControlledExecutionResult {
  execution: ExecutionSummaryV1;
  preflightBlocked: boolean;
  sandboxBlocked: boolean;
  fixtureApplied: boolean;
  datasetOriginalIntact: boolean;
  gates: {
    preflight: PreflightResult;
    sandbox: SandboxExecutionResult | null;
  };
}
```

### Pipeline

```text
contract → Gate 1: preflightCheck → Gate 2: executeSandboxed → fixture copy → colab_notebook → ExecutionSummaryV1
```

Si cualquier gate falla → `status: 'blocked'`/`'failed'`, `fixtureApplied: false`, `datasetOriginalIntact: true`.

### Funciones

| Función | Rol |
|---|---|
| `executeControlledRun(contract, plan, ctx, fingerprint, options?)` | Pipeline completo de ejecución controlada |
| `cloneFixture(fixture)` | Clona el fixture sin modificar el original |
| `detectCsvColumns(csv)` | Extrae columnas del header CSV |
| `countCsvRows(csv)` | Cuenta filas (excluyendo header) |

## 2. Tests

**17 tests** en `src/__tests__/executionService.test.ts`:

| Categoría | Tests | Cubren |
|---|---|---|
| Successful execution | 6 | contrato builder-generado, ExecutionSummaryV1 completo, fixture intacto, logs estructurados, runtime colab_notebook, conteo filas/columnas |
| Preflight blocked | 3 | fingerprint mismatch, hash tampered, acceptedActionIds phantom |
| Sandbox gate | 1 | sandbox pasa para contrato builder-generado |
| Default options | 2 | sin fixture explícito, sandbox config por defecto |
| Fail-closed | 3 | primer gate falla, fixture no aplicado, gates reportados |
| Fixture metadata | 2 | detección columnas/filas, 0 filas para header-only |

## 3. Pruebas ejecutadas

- `npm run typecheck` — **0 errores**
- `npm run build` — **exitoso** (3.63s)
- `npm test -- --run` — **1150 passed, 6 skipped** (1 error pre-existente: `scriptGenerationStepV2.test.tsx` worker timeout)

## 4. Restricciones cumplidas

- No ejecuta dataset real del usuario (solo fixtures controlados).
- Fixture original intacto (operación sobre copia con `cloneFixture`).
- No implementa HealthDelta.
- No implementa reauditoría post-ejecución.
- No modifica contratos v2 existentes.
- No toca evidencia congelada Phase 3 ni Phase 4.
- No afirma mejora medida ni dataset corregido formalmente.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/executionService.ts` | **Creado** |
| `src/__tests__/executionService.test.ts` | **Creado** |

## 6. Pendientes para Loop 4

El siguiente loop (Phase 5 L4) debe implementar reauditoría post-ejecución reusando `EvidenceEnvelopeV2` sobre el dataset limpio, con before/after evidence refs y auditoría reproducible.

## 7. Claims

**Permitidos tras L3:**
- AURA dispone de un pipeline de ejecución controlada que valida preflight, sandbox y opera sobre copia de fixture.
- El pipeline delega ejecución Python real a runtime externo (Colab notebook).
- El dataset original permanece intacto en todo momento.
- `ExecutionSummaryV1` registra runtime, status, logs, sandbox config y timestamps.

**No permitidos todavía:**
- Ejecución Python real dentro de AURA.
- Dataset corregido por pipeline formal de Phase 5.
- HealthDelta real.
- Reauditoría post-ejecución.
