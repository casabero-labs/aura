# Phase 7 Loop 1 — E2E Scaffolding + Navigation Smoke Tests

> **Estado:** CERRADO
> **Fecha:** 2026-07-01
> **SHA base:** `648193ff19aafa295f367a35e6520e1a390cb920` (Phase 7 L0)
> **SHA cierre:** este commit

---

## 1. Resumen

Phase 7 L1 establece el harness E2E basado en Playwright ya presente en el proyecto, e implementa los primeros smoke tests de navegación según el contrato E2E (`E2E_CONTRACT_PHASE7.md`).

No se agregaron dependencias. Playwright ya estaba configurado desde experimentos anteriores.

---

## 2. Hallazgo de bug en App.tsx

Durante la implementación de E2E-NAV-007 ("Back desde Health Delta vuelve a Auditoría"), se detectó que `goAudit()` (usada como `onBack` en `ImprovementRunPage`) no desactivaba `showImprovementRun`, dejando el botón "Health Delta" activo después de navegar de vuelta.

**Fix aplicado:** Se añadió `setShowImprovementRun(false)` a `goAudit()` en `App.tsx:354`.

Este fix:
- No modifica lógica de Phase 5 ni servicios.
- No modifica contratos v2.
- Corrige navegación de Phase 6 que no cumplía el contrato E2E.
- Es un bug fix incidental, no un cambio de arquitectura.

---

## 3. Escenarios E2E implementados

| ID | Escenario | Estado |
|---|---|---|
| E2E-NAV-001 | Home carga correctamente | ✓ Implementado |
| E2E-NAV-002 | Auditoría abre correctamente | ✓ Implementado |
| E2E-NAV-003 | Laboratorio abre correctamente | ✓ Implementado |
| E2E-NAV-004 | Health Delta abre correctamente | ✓ Implementado |
| E2E-NAV-005 | Configuración abre correctamente | ✓ Implementado |
| E2E-NAV-006 | Health Delta no deja Auditoría activa | ✓ Implementado |
| E2E-NAV-007 | Back desde Health Delta vuelve a Auditoría | ✓ Implementado |
| E2E-NAV-008 | Mobile nav permite abrir Health Delta | ✓ Implementado |

**Total: 8/8 escenarios de navegación implementados.**

Los escenarios de Health Delta workspace (B), claims visibles (C), y no regresión (D) están reservados para Phase 7 L2+.

---

## 4. Framework E2E

- **Playwright** (`@playwright/test ^1.57.0`) ya estaba instalado.
- Configuración existente en `playwright.config.ts` sin modificaciones.
- Test suite: `src/tests/e2e/phase7-nav-smoke.spec.ts`.
- Comando: `npm run test:e2e` (ya existía).

**Dependencias agregadas:** 0.

---

## 5. Verificación de constraints

| Constraint | Cumplimiento |
|---|---|
| No modificar servicios Phase 5 | ✓ Confirmado |
| No modificar lógica de runImprovementFlow | ✓ Confirmado |
| No modificar contratos v2 | ✓ Confirmado |
| No tocar FREEZE_PHASE5.md | ✓ Confirmado |
| No tocar FREEZE_PHASE6.md | ✓ Confirmado |
| No tocar Phase 3 ni Phase 4 | ✓ Confirmado |
| No afirmar production-ready | ✓ Confirmado |
| No usar dataset real | ✓ Confirmado |
| No afirmar validación externa independiente | ✓ Confirmado |
| No ejecutar Python dentro de AURA | ✓ Confirmado |
| Mantener Health Delta como workspace aislado | ✓ Confirmado |

---

## 6. Pruebas ejecutadas

| Suite | Tests | Resultado |
|---|---|---|
| `npm run build` | — | ✓ Pass (warnings pre-existentes) |
| `npm run test:e2e` | 8 E2E smoke | ✓ 8/8 Pass |
| `npm test -- --run ImprovementRunPage` | 2 | ✓ Pass |
| `npm test -- --run ImprovementRunPanel` | 2 | ✓ Pass |
| `npm test -- --run HealthDeltaDashboard` | 21 | ✓ Pass |
| `npm test -- --run ImprovementRunExportCard` | 12 | ✓ Pass |
| `npm test -- --run ExecutionLogsPanel` | 19 | ✓ Pass |
| `npm test -- --run improvementRunService` | 25 | ✓ Pass |
| `npm test -- --run improvementRunE2E` | 18 | ✓ Pass |
| `npm test` (full suite) | 1288 | ✓ 1288/1288 Pass |

**Error pre-existente (no relacionado):** `scriptGenerationStepV2.test.tsx` timeout en pool de workers. Pre-existente a Phase 7.

**Error TypeScript pre-existente:** `components/ReviewStep.tsx:477` — `Property 'run' does not exist on type 'IntrinsicAttributes & Props'`. Pre-existente a Phase 7. No modificado por este loop.

---

## 7. Archivos modificados

| Archivo | Cambio | Descripción |
|---|---|---|
| `src/App.tsx` | M | Bug fix: `goAudit()` ahora desactiva `showImprovementRun` |
| `src/tests/e2e/phase7-nav-smoke.spec.ts` | A | 8 smoke tests de navegación |
| `docs/.../CIERRE_LOOP1_E2E_SCAFFOLD.md` | A | Este documento |

---

## 8. Bug fix incidental documentado

**Archivo:** `src/App.tsx`
**Línea:** 354
**Cambio:** `setShowImprovementRun(false)` añadido a `goAudit()`

**Antes:**
```typescript
const goAudit = () => {
  setShowHome(false);
  setShowLab(false);
  setShowAuditLog(false);
  setShowSettings(false);
  setShowHelp(false);
  setShowMobileNav(false);
  requestAnimationFrame(() => scrollTo('sistema'));
};
```

**Después:**
```typescript
const goAudit = () => {
  setShowHome(false);
  setShowLab(false);
  setShowImprovementRun(false); // <-- añadido
  setShowAuditLog(false);
  setShowSettings(false);
  setShowHelp(false);
  setShowMobileNav(false);
  requestAnimationFrame(() => scrollTo('sistema'));
};
```

**Razón:** Sin este fix, `onBack` en `ImprovementRunPage` no cerraba el workspace de Health Delta, dejando el nav button activo y violando E2E-NAV-007.

---

## 9. Notas sobre smoke tests de navegación

Los tests verifican:
- Visibilidad de todos los 5 items de navegación en desktop.
- Active class en el item seleccionado.
- Apertura correcta de cada workspace (Health Delta, Laboratorio, Configuración).
- Exclusividad de navegación (Health Delta no deja Auditoría activa).
- Funcionamiento del botón Back en ImprovementRunPage.
- Mobile nav: hamburger toggle + apertura de Health Delta.

Los tests **no** incluyen:
- Ejecución del flow de mejora (reservado para L2+).
- Verificación de claims en UI (reservado para L3).
- Escenarios de export JSON ni clipboard.
- Simulación de error state.

---

## 10. Próximo loop

**Phase 7 L2 — Capturas de evidencia visual para cuarta entrega.**

- Capturas de pantalla de cada estado de Health Delta (idle, running, done, error).
- Capturas de HealthDeltaDashboard, ExecutionLogsPanel, ImprovementRunExportCard.
- Verificación visual de que los avisos de "fixture controlado" y "no Python" son visibles.
