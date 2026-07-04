# Phase 10 L3 — Priority Addendum

## Propósito

Este addendum actualiza la lectura operativa de `docs/product/aura/NEXT_STEPS.md` después del cierre de Phase 10 L2.

`NEXT_STEPS.md` todavía conserva como próximo frente recomendado una tarea de mantenimiento documental. Esa tarea sigue siendo válida, pero queda como frente secundario.

## Prioridad actual

El próximo frente funcional recomendado es:

Phase 10 L3 — Experiencia embebida de calibración

## Motivo

Phase 10 L2 integró la calibración como paso opt-in dentro del pipeline, pero todavía abre `BenchmarkLab` como pantalla separada mediante `onOpenLab`.

L3 debe reemplazar esa salida lateral por una experiencia embebida dentro del estado `calibration`.

## Alcance L3

1. Mantener la acción primaria: `Continuar diagnóstico normal`.
2. Mantener calibración como opción experimental y no obligatoria.
3. Evitar abrir `BenchmarkLab` como pantalla completa.
4. Crear o integrar un panel embebido dentro del paso `calibration`.
5. Reutilizar lógica existente de benchmark solo si no rompe contratos ni claims.
6. Guardar resultados en `benchmarkResults` o estructura equivalente.
7. No declarar benchmark formal definitivo.
8. No declarar production-ready.
9. No preparar cuarta entrega.

## Frente secundario

Documentation Maintenance L3 — Migrar Phase 9 y Phase 8 queda pendiente como mantenimiento documental, no como bloqueo para Phase 10 L3.

## Documento de orquestación

El prompt operativo para el agente queda en:

`docs/product/aura/phase_10/L3_AGENT_PROMPT.md`
