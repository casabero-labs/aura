# Cierre Loop 2 — ImprovementRunPanel Type Fixtures

## Objetivo

Resolver los 3 errores `mock_type_mismatch` (DEBT-003, DEBT-004, DEBT-005) del baseline TypeScript en `components/ImprovementRunPanel.tsx`, completando los fixtures del visual harness para que cumplan las interfaces `ExecutionSummaryV1`, `OutputDatasetSummaryV1` y `ReauditSummaryV1` sin modificar los contratos.

## Errores objetivo

| ID | Linea | Error TS | Descripcion |
| -- | ----- | -------- | ----------- |
| DEBT-003 | 82 | TS2740 | `execution` mock incompleto — faltan `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, `error`, `sandbox` |
| DEBT-004 | 83 | TS2739 | `outputDataset` mock incompleto — faltan `outputFingerprint`, `exportedCsvRef` |
| DEBT-005 | 87 | TS2353 | `reaudit` mock incluye `beforeReport`/`afterReport` inexistentes en `ReauditSummaryV1` |

## Causa encontrada

El visual harness (activado via `?demoMode=1` con `?phase7Visual=running`) contiene mocks literales que representan `ImprovementRunV1`. Estos mocks fueron escritos antes de que los contratos `ExecutionSummaryV1`, `OutputDatasetSummaryV1` y `ReauditSummaryV1` alcanzaran su forma final. Los mocks quedaron desactualizados respecto a las interfaces reales.

Los tipos completos (de `src/services/`):

**ExecutionSummaryV1** exige: `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, `error`, `sandbox` (con `networkDisabled`, `filesystemRestricted`, `timeoutMs`, `memoryLimitMb`, `allowedImports`).

**OutputDatasetSummaryV1** exige: `outputFingerprint`, `exportedCsvRef`.

**ReauditSummaryV1** define: `beforeEvidenceEnvelopeRef`, `afterEvidenceEnvelopeRef`, `beforeIssueCount`, `afterIssueCount`, `rulesCompared`. No incluye `beforeReport` ni `afterReport`.

## Solucion aplicada

### execution (DEBT-003) — linea 82

Campos agregados: `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, `error`, `sandbox`.

```typescript
// Antes
execution: { status: 'success', runtime: 'colab_notebook', logs: [] },

// Despues
execution: {
  status: 'success', runtime: 'colab_notebook',
  runtimeVersion: '1.0.0',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 0,
  logs: [],
  error: null,
  sandbox: {
    networkDisabled: true,
    filesystemRestricted: true,
    timeoutMs: 30000,
    memoryLimitMb: 512,
    allowedImports: []
  }
},
```

### outputDataset (DEBT-004) — linea 83

Campos agregados: `outputFingerprint`, `exportedCsvRef`.

```typescript
// Antes
outputDataset: { rowCountBefore: 3, ..., changedCellsEstimate: 3 },

// Despues
outputDataset: {
  rowCountBefore: 3, rowCountAfter: 3,
  columnCountBefore: 4, columnCountAfter: 4,
  outputFingerprint: 'sha256:visual-fixture',
  changedCellsEstimate: 3,
  exportedCsvRef: null
},
```

### reaudit (DEBT-005) — lineas 84-89

Campos removidos: `beforeReport`, `afterReport`. Campos agregados: `beforeEvidenceEnvelopeRef`, `afterEvidenceEnvelopeRef`, `rulesCompared`.

```typescript
// Antes
reaudit: {
  beforeIssueCount: 3, afterIssueCount: 0,
  beforeReport: { score: 75, ... },
  afterReport: { score: 100, ... },
},

// Despues
reaudit: {
  beforeEvidenceEnvelopeRef: 'env:visual-before',
  afterEvidenceEnvelopeRef: 'env:visual-after',
  beforeIssueCount: 3,
  afterIssueCount: 0,
  rulesCompared: [],
},
```

Verificacion: el codigo de renderizado solo consume `reaudit.beforeIssueCount` y `reaudit.afterIssueCount` (lineas 343-344). Los campos `beforeReport`/`afterReport` no eran leidos por ningun componente visual — eran residuos de un diseno anterior del mock.

## Campos agregados/corregidos

| Modificacion | Campo | Valor |
| ------------ | ----- | ----- |
| Agregado | `execution.runtimeVersion` | `'1.0.0'` |
| Agregado | `execution.startedAt` | `new Date().toISOString()` |
| Agregado | `execution.finishedAt` | `new Date().toISOString()` |
| Agregado | `execution.durationMs` | `0` |
| Agregado | `execution.error` | `null` |
| Agregado | `execution.sandbox` | `{ networkDisabled: true, ... }` |
| Agregado | `outputDataset.outputFingerprint` | `'sha256:visual-fixture'` |
| Agregado | `outputDataset.exportedCsvRef` | `null` |
| Agregado | `reaudit.beforeEvidenceEnvelopeRef` | `'env:visual-before'` |
| Agregado | `reaudit.afterEvidenceEnvelopeRef` | `'env:visual-after'` |
| Agregado | `reaudit.rulesCompared` | `[]` |
| Eliminado | `reaudit.beforeReport` | (no existe en ReauditSummaryV1) |
| Eliminado | `reaudit.afterReport` | (no existe en ReauditSummaryV1) |

## Archivos modificados

- `src/components/ImprovementRunPanel.tsx` — 3 lineas modificadas en el visual harness mock.

## Pruebas ejecutadas

```bash
npx vitest run __tests__/ImprovementRunPanel.test.tsx
```

```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

## Resultado de typecheck

**Antes (post-L1):**

```
6 errores:
  3 mock_type_mismatch     (DEBT-003, DEBT-004, DEBT-005)
  1 prop_contract_mismatch  (DEBT-006)
  2 e2e_typing_issue        (DEBT-007, DEBT-008)
```

**Despues (post-L2):**

```
3 errores:
  1 prop_contract_mismatch  (DEBT-006)
  2 e2e_typing_issue        (DEBT-007, DEBT-008)
```

### Conteo before/after

| Metrica | Before | After | Delta |
| ------- | ------ | ----- | ----- |
| Total errores | 6 | 3 | -3 |
| mock_type_mismatch | 3 | 0 | -3 |
| prop_contract_mismatch | 1 | 1 | 0 |
| e2e_typing_issue | 2 | 2 | 0 |

### Errores restantes (3)

| ID | Archivo | Tipo | Loop |
| -- | ------- | ---- | ---- |
| DEBT-006 | `components/ReviewStep.tsx:477` | prop_contract_mismatch | L3 |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts:55` | e2e_typing_issue | L4 |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts:59` | e2e_typing_issue | L4 |

## Resultado de build

```bash
npm run build
```

```
built in 6.81s
```

Build exitoso sin errores. Solo warnings preexistentes de chunks >500 kB y dynamic/static import ambiguedades (no relacionados con L2).

## Confirmaciones

- No se tocaron contratos v2.
- No se tocaron servicios.
- No se tocaron freezes Phase 5/6/7/8.
- No se toco `auditEngine` ni `scoring`.
- No se uso `any`, `as any`, `@ts-ignore` ni `@ts-expect-error`.
- No se usaron exclusiones de tsconfig ni `skipLibCheck`.
- No se modifico `ReviewStep.tsx`.
- No se modificaron tests E2E.
- No se preparo cuarta entrega.
- No se inicio L3.
- 0 errores nuevos atribuibles a L2.

## Riesgos abiertos

- Los valores de fixture para `runtimeVersion`, `startedAt`, `finishedAt`, etc. son placeholders honestos que no representan una ejecucion real. Esto es correcto para un visual harness, pero debe documentarse claramente que estos valores son de demo.
- `exportedCsvRef: null` es valido segun el tipo (`string | null`), lo que indica que no se exporto CSV en este fixture visual.

## Proximo loop recomendado

**Phase 9 L3 — ReviewStep Contract Cleanup**

Resolver DEBT-006 corrigiendo el prop `run` que `ReviewStep` intenta pasar a `ImprovementRunPanel` pero que no existe en la interfaz `Props` actual.
