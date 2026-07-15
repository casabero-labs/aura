# Hoja de ruta definitiva de AURA

Última actualización: 14 de julio de 2026.

## Resultado que se entrega

AURA queda organizado en dos recorridos complementarios:

1. **Auditoría:** carga, perfil determinista, diagnóstico LLM, informe, exportación y rama opcional de remediación con revisión humana.
2. **Laboratorio:** compara modelos y métodos de entrada sobre un dataset controlado con ground truth. Evalúa únicamente el diagnóstico; no genera scripts ni solicita revisar 27 respuestas manualmente.

## Objetivos definitivos

1. Ingerir y perfilar un CSV localmente.
2. Detectar problemas mediante reglas deterministas.
3. Restringir el diagnóstico LLM a la evidencia observada.
4. Comparar modelos y métodos de entrada con un dataset controlado y referencias conocidas.
5. Conservar métricas, recibos, hashes y evidencia reproducible.
6. Generar informes y exportables comprensibles para revisión humana.

Los seis objetivos permanecen alineados con el producto. El Laboratorio aporta la evidencia del objetivo 4; la remediación pertenece a Auditoría.

## Estado funcional

| Área | Estado |
|---|---|
| Motor determinista | Cerrado y utilizable. |
| Diagnóstico normal V2 | Funcional con Contexto mínimo, Evidencia equilibrada y Evidencia completa. |
| PDF y paquete de evidencia | Funcionales y verificados. |
| Plan, script y revisión humana | Disponibles únicamente en la rama opcional de Auditoría. |
| Aplicar y verificar | Runner Python, recibo, CSV corregido y reauditoría implementados. |
| Laboratorio | Diagnóstico automático, visualización D3, metodología visible, glosario y transferencia de configuración implementados. |
| Campaña piloto | Conservada como evidencia de ajuste; no se presenta como resultado formal. |
| Segunda campaña | Siguiente acción humana después del despliegue del protocolo 2.6.0. |

## Método del Laboratorio

### Insumo obligatorio

Una campaña necesita:

- un CSV controlado;
- un ground truth que indique los hallazgos esperados;
- hashes del CSV, esquema y ground truth;
- modelos instalados en Ollama;
- parámetros de inferencia elegidos antes de crear la campaña.

Sin ground truth no se ejecuta una campaña formal. A futuro se podrá añadir un orquestador para registrar nuevos datasets controlados, pero el insumo de referencia seguirá siendo obligatorio.

### Matriz

- 3 modelos;
- 3 métodos de entrada;
- 3 repeticiones;
- 27 diagnósticos medidos;
- 9 calentamientos excluidos.

Métodos visibles:

- **Contexto mínimo** (`prompt_libre`);
- **Evidencia equilibrada** (`smart_sample`);
- **Evidencia completa** (`recommended`).

### Qué califica AURA

- precisión, recall y F1 como **alineación con el ground truth**;
- fiabilidad: corridas válidas entre corridas intentadas;
- cumplimiento del contrato como gate de validez;
- soporte y anclaje a evidencia visible;
- columnas inventadas y claims sin soporte;
- latencia y tokens.

El índice equilibrado usa:

- fiabilidad: 35 %;
- soporte de evidencia: 25 %;
- ausencia de claims sin soporte: 20 %;
- eficiencia: 20 %.

F1 y contrato no reciben un premio adicional: el primero describe concordancia con una referencia conocida y el segundo decide si la corrida es válida.

## Campaña piloto conservada

La primera campaña produjo 27 intentos, 19 diagnósticos válidos y 8 fallos. Sirvió para descubrir y corregir:

- truncamiento por límite de salida;
- diferencias antiguas entre el pipeline normal y el Laboratorio;
- gobernanza determinista de revisión humana;
- falsos positivos al interpretar valores visibles como claims sin soporte;
- falta de claridad visual durante y después de la ejecución.

No se eliminará ni se reinterpretará como campaña formal. Su función es documentar la evolución del sistema.

## Protocolo de la segunda campaña

La segunda campaña usa `aura.oe4.final-evaluation.v2` versión `2.6.0` y congela:

- dataset `synthetic_ground_truth.csv`;
- los tres hashes de referencia;
- Qwen3.5 4B, Gemma 4 E4B y SmolLM3 3B;
- los tres métodos de entrada;
- tres repeticiones;
- `temperature=0.1`, `topP=0.9`, `think=false`;
- `numCtx` y `numPredict` elegidos en el preflight;
- seed, keep alive y timeout.

Una vez creada, no se cambian dataset, modelos, prompts, contratos o parámetros. Si se cambia cualquiera, se crea otra versión de protocolo.

## Exportación definitiva del Laboratorio

La campaña válida exporta nueve archivos:

1. `campaign.json`;
2. `runs.csv`;
3. `report.md`;
4. `report.pdf`;
5. `results-summary.json`;
6. `methodology.md`;
7. `glossary.md`;
8. `selected-configuration.json`;
9. `manifest.json`.

La configuración seleccionada conserva modelo, método y parámetros exactos y puede aplicarse al siguiente diagnóstico normal sin iniciarlo automáticamente.

## Siguiente acción humana

1. Esperar el despliegue que contenga el protocolo `2.6.0`.
2. Abrir Laboratorio y comprobar los tres modelos instalados.
3. Crear una campaña nueva; la campaña anterior debe quedar visible solo como piloto histórico.
4. Confirmar el perfil de inferencia antes de crearla.
5. Ejecutar la segunda campaña completa.
6. Al terminar, revisar las visualizaciones y seleccionar la combinación adecuada al objetivo.
7. Exportar los nueve archivos antes de cambiar código o configuración.
8. Aplicar, si se desea, la configuración elegida al siguiente diagnóstico de Auditoría.

## Mejoras posteriores a la entrega

- asistente para registrar nuevos datasets controlados y sus ground truths;
- pruebas con más datasets y hardware;
- intervalos de confianza y más repeticiones;
- comparación con proveedores cloud;
- mejoras visuales no bloqueantes del pipeline normal.

Estas mejoras no bloquean la segunda campaña ni la consolidación del documento final.
