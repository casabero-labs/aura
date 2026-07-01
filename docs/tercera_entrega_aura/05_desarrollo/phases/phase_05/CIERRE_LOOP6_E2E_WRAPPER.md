# Phase 5 Loop 6 — Cierre Tests E2E + CLI Wrapper

> **Estado:** cerrado
> **Loop:** Phase 5 L6
> **Fecha:** 2026-07-01
> **Base:** Phase 5 Loop 5 (`c8f1d464c7131d644dde9710188b73acd2d8e549`)

## 1. Entregables

### `src/services/improvementRunService.ts` — Extensiones

| Función | Rol |
|---|---|
| `isHealthDeltaV1(x)` | Type guard para HealthDeltaV1 |
| `isImprovementRunV1(x)` | Type guard para ImprovementRunV1 |
| `exportImprovementRunJSON(run)` | Serializa ImprovementRunV1 a JSON validado |

### `src/cli/runImprovement.ts`

CLI wrapper mínimo para invocar `runImprovementFlow`. Acepta:
- Arg 1: beforeCsv (inline string o usa default fixture)
- Arg 2: afterCsv (inline string o usa default fixture)
- Arg 3: datasetName (default: `demo_fixture.csv`)

Construye demo contract con `normalize_casing` sobre columna `City` y ejecuta el flujo completo.

```
npx tsx src/cli/runImprovement.ts "$BEFORE_CSV" "$AFTER_CSV" "dataset.csv"
# → stdout: ImprovementRunV1 JSON exportado
# → stderr: status, score, issues, runId
```

### `src/__tests__/improvementRunE2E.test.ts` — 18 tests

| Categoría | Tests |
|---|---|
| runImprovementFlow full pipeline | 3 (city norm, email clean, worsened) |
| JSON export | 3 (valid JSON, pretty-print, throws invalid) |
| Type guards | 7 (valid HealthDelta, valid Run, null, invalid shapes) |
| Dataset integrity | 2 (intact, immutable) |
| Colab confirmation | 1 (runtime = colab_notebook) |
| Inconclusive HealthDelta | 2 (score↓ + issues↓, score↑ + issues↑) |

### Semántica HealthDeltaV1.status (Opción A)

`inconclusive` se usa cuando score e issues se contradicen:
- `issues ↓` pero `score ↓` → `inconclusive`
- `issues ↑` pero `score ↑` → `inconclusive`

Caveats acompañan ambos casos con explicación de la contradicción.

## 2. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 errores** |
| `npm run build` | **exitoso** (3.03s) |
| `npm test -- --run improvementRunE2E` | **18 passed** |
| `npm test -- --run improvementRunService` | **25 passed** |
| `npm test -- --run reauditService` | **39 passed** |
| `npm test -- --run executionService` | **17 passed** |
| `npm test -- --run preflightCheck` | **17 passed** |
| `npm test -- --run runtimeSandbox` | **42 passed** |

**Total loops cerrados:** L0-L6 | **Total tests Phase 5:** 158

## 3. ImprovementRunV1 exportado como JSON (demo fixture)

```json
{
  "contractId": "aura.improvement_run.v1",
  "contractVersion": "1.0.0",
  "runId": "run:lr4abc-xy12",
  "createdAt": "2026-07-01T...",
  "sourceDatasetFingerprint": "sha256:testfingerprint",
  "sourceEvidenceEnvelopeRef": "env:e2e_before",
  "scriptContractRef": "contract:<sha256short>",
  "scriptHash": "...",
  "remediationPlanId": "plan:test123",
  "acceptedActionIds": ["act:city_normalize"],
  "execution": { ... },
  "outputDataset": {
    "rowCountBefore": 3,
    "rowCountAfter": 3,
    "columnCountBefore": 4,
    "columnCountAfter": 4,
    "outputFingerprint": "<sha256>",
    "changedCellsEstimate": 3,
    "exportedCsvRef": "output:env:..."
  },
  "reaudit": {
    "beforeEvidenceEnvelopeRef": "env:e2e_before",
    "afterEvidenceEnvelopeRef": "env:...",
    "beforeIssueCount": 3,
    "afterIssueCount": 0,
    "rulesCompared": ["rule:city_casing"]
  },
  "healthDelta": {
    "status": "improved",
    "scoreBefore": 75,
    "scoreAfter": 100,
    "delta": 25,
    "issueDelta": -3,
    "summary": "Issues reduced from 3 to 0 after Colab execution...",
    "caveats": []
  },
  "limitations": [...],
  "claims": { "permitted": [...], "prohibited": [...] }
}
```

## 4. Claims corregidos (NEXT_STEPS.md)

Permitido:
- `HealthDeltaV1` calculado sobre fixture controlado usando `runAudit` de AURA.
- Mejora medida solo en fixture controlado si `status === 'improved'`.
- Status `inconclusive` cuando score e issues se contradicen.
- `ImprovementRunV1` completo con execution, reaudit, delta, limitations y claims.
- Type guards y export JSON validados.
- CLI wrapper funcional.

No permitido:
- Mejora formal en dataset real.
- Validación externa independiente (siempre mismo motor `runAudit`).
- Ejecución Python dentro de AURA (siempre Colab externo).
- `improved` como claim sin caveats del contexto real.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/improvementRunService.ts` | **Modificado** (+80 líneas: type guards, JSON export, inconclusive) |
| `src/__tests__/improvementRunService.test.ts` | **Modificado** (2 tests actualizados a inconclusive) |
| `src/cli/runImprovement.ts` | **Creado** |
| `src/__tests__/improvementRunE2E.test.ts` | **Creado** |
| `docs/.../NEXT_STEPS.md` | **Modificado** (claims de frontera corregidos) |

## 6. Confirmaciones finales

- **No Python dentro de AURA** — runtime siempre `colab_notebook`, ejecución confirmada en Colab externo (L3-E2E).
- **No dataset real** — solo fixtures CSV controlados en todos los tests.
- **No modificación contratos v2** — solo lectura de contracts, runAudit, y reaudit engine.
- **Dataset original intacto** — verificado en tests E2E (L6).
- **`inconclusive` adoptado (Opción A)** — contradicciones score/issues generan `inconclusive` con caveats.

## 7. Próximo paso

Phase 5 funcionalmente completo (L0-L6). Recomendaciones:
- Documentación de uso del `ImprovementRunV1` en el flujo de usuario.
- Validación de `ImprovementRunV1` contra schema JSON formal.
- UI wrapper para visualizar `runImprovementFlow` en browser.
- Freeze y close de Phase 5.
