# Alineacion desarrollo-capaz benchmark

> Evidencia de avance tecnico para segunda entrega.
> Cambio implementado: modulo de benchmark local vs cloud dentro de AURA.

## 1. Decision de arquitectura

AURA debe reflejar en la aplicacion la arquitectura de capas propuesta en la memoria. La Capa 0 local-first no es solo una idea documental: el flujo principal debe privilegiar inferencia local mediante WebLLM/WebGPU. Los proveedores cloud quedan como contraste secundario para evaluar diferencias de rendimiento, formato y alucinacion.

## 2. Cambios implementados en la app

| Archivo | Cambio |
|---|---|
| `src/services/benchmarkService.ts` | Nuevo servicio para ejecutar benchmarks por proveedor usando el mismo `AuditReport`; compara smart sample contra prompt libre. |
| `src/components/BenchmarkPanel.tsx` | Nuevo modulo visual "Local vs Cloud" con seleccion de modelos, ejecucion local, cloud, comparativa y prueba de todos los LLM disponibles. |
| `src/types.ts` | Nuevo tipo `BenchmarkResult` para guardar metricas experimentales. |
| `src/App.tsx` | Integracion del modulo benchmark tras la Capa Cognitiva; WebLLM local queda como configuracion principal por defecto. |
| `src/services/auditEngine.ts` | Nueva regla R23 para detectar redundancia temporal derivable (`datetime` -> `time`). |
| `src/index.css` | Estilos del panel de benchmark y tabla de resultados. |

## 3. Relacion con capas

| Capa | Reflejo actual en AURA |
|---|---|
| Capa 0 | Selector local/cloud, WebLLM como proveedor primario, CSV y reglas ejecutados en navegador. |
| Capa 1 | `auditEngine.ts` genera el `AuditReport` usado como base factual unica para ambos proveedores; ahora detecta redundancia temporal derivable. |
| Capa 2 | El benchmark ejecuta salida controlada sobre smart sample y respuesta libre sobre esquema minimo para medir diferencia de alucinacion. |
| Capa 3 | Se mide si el proveedor devuelve script Pandas HITL y si referencia columnas inexistentes. |

## 4. Metricas del modulo

| Metrica | Proposito |
|---|---|
| Latencia total | Comparar coste temporal de inferencia local vs cloud. |
| First token | Evaluar rapidez inicial del proveedor cuando la metrica este disponible. |
| Tokens generados | Aproximar volumen de salida. |
| Tokens por segundo | Comparar rendimiento relativo. |
| Cumplimiento JSON | Verificar salida estructurada para reporte ejecutivo. |
| Script HITL incluido | Verificar si el modelo genera acciones auditables. |
| Columnas alucinadas | Detectar referencias `df['columna']` que no existen en el dataset. |
| Modo de entrada | Comparar `smart_sample` frente a `prompt_libre`. |

## 5. Uso experimental

Flujo esperado:

1. Cargar CSV en AURA.
2. Ejecutar motor determinista.
3. Revisar hallazgos y smart sample.
4. Seleccionar modelo local o cloud especifico.
5. Ejecutar benchmark local: smart sample y prompt libre.
6. Ejecutar benchmark cloud como contraste secundario: smart sample y prompt libre.
7. Opcionalmente ejecutar "Probar todos los LLM" para comparar todo el banco de modelos registrado.
8. Comparar resultados en la tabla del modulo.
9. Registrar resultados consolidados en `experiments/results/` cuando se haga una corrida formal.

## 6. Estado actual

El modulo ya esta integrado y la app compila. La ejecucion real dependera de:

- soporte WebGPU del navegador para WebLLM local;
- API key valida para Gemini cloud;
- datasets definidos para benchmark formal.

Verificacion tecnica:

- `npm run build` ejecutado correctamente.
- Servidor local levantado en `http://127.0.0.1:3000/`.
