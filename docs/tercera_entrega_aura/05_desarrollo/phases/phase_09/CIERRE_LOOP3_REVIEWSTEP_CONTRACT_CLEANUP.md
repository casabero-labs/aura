# Cierre Loop L3 — ReviewStep Contract Cleanup

## Objetivo

Resolver el error `prop_contract_mismatch` (DEBT-006) en `src/components/ReviewStep.tsx:477`, donde se pasaba una prop `run` a `ImprovementRunPanel` que no existe en su interfaz `Props`.

## Error objetivo

| Campo | Valor |
| ----- | ----- |
| Archivo | `src/components/ReviewStep.tsx` |
| Línea | 477 |
| Error TS | TS2322 |
| Tipo | `prop_contract_mismatch` |
| Mensaje | `Type '{ run: ImprovementRun; }' is not assignable to type 'IntrinsicAttributes & Props'. Property 'run' does not exist on type 'IntrinsicAttributes & Props'` |

## Causa encontrada

`ReviewStep.tsx` invocaba `<ImprovementRunPanel run={improvementRun} />` pasando una prop `run` de tipo `ImprovementRun`. Sin embargo, la interfaz `Props` de `ImprovementRunPanel` solo declara:

- `beforeCsv?: string`
- `afterCsv?: string`
- `datasetName?: string`
- `evidenceRef?: string`

No existe ninguna prop `run`. `ImprovementRunPanel` es un componente autónomo de Phase 6 con su propia máquina de estados interna (idle → running → done → error) que ejecuta su propio flujo de mejora sobre fixtures controlados. No está diseñado para recibir un `ImprovementRun` externo precalculado.

El consumidor de referencia, `ImprovementRunPage.tsx`, confirma esto: invoca `<ImprovementRunPanel />` sin props.

## Solución aplicada

Se eliminó la prop inválida `run={improvementRun}` de la invocación a `ImprovementRunPanel` en `ReviewStep.tsx:477`. La invocación ahora es `<ImprovementRunPanel />`, alineándose con el contrato real del componente.

El `ReviewStep` ya muestra su propio `HealthDelta` de forma independiente (líneas 342-406). `ImprovementRunPanel` se mantiene como integración visual autónoma dentro del bloque `<details>` técnicos.

## Prop corregida

| Antes | Después |
| ----- | ------- |
| `<ImprovementRunPanel run={improvementRun} />` | `<ImprovementRunPanel />` |

## Componente afectado

`src/components/ReviewStep.tsx` — línea 477 (invocación JSX).

`ImprovementRunPanel.tsx` **no fue modificado**.

## Archivos modificados

1. `src/components/ReviewStep.tsx` — Eliminación de prop `run` inválida.

## Pruebas ejecutadas

| Test | Resultado |
| ---- | --------- |
| `npx tsc --noEmit` | 2 errores (solo DEBT-007, DEBT-008) |
| `npm run build` | Éxito (~3.68s) |
| `npx vitest run __tests__/ImprovementRunPanel.test.tsx` | 2/2 passed |

No existe test específico de `ReviewStep` en el proyecto. Se ejecutó typecheck + build + test relacionado disponible (`ImprovementRunPanel`).

## Resultado de typecheck

```
before: 3 errores (DEBT-006, DEBT-007, DEBT-008)
after:  2 errores (DEBT-007, DEBT-008)
```

DEBT-006 eliminado. Sin errores nuevos.

## Errores restantes

| ID | Archivo | Tipo | Loop |
| -- | ------- | ---- | ---- |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts:55` | e2e_typing_issue | L4 |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts:59` | e2e_typing_issue | L4 |

## Confirmaciones

- [x] No se tocaron contratos v2.
- [x] No se usó `any`, `as any`, `@ts-ignore` ni `@ts-expect-error`.
- [x] No se modificó `tsconfig`.
- [x] No se borró la integración visual.
- [x] No se comentó el render problemático.
- [x] No se modificaron servicios, auditEngine ni scoring.
- [x] No se tocaron freezes Phase 5, Phase 6, Phase 7 ni Phase 8.
- [x] No se tocaron tests E2E.
- [x] No se preparó cuarta entrega.
- [x] No se inició L4.

## Riesgos abiertos

- La integración visual de `ImprovementRunPanel` dentro de `ReviewStep` ahora muestra el panel en su estado `idle` (con botón "Run Improvement Flow") en lugar de mostrar un resultado precalculado. Esto es correcto según el contrato actual del componente, pero podría requerir una futura refactorización si se desea una integración más profunda.

## Próximo loop recomendado

**Phase 9 L4 — E2E Typing Cleanup**

Resolver DEBT-007 y DEBT-008 en `tests/e2e/phase7-claims-visible.spec.ts`.
