# Phase 10 L8 — Export Preflight Integration Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y publicación

- Rama usada: `main`.
- Sin ramas adicionales.
- Commit autorizado después de validaciones exitosas.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El flujo de exportación JSON técnica `2.0` cuenta con una prueba focal de integración que verifica el comportamiento visible de `App` cuando el preflight interno falla.

## Archivos modificados

1. `src/App.tsx`
2. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `src/utils/download.ts`
2. `src/__tests__/exportJsonPreflight.integration.test.tsx`
3. `docs/product/aura/phase_10/L8_EXPORT_PREFLIGHT_INTEGRATION_CLOSEOUT.md`

## Resumen funcional

- La prueba usa Vitest, Testing Library y `jsdom`; no requiere Playwright.
- Se monta `App` con una sesión restaurada en estado `export`.
- La UI de exportación y su manejador son reales.
- Se mockean únicamente fronteras externas o costosas:
  - persistencia de sesión;
  - API/configuración;
  - proveedor AI;
  - pipeline principal;
  - preflight;
  - descarga.
- El test pulsa `Empezar auditoría` y luego `JSON técnico`.
- El preflight devuelve un fallo con un detalle interno identificable.
- Se verifica que:
  - `validateAuraExportPackage` fue invocado;
  - `downloadTextFile` no fue invocado;
  - aparece `export-json-preflight-warning`;
  - el texto visible contiene el mensaje controlado;
  - el texto visible no contiene el detalle interno.
- `downloadTextFile` se movió desde `App.tsx` a `src/utils/download.ts` sin alterar su implementación, para permitir un mock explícito y determinista.
- No se agregaron dependencias.

## Pruebas ejecutadas

### Export package

```text
cd src && npm test -- --run exportPackage
```

Resultado:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
Duration    105ms
exit 0
```

### JSON Schema

```text
cd src && npm test -- --run exportPackageSchema
```

Resultado:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
Duration    86ms
exit 0
```

### Export contract validation

```text
cd src && npm test -- --run exportContractValidation
```

Resultado:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
Duration    93ms
exit 0
```

### Export JSON preflight integration

```text
cd src && npm test -- --run exportJsonPreflight
```

Resultado:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
Duration    1.10s
exit 0
```

### Typecheck

```text
cd src && npm run typecheck
```

Resultado:

```text
tsc --noEmit
exit 0
```

### Build

```text
cd src && npm run build
```

Resultado:

```text
vite v6.4.3 building for production...
2780 modules transformed
built in 3.10s
exit 0
```

El build conserva advertencias no bloqueantes ya existentes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Greps obligatorios

### Claims prohibidos

Las coincidencias pertenecen a validadores de claims, tests de rechazo y documentos Phase 10 que enumeran restricciones. L8 no declara esos claims como capacidades.

### `experiment`

Las coincidencias del contrato de exportación pertenecen a deprecación, migración y tests de ausencia. Las coincidencias históricas del evaluador describen corridas experimentales internas; no constituyen un bloque raíz del paquete técnico `2.0`.

### `calibrationEvidence`

Aparece como bloque canónico en el constructor, JSON Schema, preflight y tests. L8 no modifica su estructura ni semántica.

### Entrega académica

Las coincidencias pertenecen a prohibiciones y verificaciones documentales. No se preparó una nueva entrega.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| Sin dependencias nuevas | Cumplida |
| Schema L6 no modificado | Cumplida |
| `exportPackage` no modificado | Cumplida |
| `exportContractValidation` no modificado | Cumplida |
| `evidenceManifest` no modificado | Cumplida |
| `auditEngine` no modificado | Cumplida |
| Scoring determinista no modificado | Cumplida |
| Contratos v2 no modificados | Cumplida |
| Freezes Phase 5-9 respetados | Cumplida |
| `docs/tercera_entrega_aura/` no modificado | Cumplida |
| Sin datos reales | Cumplida |
| Sin descarga de modelos en tests | Cumplida |
| Sin preparación de entrega académica | Cumplida |
| Commit solo después de validaciones exitosas | Cumplida |
| Push solo después de validaciones exitosas | Cumplida |

## Riesgos abiertos

1. La prueba cubre el camino inválido solicitado; el camino exitoso de descarga sigue cubierto indirectamente por tests de construcción y contrato, no por una integración UI.
2. `MainPipeline`, API y proveedor AI están mockeados para aislar la exportación; el test no representa un recorrido completo desde carga de CSV.
3. `downloadTextFile` conserva la implementación existente, pero no tiene un test unitario propio.
4. El preflight continúa siendo un subconjunto ligero del JSON Schema Draft 2020-12.

## Recomendación

Listo para revisión del orquestador después del commit y push. Revisar especialmente que el test pruebe comportamiento observable, que el detalle interno no llegue al DOM y que la extracción de `downloadTextFile` no cambie las demás descargas.
