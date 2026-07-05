# Phase 10 L5 — Export Schema Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y modo de trabajo

- Rama usada: `main`.
- Trabajo local, sin crear ramas.
- Commit autorizado por el usuario después de la validación local.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El JSON técnico de AURA tiene un contrato explícito y testeable que identifica bloques canónicos, bloques opcionales y la migración desde el bloque heredado, sin reintroducir aliases silenciosos.

## Archivos modificados

1. `src/App.tsx`
2. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `src/services/exportPackage.ts`
2. `src/__tests__/exportPackage.test.ts`
3. `docs/product/aura/phase_10/L5_EXPORT_SCHEMA_CLOSEOUT.md`

## Resumen funcional

- Se crea `buildAuraExportPackage`, función pura responsable de la estructura JSON.
- `App.tsx` construye el manifest, invoca el helper y descarga su resultado.
- `exportContract` declara:
  - nombre `aura-technical-export`;
  - versión `2.0`;
  - fecha de generación;
  - bloques canónicos;
  - bloques opcionales;
  - bloques deprecados;
  - instrucciones de compatibilidad.
- Los bloques canónicos son:
  - `manifest`;
  - `profile`;
  - `diagnosis`;
  - `script`;
  - `calibrationEvidence`.
- `calibrationEvidence` siempre existe, incluso cuando `results` está vacío.
- La migración `experiment → calibrationEvidence` aparece únicamente en metadatos de deprecación y compatibilidad.
- No se incluye alias heredado.
- El manifest continúa siendo la fuente de verdad de `calibrationSummary`.

## Pruebas ejecutadas

### Export package

```text
cd src && npm test -- --run exportPackage
```

Resultado:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

Los tests verifican versión, bloques canónicos, presencia estable de `calibrationEvidence`, ausencia del alias heredado, migración explícita y lenguaje seguro.

### Evidence manifest

`evidenceManifest` no fue modificado en L5; no fue necesario ampliar su suite.

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
built in 3.11s
exit 0
```

El build conserva advertencias no bloqueantes ya existentes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Compatibilidad

- No existe un bloque raíz `experiment`.
- `exportContract.deprecatedBlocks` registra `experiment → calibrationEvidence`.
- `exportContract.compatibility.legacyAliasIncluded` es `false`.
- La instrucción de migración indica leer `calibrationEvidence.results` y `calibrationEvidence.summary`.
- Consumidores externos pueden detectar la versión antes de interpretar el paquete.

## Greps obligatorios

### Claims prohibidos

Las coincidencias pertenecen a validadores, tests de rechazo y documentos Phase 10 que enumeran restricciones. L5 no declara esos claims como capacidades.

### `experiment`

Las coincidencias se dividen en:

- metadatos de deprecación y migración en `exportPackage`;
- tests que comprueban que no existe como bloque raíz;
- comentarios y tests históricos del servicio interno de evaluación experimental.

No existe una propiedad raíz canónica `experiment` en el paquete exportado.

### `calibrationEvidence`

Aparece como:

- bloque canónico en `exportPackage`;
- destino de migración;
- bloque estable con resumen y resultados;
- contrato verificado por tests.

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
 M src/App.tsx
?? docs/product/aura/phase_10/L5_EXPORT_SCHEMA_CLOSEOUT.md
?? src/__tests__/exportPackage.test.ts
?? src/services/exportPackage.ts
```

`git diff --name-status`:

```text
M	docs/product/aura/NEXT_STEPS.md
M	src/App.tsx
```

Los archivos nuevos permanecían visibles como `??` antes de la autorización explícita para añadirlos al índice.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
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
| Commit solo después de autorización explícita | Cumplida |
| Push solo después de autorización explícita | Cumplida |

## Riesgos abiertos

1. El contrato se valida con tests TypeScript, no con un JSON Schema publicado.
2. Cambios incompatibles futuros deberán incrementar la versión de contrato.
3. Consumidores de la estructura anterior deben aplicar la migración indicada.
4. Falta revisión humana de un JSON descargado desde la aplicación.

## Revisión humana recomendada

| Escenario | Precondición | Acción exacta | Resultado esperado | Evidencia a capturar | Resultado observado | Veredicto | Nota |
|---|---|---|---|---|---|---|---|
| Contrato JSON 2.0 | Dataset sintético procesado | Descargar `JSON técnico` y abrir el archivo | `exportContract.version` es `2.0`; `calibrationEvidence` existe; no hay bloque raíz `experiment` | Fragmento del JSON exportado |  |  |  |

## Recomendación

Listo para revisión humana acumulada de Phase 10 L3-L5.
