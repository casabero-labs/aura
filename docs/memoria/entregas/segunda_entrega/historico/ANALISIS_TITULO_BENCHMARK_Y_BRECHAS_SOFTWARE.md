# Analisis del titulo, benchmark y brechas de software

> Fecha: 2026-05-19  
> Proposito: evaluar si el titulo actual y el estado del software sostienen la narrativa de la segunda entrega.

## 1. Titulo actual

Titulo observado:

> AURA: Entorno de diagnostico cognitivo para la calidad del dato mediante benchmarking de LLMs

## 2. Opinion tecnica

El titulo es defendible solo si el benchmark de LLMs se presenta como una parte central y funcional de la contribucion. En el estado actual, AURA tiene una base solida en:

- arquitectura local-first;
- motor determinista;
- perfilamiento del dataset;
- hallazgos reproducibles;
- diagnostico asistido;
- generacion y validacion de scripts;
- revision humana.

La parte de benchmark existe en codigo, pero todavia necesita corridas reales, exportables y defendibles para sostener el peso que el titulo le otorga. Por tanto, el riesgo del titulo actual es que promete que el eje principal es el benchmarking, cuando la evidencia mas fuerte hoy esta en el flujo hibrido de auditoria y mejora de calidad del dato.

## 3. Alternativas de titulo mas alineadas

### Opcion A - recomendada

> AURA: arquitectura local-first para auditoria inteligente de calidad del dato con diagnostico asistido por LLM

Ventaja: pone en primer plano lo que ya esta mas maduro: arquitectura, auditoria, calidad del dato y LLM como apoyo.

### Opcion B - mantiene benchmark sin sobredimensionarlo

> AURA: entorno local-first de auditoria de calidad del dato con diagnostico asistido y benchmarking de LLMs

Ventaja: conserva benchmarking, pero no lo presenta como unico mecanismo.

### Opcion C - cercana al titulo actual

> AURA: entorno de diagnostico cognitivo para la calidad del dato con evaluacion comparativa de LLMs locales y cloud

Ventaja: suaviza "mediante benchmarking" y lo convierte en evaluacion comparativa.

## 4. Estado real del benchmark en software

Componentes existentes:

- `src/components/BenchmarkLab.tsx`: laboratorio experimental separado.
- `src/components/ExperimentDesigner.tsx`: configuracion de experimentos.
- `src/services/benchmarkService.ts`: ejecucion por modelo, proveedor y modo de entrada.
- `src/services/benchmark/hallucinationDetector.ts`: columnas fantasma, claims sin soporte, JSON y scripts.
- `src/services/benchmark/evaluationService.ts`: score compuesto, estadisticos y export JSON.
- `src/components/BenchmarkCharts.tsx`: visualizaciones.

Fortalezas:

- existe arquitectura de benchmark;
- soporta local/cloud;
- diferencia `smart_sample` de `prompt_libre`;
- mide latencia, tokens, compliance JSON, script y alucinaciones;
- exporta JSON experimental;
- se conecto el resultado del laboratorio al `JSON audit` general.

Brechas:

- falta ejecutar corridas formales reales y exportarlas;
- el archivo `experiments/results/benchmark_multimodelo.json` contiene fallos por API key y no sirve como resultado valido;
- no hay todavia un protocolo de repeticion por modelo/dataset dentro del documento final;
- falta evidencia visual/capturas del laboratorio ejecutado con resultados;
- falta decidir modelos minimos para la segunda entrega;
- falta un dataset de prueba oficial para capturas y resultados;
- falta una tabla final de resultados con estado `preliminary_valid` o `attempted_failed`.

## 5. Recomendacion de software para cerrar brechas

Prioridad alta:

1. Definir dataset oficial de segunda entrega.
2. Ejecutar el flujo completo de AURA en navegador.
3. Exportar `aura_audit_*.json`, `aura_issues_*.csv`, script aprobado y `aura_improvement_run_*.json`.
4. Ejecutar al menos una corrida cloud valida o una local valida, segun disponibilidad.
5. Exportar `benchmark-results-*.json`.
6. Insertar capturas de cada etapa en el Word.

Prioridad media:

1. Agregar una pantalla de "protocolo experimental" que obligue a registrar dataset, modelo, proveedor, temperatura, input mode y estado de evidencia.
2. Agregar export de benchmark tambien desde `BenchmarkLab`, no solo desde `ExperimentDesigner`.
3. Persistir benchmark results en localStorage para no perder resultados al cerrar el laboratorio.
4. Mostrar en interfaz si una corrida es `preliminary_valid`, `attempted_failed` o `planned`.

Prioridad baja:

1. Agregar comparacion automatica `smart_sample` vs `prompt_libre`.
2. Agregar repeticiones por modelo para media, desviacion estandar y coeficiente de variacion.
3. Generar tabla APA-ready para copiar al documento.

## 6. Decision editorial recomendada

Para la segunda entrega, el documento debe decir:

> AURA incorpora un modulo experimental de comparacion de LLMs. El modulo se encuentra implementado a nivel funcional y permite medir latencia, cumplimiento de formato, alucinaciones y validez de scripts. Sin embargo, las corridas formales completas se reportan como trabajo experimental en curso, y solo se presentan como resultados aquellas exportadas con credenciales/modelos disponibles y estado de evidencia valido.

Esto protege el TFM: no niega el benchmark, pero tampoco lo sobredimensiona antes de tener evidencia suficiente.
