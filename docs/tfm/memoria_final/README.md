# Memoria final del TFM — entorno canónico

Fecha de preparación: 2026-07-14

Esta carpeta es la única entrada para redactar, revisar y cerrar la memoria final de AURA. No contiene todavía el DOCX definitivo: primero fija qué fuentes son vigentes y cuáles quedan excluidas como estado actual.

## 1. Fuente operativa vigente

- `docs/product/aura/NEXT_STEPS.md`

Es la bitácora de cierre actualizada durante la campaña experimental. Define el estado técnico, la configuración V2.4, las corridas válidas o fallidas, las tareas urgentes y los límites de claims.

## 2. Fuente académica de objetivos

- Última entrega académica evaluada y su copia histórica bajo `docs/archive/academic/entrega_03_historica/`.
- La formulación vigente es: un objetivo general y seis objetivos específicos OE1–OE6.

Los borradores anteriores pueden aportar texto o contexto, pero no deben reemplazar esta formulación.

## 3. Fuentes canónicas de evidencia

### OE1–OE2 — arquitectura y motor determinista

- `experiments/results/final_deterministic_evidence.json`
- `experiments/results/final_deterministic_evidence.md`
- `src/services/finalDeterministicEvidence.ts`
- `src/__tests__/finalDeterministicEvidence.test.ts`

### OE3–OE4 — diagnóstico restringido y evaluación LLM

- `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm-design.md`
- `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md`
- `docs/product/aura/NEXT_STEPS.md`
- campañas y expedientes persistidos en `experiments/final-evaluation/` y `experiments/tests/`

Toda corrida fallida se conserva como evidencia. Un JSON incompleto, una salida truncada o un incumplimiento contractual no se convierten en éxito ni se reparan silenciosamente.

### OE5–OE6 — HITL, script y ejecución controlada

- artefactos de `experiments/tests/flujo5/`, `experiments/tests/flujo6/` y `experiments/tests/flujo7/` cuando existan en el commit de cierre;
- recibos, scripts aprobados, CSV corregido, reauditoría y manifiestos exportados;
- código y tests del runner, validación de recibos y rama opcional de remediación.

## 4. Fuentes históricas que no definen el estado actual

- `docs/archive/academic/entrega_03_historica/`;
- closeouts y freezes de fases cerradas;
- planes con fecha anterior que ya fueron ejecutados o sustituidos;
- borradores de primera, segunda y tercera entrega;
- `experiments/results/deterministic_validation.json`;
- resultados mock o pilotos invalidados por truncamiento;
- scripts específicos para actualizar entregas intermedias.

Estas fuentes se consultan para trazabilidad, antecedentes y redacción histórica. No deben citarse como resultado final sin contrastarlas con las fuentes canónicas.

## 5. Regla de prioridad cuando dos archivos contradicen

1. Artefacto experimental exportado y verificable.
2. Código y tests del commit de cierre.
3. `docs/product/aura/NEXT_STEPS.md`.
4. Diseño o protocolo vigente de OE4.
5. Plan del 9 de julio como línea base histórica.
6. Closeouts, freezes y entregas archivadas.

## 6. Estructura de trabajo para la memoria

```text
docs/tfm/memoria_final/
├── README.md                 # esta frontera documental
├── borrador/                 # capítulos en elaboración
├── figuras/                  # capturas y diagramas seleccionados
├── tablas/                   # tablas derivadas de evidencia canónica
├── anexos/                   # manifiestos, protocolos y recibos relevantes
└── entrega/                  # DOCX y PDF finales verificados
```

Las subcarpetas se crearán cuando exista contenido real. No se copiarán paquetes enteros por comodidad: se enlazarán o seleccionarán solo las piezas usadas en el documento.

## 7. Reglas de cierre

- No abrir nuevas fases de producto para redactar la memoria.
- No afirmar benchmark formal definitivo hasta cerrar y verificar la campaña prevista.
- No atribuir al LLM el score ni los hallazgos deterministas.
- No afirmar corrección automática universal del dataset.
- No ocultar fallos, truncamientos, pausas o revisiones humanas obligatorias.
- Cada tabla, figura y conclusión debe poder remontarse a un archivo, hash, commit o recibo verificable.
