# Phase 10 — Estado actual y contrato operativo

## Estado del documento

Documento de control para entender qué existe actualmente en Phase 10, qué falta implementar y qué límites deben respetarse.

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica cerrada.

## Resumen ejecutivo

Phase 10 es el frente de producto que busca reorganizar el antiguo laboratorio de AURA para que deje de funcionar como módulo principal aislado y pase a operar como una calibración experimental opcional dentro del flujo normal.

La intención no es demostrar que existe un mejor modelo universal. La intención es permitir, bajo condiciones explícitas, comparar candidatos o configuraciones sobre el mismo perfil determinista del dataset y registrar evidencia limitada de esa comparación.

## Qué es Phase 10

Phase 10 es:

- una línea de desarrollo de producto;
- una reorganización UX y técnica del laboratorio;
- una capa opcional dentro del flujo principal;
- una forma de comparar candidatos sin romper el flujo normal;
- una estrategia para evitar claims inflados de benchmark.

Phase 10 no es:

- tercera entrega;
- cuarta entrega;
- memoria final;
- benchmark formal terminado;
- validación científica de modelos;
- selección universal del mejor modelo;
- corrección automática de datasets.

## Flujo base que debe preservarse

AURA debe seguir funcionando sin calibración experimental.

El flujo base es:

1. cargar dataset;
2. perfilar con motor determinista;
3. generar diagnóstico;
4. generar script revisable;
5. revisar humanamente;
6. reauditar o exportar evidencia.

La calibración experimental no puede convertirse en paso obligatorio.

## Estado actual real

### L1 — Documentado y parcialmente creado

Estado: completado a nivel documental y de componente UI inicial.

Existe:

- `docs/product/aura/phase_10/L1_CALIBRATION_MODE_OPT_IN.md`;
- `src/components/calibration/CalibrationOptInExplainer.tsx`.

L1 dejó definida la idea central:

- AURA funciona sin calibración;
- la calibración es explícita y opcional;
- la acción principal debe continuar el flujo normal;
- la acción secundaria activa comparación experimental;
- deben mostrarse límites claros.

### L2 — Orquestado, no implementado completamente

Estado: documentado, pendiente de integración controlada en código.

Existe:

- `docs/product/aura/phase_10/L2_AGENT_ORCHESTRATION.md`.

L2 define qué debe modificarse:

- `src/components/MainPipeline.tsx`;
- `src/components/PipelineProgress.tsx`;
- `src/App.tsx`.

Pero al momento de este documento, la integración funcional completa no debe asumirse como hecha.

## Componente existente

El componente creado es:

```text
src/components/calibration/CalibrationOptInExplainer.tsx
```

Responsabilidad del componente:

- explicar qué es la calibración experimental;
- dejar claro que el flujo normal continúa sin usarla;
- ofrecer acción primaria para continuar diagnóstico normal;
- ofrecer acción secundaria para activar comparación experimental;
- mostrar límites metodológicos.

## Integración pendiente

### 1. PipelineProgress

Debe agregar el estado:

```ts
'calibration'
```

dentro del tipo de estado del pipeline.

Orden esperado:

```text
upload → profile → calibration → diagnosis → script → review → export
```

### 2. MainPipeline

Debe:

- importar `CalibrationOptInExplainer`;
- cambiar la continuación de `ProfileStep` para ir a `calibration` antes de `diagnosis`;
- renderizar `CalibrationOptInExplainer` cuando exista reporte de perfilamiento;
- permitir continuar a `diagnosis` sin activar comparación;
- permitir activar comparación mediante `onOpenLab` o mecanismo equivalente.

### 3. App

Debe:

- retirar `Laboratorio` como opción visible de navegación principal;
- retirar botón público de laboratorio en Home;
- mantener temporalmente `BenchmarkLab` como motor interno;
- no eliminar aún `BenchmarkLab` hasta que exista una experiencia embebida equivalente.

## Contrato UX

La pantalla de calibración debe comunicar:

1. La auditoría normal puede continuar sin calibración.
2. La calibración compara candidatos o configuraciones, no corrige datos.
3. La comparación no equivale a benchmark formal.
4. La revisión humana sigue siendo necesaria.
5. La disponibilidad de proveedores depende del entorno real.

## Textos recomendados

Acción primaria:

```text
Continuar diagnóstico normal
```

Acción secundaria:

```text
Activar comparación experimental
```

Nombres aceptables:

- Calibración experimental;
- Comparación opcional de candidatos;
- Comparar modelos antes del diagnóstico.

Nombres a evitar:

- Mejor modelo;
- Benchmark definitivo;
- Modelo ganador;
- Validación formal del modelo;
- Laboratorio obligatorio.

## Modelos disponibles para orquestación

El usuario indicó que se cuenta con:

- MiniMax 3;
- MiniMax 2.7;
- DeepSeek 4 Flash;
- DeepSeek 4 Pro.

Estos nombres pueden usarse para orquestación de desarrollo o como candidatos configurables si existe proveedor real disponible.

No deben aparecer en AURA como promesa de disponibilidad automática.

## Roles sugeridos de modelos

- DeepSeek 4 Pro: integración TypeScript principal en `MainPipeline` y `PipelineProgress`.
- DeepSeek 4 Flash: limpieza de navegación en `App`.
- MiniMax 3: revisión de claridad UX.
- MiniMax 2.7: revisión documental y claims.

## Claims permitidos

AURA puede afirmar que la calibración experimental:

- compara candidatos bajo una misma entrada determinista;
- registra evidencia de configuración y resultados observados;
- puede sugerir un candidato observado para esa ejecución concreta;
- mantiene el flujo normal disponible;
- no reemplaza revisión humana.

## Claims prohibidos

AURA no debe afirmar que:

- encontró el mejor modelo universal;
- realizó benchmark formal definitivo;
- corrigió automáticamente el dataset;
- reemplazó al usuario revisor;
- validó proveedores reales sin evidencia;
- ejecutó una evaluación científica completa si no hay protocolo formal.

## Pruebas mínimas para cerrar L2

Antes de considerar L2 completado, deben pasar:

```bash
npm run typecheck
npm run build
```

Si existen tests relevantes:

```bash
npm test -- --run
```

Greps recomendados:

```bash
grep -R "Abrir laboratorio" src/App.tsx src/components || true
grep -R "Laboratorio" src/App.tsx src/components || true
grep -R "mejor modelo\|benchmark definitivo\|modelo ganador universal\|validación formal" src/components docs/product/aura/phase_10 || true
```

## Definition of Done de Phase 10 L2

L2 puede cerrarse cuando:

1. El usuario puede completar el flujo normal sin activar calibración.
2. La calibración aparece solo como opción informada después del perfil.
3. La acción principal continúa a diagnóstico normal.
4. La acción secundaria abre o activa comparación experimental.
5. `Laboratorio` deja de aparecer como módulo principal visible.
6. `BenchmarkLab` no se elimina todavía si sigue siendo necesario internamente.
7. Typecheck y build pasan.
8. No hay claims de benchmark formal no demostrado.

## Riesgos principales

| Riesgo | Control |
|---|---|
| Convertir calibración en paso obligatorio | Mantener acción primaria de flujo normal |
| Vender benchmark formal sin evidencia | Usar lenguaje de comparación experimental |
| Romper flujo existente | Integración pequeña y verificable |
| Eliminar motor útil demasiado pronto | Mantener `BenchmarkLab` temporalmente |
| Confundir usuario con múltiples módulos | Sacar laboratorio de navegación principal |

## Decisión operativa sobre commits y despliegues

A partir de esta documentación, los cambios preparatorios de Phase 10 no deben empujarse directamente a `main` salvo instrucción explícita del usuario.

Motivo: cada commit en `main` puede disparar despliegues en Coolify y acumular cola innecesaria.

Regla operativa:

- documentación exploratoria: usar rama aparte;
- cambios funcionales: agrupar en un solo commit o PR cuando el usuario autorice;
- no hacer commits pequeños repetidos en `main`;
- no tocar `main` si el objetivo es solo análisis o preparación.

## Próximo paso recomendado

Preparar un único patch funcional de L2 en rama aparte:

```text
docs/phase10-current-state-20260703
```

o una nueva rama funcional dedicada.

El patch debe tocar únicamente:

- `src/components/PipelineProgress.tsx`;
- `src/components/MainPipeline.tsx`;
- `src/App.tsx`;
- documentación mínima de cierre L2.

No se debe hacer merge a `main` hasta autorización explícita del usuario.

## Veredicto

Phase 10 es importante porque corrige una desviación de producto: el laboratorio no debe competir con el flujo principal de AURA. Debe convertirse en calibración opcional, informada y técnicamente trazable.

El estado actual es claro: la intención, el componente inicial y la orquestación existen; la integración funcional completa todavía está pendiente.
