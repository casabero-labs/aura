# Phase 10 L3 — Embedded Calibration Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y modo de trabajo

- Rama usada: `main`.
- Trabajo local, sin crear ramas.
- Commit autorizado por el usuario después de la validación local.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

La calibración experimental queda embebida dentro del paso `calibration` del pipeline principal. El opt-in ya no abre `BenchmarkLab` como pantalla separada y el flujo normal puede continuar sin ejecutar una comparación.

## Archivos modificados

1. `src/components/MainPipeline.tsx`
2. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `src/components/calibration/CalibrationEmbeddedPanel.tsx`
2. `src/components/calibration/CalibrationEmbeddedPanel.test.tsx`
3. `src/components/MainPipeline.test.tsx`
4. `docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md`

## Resumen funcional

- `CalibrationOptInExplainer` permanece como primera capa del paso.
- `Activar comparación experimental` cambia a la segunda capa sin abandonar `MainPipeline`.
- `CalibrationEmbeddedPanel` muestra proveedor, modelo y dos modos mínimos de entrada.
- La corrida usa `runBenchmarkForConfig` y devuelve el resultado a `MainPipeline`.
- `MainPipeline` conserva cada resultado en `benchmarkResults`.
- La acción principal `Continuar diagnóstico normal` sigue disponible dentro de ambas capas.
- `Cerrar calibración` vuelve a la explicación opt-in.
- Un dataset nuevo cierra cualquier panel abierto y reinicia los resultados.
- `BenchmarkLab` no se eliminó ni se convirtió en destino principal.

## Pruebas ejecutadas

### Panel embebido

Comando:

```text
cd src && npm test -- --run CalibrationEmbeddedPanel
```

Resultado:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

### Filtro calibration

Comando:

```text
cd src && npm test -- --run calibration
```

Resultado:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

### Integración MainPipeline

Comando:

```text
cd src && npm test -- --run MainPipeline
```

Resultado:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

El test verifica que el opt-in abre el panel embebido, que `onOpenLab` no se invoca y que la acción primaria continúa al diagnóstico.

### Typecheck

Comando:

```text
cd src && npm run typecheck
```

Resultado:

```text
tsc --noEmit
exit 0
```

### Build

Comando:

```text
cd src && npm run build
```

Resultado:

```text
vite v6.4.3 building for production...
2777 modules transformed
built in 2.98s
exit 0
```

El build conserva advertencias no bloqueantes sobre imports dinámicos/estáticos y chunks mayores de 500 kB.

## Greps obligatorios

### `Abrir laboratorio`

Sin coincidencias en `src/App.tsx` ni `src/components`.

### `Laboratorio`

Coincidencias:

```text
src/App.tsx:              Laboratorio de Modelos
src/components/HelpCenter.tsx:            <li>Usa <strong>Laboratorio</strong> cuando ya tienes un reporte y quieres comparar modelos o configuraciones.</li>
src/components/HelpCenter.tsx:      title: 'G. Laboratorio de modelos',
src/components/HelpCenter.tsx:            <dt>¿Qué hago si el modelo se equivoca?</dt><dd>Prioriza el perfil determinista, registra la limitación y ajusta configuración o proveedor desde Laboratorio.</dd>
src/components/BenchmarkLab.tsx:            <h1>Laboratorio de calibración</h1>
src/components/BenchmarkLab.tsx:                  El Laboratorio es opcional y no bloquea la auditoría principal. Puedes volver al flujo sin ejecutar corridas.
```

Las coincidencias pertenecen a la pantalla interna conservada, su fallback o contenido de ayuda; no existe un botón de navegación principal ni CTA de Home.

### Claims sensibles

Las coincidencias están en validadores, tests, comentarios o documentos que enumeran claims prohibidos. El código y la documentación nueva no presentan esos claims como capacidades.

## Validación Git prepublicación

`git branch --show-current`:

```text
main
```

`git status --porcelain`:

```text
 M docs/product/aura/NEXT_STEPS.md
 M src/components/MainPipeline.tsx
?? docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md
?? src/components/MainPipeline.test.tsx
?? src/components/calibration/CalibrationEmbeddedPanel.test.tsx
?? src/components/calibration/CalibrationEmbeddedPanel.tsx
```

`git diff --name-status`:

```text
M	docs/product/aura/NEXT_STEPS.md
M	src/components/MainPipeline.tsx
```

Los archivos nuevos no aparecían en `git diff --name-status` antes de añadirse al índice; permanecían visibles como `??` en `git status --porcelain`.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| `auditEngine` no modificado | Cumplida |
| Scoring no modificado | Cumplida |
| Contratos v2 no modificados | Cumplida |
| Freezes Phase 5-9 respetados | Cumplida |
| `docs/tercera_entrega_aura/` no modificado | Cumplida |
| `BenchmarkLab` no eliminado | Cumplida |
| Sin datos reales | Cumplida |
| Sin descarga de modelos en tests | Cumplida |
| Sin ejecución de Python | Cumplida |
| Sin preparación de cuarta entrega | Cumplida |
| Commit solo después de autorización explícita | Cumplida |
| Push solo después de autorización explícita | Cumplida |

## Riesgos abiertos

1. La disponibilidad real del proveedor o modelo sigue dependiendo de la configuración local del usuario.
2. Una configuración no disponible produce evidencia `attempted_failed`; no bloquea el diagnóstico normal.
3. La validación automatizada cubre comportamiento y persistencia, pero queda pendiente la revisión visual humana con dataset sintético.
4. `BenchmarkLab` permanece internamente durante la transición y conserva su superficie histórica.

## Recomendación

Listo para revisión humana. No abrir un nuevo frente funcional hasta validar visualmente el recorrido opt-in, ejecución o fallo controlado, cierre y continuación al diagnóstico.
