# Phase 8 L1 — Cierre Demo/Prod Boundary Hardening

## Objetivo

Blindar la separación entre modo normal/producto y modo demo/evidencia en AURA, evitando que fixtures, harness visuales, estados sintéticos o claims de evidencia aparezcan como comportamiento productivo normal.

## Problema Atacado

Antes de L1, el visual harness (`?phase7Visual=running|error`) y el resto de evidencia controlada se activaban mediante un `URLSearchParams.get('phase7Visual')` inline dentro de `ImprovementRunPanel.tsx`. La detección estaba acoplada al componente y no había:

- Banner explícito que indicara al usuario que estaba viendo demo/evidencia.
- Helper centralizado para detectar el modo demo (reutilizable para futuras features).
- Constantes explícitas de claims prohibidos exportadas y testeables.
- Garantía automatizada de que el banner demo no se filtra a Auditoría, Home o Laboratorio.

## Cambios Realizados

### 1. Helper centralizado: `src/utils/demoMode.ts`

- `detectDemoMode(search?)` — detecta modo demo/evidencia por query param.
  - `?phase7Visual=running|error` → `source: 'query_param_phase7'`, `visual: 'running'|'error'`
  - `?demoMode=1|true` → `source: 'query_param_demo'`, `visual: 'none'`
  - Por defecto lee `window.location.search` (SSR-safe: acepta `undefined`).
  - **No** activa con `?demoMode=0` ni con valores desconocidos de `phase7Visual`.
- `PROHIBITED_CLAIMS` — constantes exportadas de claims prohibidos.
- `isProhibitedClaim(text)` — detección simple por substring case-insensitive.
- `DEMO_MODE_NOTICE` — texto canónico del banner.

### 2. Panel endurecido: `src/components/ImprovementRunPanel.tsx`

- Reemplazado el `URLSearchParams.get('phase7Visual')` inline por `detectDemoMode()`.
- Añadido banner demo (`data-testid="demo-mode-banner"`) que solo se renderiza cuando `detectDemoMode().active === true`.
- El banner usa colores ámbar para distinguirlo visualmente como zona controlada.
- En modo normal (sin flag), el banner **no aparece** y el panel arranca en estado `idle`.

### 3. Tests unitarios: `src/__tests__/demoMode.test.ts`

20 tests cubriendo:

- Detección inactiva sin query params.
- Detección inactiva con params no relacionados.
- Activación correcta en cada trigger permitido.
- Inactividad explícita con `demoMode=0`.
- Inactividad con valores desconocidos de `phase7Visual`.
- Precedencia de `phase7Visual` sobre `demoMode`.
- Default desde `window.location.search`.
- Detección de claims prohibidos (production-ready, real datasets, Python internally, always available, formal benchmark, external validation).
- Claims neutros no detectados como prohibidos.

### 4. Tests E2E: `src/tests/e2e/phase8-boundary.spec.ts`

8 tests Playwright cubriendo:

- **E2E-BOUNDARY-001**: modo normal oculta banner demo en Health Delta.
- **E2E-BOUNDARY-002**: `?demoMode=1` muestra banner demo en Health Delta.
- **E2E-BOUNDARY-003**: `?phase7Visual=running` muestra banner y fuerza estado running.
- **E2E-BOUNDARY-004**: `?phase7Visual=error` muestra banner y fuerza estado error.
- **E2E-BOUNDARY-005**: banner demo no se filtra a Auditoría.
- **E2E-BOUNDARY-006**: banner demo no se filtra a Home.
- **E2E-BOUNDARY-007**: banner demo no se filtra a Laboratorio.
- **E2E-BOUNDARY-008**: modo normal nunca auto-dispara running/error/done.

## Archivos Modificados

| Archivo | Tipo |
|---------|------|
| `src/utils/demoMode.ts` | Nuevo |
| `src/__tests__/demoMode.test.ts` | Nuevo |
| `src/tests/e2e/phase8-boundary.spec.ts` | Nuevo |
| `src/components/ImprovementRunPanel.tsx` | Modificado (refactor mínimo + banner) |
| `docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/PHASE8_EVIDENCE_LEDGER.md` | Modificado (evidencia L1) |
| `docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md` | Nuevo |

## Pruebas Ejecutadas

| Comando | Resultado |
|---------|-----------|
| `npx vitest run __tests__/demoMode.test.ts` | **20/20 passed** |
| `npx vitest run __tests__/ImprovementRunPanel.test.tsx __tests__/ImprovementRunPage.test.tsx __tests__/demoMode.test.ts` | **24/24 passed** |
| `npx tsc --noEmit` | Errores preexistentes en `ImprovementRunPanel.tsx` (visual harness mock incompleto vs tipos v1), `scriptGenerationStepV2.test.tsx`, `ReviewStep.tsx`, `phase7-claims-visible.spec.ts` — **no introducidos por L1** |
| `npx vite build` | **✓ built in 16.33s** |

Tests E2E no ejecutados en este commit (requieren entorno Playwright + Chrome). Se entregarán como artefacto L1 reproducible.

## Frontera Modo Normal vs Modo Demo/Evidencia

### Modo normal/producto (sin flag)

- **Banner demo**: NO se renderiza.
- **Estado del panel**: `idle` por defecto. El usuario debe presionar "Run" para ejecutar el flujo real (que sigue siendo fixture controlado por diseño de Phase 5/6).
- **Visual harness**: inactivo. Los estados `running`/`error` solo se alcanzan por acción explícita del usuario (`Run` / `Retry`).
- **Claims prohibidos**: no deben aparecer en UI normal.

### Modo demo/evidencia (con flag explícito)

- **Activación**: solo vía `?demoMode=1` o `?phase7Visual=running|error`.
- **Banner demo**: SÍ se renderiza, color ámbar, texto "DEMO / EVIDENCE MODE — controlled fixture only".
- **Visual harness**: activado. Estados sintéticos alcanzables sin acción del usuario.
- **Claims prohibidos**: no deben aparecer aunque el panel muestre datos sintéticos.

## Claims Permitidos

- AURA cuenta con fases congeladas de mejora controlada, UI HealthDelta y QA E2E.
- Phase 8 L1 separó explícitamente el modo demo del modo normal.
- El modo demo se activa solo con `?demoMode=1` o `?phase7Visual=running|error`.
- El visual harness usa fixtures controlados, no ejecuta Python, no usa datasets reales.
- AURA no depende de Chrome AI / Gemini Nano real en modo demo.

## Claims Prohibidos

- AURA está production-ready.
- AURA corrigió datasets reales.
- AURA ejecuta Python internamente.
- Chrome AI / Gemini Nano siempre está disponible.
- Existe un benchmark formal definitivo.
- Hay validación externa independiente.
- El visual harness es comportamiento productivo normal.
- Los resultados del modo demo equivalen a producción.

## Riesgos Abiertos

1. **E2E no ejecutados en este commit**: los 8 tests de `phase8-boundary.spec.ts` no se corrieron en CI porque el entorno actual no tiene Playwright configurado para ejecutar. Recomendación: ejecutar `npx playwright test src/tests/e2e/phase8-boundary.spec.ts` en un entorno con Chrome instalado antes de declarar L1 totalmente cerrado en producción.
2. **Visual harness mock incompleto**: el objeto `improvementRun` creado por `?phase7Visual=` no satisface completamente los tipos `ExecutionSummaryV1`, `OutputDatasetSummaryV1`, `ReauditSummaryV1`. Este es un problema pre-existente de Phase 7 L2B, no introducido por L1.
3. **Banner como única señal visual**: el banner ámbar es la única advertencia. Si se añaden nuevos triggers demo en el futuro, deben pasar por `detectDemoMode()` para mantener consistencia.
4. **Cobertura de otros componentes**: solo se blindó el visual harness de `ImprovementRunPanel`. Si Phase 8 L2-L6 introducen fixtures adicionales, deben reutilizar el helper.

## Confirmación de No Cuarta Entrega

Este commit **no** prepara la cuarta entrega documental. No se modificaron borradores, ni consolidación de evidencia, ni documentos `01_borrador` ni `02_metodologia` ni `03_evidencia`. Solo se tocó documentación nueva de Phase 8.

## Próximo Loop Recomendado

**Phase 8 L2 — Controlled Dataset Protocol**

Definir el dataset controlado ampliado (sin PII, con ground truth documentado) que se usará en L3 (Controlled Pilot Run).