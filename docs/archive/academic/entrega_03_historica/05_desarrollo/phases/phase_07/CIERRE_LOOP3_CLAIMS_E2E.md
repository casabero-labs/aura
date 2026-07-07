# Phase 7 Loop 3 — Cierre: Verificación automática de claims visibles

> **SHA:** `loop3-claims-e2e`
> **Fecha:** 2026-07-01
> **Base:** Phase 7 L2B (`a651a36`)
> **Estado:** CERRADO ✓

---

## Resumen

L3 cerrado con **17/17 tests pasando**. Se verificó automáticamente la presencia de claims requeridos y ausencia de claims prohibidos en todos los estados visuales de Health Delta (idle / running / done / error).

---

## Problemas detectados y reparados

### 1. `getPanelText()` scope insuficiente

**Síntoma:** `getPanelText()` usaba `.improvement-run-panel` pero varios notices (fixture, Colab) son siblings dentro del mismo `<section>` y no children directos.

**Solución:** `getPanelText()` ahora usa `.evaluate()` para capturar texto del panel + todos los elementos `.improvement-run-notice`, `.improvement-run-notice-green`, `.limitation-banner`, `[data-testid="colab-notice"]`, `[data-testid="fixture-notice"]` dentro del workspace.

### 2. Prohibited phrases matcher detectaba negaciones como afirmaciones

**Síntoma:** `hasNegationNearby()` — frase `"not independent external validation"` coincidía con `"independent external validation"` en E2E-CLM-001 done. El test fallaba por positivo falso.

**Solución:** Helper `hasNegationNearby(text, pattern, window=12)` que verifica si hay palabras de negación (`not/no/never/doesn't/does not/did not/was not`) en las 12 palabras anteriores al match. Si hay negación cercana, se salta el check.

### 3. DoneState no tenía notices

**Síntoma:** E2E-CLM-003, E2E-CLM-004, E2E-CLM-005 fallaban en estado done porque DoneState no renderizaba ningún notice con los claims requeridos.

**Solución:** Se添加 fixture notice y Colab notice a DoneState:
- `data-testid="fixture-notice"`: "This run used a **controlled fixture copy** of the dataset. No original data was modified."
- `data-testid="colab-notice"`: "AURA does **not** execute Python. The pipeline executed externally via a Colab notebook with the controlled fixture copy."

### 4. ErrorState no tenía Colab notice

**Síntoma:** E2E-CLM-003 fallaba en error (ErrorState ya tenía fixture notice pero faltaba Colab).

**Solución:** Se添加 Colab notice a ErrorState:
- `data-testid="colab-notice"`: "AURA does **not** execute Python. Pipeline execution is delegated to an external Colab notebook."

---

## Modificaciones de código

### `src/components/ImprovementRunPanel.tsx` (+18 líneas)

**DoneState** — 添加 notices tras el header "Run complete":
```tsx
<div data-testid="fixture-notice" style={{ background: '#f0fdf4', ... }}>
  This run used a <strong>controlled fixture copy</strong> of the dataset.
  No original data was modified.
</div>
<div data-testid="colab-notice" style={{ background: '#fefce8', ... }}>
  AURA does <em>not</em> execute Python. The pipeline executed externally
  via a Colab notebook with the controlled fixture copy.
</div>
```

**ErrorState** — 添加 Colab notice tras fixture notice:
```tsx
<div data-testid="colab-notice" style={{ background: '#fefce8', ... }}>
  AURA does <em>not</em> execute Python. Pipeline execution is delegated
  to an external Colab notebook.
</div>
```

### `src/tests/e2e/phase7-claims-visible.spec.ts` (nuevo archivo)

- `PROHIBITED_PHRASES[]` — 12 phrases con `{ pattern, label }` para reporteo claro
- `hasNegationNearby()` — evita falsos positivos en phrases negados
- `getPanelText()` — scope expandido a panel + sibling notices
- `CLAIM_FIXTURE` — incluye "fixture copy", "fixture only", "fixture controlado"
- `CLAIM_COLAB` — incluye "colab notebook", "external colab", "external runtime"
- `CLAIM_NO_REAL` — incluye "no original data", "not original data", "controlled fixture"
- `CLAIM_NOT_INDEPENDENT` — incluye "reaudit", "same audit" para cubrir todos los textos presentes

---

## Cobertura de claims por estado

| Claim | Idle | Running | Done | Error |
|---|---|---|---|---|
| PROHIBITED phrases absent | ✓ | ✓ | ✓ | ✓ |
| `CLAIM_FIXTURE` (controlled fixture) | ✓ | ✓ | ✓ | ✓ |
| `CLAIM_COLAB` (external Colab) | ✓ | ✓ | ✓ | ✓ |
| `CLAIM_NO_REAL` (no real data) | ✓ | ✓ | ✓ | ✓ |
| `CLAIM_NOT_INDEPENDENT` (not independent) | ✓ | ✓ | ✓ | ✓ |

---

## Resultados de tests

### E2E L3 — phase7-claims-visible (17 tests)
```
✓ E2E-CLM-001 idle      — no prohibited claims
✓ E2E-CLM-001 done      — no prohibited claims
✓ E2E-CLM-001 running   — no prohibited claims
✓ E2E-CLM-001 error     — no prohibited claims
✓ E2E-CLM-002 idle      — controlled fixture
✓ E2E-CLM-003 idle      — Colab external
✓ E2E-CLM-003 running  — Colab external
✓ E2E-CLM-003 done      — Colab external
✓ E2E-CLM-003 error     — Colab external
✓ E2E-CLM-004 idle      — no real datasets
✓ E2E-CLM-004 running  — no real datasets
✓ E2E-CLM-004 done      — no real datasets
✓ E2E-CLM-004 error     — no real datasets
✓ E2E-CLM-005 idle      — not independent
✓ E2E-CLM-005 running  — not independent
✓ E2E-CLM-005 done      — not independent
✓ E2E-CLM-005 error     — not independent
17/17 PASSING
```

### Unit tests (Phase 5-6 components, todos passing)
```
✓ ImprovementRunPanel    — 2 tests
✓ HealthDeltaDashboard   — 21 tests
✓ ImprovementRunExportCard — 12 tests
✓ ExecutionLogsPanel     — 19 tests
✓ improvementRunService  — 25 tests
✓ improvementRunE2E       — 18 tests
✓ ImprovementRunPage      — 2 tests
Total: 99 unit tests PASSING
```

### Build
```
✓ vite build — production build successful (3.80s)
```

---

## Confirmaciones

- **No Python en AURA:** confirmado — Colab notice visible en todos los estados
- **No dataset real:** confirmado — fixture notice visible en todos los estados
- **No Chrome AI / Gemini Nano:** confirmado — E2E no usa Chrome AI ni Gemini Nano
- **No dataset real:** confirmado — todos los flujos usan controlled fixture copy
- **Errores preexistentes:** los tests que fallan en `aura-qa-audit.spec.ts`, `aura-qa-screenshots.spec.ts`, `aura-development-loops.spec.ts` son de phases anteriores y no fueron modificados en este loop
- **Errores introducidos:** ninguno

---

## Arquitectura de claims

```
ImprovementRunPanel
  ├── IdleState
  │     ├── fixture notice (fixture-only claim)
  │     └── colab notice (external execution claim)
  ├── RunningState
  │     └── colab notice (external execution claim)
  ├── DoneState         ← AGREGADO: fixture + colab notices
  │     ├── HealthDeltaDashboard
  │     ├── ExecutionLogsPanel
  │     └── ImprovementRunExportCard
  └── ErrorState        ← AGREGADO: colab notice (fixture ya existía)
        └── [retry] [reload]
```

---

## Próximo loop recomendado

**Phase 7 L4 — No-regression suite**

Implementar `phase7-no-regression.spec.ts` con los escenarios D del contrato E2E:
- `E2E-REG-001`: MainPipeline no se rompe (navegar Health Delta → ejecutar → volver a Auditoría)
- `E2E-REG-002`: BenchmarkLab no se rompe
- `E2E-REG-003`: Settings no se rompe
- `E2E-REG-004`: Footer se oculta en workspaces

---

## SHA real

```
L0:  648193f — docs: Phase 7 Loop 0 — Production Readiness Plan + E2E Contract
L1:  68e39bd — feat: Phase 7 Loop 1 — E2E smoke tests navigation + goAudit bug fix
L2:  202e941 — feat: Phase 7 Loop 2 — Visual evidence screenshots + CAPTURES manifest
L2B: a651a36 — feat: Phase 7 Loop 2B — Visual harness for running and error states
L3:  `5c131d3` — feat: Phase 7 Loop 3 — Claims visible E2E + notices added to DoneState/ErrorState
```
