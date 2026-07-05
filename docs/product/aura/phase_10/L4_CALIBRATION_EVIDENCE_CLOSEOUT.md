# Phase 10 L4 — Calibration Evidence Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y modo de trabajo

- Rama usada: `main`.
- Trabajo local, sin crear ramas.
- Commit autorizado por el usuario después de la validación local.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

Los resultados de calibración embebida quedan resumidos y exportados como evidencia trazable, con límites metodológicos explícitos y sin convertir una comparación experimental en un ranking absoluto.

## Archivos modificados

1. `src/services/evidenceManifest.ts`
2. `src/types.ts`
3. `src/App.tsx`
4. `src/__tests__/evidenceManifest.test.ts`
5. `docs/product/aura/NEXT_STEPS.md`

## Archivo creado

1. `docs/product/aura/phase_10/L4_CALIBRATION_EVIDENCE_CLOSEOUT.md`

## Resumen funcional

- `EvidenceManifest` incorpora `calibrationSummary`.
- El resumen registra:
  - total de corridas;
  - corridas completadas;
  - intentos fallidos o no disponibles;
  - corridas con `formal_valid`;
  - estado global `none`, `attempted`, `preliminary` o `formal`;
  - declaración defendible y limitaciones.
- `OE3` usa lenguaje de diagnóstico y calibración experimental.
- Los intentos fallidos se conservan como artefacto trazable y no bloquean el diagnóstico normal.
- El manifest ya no calcula ni exporta una configuración destacada por score.
- `allowedClaims.calibrationEvidence` solo admite:
  - `none` para ausencia o intentos sin resultado;
  - `preliminary` para corridas completadas sin `formal_valid`;
  - `formal` cuando existe al menos una corrida `formal_valid`.
- El JSON técnico reemplaza el bloque heredado por `calibrationEvidence`, con clasificación, resumen, resultados e información relacionada del ciclo de mejora.
- La pantalla Exportar muestra el estado de calibración y explica si la evidencia está en revisión o todavía no tiene un resultado concluido.

## Compatibilidad

- `BenchmarkResult` no fue modificado.
- `benchmarkResults` permanece como estado interno del pipeline.
- El schema de salida del manifest cambia de nombres heredados a `calibrationSummary` y `calibrationEvidence`.

## Pruebas ejecutadas

### Evidence manifest

```text
cd src && npm test -- --run evidenceManifest
```

Resultado:

```text
Test Files  1 passed (1)
Tests       20 passed (20)
```

Los casos focales cubren `none`, `attempted`, `preliminary` y `formal`, incluida la conservación de intentos no disponibles y la ausencia de ranking en evidencia preliminar.

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
2777 modules transformed
built in 3.00s
exit 0
```

El build conserva advertencias no bloqueantes ya existentes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Tests de exportación

No existe un test específico del handler `handleExportJson` de `App.tsx`. La estructura metodológica que consume queda cubierta por los 20 tests del manifest y por typecheck/build.

## Greps obligatorios

### Claims prohibidos

Las coincidencias de `mejor modelo`, `modelo ganador`, `ganador universal`, `benchmark definitivo` o `production-ready` pertenecen a:

- validadores de claims;
- tests que comprueban su rechazo;
- comentarios de prohibición;
- documentos Phase 10 que enumeran restricciones.

No aparecen como capacidad declarada por L4.

### Ranking heredado

El comando siguiente no produjo coincidencias:

```text
grep -R "mejor score compuesto\|bestBenchmark" src/services src/components src/App.tsx
```

### Entrega académica

Las coincidencias de `cuarta entrega` pertenecen a prohibiciones y verificaciones documentales previas. El grep también reportó un archivo swap ignorado; no forma parte del cambio.

## Validación Git prepublicación

`git branch --show-current`:

```text
main
```

`git status --porcelain`:

```text
 M docs/product/aura/NEXT_STEPS.md
 M src/App.tsx
 M src/__tests__/evidenceManifest.test.ts
 M src/services/evidenceManifest.ts
 M src/types.ts
?? docs/product/aura/phase_10/L4_CALIBRATION_EVIDENCE_CLOSEOUT.md
```

`git diff --name-status`:

```text
M	docs/product/aura/NEXT_STEPS.md
M	src/App.tsx
M	src/__tests__/evidenceManifest.test.ts
M	src/services/evidenceManifest.ts
M	src/types.ts
```

El closeout nuevo permanecía visible como `??` antes de la autorización explícita para añadirlo al índice.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
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

1. Consumidores externos del JSON heredado deberán migrar del bloque anterior a `calibrationEvidence`.
2. La disponibilidad real de proveedores sigue dependiendo de la configuración local.
3. Una clasificación `formal` solo es defendible para corridas `formal_valid`; no habilita conclusiones universales.
4. Falta revisión humana acumulada del panel L3 y de la pantalla/exportación L4.

## Revisión humana recomendada

| Escenario | Precondición | Acción exacta | Resultado esperado | Evidencia a capturar | Resultado observado | Veredicto | Nota |
|---|---|---|---|---|---|---|---|
| Sin calibración | Dataset sintético perfilado | Omitir calibración y llegar a Exportar | El flujo continúa y no presenta resultados inexistentes | Pantalla Exportar |  |  |  |
| Intento no disponible | Proveedor deliberadamente no disponible | Ejecutar calibración y continuar a Exportar | Estado `attempted`; el diagnóstico normal permanece válido | Panel, Exportar y JSON |  |  |  |
| Resultado preliminar | Proveedor disponible sin clasificación `formal_valid` | Ejecutar calibración, exportar JSON | Estado `preliminary`; texto sin ranking absoluto | Pantalla y bloque `calibrationEvidence` |  |  |  |
| Evidencia formal limitada | Fixture o resultado clasificado `formal_valid` | Abrir Exportar y descargar JSON | Estado `formal` limitado a las corridas clasificadas | Pantalla y JSON |  |  |  |

## Recomendación

Listo para revisión humana acumulada de Phase 10 L3-L4.
