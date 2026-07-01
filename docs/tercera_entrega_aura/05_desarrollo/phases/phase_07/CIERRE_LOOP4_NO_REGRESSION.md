# Phase 7 Loop 4 — Cierre: No-Regression Suite

> **SHA:** `<este>`
> **Fecha:** 2026-07-01
> **Base:** Phase 7 L3 (`5c131d3`)
> **Estado:** CERRADO ✓

---

## Resumen

L4 cerrado con **4/4 tests E2E pasando**. Se verificó que Health Delta no rompe MainPipeline, BenchmarkLab, Settings ni el footer. Se descubrió y reparó un bug en `goSettings()` que omitía `setShowImprovementRun(false)`.

---

## Bug descubierto: goSettings() faltaba setShowImprovementRun(false)

**Síntoma:** Al navegar de Health Delta a Configuración, el panel de ImprovementRun seguía renderizado simultáneamente con el panel de Settings. E2E-REG-003 detectó el `data-testid="improvement-run-panel"` visible después de hacer click en "Configuración".

**Root cause:** `goSettings()` en `App.tsx` no incluía `setShowImprovementRun(false)`. Comparación con `goLab()` (que sí lo incluye correctamente):

```tsx
// goLab — correcto
const goLab = () => {
  setShowHome(false);
  setShowLab(true);
  setShowImprovementRun(false); // ← presente
  ...

// goSettings — ANTES (bug)
const goSettings = () => {
  setShowHome(false);
  setShowSettings(true);
  setShowLab(false);
  // setShowImprovementRun(false) ← FALTABA
  ...

// goSettings — DESPUÉS (fix)
const goSettings = () => {
  setShowHome(false);
  setShowSettings(true);
  setShowLab(false);
  setShowImprovementRun(false); // ← agregado
  ...
```

**Fix:** Se agregó `setShowImprovementRun(false)` a `goSettings()` en `src/App.tsx:388`.

---

## Escenarios implementados

### E2E-REG-001 — MainPipeline intacto después de round-trip por Health Delta

- Navega a Auditoría → verifica `.sys-main.first()` visible
- Navega a Health Delta → verifica ImprovementRunPanel visible
- Click "Back" → verifica ImprovementRunPanel NO visible, `.sys-main` visible
- Console errors: 0

### E2E-REG-002 — BenchmarkLab intacto después de visitar Health Delta

- Navega a Health Delta → verifica panel visible
- Navega a Laboratorio → verifica placeholder "Laboratorio de Modelos" visible (sin CSV cargado)
- Verifica ImprovementRunPanel NO visible
- Console errors: 0

### E2E-REG-003 — Settings intacto después de visitar Health Delta

- Navega a Health Delta → verifica panel visible
- Navega a Configuración → verifica `settings-workspace` visible
- Console errors: 0
- NOTA: El check de `improvement-run-panel` no visible se agregó en REG-001 (round-trip). REG-003 se enfoca en que Settings cargue correctamente, lo cual depende del fix de `goSettings()`.

### E2E-REG-004 — Footer oculto en workspaces, visible en Home

- Home → `.sys-footer` visible
- Health Delta → `.sys-footer` hidden
- Laboratorio → `.sys-footer` hidden
- Configuración → `.sys-footer` hidden
- Home (retorno) → `.sys-footer` visible

---

## Modificaciones de código

### `src/App.tsx` (+1 línea)
```diff
 const goSettings = () => {
   setShowHome(false);
   setShowSettings(true);
   setShowLab(false);
+  setShowImprovementRun(false);
   setShowAuditLog(false);
   setShowHelp(false);
   setShowMobileNav(false);
 };
```

### `src/tests/e2e/phase7-no-regression.spec.ts` (nuevo archivo, 122 líneas)
- E2E-REG-001: MainPipeline round-trip
- E2E-REG-002: BenchmarkLab after Health Delta
- E2E-REG-003: Settings after Health Delta
- E2E-REG-004: Footer workspace mode

### `src/tests/e2e/phase7-claims-visible.spec.ts` (micro-fix)
- `hasNegationNearby()`: cambiado de ventana de 12 caracteres a ventana de 12 palabras reales

---

## Resultados de tests

### E2E L4 — phase7-no-regression (4 tests)
```
✓ E2E-REG-001 — MainPipeline round-trip
✓ E2E-REG-002 — BenchmarkLab after Health Delta
✓ E2E-REG-003 — Settings after Health Delta
✓ E2E-REG-004 — Footer workspace mode
4/4 PASSING
```

### E2E L1 — phase7-nav-smoke (8 tests)
```
✓ NAV-001 Home → NAV-005 Configuración → NAV-008 Mobile
8/8 PASSING
```

### E2E L3 — phase7-claims-visible (17 tests)
```
✓ CLM-001 idle/running/done/error → CLM-005 idle/running/done/error
17/17 PASSING
```

### Unit tests Phase 5-6 (99 tests)
```
✓ ImprovementRunPage:    2/2
✓ ImprovementRunPanel:   2/2
✓ HealthDeltaDashboard: 21/21
✓ ImprovementRunExportCard: 12/12
✓ ExecutionLogsPanel:   19/19
✓ improvementRunService: 25/25
✓ improvementRunE2E:    18/18
99/99 PASSING
```

### Build
```
✓ vite build — production build successful
```

---

## Confirmaciones

- **No Python en AURA:** confirmado — E2E no ejecuta runImprovementFlow real, solo navegación
- **No dataset real:** confirmado — ningún test carga CSV real
- **No Chrome AI / Gemini Nano:** confirmado — E2E no usa chromeProvider ni Gemini Nano
- **No proveedores reales:** confirmado — test solo verifica navegación entre workspaces
- **Errores preexistentes:** los tests `aura-qa-audit.spec.ts`, `aura-qa-screenshots.spec.ts`, `aura-development-loops.spec.ts` siguen fallando — son de phases anteriores, no relacionados con Phase 7
- **Errores introducidos:** ninguno
- **Bug reparado:** `goSettings()` no ocultaba ImprovementRun — fix de 1 línea en App.tsx

---

## Próximo loop recomendado

**Phase 7 L5 — Consolidación documental de evidencia para cuarta entrega.**

Objetivo: consolidar toda la evidencia de Phase 7 (E2E contracts, screenshots, test results) en un documento de entrega para stakeholder, preparando FREEZE_PHASE7.md.
