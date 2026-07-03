# Phase 10 L2 — Orquestación para integrar calibración experimental en el flujo principal

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Propósito

Esta fase inicia la integración real del antiguo laboratorio dentro del flujo principal de AURA, pero sin convertirlo en un requisito ni desplazar el objetivo principal del producto.

El objetivo de AURA sigue siendo:

1. cargar dataset;
2. perfilar con motor determinista;
3. generar diagnóstico;
4. generar script revisable;
5. revisar humanamente;
6. reauditar o exportar evidencia.

La calibración experimental queda como una opción secundaria, explícita e informada.

## Modelos disponibles para orquestación

El usuario indicó disponibilidad de:

- MiniMax 3;
- MiniMax 2.7;
- DeepSeek 4 Flash;
- DeepSeek 4 Pro.

Estos modelos no deben aparecer como promesa de disponibilidad dentro de AURA. Solo deben usarse como agentes de desarrollo/orquestación o como candidatos configurables si el proveedor real está disponible y registrado por evidencia.

## Regla central de producto

La acción principal del usuario debe ser siempre continuar el flujo normal.

Texto recomendado:

```txt
Continuar diagnóstico normal
```

La acción secundaria puede activar calibración:

```txt
Activar comparación experimental
```

AURA no debe decir:

- “mejor modelo”;
- “benchmark definitivo”;
- “modelo ganador universal”;
- “validación formal” si no hay `formal_valid`;
- “corrección automática del dataset”.

## Estado actual antes de L2

Ya existe el componente:

- `src/components/calibration/CalibrationOptInExplainer.tsx`

Este componente:

- explica que AURA funciona sin calibración;
- separa qué hace y qué no hace la calibración;
- mantiene como acción primaria `Continuar diagnóstico normal`;
- expone una acción secundaria `Activar comparación experimental`.

## Problema a resolver

Actualmente `Laboratorio` todavía funciona como módulo autónomo visible desde:

- navegación de escritorio;
- navegación móvil;
- botón en Home;
- render condicional separado en `App.tsx`.

Esto contradice la dirección de producto: la calibración debe estar integrada en el flujo, no vendida como módulo principal.

## Diseño de L2

### Cambio 1 — Agregar estado `calibration` al pipeline

Actualizar:

- `src/components/MainPipeline.tsx`
- `src/components/PipelineProgress.tsx`

Tipo esperado:

```ts
export type PipelineState = 'upload' | 'profile' | 'calibration' | 'diagnosis' | 'script' | 'review' | 'export';
```

El stepper puede mostrarlo como:

```ts
{ num: 3, label: 'Calibración', state: 'calibration' }
```

El diagnóstico pasaría a paso 4, script a 5, revisión a 6 y exportación a 7.

### Cambio 2 — Insertar `CalibrationOptInExplainer` después de perfil

En `MainPipeline.tsx`:

- importar `CalibrationOptInExplainer`;
- cambiar `ProfileStep.onContinue` de `setState('diagnosis')` a `setState('calibration')`;
- renderizar el nuevo estado `calibration` cuando exista `report`.

Ejemplo esperado:

```tsx
{state === 'calibration' && report && (
  <CalibrationOptInExplainer
    benchmarkCount={benchmarkResults.length}
    onContinueStandardFlow={() => setState('diagnosis')}
    onStartCalibration={() => {
      addLog('calibration.opt_in :: user opened experimental comparison');
      onOpenLab?.();
    }}
  />
)}
```

### Cambio 3 — Mantener navegación del flujo normal

Actualizar navegación por pasos para permitir acceso si hay datos:

```ts
if (step === 'upload' || (hasData && ['profile', 'calibration', 'diagnosis', 'script', 'review', 'export'].includes(step))) {
  setState(step);
}
```

### Cambio 4 — Retirar laboratorio de navegación principal

Actualizar `src/App.tsx`:

- quitar el botón `Laboratorio` del menú escritorio;
- quitar el botón `Laboratorio` del menú móvil;
- quitar `Abrir laboratorio` del Home;
- mantener internamente `goLab` y `BenchmarkLab` durante L2 para que el opt-in lo pueda abrir;
- no eliminar `BenchmarkLab` todavía.

Motivo: en L2 el motor sigue existiendo, pero deja de ser una sección visible independiente.

### Cambio 5 — Ajustar lenguaje del Home

El Home debe vender el flujo base, no la calibración.

Texto recomendado:

```txt
Empezar auditoría
```

No mostrar botón público de laboratorio.

## División por agente/modelo

### DeepSeek 4 Pro — Integración TypeScript principal

Responsabilidad:

- modificar `MainPipeline.tsx`;
- modificar `PipelineProgress.tsx`;
- garantizar que el tipo `PipelineState` no quede duplicado de forma incompatible;
- mantener el flujo normal funcional.

Criterios:

- `calibration` compila;
- `ProfileStep` conduce a `calibration`;
- `Continuar diagnóstico normal` conduce a `diagnosis`;
- `Activar comparación experimental` llama a `onOpenLab`;
- no se hacen claims inflados.

### DeepSeek 4 Flash — Limpieza de navegación

Responsabilidad:

- modificar `App.tsx`;
- retirar laboratorio de nav escritorio, nav móvil y Home;
- mantener `goLab` como callback interno;
- no eliminar todavía `BenchmarkLab`.

Criterios:

- no aparece `Laboratorio` como botón principal;
- no aparece `Abrir laboratorio` en Home;
- el flujo normal sigue entrando por `Empezar auditoría`.

### MiniMax 3 — Revisión UX de claridad

Responsabilidad:

- revisar textos del componente `CalibrationOptInExplainer`;
- asegurar lenguaje claro, honesto y no técnico en exceso;
- mantener límites metodológicos visibles.

Criterios:

- el usuario entiende que la calibración es opcional;
- el usuario entiende que no corrige datos;
- el usuario entiende que no es benchmark formal;
- la acción primaria sigue siendo el flujo normal.

### MiniMax 2.7 — Documentación y claims

Responsabilidad:

- actualizar docs de Phase 10;
- registrar qué se cambió y qué no se cambió;
- revisar claims prohibidos.

Criterios:

- documentar que L2 integra opt-in pero no reemplaza aún `BenchmarkLab`;
- documentar que los proveedores/candidatos dependen de disponibilidad real;
- registrar limitaciones.

## Pruebas mínimas obligatorias

Ejecutar:

```bash
npm run typecheck
npm run build
```

Si existen tests E2E o de componentes relevantes:

```bash
npm test -- --run
```

## Greps obligatorios

Después de L2, revisar:

```bash
grep -R "Abrir laboratorio" src/App.tsx src/components || true
grep -R "Laboratorio" src/App.tsx src/components || true
grep -R "mejor modelo\|benchmark definitivo\|modelo ganador universal\|validación formal" src/components docs/product/aura/phase_10 || true
```

Criterio:

- `Laboratorio` no debe aparecer como navegación principal;
- claims prohibidos solo pueden aparecer en secciones de advertencia o claims prohibidos;
- no debe existir lenguaje que venda calibración como obligación.

## Definition of Done L2

L2 se considera completado si:

1. El flujo base puede completarse sin activar calibración.
2. La calibración aparece solo como opción informada después del perfil.
3. El usuario puede continuar diagnóstico normal con la acción principal.
4. El usuario puede activar comparación experimental con acción secundaria.
5. Laboratorio deja de aparecer como módulo principal visible.
6. No se elimina aún `BenchmarkLab` ni el motor experimental.
7. Typecheck y build pasan.
8. La documentación registra limitaciones y no hace claims formales no demostrados.

## Veredicto de orquestación

La modificación debe hacerse en dos capas:

1. **Capa UX inmediata:** esconder el laboratorio como sección principal y presentar calibración opt-in dentro del pipeline.
2. **Capa técnica posterior:** reemplazar la apertura de `BenchmarkLab` por una experiencia embebida que devuelva candidatos reutilizables al diagnóstico/script.

L2 solo cubre la primera capa. La segunda capa corresponde a L3 o L4.
