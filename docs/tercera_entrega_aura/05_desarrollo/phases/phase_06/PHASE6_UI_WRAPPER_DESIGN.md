# Phase 6 — UI Wrapper y Dashboard HealthDelta

> **Estado:** diseño  
> **Loop:** Phase 6 L0  
> **Base:** Phase 5 freeze (`40a376929fcaad13b1809bd0c8ba895011ceb8cb`)

## 1. Objetivo

Envolver el pipeline Phase 5 (`runImprovementFlow`) en una interfaz de usuario del frontend de AURA, exponiendo el `ImprovementRunV1` como un dashboard visual de health delta, permitiendo exportación JSON y visualización de logs de ejecución.

## 2. Alcance funcional

### Phase 6 L1 — UI wrapper mínimo

- Componente `ImprovementRunPanel` que invoca `runImprovementFlow` desde el frontend.
- `HealthDeltaDashboard` que renderiza score antes/después, delta, issue counts y caveats.
- `ImprovementRunExportCard` que descarga `ImprovementRunV1` como JSON.
- `ExecutionLogsPanel` que muestra logs de ejecución y reauditoría.

### Fuera de alcance (no en Phase 6)

- Ejecución Python dentro de AURA (siempre Colab externo).
- Modificación de servicios Phase 5.
- Modificación de contratos v2.
- Dataset real del usuario (solo fixtures controlados en tests).
- Dashboard de múltiples runs históricos (Phase 7+).

## 3. Qué NO se toca de Phase 5

| Artefacto | Protegido |
|---|---|
| `src/services/executionService.ts` | NO modificar |
| `src/services/reauditService.ts` | NO modificar |
| `src/services/improvementRunService.ts` | NO modificar |
| `src/services/preflightCheck.ts` | NO modificar |
| `src/services/runtimeSandbox.ts` | NO modificar |
| `src/services/colabExporter.ts` | NO modificar |
| Todos los tests Phase 5 | NO modificar |
| `FREEZE_PHASE5.md` | NO modificar |

## 4. Flujo visual propuesto

```
┌─────────────────────────────────────────────────┐
│ ImprovementRunPanel                              │
│  ┌─────────────────────────────────────────────┐ │
│  │ Phase 5 Improvement Flow                    │ │
│  │                                              │ │
│  │ [fixture before CSV]  [fixture after CSV]    │ │
│  │ [dataset name]        [evidence ref]         │ │
│  │                                              │ │
│  │ [▶ Run Improvement Flow]                     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ HealthDeltaDashboard                         │ │
│  │                                              │ │
│  │ Score:  75 ────→ 100   Δ +25                │ │
│  │ Issues:  3 ────→ 0     Δ -3                 │ │
│  │ Status:  ● IMPROVED                          │ │
│  │ Caveats: (none)                              │ │
│  │                                              │ │
│  │ [────────────────────●] (visual bar)         │ │
│  │  before            after                     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ ExecutionLogsPanel                           │ │
│  │  [info] gate 1 passed: preflight ready       │ │
│  │  [info] gate 2 passed: sandbox safe          │ │
│  │  [info] notebook generated: 7164 chars       │ │
│  │  [info] reaudit: 3 → 0 issues                │ │
│  │  [info] healthDelta status: improved          │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ ImprovementRunExportCard                     │ │
│  │  [⬇ Export JSON]   [📋 Copy to clipboard]   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 5. Componentes UI propuestos

### ImprovementRunPanel

| Propiedad | Tipo | Descripción |
|---|---|---|
| `beforeCsv` | `string` | CSV fixture antes de ejecución |
| `afterCsv` | `string` | CSV fixture después de ejecución |
| `datasetName` | `string` | Nombre del dataset |
| `evidenceRef` | `string` | Ref de evidencia before |
| `onResult` | `(FlowResult) => void` | Callback con resultado del flujo |

Estado: `idle | running | done | error`

### HealthDeltaDashboard

| Propiedad | Tipo | Descripción |
|---|---|---|
| `healthDelta` | `HealthDeltaV1` | Delta de salud del run |
| `reaudit` | `ReauditSummaryV1` | Summary de reauditoría |
| `output` | `OutputDatasetSummaryV1` | Summary del output dataset |

Renderiza:
- Barra de progreso visual score (before → after)
- Indicador de status con color semántico
- Issue counts con delta numérico
- Caveats en panel expandible
- Summary textual

### ImprovementRunExportCard

| Propiedad | Tipo | Descripción |
|---|---|---|
| `improvementRun` | `ImprovementRunV1` | Run completo para exportar |

Acciones:
- Descarga JSON (`exportImprovementRunJSON`)
- Copia al portapapeles
- Vista previa colapsada del JSON

### ExecutionLogsPanel

| Propiedad | Tipo | Descripción |
|---|---|---|
| `logs` | `string[]` | Logs de ejecución y reauditoría |
| `execution` | `ExecutionSummaryV1` | Summary de ejecución |

Renderiza logs filtrables por nivel y expandibles.

## 6. Estados visuales

| Estado | Color | Icono | Descripción |
|---|---|---|---|
| `idle` | gris | ○ | Panel esperando input |
| `running` | azul | ◌ | Flujo en ejecución |
| `improved` | verde | ● | Issues reducidos |
| `unchanged` | amarillo | ◉ | Sin cambios |
| `worsened` | rojo | ◉ | Issues aumentaron |
| `inconclusive` | naranja | ◎ | Score e issues contradicen |
| `error` | rojo oscuro | ✕ | Fallo en pipeline |

## 7. Claims visibles para usuario

Condicionados al status del delta:

- `improved`: _"Issues reduced from 3 to 0. Score improved to 100."_
- `unchanged`: _"No change detected. Score remained at 75."_
- `worsened`: _"Issues increased. Review the output dataset before use."_
- `inconclusive`: _"Result is inconclusive. Score and issues moved in opposite directions. See caveats."_
- `error`: _"Execution pipeline failed. Check logs for details."_

Claims permanentes:
- _"Execution delegated to Google Colab (external). AURA did NOT execute Python."_
- _"Reaudit uses AURA runAudit engine (reproducible, not independent validation)."_

## 8. Claims prohibidos (no mostrar en UI)

- NO mostrar: "AURA ejecutó Python directamente"
- NO mostrar: "Dataset corregido y validado"
- NO mostrar: "HealthDelta es medición externa formal"
- NO mostrar: "Output automáticamente confiable sin revisión manual"
- NO mostrar: "Benchmark formal de calidad"

## 9. Riesgos UX

| Riesgo | Mitigación |
|---|---|
| Usuario cree que AURA ejecutó Python | Banner visible: _"Execution delegated to Google Colab. This is a preview based on controlled fixtures."_ |
| Usuario confíe ciegamente en score | Mostrar siempre limitaciones y caveats |
| Usuario no entienda `inconclusive` | Tooltip explicativo con ejemplo concreto |
| Usuario intente usar dataset real | Placeholder: _"Paste your Colab output CSV here (fixture only in demo mode)"_ |
| Estado `running` sin feedback | Mostrar logs en tiempo real, spinner, elapsed time |

## 10. Plan de loops Phase 6

| Loop | Objetivo | Entregable |
|---|---|---|
| L0 | Diseño documento | PHASE6_UI_WRAPPER_DESIGN.md |
| L1 | `ImprovementRunPanel` + `runImprovementFlow` wrapper | Componente React con fixture controlado |
| L2 | `HealthDeltaDashboard` | Visualización de score, delta, status, caveats |
| L3 | `ImprovementRunExportCard` + `ExecutionLogsPanel` | Export JSON + logs visuales |
| L4 | Estados visuales completos (idle/running/error) | Animaciones y transiciones |
| L5 | Integración con rutas de AURA | Navegación desde sidebar |
| L6 | Freeze Phase 6 | FREEZE_PHASE6.md |
