# Phase 9 — Debt Ledger

Libro de control de deuda técnica TypeScript. Cada entry corresponde a un error del baseline capturado en L0.

---

## DEBT-001

| Campo | Valor |
| ----- | ----- |
| Archivo | `__tests__/scriptGenerationStepV2.test.tsx:12` |
| Tipo | dependency_missing |
| Impacto | Test `scriptGenerationStepV2.test.tsx` no compila; bloquea typecheck del archivo |
| Fix propuesto | Instalar `@testing-library/react` como devDependency o asegurar que los type declarations estén disponibles |
| Fix aplicado | `npm install` — la dependencia ya estaba en `devDependencies` de `package.json` pero no instalada en `node_modules` |
| Loop asignado | L1 — Test Dependency Baseline Cleanup |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2307 en este archivo |
| Evidencia | ✅ Error TS2307 eliminado. 42/42 tests pasan en `scriptGenerationStepV2.test.tsx` |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Bajo — solo afecta dependencias de test, no runtime |

---

## DEBT-002

| Campo | Valor |
| ----- | ----- |
| Archivo | `__tests__/scriptGenerationStepV2.test.tsx:13` |
| Tipo | dependency_missing |
| Impacto | Test `scriptGenerationStepV2.test.tsx` no compila; bloquea typecheck del archivo |
| Fix propuesto | Instalar `@testing-library/user-event` como devDependency o asegurar que los type declarations estén disponibles |
| Fix aplicado | `npm install` — la dependencia ya estaba en `devDependencies` de `package.json` pero no instalada en `node_modules` |
| Loop asignado | L1 — Test Dependency Baseline Cleanup |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2307 en este archivo |
| Evidencia | ✅ Error TS2307 eliminado. 42/42 tests pasan en `scriptGenerationStepV2.test.tsx` |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Bajo — solo afecta dependencias de test, no runtime |

---

## DEBT-003

| Campo | Valor |
| ----- | ----- |
| Archivo | `components/ImprovementRunPanel.tsx:82` |
| Tipo | mock_type_mismatch |
| Impacto | El mock visual `execution` en el harness de `ImprovementRunPanel` no cumple el contrato `ExecutionSummaryV1`; typecheck falla |
| Fix propuesto | Completar el objeto `execution` con los campos requeridos por `ExecutionSummaryV1`: `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, `cpuModel`, `memoryMb` |
| Loop asignado | L2 — ImprovementRunPanel Type Fixtures |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2740 en `ImprovementRunPanel.tsx:82` |
| Evidencia | ✅ Error TS2740 eliminado. Se completaron campos `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, `error`, `sandbox` |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Medio — al tocar el mock visual, el harness podría renderizar distinto |

---

## DEBT-004

| Campo | Valor |
| ----- | ----- |
| Archivo | `components/ImprovementRunPanel.tsx:83` |
| Tipo | mock_type_mismatch |
| Impacto | El mock visual `outputDataset` en el harness de `ImprovementRunPanel` no cumple el contrato `OutputDatasetSummaryV1`; typecheck falla |
| Fix propuesto | Completar el objeto `outputDataset` con los campos requeridos por `OutputDatasetSummaryV1`: `outputFingerprint`, `exportedCsvRef` |
| Fix aplicado | Se agregaron `outputFingerprint: 'sha256:visual-fixture'` y `exportedCsvRef: null` al mock |
| Loop asignado | L2 — ImprovementRunPanel Type Fixtures |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2739 en `ImprovementRunPanel.tsx:83` |
| Evidencia | ✅ Error TS2739 eliminado |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Medio — al tocar el mock visual, el harness podría renderizar distinto |

---

## DEBT-005

| Campo | Valor |
| ----- | ----- |
| Archivo | `components/ImprovementRunPanel.tsx:87` |
| Tipo | mock_type_mismatch |
| Impacto | El mock visual `reaudit` incluye el campo `beforeReport` que no existe en el tipo `ReauditSummaryV1`; typecheck falla |
| Fix propuesto | Eliminar el campo `beforeReport` del mock o renombrarlo/adaptarlo al contrato real de `ReauditSummaryV1` (que usa `beforeIssueCount`/`afterIssueCount` en lugar de reports anidados) |
| Fix aplicado | `beforeReport` y `afterReport` eliminados. Agregados `beforeEvidenceEnvelopeRef`, `afterEvidenceEnvelopeRef`, `rulesCompared: []`. El renderizado solo consume `beforeIssueCount`/`afterIssueCount` |
| Loop asignado | L2 — ImprovementRunPanel Type Fixtures |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2353 en `ImprovementRunPanel.tsx:87` |
| Evidencia | ✅ Error TS2353 eliminado |
| SHA resolución | Pendiente de commit |

---

## DEBT-006

| Campo | Valor |
| ----- | ----- |
| Archivo | `components/ReviewStep.tsx:477` |
| Tipo | prop_contract_mismatch |
| Impacto | `ReviewStep` intenta pasar `run={improvementRun}` a `ImprovementRunPanel`, pero el tipo `Props` de `ImprovementRunPanel` no incluye `run`; typecheck falla |
| Fix propuesto | Remover la prop `run` inválida de la invocación JSX. `ImprovementRunPanel` es un componente autónomo sin prop para resultados externos |
| Fix aplicado | Se eliminó `run={improvementRun}` de la invocación `<ImprovementRunPanel />` en `ReviewStep.tsx:477` |
| Loop asignado | L3 — ReviewStep Contract Cleanup |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2322 en `ReviewStep.tsx:477` |
| Evidencia | ✅ Error TS2322 eliminado. Typecheck: 3 → 2 errores. Build y tests pasan |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Bajo — `ImprovementRunPanel` se renderiza en estado idle en ese contexto, igual que antes funcionalmente |

---

## DEBT-007

| Campo | Valor |
| ----- | ----- |
| Archivo | `tests/e2e/phase7-claims-visible.spec.ts:55` |
| Tipo | e2e_typing_issue |
| Impacto | Llamada `querySelectorAll<HTMLElement>` con type argument en contexto `page: any` dentro de `locator.evaluate()`; typecheck falla con TS2347 |
| Fix propuesto | Tipar `page` como `Page` de Playwright y eliminar el type argument `<HTMLElement>` innecesario de `querySelectorAll` |
| Fix aplicado | `page: any` → `page: Page`. `querySelectorAll<HTMLElement>` → `querySelectorAll(...)`. El retorno `NodeListOf<Element>` tiene `textContent` por herencia de `Node` |
| Loop asignado | L4 — E2E Typing Cleanup |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2347 en `phase7-claims-visible.spec.ts:55` |
| Evidencia | ✅ Error TS2347 eliminado. Typecheck: 2 → 0 errores. E2E: 17/17 pasan |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Bajo — solo afecta tipado en test E2E |

---

## DEBT-008

| Campo | Valor |
| ----- | ----- |
| Archivo | `tests/e2e/phase7-claims-visible.spec.ts:59` |
| Tipo | e2e_typing_issue |
| Impacto | Acceso a `n.textContent` donde `n` es de tipo `unknown` porque `Array.from(el.querySelectorAll(...))` heredaba el `any` de `page: any`; typecheck falla con TS2339 |
| Fix propuesto | Tipar `page` como `Page` de Playwright. Con `page: Page`, `locator.evaluate` tiene firmas tipadas y `el` es `HTMLElement`; `querySelectorAll` retorna `NodeListOf<Element>` cuyos elementos tienen `textContent` |
| Fix aplicado | `page: any` → `page: Page`. El callback `.evaluate((el: HTMLElement) => ...)` ahora tiene tipos DOM completos |
| Loop asignado | L4 — E2E Typing Cleanup |
| Estado | **Resuelto** |
| Evidencia requerida | `npx tsc --noEmit` sin error TS2339 en `phase7-claims-visible.spec.ts:59` |
| Evidencia | ✅ Error TS2339 eliminado. Typecheck: 2 → 0 errores |
| SHA resolución | Pendiente de commit |
| Riesgo de regresión | Bajo — solo afecta tipado en test E2E |

---

## Resumen

| Estado | Cantidad |
| ------ | -------- |
| Pendiente | 0 |
| En progreso | 0 |
| Resuelto | 8 |
| **Total** | **8** |

## Cierre de Phase 9 TypeScript Debt

| Loop | SHA | Errores | Estado |
| ---- | --- | ------- | ------ |
| L0 | `2a9a7cb` | 8 | Baseline |
| L1 | `4e0a6e3` | 6 | DEBT-001, DEBT-002 resueltos |
| L2 | `5182970` | 3 | DEBT-003, DEBT-004, DEBT-005 resueltos |
| L3 | `c67fb76` | 2 | DEBT-006 resuelto |
| L4 | `f39d84a` | 0 | DEBT-007, DEBT-008 resueltos |
| L5 | — | **0** | **Verificado — sin cambios de código** |

**Próximo paso: Phase 9 L6 — Freeze Phase 9**
