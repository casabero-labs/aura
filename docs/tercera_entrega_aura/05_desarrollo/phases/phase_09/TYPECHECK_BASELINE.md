# Typecheck Baseline — Phase 9 L0

## Comando ejecutado

```bash
cd src && npx tsc --noEmit
```

## Fecha de captura

2026-07-02

## SHA base

`7fc32409160e5e9ee84d38bbe56db2fb4e504af4` (Phase 8 freeze)

## Total de errores

**8 errores TypeScript**

## Archivos afectados

3 archivos:
- `__tests__/scriptGenerationStepV2.test.tsx`
- `components/ImprovementRunPanel.tsx`
- `components/ReviewStep.tsx`
- `tests/e2e/phase7-claims-visible.spec.ts`

## Tabla de errores

| ID | Archivo | Línea | Error TS | Descripción | Origen probable | Riesgo | Prioridad | Loop recomendado | Estado |
| -- | ------- | ----- | -------- | ----------- | --------------- | ------ | --------- | ---------------- | ------ |
| DEBT-001 | `__tests__/scriptGenerationStepV2.test.tsx` | 12 | TS2307 | Cannot find module `@testing-library/react` | dependency_missing | Bajo — solo afecta tests que requieren el módulo | Alta | L1 | Pendiente |
| DEBT-002 | `__tests__/scriptGenerationStepV2.test.tsx` | 13 | TS2307 | Cannot find module `@testing-library/user-event` | dependency_missing | Bajo — solo afecta tests que requieren el módulo | Alta | L1 | Pendiente |
| DEBT-003 | `components/ImprovementRunPanel.tsx` | 82 | TS2740 | Type `{ status: "success"; runtime: "colab_notebook"; logs: undefined[]; }` is missing properties from `ExecutionSummaryV1`: `runtimeVersion`, `startedAt`, `finishedAt`, `durationMs`, y 2 más | mock_type_mismatch — mock visual harness incompleto vs tipo `ExecutionSummaryV1` | Medio — mock visual no representa el contrato real | Alta | L2 | Pendiente |
| DEBT-004 | `components/ImprovementRunPanel.tsx` | 83 | TS2739 | Type `{ rowCountBefore: number; ... }` is missing properties from `OutputDatasetSummaryV1`: `outputFingerprint`, `exportedCsvRef` | mock_type_mismatch — mock visual harness incompleto vs tipo `OutputDatasetSummaryV1` | Medio — mock visual no representa el contrato real | Alta | L2 | Pendiente |
| DEBT-005 | `components/ImprovementRunPanel.tsx` | 87 | TS2353 | Object literal may only specify known properties, and `beforeReport` does not exist in type `ReauditSummaryV1` | mock_type_mismatch — `beforeReport` no es campo válido en `ReauditSummaryV1` | Medio — el mock usa un campo inexistente en el contrato | Alta | L2 | Pendiente |
| DEBT-006 | `components/ReviewStep.tsx` | 477 | TS2322 | Type `{ run: ImprovementRun; }` is not assignable to type `IntrinsicAttributes & Props`. Property `run` does not exist on type `IntrinsicAttributes & Props` | prop_contract_mismatch — `ImprovementRunPanel` no acepta prop `run` | Medio — podría ser que el prop se renombró o se eliminó | Media | L3 | Pendiente |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts` | 55 | TS2347 | Untyped function calls may not accept type arguments | e2e_typing_issue — `querySelectorAll<HTMLElement>` sin tipo en contexto `any` | Bajo — solo afecta tipado en test E2E | Baja | L4 | Pendiente |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts` | 59 | TS2339 | Property `textContent` does not exist on type `unknown` | e2e_typing_issue — `n.textContent` sobre elemento de tipo `unknown` | Bajo — solo afecta tipado en test E2E | Baja | L4 | Pendiente |

## Clasificación por tipo

| Tipo | Cantidad | IDs |
| ---- | -------- | --- |
| dependency_missing | 2 | DEBT-001, DEBT-002 |
| mock_type_mismatch | 3 | DEBT-003, DEBT-004, DEBT-005 |
| prop_contract_mismatch | 1 | DEBT-006 |
| e2e_typing_issue | 2 | DEBT-007, DEBT-008 |
| unknown | 0 | — |

## Clasificación por archivo

| Archivo | Cantidad | IDs |
| ------- | -------- | --- |
| `__tests__/scriptGenerationStepV2.test.tsx` | 2 | DEBT-001, DEBT-002 |
| `components/ImprovementRunPanel.tsx` | 3 | DEBT-003, DEBT-004, DEBT-005 |
| `components/ReviewStep.tsx` | 1 | DEBT-006 |
| `tests/e2e/phase7-claims-visible.spec.ts` | 2 | DEBT-007, DEBT-008 |

## Notas

- **Typecheck no está limpio.** Este documento registra el baseline real.
- **Ningún error ha sido resuelto.** Todos los errores están pendientes de asignación a loops L1-L4.
- **Ningún código fue modificado durante L0.** Esta es una captura documental pura.
- **Ningún freeze fue modificado.** Phase 5, Phase 6, Phase 7 y Phase 8 permanecen congeladas.
