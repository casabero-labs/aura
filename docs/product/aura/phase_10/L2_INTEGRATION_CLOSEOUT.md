# Phase 10 L2 — Integration Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Objetivo de L2

Integrar la calibración experimental como opción informada dentro del flujo principal de AURA, después del perfilamiento, sin convertirla en requisito y sin mantener el Laboratorio como módulo principal visible.

## Archivos modificados

1. `src/components/MainPipeline.tsx`
2. `src/components/PipelineProgress.tsx`
3. `src/App.tsx`
4. `docs/product/aura/NEXT_STEPS.md`

## Archivos creados

1. `docs/product/aura/phase_10/L2_INTEGRATION_CLOSEOUT.md` (este archivo)

## Resumen de cambios

### MainPipeline.tsx

- Se importa `CalibrationOptInExplainer`.
- `PipelineState` incluye `'calibration'` entre `'profile'` y `'diagnosis'`.
- Navegación por pasos permite `'calibration'` cuando hay datos.
- `ProfileStep.onContinue` redirige a `'calibration'` en lugar de `'diagnosis'`.
- Se renderiza `CalibrationOptInExplainer` cuando el estado es `'calibration'` y existe `report`.
  - Acción primaria: `Continuar diagnóstico normal` → `setState('diagnosis')`.
  - Acción secundaria: `Activar comparación experimental` → `onOpenLab?.()`.

### PipelineProgress.tsx

- `PipelineState` incluye `'calibration'`.
- Steps actualizados:
  - 1: Carga (upload)
  - 2: Perfil (profile)
  - 3: Calibración (calibration)
  - 4: Diagnóstico (diagnosis)
  - 5: Script (script)
  - 6: Revisión (review)
  - 7: Exportar (export)
- `stepOrder` actualizado con `'calibration'`.

### App.tsx

- Botón `Laboratorio` eliminado del menú de navegación desktop.
- Botón `Laboratorio` eliminado del menú de navegación móvil.
- CTA `Abrir laboratorio` eliminado del Home.
- Mantenidos internamente: `showLab`, `goLab`, `BenchmarkLab`, import `FlaskConical`.

### NEXT_STEPS.md

- Sección Phase 10 L2 marcada como completada con referencia al closeout.

## Cómo queda el flujo

1. Carga → 2. Perfil → 3. Calibración (opt-in) → 4. Diagnóstico → 5. Script → 6. Revisión → 7. Exportar.

El flujo base puede completarse sin activar calibración: al perfil, el usuario ve la explicación de calibración y elige "Continuar diagnóstico normal" para seguir al diagnóstico sin interrupción.

## Qué se retiró de navegación

- Botón `Laboratorio` en menú desktop.
- Botón `Laboratorio` en menú móvil.
- CTA `Abrir laboratorio` en Home.

El Home ahora solo muestra: `Empezar auditoría`.

## Qué se conserva internamente

- Componente `BenchmarkLab`.
- Estado `showLab` y función `goLab` en `App.tsx`.
- Import de `FlaskConical` (usado en fallback del lab).
- `onOpenLab` como prop de `MainPipeline`.
- Toda la lógica de comparación experimental de `BenchmarkLab`.

El laboratorio sigue funcional si se activa desde el opt-in de calibración, pero no es accesible como módulo de navegación principal.

## Claims permitidos

- La calibración experimental aparece como opción informada después del perfilamiento.
- El flujo normal puede continuar sin calibración.
- El Laboratorio deja de mostrarse como módulo principal visible.
- BenchmarkLab se conserva como motor experimental interno.
- Las comparaciones siguen siendo evidencia preliminar salvo clasificación formal.

## Claims prohibidos

- No decir que AURA está production-ready.
- No decir que existe benchmark formal definitivo.
- No decir que la calibración elige el mejor modelo universal.
- No decir que la calibración corrige datasets.
- No decir que proveedores reales siempre están disponibles.
- No decir que Chrome AI o Gemini Nano se prueban en E2E estándar.
- No decir que la cuarta entrega ya empezó.

## Pruebas ejecutadas

- `npm run typecheck`
- `npm run build`
- Tests específicos MainPipeline/PipelineProgress/phase10: no existen en el proyecto.

## Riesgos abiertos

- La calibración depende de `onOpenLab` que aún abre `BenchmarkLab` como pantalla separada. L3/L4 deberá reemplazarlo por experiencia embebida.
- No hay tests unitarios para la integración del nuevo estado `calibration` en el pipeline.
- `FlaskConical` permanece en imports de App.tsx aunque solo se usa en fallback del lab.

## Siguiente paso recomendado

**Phase 10 L3**: Reemplazar la apertura de `BenchmarkLab` por una experiencia embebida que devuelva candidatos reutilizables al diagnóstico/script, sin abrir pantalla separada.

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| `auditEngine` no modificado | ✅ |
| Scoring no modificado | ✅ |
| Contratos v2 no modificados | ✅ |
| Freezes Phase 5-9 respetados | ✅ |
| Sin commit | ✅ |
| Sin push | ✅ |
| Sin preparación de cuarta entrega | ✅ |
| `BenchmarkLab` no eliminado | ✅ |
| `docs/tercera_entrega_aura/` no modificado | ✅ |
