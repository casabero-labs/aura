# Cierre Loop 1 — Test Dependency Baseline Cleanup

## Objetivo

Resolver los errores `dependency_missing` (DEBT-001 y DEBT-002) del baseline TypeScript, eliminando los errores TS2307 por módulos `@testing-library/*` no encontrados en `__tests__/scriptGenerationStepV2.test.tsx`.

## Errores objetivo

| ID | Archivo | Error TS | Módulo faltante |
| -- | ------- | -------- | --------------- |
| DEBT-001 | `__tests__/scriptGenerationStepV2.test.tsx:12` | TS2307 | `@testing-library/react` |
| DEBT-002 | `__tests__/scriptGenerationStepV2.test.tsx:13` | TS2307 | `@testing-library/user-event` |

## Causa encontrada

Ambas dependencias estaban **declaradas como `devDependencies` en `package.json`** desde el inicio:

- `@testing-library/react: ^16.3.2`
- `@testing-library/user-event: ^14.6.1`

Pero **no estaban instaladas en `node_modules/`**. El directorio `node_modules/@testing-library` no existía. Esto significa que en algún momento `node_modules` fue poblado parcialmente sin incluir estas dependencias (posiblemente por un `npm ci` incompleto o una reinstalación parcial).

## Solución aplicada

```bash
cd src && npm install
```

Esto instaló 54 paquetes faltantes (incluyendo `@testing-library/react`, `@testing-library/user-event` y todas sus dependencias transitivas), removió 3, y actualizó 40.

**No se modificó `package.json`** — las dependencias ya estaban correctamente declaradas. Tampoco se modificó ningún archivo de test ni código fuente.

## Archivos modificados

- `src/package-lock.json` — actualizado automáticamente por `npm install`.
- `src/node_modules/` — paquetes instalados (no commiteados, ignorados por `.gitignore`).

**Ningún archivo `.ts`, `.tsx`, contrato, componente, servicio ni test fue modificado.**

## Pruebas ejecutadas

```bash
cd src && npx vitest run __tests__/scriptGenerationStepV2.test.tsx
```

Resultado:

```
Test Files  1 passed (1)
     Tests  42 passed (42)
  Duration  6.10s
```

Los 42 tests pasan sin errores, confirmando que las dependencias están correctamente instaladas y funcionales.

## Resultado de typecheck

**Antes (L0 baseline):**

```
8 errores TypeScript:
  2 dependency_missing  (DEBT-001, DEBT-002)
  3 mock_type_mismatch   (DEBT-003, DEBT-004, DEBT-005)
  1 prop_contract_mismatch (DEBT-006)
  2 e2e_typing_issue     (DEBT-007, DEBT-008)
```

**Después (L1 cierre):**

```
6 errores TypeScript:
  3 mock_type_mismatch   (DEBT-003, DEBT-004, DEBT-005)
  1 prop_contract_mismatch (DEBT-006)
  2 e2e_typing_issue     (DEBT-007, DEBT-008)
```

### Conteo before/after

| Métrica | Before | After | Delta |
| ------- | ------ | ----- | ----- |
| Total errores | 8 | 6 | -2 |
| dependency_missing | 2 | 0 | -2 |
| mock_type_mismatch | 3 | 3 | 0 |
| prop_contract_mismatch | 1 | 1 | 0 |
| e2e_typing_issue | 2 | 2 | 0 |

### Errores restantes (6)

| ID | Archivo | Tipo | Loop |
| -- | ------- | ---- | ---- |
| DEBT-003 | `components/ImprovementRunPanel.tsx:82` | mock_type_mismatch | L2 |
| DEBT-004 | `components/ImprovementRunPanel.tsx:83` | mock_type_mismatch | L2 |
| DEBT-005 | `components/ImprovementRunPanel.tsx:87` | mock_type_mismatch | L2 |
| DEBT-006 | `components/ReviewStep.tsx:477` | prop_contract_mismatch | L3 |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts:55` | e2e_typing_issue | L4 |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts:59` | e2e_typing_issue | L4 |

## Confirmaciones

- ✅ No se tocaron otras deudas (L2, L3, L4).
- ✅ No se modificaron componentes, servicios, contratos v2.
- ✅ No se tocaron freezes Phase 5/6/7/8.
- ✅ No se tocó `auditEngine` ni `scoring`.
- ✅ No se usó `skipLibCheck`, `any` masivo ni exclusiones globales.
- ✅ No se borraron tests ni se convirtieron en `.skip`.
- ✅ No se comentaron imports.
- ✅ No se preparó cuarta entrega.
- ✅ 0 errores nuevos atribuibles a L1 — el typecheck bajó de 8 a 6 exactamente.
- ✅ Tests existentes pasan: 42/42.

## Riesgos abiertos

- `package-lock.json` fue regenerado por `npm install`, lo que podría traer versiones ligeramente distintas de dependencias transitivas. Los tests pasan sin cambios, lo que sugiere que las diferencias son compatibles.
- Las dependencias `@testing-library/*` estaban declaradas correctamente desde antes, pero su ausencia en `node_modules` sugiere que el lockfile y el estado instalado estaban desincronizados. Esto no debería repetirse si `npm ci` se usa en CI.

## Próximo loop recomendado

**Phase 9 L2 — ImprovementRunPanel Type Fixtures**

Resolver DEBT-003, DEBT-004 y DEBT-005 completando los mocks visuales del harness de `ImprovementRunPanel` con los campos requeridos por `ExecutionSummaryV1`, `OutputDatasetSummaryV1` y `ReauditSummaryV1`.
