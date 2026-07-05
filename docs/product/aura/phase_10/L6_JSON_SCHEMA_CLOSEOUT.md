# Phase 10 L6 — JSON Schema Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y publicación

- Rama usada: `main`.
- Sin ramas adicionales.
- Commit autorizado después de validaciones exitosas.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El contrato `aura-technical-export` versión `2.0` cuenta con un JSON Schema Draft 2020-12 independiente que especifica su estructura mínima, compatibilidad y límites de calibración.

## Archivo modificado

1. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `docs/product/aura/contracts/aura-technical-export.schema.json`
2. `src/__tests__/exportPackageSchema.test.ts`
3. `docs/product/aura/phase_10/L6_JSON_SCHEMA_CLOSEOUT.md`

## Resumen funcional

- El schema exige:
  - `exportContract`;
  - `manifest`;
  - `profile`;
  - `diagnosis`;
  - `script`;
  - `calibrationEvidence`.
- `exportContract.name` debe ser `aura-technical-export`.
- `exportContract.version` debe ser `2.0`.
- `canonicalBlocks` contiene `calibrationEvidence` y conserva el orden contractual.
- `compatibility.legacyAliasIncluded` debe ser `false`.
- `calibrationEvidence.classification` debe ser `experimental`.
- `calibrationEvidence.summary.status` acepta únicamente:
  - `none`;
  - `attempted`;
  - `preliminary`;
  - `formal`.
- El bloque raíz `experiment` está prohibido y aparece solo como referencia de deprecación/migración.
- El schema valida estructura y compatibilidad; no valida calidad ni verdad de resultados.

## Estrategia de validación

No se agregó una dependencia de validación.

El test focal:

1. carga y parsea el JSON Schema real;
2. resuelve referencias locales `$defs`;
3. recorre restricciones `required`, `const`, `contains` y `enum`;
4. las contrasta con un paquete generado por `buildAuraExportPackage`;
5. verifica la ausencia del bloque raíz deprecado.

## Pruebas ejecutadas

### Export package

```text
cd src && npm test -- --run exportPackage
```

Resultado:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
```

### JSON Schema

```text
cd src && npm test -- --run exportPackageSchema
```

Resultado:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
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
2778 modules transformed
built in 3.12s
exit 0
```

El build conserva advertencias no bloqueantes ya existentes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Greps obligatorios

### Claims prohibidos

Las coincidencias pertenecen a validadores, tests de rechazo y documentos Phase 10 que enumeran restricciones. L6 no declara esos claims como capacidades.

### `experiment`

Las coincidencias pertenecen a:

- metadatos de deprecación/migración;
- tests de ausencia;
- comentarios y tests históricos del evaluador experimental;
- la prohibición explícita dentro del JSON Schema.

No existe como bloque raíz canónico.

### `calibrationEvidence`

Aparece como bloque canónico en código, tests y JSON Schema. El schema lo exige en raíz, en `canonicalBlocks` y como destino de migración.

### Entrega académica

Las coincidencias pertenecen a prohibiciones y verificaciones documentales. No se preparó una nueva entrega. El grep también reportó un archivo swap ignorado que no forma parte del cambio.

## Validación Git prepublicación

`git branch --show-current`:

```text
main
```

`git status --porcelain`:

```text
 M docs/product/aura/NEXT_STEPS.md
?? docs/product/aura/contracts/
?? docs/product/aura/phase_10/L6_JSON_SCHEMA_CLOSEOUT.md
?? src/__tests__/exportPackageSchema.test.ts
```

`git diff --name-status`:

```text
M	docs/product/aura/NEXT_STEPS.md
```

Los archivos nuevos no aparecen en `git diff --name-status` hasta añadirse al índice.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| `exportPackage` no modificado | Cumplida |
| `evidenceManifest` no modificado | Cumplida |
| `auditEngine` no modificado | Cumplida |
| Scoring determinista no modificado | Cumplida |
| Contratos v2 no modificados | Cumplida |
| Freezes Phase 5-9 respetados | Cumplida |
| `docs/tercera_entrega_aura/` no modificado | Cumplida |
| `BenchmarkLab` no eliminado | Cumplida |
| Sin datos reales | Cumplida |
| Sin descarga de modelos en tests | Cumplida |
| Sin ejecución de Python | Cumplida |
| Sin preparación de entrega académica | Cumplida |
| Commit solo después de validaciones exitosas | Cumplida |
| Push solo después de validaciones exitosas | Cumplida |

## Riesgos abiertos

1. El test realiza validación estructural focal; no sustituye un motor JSON Schema completo.
2. Las palabras clave `format` quedan documentadas, pero el test liviano no valida semántica de fechas.
3. Cambios incompatibles futuros deben incrementar la versión del contrato y actualizar schema/tests.
4. El `$id` apunta a la ruta `main`; la trazabilidad exacta depende además del SHA publicado.

## Recomendación

Listo para revisión del orquestador después del commit y push.
