# Phase 10 — Integración histórica del laboratorio como calibración opcional

> **Documento histórico, superado el 10 de julio de 2026.** El laboratorio
> operativo y la calibración incrustada fueron retirados. No deben restaurarse.
> La continuación vigente es la consola formal nueva definida en la Task 10 de
> [`2026-07-10-laboratorio-oe4-evaluacion-llm.md`](../../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md).

## Naturaleza de esta fase

Phase 10 no pertenece a una entrega académica cerrada. Es una línea de desarrollo continuo de producto para reorganizar la experiencia de AURA y evitar que el laboratorio aparezca como módulo aislado o como promesa de benchmark formal.

## Objetivo general

Convertir el antiguo laboratorio en una capacidad opcional de calibración dentro del flujo principal de AURA.

El flujo base de AURA sigue siendo:

1. Cargar dataset.
2. Perfilar con motor determinista.
3. Generar diagnóstico.
4. Generar script revisable.
5. Revisar humanamente.
6. Reauditar o exportar evidencia.

La calibración experimental debe quedar como una opción secundaria, informada y no obligatoria.

## Documentos

- `L1_CALIBRATION_MODE_OPT_IN.md`: contrato inicial de producto y UX para explicar la calibración antes de activarla.
- `L2_AGENT_ORCHESTRATION.md`: plan de orquestación para integrar la calibración al flujo principal.

## Regla de rigor

No se deben hacer afirmaciones como:

- “mejor modelo” de forma absoluta;
- “benchmark definitivo”;
- “modelo ganador universal”;
- “corrección automática del dataset”;
- “validación formal” sin evidencia `formal_valid`.

## Estado

- L1: documentado y componente inicial creado.
- L2: orquestación documentada, pendiente de integración controlada en `MainPipeline.tsx`, `PipelineProgress.tsx` y `App.tsx`.
