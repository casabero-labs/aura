# Cierre Loop 0 — Technical Debt Baseline Plan

## Objetivo

Capturar y documentar el baseline actual de errores TypeScript (`npx tsc --noEmit`) sin modificar ningún archivo de código, test, servicio, componente ni contrato.

## Comando ejecutado

```bash
cd src && npx tsc --noEmit
```

## Resultado exacto

```
__tests__/scriptGenerationStepV2.test.tsx(12,41): error TS2307: Cannot find module '@testing-library/react' or its corresponding type declarations.
__tests__/scriptGenerationStepV2.test.tsx(13,23): error TS2307: Cannot find module '@testing-library/user-event' or its corresponding type declarations.
components/ImprovementRunPanel.tsx(82,13): error TS2740: Type '{ status: "success"; runtime: "colab_notebook"; logs: undefined[]; }' is missing the following properties from type 'ExecutionSummaryV1': runtimeVersion, startedAt, finishedAt, durationMs, and 2 more.
components/ImprovementRunPanel.tsx(83,13): error TS2739: Type '{ rowCountBefore: number; rowCountAfter: number; columnCountBefore: number; columnCountAfter: number; changedCellsEstimate: number; }' is missing the following properties from type 'OutputDatasetSummaryV1': outputFingerprint, exportedCsvRef
components/ImprovementRunPanel.tsx(87,15): error TS2353: Object literal may only specify known properties, and 'beforeReport' does not exist in type 'ReauditSummaryV1'.
components/ReviewStep.tsx(477,36): error TS2322: Type '{ run: ImprovementRun; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'run' does not exist on type 'IntrinsicAttributes & Props'.
tests/e2e/phase7-claims-visible.spec.ts(55,32): error TS2347: Untyped function calls may not accept type arguments.
tests/e2e/phase7-claims-visible.spec.ts(59,44): error TS2339: Property 'textContent' does not exist on type 'unknown'.
```

## Total de errores

**8 errores TypeScript**

## Archivos afectados

| Archivo | Errores | IDs |
| ------- | ------- | --- |
| `__tests__/scriptGenerationStepV2.test.tsx` | 2 | DEBT-001, DEBT-002 |
| `components/ImprovementRunPanel.tsx` | 3 | DEBT-003, DEBT-004, DEBT-005 |
| `components/ReviewStep.tsx` | 1 | DEBT-006 |
| `tests/e2e/phase7-claims-visible.spec.ts` | 2 | DEBT-007, DEBT-008 |

## Clasificación

| Tipo | Cantidad | IDs |
| ---- | -------- | --- |
| dependency_missing | 2 | DEBT-001, DEBT-002 |
| mock_type_mismatch | 3 | DEBT-003, DEBT-004, DEBT-005 |
| prop_contract_mismatch | 1 | DEBT-006 |
| e2e_typing_issue | 2 | DEBT-007, DEBT-008 |

## Plan de loops propuesto

| Loop | Nombre | Objetivo | Archivos involucrados | DEBTs |
| ---- | ----- | -------- | --------------------- | ----- |
| L1 | Test Dependency Baseline Cleanup | Instalar/resolver `@testing-library/*` | `scriptGenerationStepV2.test.tsx` | DEBT-001, DEBT-002 |
| L2 | ImprovementRunPanel Type Fixtures | Completar mocks visuales con campos requeridos por contratos v1 | `ImprovementRunPanel.tsx` | DEBT-003, DEBT-004, DEBT-005 |
| L3 | ReviewStep Contract Cleanup | Resolver prop `run` mismatch en ReviewStep → ImprovementRunPanel | `ReviewStep.tsx` | DEBT-006 |
| L4 | E2E Typing Cleanup | Corregir tipos sin tipo en `phase7-claims-visible.spec.ts` | `phase7-claims-visible.spec.ts` | DEBT-007, DEBT-008 |
| L5 | Typecheck Green Verification | Verificar `npx tsc --noEmit` sin errores | Todos | Verificación final |
| L6 | Freeze Phase 9 | Congelar Phase 9 si typecheck queda limpio | Documentación | — |

## Confirmaciones

- **No se tocó código.** Solo se crearon documentos de planificación.
- **No se tocaron tests.** Los archivos de test permanecen sin modificar.
- **No se tocaron servicios.** Ningún archivo en `services/` fue modificado.
- **No se tocaron componentes.** Ningún archivo en `components/` fue modificado.
- **No se tocaron contratos v2.** Ningún archivo de contrato fue modificado.
- **No se modificaron freezes.** `FREEZE_PHASE5.md`, `FREEZE_PHASE6.md`, `FREEZE_PHASE7.md` y `FREEZE_PHASE8.md` permanecen intactos.
- **No se preparó cuarta entrega.** Este loop es puramente documental/técnico.
- **No se inició L1.** El próximo loop está planificado pero no ejecutado.

## Próximo loop recomendado

**Phase 9 L1 — Test Dependency Baseline Cleanup**

Resolver DEBT-001 y DEBT-002 instalando o configurando `@testing-library/react` y `@testing-library/user-event` como devDependencies, sin tocar otros archivos.
