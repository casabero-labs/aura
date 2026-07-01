# Phase 5 Loop 5 — Cierre ImprovementRunV1 Completo

> **Estado:** cerrado
> **Loop:** Phase 5 L5
> **Fecha:** 2026-07-01
> **Base:** Phase 5 Loop 4 (`8327f6a174b9b3620f403554ab59875952afbc08`)

## 1. Entregable

**`src/services/improvementRunService.ts`** — servicio que orquesta el flujo completo de Phase 5: `executeControlledRun` → `importColabOutput` → `runReaudit` → `computeHealthDelta` → `ImprovementRunV1`.

### Interfaces

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
  claims: { permitted: string[]; prohibited: string[] };
}
```

### Funciones

| Función | Rol |
|---|---|
| `computeHealthDelta(reauditResult)` | Calcula delta de score e issues, determina status improved/unchanged/worsened/inconclusive, genera caveats |
| `buildImprovementRunV1(...)` | Construye ImprovementRunV1 completo con limitaciones y claims dinámicos |
| `runImprovementFlow(...)` | Orchestra flujo completo: execute → import → reaudit → delta → ImprovementRunV1 |

### Flujo integrado

```
executeControlledRun (L3)
  → preflight gate → sandbox gate → notebook generation
importColabOutput (L4)
  → parse CSV output from Colab
runReaudit (L4)
  → runAudit(beforeCsv) + runAudit(afterCsv) → ReauditSummaryV1 + OutputDatasetSummaryV1
computeHealthDelta
  → scoreBefore/After, delta, issueDelta, status, caveats
buildImprovementRunV1
  → ImprovementRunV1 con limitations/claims dinámicos
```

### Status determination logic

| Condición | Status |
|---|---|
| `issueAfter < issueBefore` | `improved` |
| `issueAfter === issueBefore` | `unchanged` |
| `issueAfter > issueBefore` | `worsened` |
| `issues = 0 before AND after` | `unchanged` |

Caveats automáticos:
- Score bajó pero issues bajaron → indica anomalía en scoring
- Score subió pero issues subieron → indica compensaciones en weight
- Score sin cambio con issues restantes → score puede ser insensible

## 2. Tests

**25 tests** en `src/__tests__/improvementRunService.test.ts`:

| Categoría | Tests | Cubren |
|---|---|---|
| computeHealthDelta | 9 | improved, unchanged, worsened, no-issues, caveats score↓/issues↓, caveats score↑/issues↑, caveats delta=0, summary, issueDelta |
| buildImprovementRunV1 | 6 | estructura válida, limitation worsen, claims improved, script ref, reaudit summary, healthDelta fields |
| runImprovementFlow | 10 | pipeline completo, fingerprints, notebook generado, delta status, improved claims, prohibited claims, limitations, gate fail throws, import fail throws, acceptedActionIds |

## 3. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 errores** |
| `npm run build` | **exitoso** (3.06s) |
| `npm test -- --run improvementRunService` | **25 passed** |
| `npm test -- --run reauditService` | **39 passed** |
| `npm test -- --run executionService` | **17 passed** |
| `npm test -- --run preflightCheck` | **17 passed** |
| `npm test -- --run runtimeSandbox` | **42 passed** |

## 4. Restricciones cumplidas

- No ejecuta Python dentro de AURA (delega a Colab).
- No usa dataset real del usuario (fixtures CSV controlados).
- No modifica contratos v2 existentes (solo lee).
- No toca evidencia congelada Phase 3 ni Phase 4.
- No afirma mejora si `HealthDelta.status !== 'improved'`.
- Caveats documentados cuando el delta es inconclusive o hay anomalías.
- Claims `permitted`/`prohibited` dinámicos según el status real del delta.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/improvementRunService.ts` | **Creado** |
| `src/__tests__/improvementRunService.test.ts` | **Creado** |

## 6. Claims

**Permitidos tras L5 (con HealthDeltaV1.status === 'improved'):**
- Issues reducidos de `N` a `M` tras ejecución en Colab (según motor runAudit de AURA).
- Score antes/después documentado (`scoreBefore`, `scoreAfter`).
- Output dataset fingerprint registrado.
- Dataset original nunca modificado por AURA (fixture copy only).

**Permitidos siempre (Phase 5 completo):**
- Contrato de script generado y validado (L1).
- Verificación preflight: hash, fingerprint, coherencia HITL (L1).
- Runtime sandbox validado: imports, network, filesystem (L2).
- Notebook Colab generado para ejecución externa (L3).
- Reauditoría antes/después con `runAudit` engine (L4).
- `HealthDeltaV1` calculado con caveats apropiados (L5).
- Limitations y prohibited claims documentados.

**Prohibidos (nunca, sin importar el status):**
- "AURA ejecutó Python directamente" — siempre Colab externo.
- "HealthDelta es medición formal externa" — usa motor runAudit de AURA.
- "Output es automáticamente confiable" — requiere revisión manual.
- "Score improvement = data quality improvement" — sin validación de dominio.

## 7. Score e Issue counts (fixture controlado — caso demo)

```
BEFORE_CSV: cities uppercase → runAudit: 3 issues (city casing)
AFTER_CSV:  cities lowercase → runAudit: 0 issues

scoreBefore: 75
scoreAfter:  100
delta: +25
issueDelta: -3
status: improved

healthDelta.summary: "Issues reduced from 3 to 0 after Colab execution (score: 75 → 100, delta: +25)."
```

## 8. Próximo paso: Phase 5 Loop 6

Phase 5 está funcionalmente completo con L0-L5. El loop 6 puede abordar:
- Tests E2E completos del flujo execute→import→reaudit→delta con fixture fixture_real.
- Documentación de uso del `ImprovementRunV1` exportado.
- CLI o UI wrapper para invocar `runImprovementFlow`.
- Validación de `ImprovementRunV1` contra schema formal.
