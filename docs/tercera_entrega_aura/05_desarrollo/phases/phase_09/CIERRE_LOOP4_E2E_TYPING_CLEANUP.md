# Cierre Loop L4 — E2E Typing Cleanup

## Objetivo

Resolver los 2 errores `e2e_typing_issue` (DEBT-007, DEBT-008) en `src/tests/e2e/phase7-claims-visible.spec.ts`, llevando `npx tsc --noEmit` a 0 errores.

## Errores objetivo

| ID | Archivo | Línea | Error TS | Tipo |
| -- | ------- | ----- | -------- | ---- |
| DEBT-007 | `tests/e2e/phase7-claims-visible.spec.ts` | 55 | TS2347: Untyped function calls may not accept type arguments | e2e_typing_issue |
| DEBT-008 | `tests/e2e/phase7-claims-visible.spec.ts` | 59 | TS2339: Property `textContent` does not exist on type `unknown` | e2e_typing_issue |

## Causa encontrada

Ambos errores se originaban en la función helper `getPanelText`:

1. **DEBT-007 (línea 55):** El parámetro `page` estaba tipado como `any`, lo que provocaba que `page.locator(...).evaluate(...)` fuera una función sin tipo. Dentro del callback, `el.querySelectorAll<HTMLElement>(...)` intentaba usar un type argument (`<HTMLElement>`) en un contexto donde TypeScript no podía inferir la firma de `querySelectorAll`. Resultado: TS2347.

2. **DEBT-008 (línea 59):** Consecuencia del mismo problema de `page: any`. La variable `Notices` (resultado de `Array.from(el.querySelectorAll(...))`) era inferida como `unknown[]`. Al iterar con `.map(n => n.textContent)`, TypeScript rechazaba el acceso a `textContent` sobre tipo `unknown`. Resultado: TS2339.

La función `goToHealthDeltaIdle` también usaba `page: any`, pero no producía errores; se corrigió por consistencia.

## Solución aplicada

### 1. Importar tipo `Page` de Playwright

```typescript
import { test, expect, type Page } from '@playwright/test';
```

### 2. Tipar correctamente `getPanelText`

| Antes | Después |
| ----- | ------- |
| `function getPanelText(page: any): Promise<string>` | `function getPanelText(page: Page): Promise<string>` |
| `.evaluate(el => {` | `.evaluate((el: HTMLElement) => {` |
| `el.querySelectorAll<HTMLElement>(...)` | `el.querySelectorAll(...)` (sin type argument) |
| `const Notices = Array.from(...)` | `const notices = Array.from(notices)` |
| `Notices.map(n => n.textContent ...)` | `notices.map((n) => n.textContent ...)` |

### 3. Tipar correctamente `goToHealthDeltaIdle`

```typescript
async function goToHealthDeltaIdle(page: Page) {
```

## Líneas/helpers corregidos

- `getPanelText`: firma y cuerpo tipados correctamente con `Page` y `HTMLElement`.
- `goToHealthDeltaIdle`: parámetro `page: any` → `page: Page`.
- Se eliminó el type argument `<HTMLElement>` de `querySelectorAll` — el retorno `NodeListOf<Element>` tiene `textContent` por herencia de `Node`.

## Archivos modificados

1. `src/tests/e2e/phase7-claims-visible.spec.ts` — Corrección de tipado en helpers.

## Pruebas ejecutadas

| Prueba | Resultado |
| ------ | --------- |
| `npx tsc --noEmit` | 0 errores |
| `npx playwright test tests/e2e/phase7-claims-visible.spec.ts` | 17/17 passed (6.1s) |
| `npm run build` | Éxito (~6.73s) |

## Conteo before/after

```
before: 2 errores (DEBT-007, DEBT-008)
after:  0 errores
```

## Errores restantes

Ninguno. Typecheck verde.

## Confirmaciones

- [x] Typecheck: 0 errores.
- [x] E2E: 17/17 tests pasan, igual que antes de la corrección.
- [x] No se cambiaron claims funcionales ni asserts.
- [x] No se usó `any`, `as any`, `@ts-ignore`, `@ts-expect-error` ni exclusiones.
- [x] No se tocó código productivo, componentes, servicios, contratos v2, auditEngine ni scoring.
- [x] No se tocaron freezes Phase 5/6/7/8.
- [x] No se tocaron otros specs E2E.
- [x] No se usaron proveedores reales (Chrome AI/Gemini Nano).
- [x] No se descargaron modelos.
- [x] No se inició L5.

## Riesgos abiertos

Ninguno. La corrección es puramente de tipado — el comportamiento del test es idéntico al original.

## Próximo loop recomendado

**Phase 9 L5 — Typecheck Green Verification**

Verificar que `npx tsc --noEmit` permanece en 0 errores, ejecutar suite completa de tests, y preparar freeze de Phase 9.
