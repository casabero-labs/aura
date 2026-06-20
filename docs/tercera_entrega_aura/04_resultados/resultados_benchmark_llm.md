# Resultados del Benchmark Multi-Modelo y Ciclo de Mejora

**Objetivo Específico 2 (OE2):** evaluar modelos LLM bajo condiciones comparables.
**Objetivo Específico 3 (OE3):** contrastar inferencia local y cloud.
**Objetivo Específico 4 (OE4):** verificar si las salidas generan scripts auditables y útiles para mejorar el dataset.

## Criterio de validez

Las corridas fallidas por API key, WebGPU no disponible, error de proveedor, columnas alucinadas críticas o script inválido se registran como `attempted_failed`. Sirven como trazabilidad, pero **no deben presentarse como resultados experimentales validos de OE2/OE3**.

| Estado | Interpretación |
|---|---|
| `planned` | Experimento preparado, no ejecutado |
| `attempted_failed` | Intento fallido o salida no usable como evidencia |
| `preliminary_valid` | Resultado preliminar defendible para segunda entrega |
| `formal_valid` | Resultado formal con protocolo completo, repeticiones y datasets definidos |

## Tabla de resultados esperada

| Modelo | Proveedor | Input mode | Estado evidencia | Latencia (ms) | JSON | Script válido | Columnas alucinadas | Delta salud simulado | Recomendación |
|---|---|---|---|---:|---|---|---:|---:|---|
| Gemini 2.0 Flash | Cloud | smart_sample | attempted_failed si API key falla | pendiente | pendiente | pendiente | pendiente | pendiente | contraste cloud |
| Gemini 1.5 Pro | Cloud | smart_sample | attempted_failed si API key falla | pendiente | pendiente | pendiente | pendiente | pendiente | contraste cloud |
| Llama 3.2 3B | Local WebLLM | smart_sample | pending/preliminary_valid según WebGPU | pendiente | pendiente | pendiente | pendiente | pendiente | candidato local |
| Qwen 2.5 3B | Local WebLLM | smart_sample | pending/preliminary_valid según WebGPU | pendiente | pendiente | pendiente | pendiente | pendiente | candidato local |
| Modelo seleccionado | Local o cloud | smart_sample | preliminary_valid/formal_valid | exportado por AURA | exportado | exportado | exportado | exportado | recomendado si mejora salud |

## Resultado actualmente conocido

`experiments/results/benchmark_multimodelo.json` contiene intentos Gemini fallidos por API key. Por tanto, ese archivo debe interpretarse como `attempted_failed`, no como validación de OE2.

## Uso en la memoria

Para la segunda entrega, esta tabla debe completarse únicamente con corridas exportadas desde AURA o desde scripts `experiments/` que incluyan:

- dataset;
- modelo;
- proveedor;
- temperatura;
- input mode;
- estado de evidencia;
- validación de alucinaciones;
- validación de script;
- delta de salud si se ejecutó el Ciclo de Mejora Guiado por Evidencia.

## Caso Incidentes Policiales: diagnóstico generativo vs regla determinista

> Ver artefacto completo: `docs/tercera_entrega_aura/03_evidencia/results/incidentes_policiales_aura_vs_gemini.md`
>
> **Delta real documentado (Loop 5c/5d):** score 65→26 (delta −39) vía Python externo + runAudit oficial. Clasificado como `source_debt_preserved`. Ver `experiments/tests/results/incidentes_colab_delta_fixture.json` y `RESUMEN_CIERRE_INCIDENTES_POLICIALES.md`.

### Resumen del caso

Se comparó el diagnóstico histórico de Gemini Nano (Chrome built-in) sobre el dataset `Incidentes_Policiales.csv` (corrida preview de 5,000 filas) contra el motor determinista de AURA antes y después de Loop 2. La app actual procesa el CSV completo por defecto.

### Hallazgo principal

Gemini Nano **no identificó** que `CrimeId` contiene 319 valores (`Handled/Advised`, `Not Recorded`, `Arrest/Citation`, `Gone/Unable to Locate`) que coinciden con el vocabulario de `Disposition`. AURA post-Loop 2 sí lo detecta mediante la regla determinista `Contaminación Semántica de ID`.

### Implicación para OE3/OE4

Este caso constituye evidencia preliminar de que:

1. El diagnóstico generativo (LLM) depende críticamente de la calidad del motor determinista que lo alimenta: tres falsos positivos del motor fueron replicados por Gemini Nano.
2. Una regla determinista nueva puede detectar patrones semánticos que el LLM no produce por sí solo.
3. La combinación "motor determinista corregido → reglas nuevas → diagnóstico LLM informado" es más sólida que cualquiera de las dos capas por separado.

### Estado de evidencia

- **Tipo:** `preliminary_valid`
- **Limitación:** una sola corrida con Gemini Nano; sin repeticiones ni contraste con otros modelos.
- **Reproducibilidad:** el motor determinista es completamente reproducible; la salida de Gemini Nano depende de la disponibilidad del modelo Chrome built-in.
