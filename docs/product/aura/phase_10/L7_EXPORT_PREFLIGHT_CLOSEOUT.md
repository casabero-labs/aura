# Phase 10 L7 — Export Preflight Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y publicación

- Rama usada: `main`.
- Sin ramas adicionales.
- Commit autorizado después de validaciones exitosas.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El paquete `aura-technical-export` versión `2.0` pasa por un preflight interno ligero antes de que `App.tsx` inicie la descarga del JSON técnico.

## Archivos modificados

1. `src/App.tsx`
2. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `src/services/exportContractValidation.ts`
2. `src/__tests__/exportContractValidation.test.ts`
3. `docs/product/aura/phase_10/L7_EXPORT_PREFLIGHT_CLOSEOUT.md`

## Resumen funcional

- `validateAuraExportPackage` recibe una entrada desconocida y devuelve:
  - `valid`;
  - `errors`;
  - `warnings`.
- El preflight verifica:
  - existencia de `exportContract`;
  - nombre `aura-technical-export`;
  - versión `2.0`;
  - presencia de `calibrationEvidence` en `canonicalBlocks`;
  - `legacyAliasIncluded === false`;
  - ausencia del bloque raíz heredado;
  - existencia de `calibrationEvidence`;
  - clasificación `experimental`;
  - estado `none`, `attempted`, `preliminary` o `formal`.
- La declaración de migración heredada ausente genera un warning no bloqueante.
- `App.tsx` valida inmediatamente después de construir el paquete y antes de `downloadTextFile`.
- Un fallo cancela la descarga, registra contexto técnico y muestra un aviso controlado sin errores internos crudos.

## Pruebas ejecutadas

### Export package

```text
cd src && npm test -- --run exportPackage
```

Resultado:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
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
2779 modules transformed
built in 3.00s
exit 0
```

El build conserva advertencias no bloqueantes ya existentes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Greps obligatorios

### Claims prohibidos

Las coincidencias pertenecen a validadores de claims, tests de rechazo y documentos Phase 10 que enumeran restricciones. L7 no declara esos claims como capacidades.

### `experiment`

Las coincidencias del contrato de exportación pertenecen exclusivamente a:

- metadatos de deprecación/migración;
- reglas de rechazo del preflight;
- tests que verifican su ausencia.

Las coincidencias históricas en el evaluador de benchmark y sus tests describen corridas experimentales internas; no constituyen un bloque raíz del paquete técnico 2.0.

### `calibrationEvidence`

Aparece como bloque canónico en el constructor, JSON Schema, preflight y tests. El preflight exige tanto el bloque raíz como su presencia en `canonicalBlocks`.

### Entrega académica

Las coincidencias pertenecen a prohibiciones y verificaciones documentales. No se preparó una nueva entrega. El grep reporta además un archivo swap ignorado preexistente que no forma parte del cambio.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| Schema L6 no modificado | Cumplida |
| `exportPackage` no modificado | Cumplida |
| `evidenceManifest` no modificado | Cumplida |
| `auditEngine` no modificado | Cumplida |
| Scoring determinista no modificado | Cumplida |
| Contratos v2 no modificados | Cumplida |
| Freezes Phase 5-9 respetados | Cumplida |
| `docs/tercera_entrega_aura/` no modificado | Cumplida |
| Sin datos reales | Cumplida |
| Sin descarga de modelos en tests | Cumplida |
| Sin ejecución de Python | Cumplida |
| Sin preparación de entrega académica | Cumplida |
| Commit solo después de validaciones exitosas | Cumplida |
| Push solo después de validaciones exitosas | Cumplida |

## Riesgos abiertos

1. El preflight duplica de forma intencional un subconjunto crítico del JSON Schema; cambios futuros deben mantener sincronizados schema, validador y tests.
2. La validación ligera no sustituye un motor JSON Schema Draft 2020-12 completo.
3. Los warnings no bloqueantes se registran en consola y no se muestran en la interfaz.
4. El flujo de error se cubre a nivel del validador; no se agregó una prueba de navegador para interceptar la descarga.

## Recomendación

Listo para revisión del orquestador después del commit y push. Revisar especialmente la equivalencia entre las invariantes runtime y el schema L6, además del orden `buildAuraExportPackage` → preflight → `downloadTextFile`.
