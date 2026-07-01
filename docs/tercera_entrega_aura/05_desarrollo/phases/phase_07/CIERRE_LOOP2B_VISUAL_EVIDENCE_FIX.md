# Phase 7 Loop 2B — Visual Evidence: Running & Error State Fix

> **Estado:** CERRADO
> **Fecha:** 2026-07-01
> **SHA base:** `202e9416f86dc4df8805a0bdb1c90d500be4ecf1` (Phase 7 L2)
> **SHA cierre:** este commit

---

## 1. Problema

Phase 7 L2 generó capturas de evidencia, pero con deficiencias:

1. **`healthdelta_running.png` mostraba `done`** — el flujo real completaba en <10ms, imposible capturar el spinner.
2. **`healthdelta_error.png` mostraba `idle`** — el mock de `page.route` no interceptó correctamente el módulo `improvementRunService` en el contexto Vite dev.

Ambas capturas no cumplían el objetivo de demostrar visualmente los estados `running` y `error`.

---

## 2. Decisión de diseño

Se implementó un **visual testability harness opt-in** en `ImprovementRunPanel.tsx`:

- **Query param `?phase7Visual=running`**: fuerza estado `running` por 3 segundos, luego `done`.
- **Query param `?phase7Visual=error`**: fuerza estado `error` inmediatamente.
- **Por defecto (sin query params)**: comportamiento normal de producción — sin cambios.

Este enfoque:
- No modifica la lógica de producción (el hook solo se activa con el query param).
- No ejecuta Python ni usa datasets reales.
- Es estrictamente opt-in para captura visual de evidencia.
- Es mínima intrusión en el código del componente.

---

## 3. Implementación

### 3.1 Cambio en `ImprovementRunPanel.tsx`

**Archivo:** `src/components/ImprovementRunPanel.tsx`
**Líneas añadidas:** 55-99

```typescript
// ── Phase 7 L2B: Visual testability harness (opt-in, non-production) ──
// Activated only via ?phase7Visual=running or ?phase7Visual=error query param.
// Does NOT execute Python, does NOT use real datasets.
// For E2E visual evidence capture only.
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const visualMode = params.get('phase7Visual');
  if (!visualMode) return;

  if (visualMode === 'running') {
    setState('running');
    const timer = setTimeout(() => {
      setState('done');
      setResult({ /* mock ImprovementRunV1 */ });
    }, 3000);
    return () => clearTimeout(timer);
  }

  if (visualMode === 'error') {
    setState('error');
    setErrorMessage('Visual harness: forced error state for E2E capture.');
  }
}, []);
```

### 3.2 Test actualizado

**Archivo:** `src/tests/e2e/phase7-healthdelta-screenshots.spec.ts`

Los tests L2B solo ejecutan las capturas de running y error:

```typescript
test('E2E-HD-SS-002 — healthdelta_running.png (visual harness)', async ({ page }) => {
  await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded' });
  // ... navigate to Health Delta ...
  await expect(page.locator('[data-testid="running-state"]')).toBeVisible();
  await takeScreenshot(page, 'healthdelta_running.png');
});

test('E2E-HD-SS-006 — healthdelta_error.png (visual harness)', async ({ page }) => {
  await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded' });
  // ... navigate to Health Delta ...
  await expect(page.locator('[data-testid="error-state"]')).toBeVisible();
  await takeScreenshot(page, 'healthdelta_error.png');
});
```

Los tests idle, done, mobile se mantienen en el spec de L2.

---

## 4. Capturas corregidas

| Archivo | Antes (L2) | Después (L2B) | Cambio |
|---|---|---|---|
| `healthdelta_running.png` | 74678 bytes (muestra `done`) | 58348 bytes (muestra `running` spinner) | ✅ Corregido |
| `healthdelta_error.png` | 59982 bytes (muestra `idle`) | 62418 bytes (muestra `error` panel) | ✅ Corregido |

---

## 5. Verificación de constraints

| Constraint | Cumplimiento |
|---|---|
| No modificar servicios Phase 5 | ✓ Confirmado |
| No modificar contratos v2 | ✓ Confirmado |
| No tocar FREEZE_PHASE5.md | ✓ Confirmado |
| No tocar FREEZE_PHASE6.md | ✓ Confirmado |
| No tocar Phase 3 ni Phase 4 | ✓ Confirmado |
| No afirmar production-ready | ✓ Confirmado |
| No usar dataset real | ✓ Confirmado (visual harness no toca datos) |
| No ejecutar Python dentro de AURA | ✓ Confirmado (0 ejecución Python) |
| No usar Gemini Nano real | ✓ Confirmado |
| No depender de Chrome AI real | ✓ Confirmado |
| No descargar modelos | ✓ Confirmado |
| No redesñar componentes Phase 6 | ✓ Confirmado (solo añadida hook opt-in mínima) |

---

## 6. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npm run build` | ✓ Pass |
| `npm run test:e2e -- --grep phase7-healthdelta` | ✓ 2/2 Pass |
| `npm test -- --run ImprovementRunPage` | ✓ 2/2 Pass |
| `npm test -- --run ImprovementRunPanel` | ✓ 2/2 Pass |
| `npm test -- --run HealthDeltaDashboard` | ✓ 21/21 Pass |
| `npm test -- --run ImprovementRunExportCard` | ✓ 12/12 Pass |
| `npm test -- --run ExecutionLogsPanel` | ✓ 19/19 Pass |
| `npm test -- --run improvementRunService` | ✓ 25/25 Pass |
| `npm test -- --run improvementRunE2E` | ✓ 18/18 Pass |

---

## 7. Archivos modificados

| Archivo | Cambio | Descripción |
|---|---|---|
| `src/components/ImprovementRunPanel.tsx` | M | Añadido visual testability harness opt-in (45 líneas) |
| `src/tests/e2e/phase7-healthdelta-screenshots.spec.ts` | M | Actualizado para usar query params |
| `docs/.../screenshots/phase_07/healthdelta_running.png` | M | Regenerado — muestra running |
| `docs/.../screenshots/phase_07/healthdelta_error.png` | M | Regenerado — muestra error |
| `docs/.../screenshots/phase_07/CAPTURAS_PHASE7_MANIFEST.md` | M | Actualizado con método L2B |
| `docs/.../CIERRE_LOOP2B_VISUAL_EVIDENCE_FIX.md` | A | Este documento |

---

## 8. Decisión: no avanzar a L3

Phase 7 L2B corrige las capturas visuales que L2 no pudo generar. La evidencia visual de los 5 estados (idle, running, done, error, mobile) ahora está completa.

**L3 puede proceed** con verificación automática de claims visibles, usando los screenshots corregidos como baseline.

---

## 9. Próximo loop

**Phase 7 L3 — Verificación automática de claims visibles.**

Tests E2E que verifican presencia de claims requeridos y ausencia de claims prohibidos en la UI de Health Delta, según el contrato E2E (`E2E_CONTRACT_PHASE7.md` sección C).
