# Typecheck Baseline — Phase 9 L0

## Comando ejecutado

```bash
cd src && npx tsc --noEmit
```

## Fecha de captura

2026-07-02

## SHA base

`7fc32409160e5e9ee84d38bbe56db2fb4e504af4` (Phase 8 freeze)

## Total de errores (L0 baseline)

**8 errores TypeScript** (baseline L0)

## Total de errores (post-L2)

**3 errores TypeScript** (DEBT-003, DEBT-004, DEBT-005 resueltos en L2)

## Total de errores (post-L3)

**2 errores TypeScript** (DEBT-006 resuelto en L3)

## Total de errores (post-L4)

**0 errores TypeScript** (DEBT-007, DEBT-008 resueltos en L4 — typecheck verde)

## Archivos afectados

4 archivos:
- `__tests__/scriptGenerationStepV2.test.tsx` (DEBT-001, DEBT-002 — **resueltos en L1**)
- `components/ImprovementRunPanel.tsx` (DEBT-003, DEBT-004, DEBT-005 — **resueltos en L2**)
- `components/ReviewStep.tsx`
- `tests/e2e/phase7-claims-visible.spec.ts`

## Tabla de errores

| ID | Archivo | Línea | Error TS | Descripción | Origen probable | Riesgo | Prioridad | Loop recomendado | Estado |
| -- | ------- | ----- | -------- | ----------- | --------------- | ------ | --------- | ---------------- | ------ |
| DEBT-001 | `__tests__/scriptGenerationStepV2.test.tsx` | 12 | TS2307 | Cannot find module `@testing-library/react` | dependency_missing | Bajo — solo afecta tests que requieren el módulo | Alta | L1 | Resuelto (L1) |
| DEBT-002 | `__tests__/scriptGenerationStepV2.test.tsx` | 13 | TS2307 | Cannot find module `@testing-library/user-event` | dependency_missing | Bajo — solo afecta tests que requieren el módulo | Alta | L1 | Resuelto (L1) |
| DEBT-003 | `components/ImprovementRunPanel.tsx` | 82 | TS2740 | Type `{ status: "success"; runtime: "colab_notebook"; logs: undefined[]; }` is missing properties from `ExecutionSummaryV1`: `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, y 2 más | mock_type_mismatch — mock visual harness incompleto vs tipo `ExecutionSummaryV1` | Medio — mock visual no representa el contrato real | Alta | L2 | Resuelto (L2) |
| DEBT-004 | `components/ImprovementRunPanel.tsx` | 83 | TS2739 | Type `{ rowCountBefore: number; ... }` is missing properties from `OutputDatasetSummaryV1`: `outputFingerprint`, `exportedCsvRef` | mock_type_mismatch — mock visual harness incompleto vs tipo `OutputDatasetSummaryV1` | Medio — mock visual no representa el contrato real | Alta | L2 | Resuelto (L2) |
| DEBT-005 | `components/ImprovementRunPanel.tsx` | 87 | TS2353 | Object literal may only specify known properties, and `beforeReport` does not exist in type `ReauditSummaryV1` | mock_type_mismatch — `beforeReport` no es campo válido en `ReauditSummaryV1` | Medio — el mock usa un campo inexistente en el contrato | Alta | L2 | Resuelto (L2) |
| DEBT-006 | `components/ReviewStep.tsx` | 477 | TS2322 | Type `{ run: ImprovementRun; }` is not assignable to type `IntrinsicAttributes & Props`. Property `run` does not exist on type `IntrinsicAttributes & Props` | prop_contract_mismatch — `ImprovementRunPanel` no acepta prop `run` | Medio — `ReviewStep` pasaba prop inexistente | Media | L3 | Resuelto (L3) |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts` | 55 | TS2347 | Untyped function calls may not accept type arguments | e2e_typing_issue — `querySelectorAll<HTMLElement>` en contexto `page: any` | Bajo — solo afecta tipado en test E2E | Baja | L4 | Resuelto (L4) |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts` | 59 | TS2339 | Property `textContent` does not exist on type `unknown` | e2e_typing_issue — `n.textContent` sobre elemento de tipo `unknown` por `page: any` | Bajo — solo afecta tipado en test E2E | Baja | L4 | Resuelto (L4) |

## Clasificación por tipo

| Tipo | Cantidad | IDs |
| ---- | -------- | --- |
| dependency_missing | 2 (resueltos L1) | ~~DEBT-001, DEBT-002~~ |
| mock_type_mismatch | 3 (resueltos L2) | ~~DEBT-003, DEBT-004, DEBT-005~~ |
| prop_contract_mismatch | 1 (resuelto L3) | ~~DEBT-006~~ |
| e2e_typing_issue | 2 (resueltos L4) | ~~DEBT-007, DEBT-008~~ |
| unknown | 0 | — |

## Clasificación por archivo

| Archivo | Cantidad | IDs |
| ------- | -------- | --- |
| `__tests__/scriptGenerationStepV2.test.tsx` | 2 (resueltos L1) | ~~DEBT-001, DEBT-002~~ |
| `components/ImprovementRunPanel.tsx` | 3 (resueltos L2) | ~~DEBT-003, DEBT-004, DEBT-005~~ |
| `components/ReviewStep.tsx` | 1 (resuelto L3) | ~~DEBT-006~~ |
| `tests/e2e/phase7-claims-visible.spec.ts` | 2 (resueltos L4) | ~~DEBT-007, DEBT-008~~ |

## Notas

- **Typecheck verde.** 0 errores activos post-L4. Los 8 errores del baseline L0 han sido resueltos en L1-L4.
- **DEBT-001 y DEBT-002 resueltos en L1.** Las dependencias `@testing-library/*` estaban declaradas en `package.json` pero no instaladas en `node_modules`. Corregido con `npm install`.
- **DEBT-003, DEBT-004 y DEBT-005 resueltos en L2.** Mocks del visual harness en `ImprovementRunPanel.tsx` completados para cumplir `ExecutionSummaryV1`, `OutputDatasetSummaryV1` y `ReauditSummaryV1`.
- **DEBT-006 resuelto en L3.** Prop `run` eliminada de la invocación a `ImprovementRunPanel` en `ReviewStep.tsx`. El componente no acepta `run` ni prop equivalente para resultados externos; es autónomo.
- **DEBT-007 y DEBT-008 resueltos en L4.** Parámetros `page: any` reemplazados por `Page` de Playwright en helpers del spec. Se eliminó type argument inválido de `querySelectorAll`.
- **Ningún freeze fue modificado.** Phase 5, Phase 6, Phase 7 y Phase 8 permanecen congeladas.
