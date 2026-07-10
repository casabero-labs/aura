# Laboratorio OE4 y evaluación final de LLM — Diseño aprobado

**Fecha:** 10 de julio de 2026

**Estado:** aprobado para implementación

**Objetivos:** OE3, OE4, OE5 y OE6

## Decisión

El Laboratorio de AURA será el registro oficial de la evaluación LLM del TFM. Cada prueba pertenecerá a una campaña reproducible y conservará el flujo completo: configuración, contrato de entrada, prompts y hashes, diagnóstico, script, validaciones, métricas, revisión humana, ejecución controlada cuando corresponda, reauditoría y artefactos de reporte.

No se construirá un benchmark separado de AURA ni se usarán hojas manuales como fuente primaria. El Laboratorio consolida la evidencia y exporta el expediente final en JSON, CSV, Markdown y PDF.

## 1. Pregunta experimental

> ¿Cómo cambian la calidad, la seguridad, la estabilidad y la utilidad humana del diagnóstico y del script de AURA al variar el modelo local y la composición del contrato de entrada, manteniendo constantes el dataset, el contrato de salida y la configuración de inferencia?

La evaluación compara configuraciones; no pretende declarar un mejor modelo universal.

## 2. Modelos congelados

Los tres modelos se ejecutarán localmente mediante Ollama y usarán cuantización Unsloth `UD-Q4_K_XL`. De esta forma se reduce el sesgo de comparar cuantizaciones distintas.

| Modelo | Identificador exacto para Ollama | Tamaño de referencia | SHA-256 del GGUF de referencia |
|---|---|---:|---|
| Qwen3 8B | `hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL` | 5.14 GB | `34a514d08f7449cb4a694a707aaa2eedccb7bb68290121bf5e5a569b2abe71c3` |
| Gemma 3 4B IT QAT | `hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL` | 2.54 GB | `ccd7e4b76a749936b1bea6aabd6118e6a16c61354acc09b367aec2aae8382c72` |
| DeepSeek R1 0528 Qwen3 8B | `hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL` | 5.12 GB | `f040f922dfd89f0adc57a16309a7c407d39ad099a3997f47c1370ee1f33c380a` |

El nombre correcto de la variante propuesta es `gemma-3-4b-it-qat-UD-Q4_K_XL.gguf`; no `gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf`.

Antes de iniciar la campaña, AURA registrará también el digest que Ollama tenga instalado. Si el identificador, el SHA esperado o el digest local cambian, se crea una campaña nueva; no se mezclan resultados.

### Restricción de hardware

El equipo de referencia es un MacBook Air M4 de 10 núcleos y 16 GB de memoria. Los modelos se ejecutarán secuencialmente y solo uno permanecerá cargado. La diferencia observada entre cliente Ollama `0.31.1` y servidor `0.20.3` debe corregirse antes de las corridas formales y ambas versiones deben quedar registradas en el manifiesto.

## 3. Dataset y oráculos

La campaña usará únicamente `controlled_customers_phase8.csv`:

- 50 filas y 15 columnas;
- dataset sintético y sin PII;
- SHA-256 congelado: `7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf`;
- ground truth histórico: 55 incidencias, con SHA-256 `38c846856860519d248b42e53afe3cacacff714f115af6cec4b3d050fe79040d`;
- score histórico inicial: 0/100 y 29 hallazgos agregados del motor, valores que deberán regenerarse y no copiarse ciegamente.

Antes de ejecutar LLM se crearán dos oráculos versionados:

1. `diagnostic-oracle.v1.json`: normaliza el ground truth a la misma unidad que produce AURA, `ruleId + columnId + scope`. Esto elimina la antigua incompatibilidad entre incidencias por fila y hallazgos agregados por columna.
2. `remediation-oracle.v1.json`: define, para cada hallazgo, acciones esperadas, permitidas, prohibidas y sujetas a revisión humana.

Los oráculos se congelan antes de la primera corrida formal. Cualquier corrección posterior invalida esa campaña y exige una nueva versión.

## 4. Matriz experimental

La matriz principal es:

```text
1 dataset × 3 modelos × 5 modos de entrada × 5 repeticiones = 75 corridas
75 diagnósticos + 75 generaciones de script = hasta 150 llamadas LLM evaluadas
```

Los cinco modos son:

1. `prompt_libre`: resumen mínimo, columnas y tarea; funciona como línea base de contexto limitado.
2. `smart_sample`: contrato AURA y muestra inteligente.
3. `enhanced_registry`: contrato AURA con registro técnico ampliado.
4. `copy_paste_bad_samples`: composición centrada en bad samples controlados.
5. `recommended`: composición AURA recomendada con evidencia, reglas y muestras balanceadas.

Todos los modos usan el mismo schema de salida `aura.diagnosis.v2` y la misma segunda etapa de generación de `aura.script.v2`. Solo cambia la evidencia de entrada. La bifurcación actual que deja `prompt_libre` y `copy_paste_bad_samples` con una sola llamada debe desaparecer del corredor formal.

### Configuración común

- `temperature`: 0.2;
- `top_p`: 0.9;
- `num_ctx`: 16384;
- `num_predict`: 1600 por llamada;
- sin seed fija, porque se medirán cinco repeticiones;
- mismo timeout, keep-alive, versión de prompts y contratos;
- salida de razonamiento interno, si el proveedor la devuelve, se conserva separada y no se califica como diagnóstico final.

La configuración común prima el control experimental. Si una guía de un modelo recomienda otros parámetros, se documentará como amenaza a la validez y no se cambiarán parámetros a mitad de campaña.

### Orden y calentamiento

Las cinco repeticiones forman bloques. El orden de modelos rota mediante un cuadrado latino y los cinco modos se ordenan con una semilla predeclarada dentro de cada bloque. Antes de cada bloque de modelo se ejecuta un warm-up excluido de las métricas. Esto limita el sesgo por orden y evita cargar simultáneamente los tres modelos.

## 5. Qué guarda el Laboratorio

La unidad persistida es `ExperimentRun`, no una fila resumida. Cada corrida conserva:

- campaña, protocolo, secuencia, repetición y estado;
- dataset, fingerprint, commit Git y entorno;
- modelo, repositorio, cuantización, SHA esperado y digest Ollama local;
- modo de entrada, snapshot completo del contrato, prompt y hashes;
- respuesta cruda y parseada del diagnóstico;
- respuesta cruda y parseada del script;
- tokens y tiempos reales reportados por Ollama para diagnóstico y script;
- errores, timeouts, validaciones y traza de estados;
- métricas automáticas del diagnóstico y del script;
- rúbrica humana y observaciones;
- decisión HITL, evidencia de ejecución, reauditoría y delta cuando aplique.

Los registros serán append-only: un fallo o reintento nunca sobrescribe el intento anterior. La corrida fallida cuenta en estabilidad. Un reintento queda enlazado y se reporta como recuperación operacional, no como sustitución silenciosa.

## 6. Persistencia y recuperación

El Laboratorio usará IndexedDB, no `localStorage`, porque las 150 respuestas pueden superar los límites de almacenamiento pequeño. La campaña se podrá pausar, cerrar y reanudar sin perder resultados.

Estados mínimos:

```text
planned → running → completed | failed
completed → awaiting_human → reviewed
reviewed → awaiting_hitl → approved | rejected | blocked
approved → awaiting_external_output → reaudited
```

El dataset no se guarda dentro de cada corrida; se conserva su referencia y fingerprint. El JSON exportado sí incluye las respuestas completas y todas las mediciones.

## 7. Métricas obligatorias

### Diagnóstico

- TP, FP, FN, precisión, recall y F1 frente a `diagnostic-oracle.v1`;
- cumplimiento del schema y del contrato;
- columnas inventadas, reglas inexistentes y claims sin soporte;
- anclaje a `issueId`, `ruleId`, `columnId`, `evidenceRef` y bad samples;
- cobertura de hallazgos deterministas, cognitivos y de revisión humana.

### Operación

- latencia total y por etapa;
- tiempo de carga, evaluación del prompt y generación cuando Ollama lo reporte;
- tokens de entrada, salida y razonamiento si existe;
- errores, timeouts, respuestas vacías, parseos fallidos y recuperación;
- media, mediana, desviación estándar, mínimo y máximo por celda modelo–entrada.

### Script

- contrato y sintaxis válidos;
- existencia de `clean_dataset(df)`;
- imports permitidos y ausencia de red, filesystem o built-ins peligrosos;
- columnas válidas y operaciones permitidas;
- cobertura de acciones del `remediation-oracle.v1`;
- acciones inseguras, destructivas o sin soporte;
- condición de elegibilidad para revisión y ejecución.

### Antes/después

- decisión HITL y motivo;
- estado de ejecución externa controlada;
- score e issues antes/después;
- filas y columnas antes/después;
- celdas modificadas estimadas, reglas resueltas, persistentes o nuevas;
- estado `improved`, `unchanged`, `worsened` o `inconclusive`.

### Rúbrica humana 0–4

Las 75 respuestas completadas reciben tres calificaciones independientes:

- claridad;
- trazabilidad;
- accionabilidad.

Anclajes comunes: 0 = ausente o engañosa; 1 = deficiente; 2 = parcial pero utilizable; 3 = clara y suficientemente respaldada; 4 = precisa, completa y directamente utilizable. Se registra revisor, fecha y nota breve.

## 8. Ejecución dinámica representativa

Las 75 corridas generan diagnóstico y script, y las 75 reciben métricas automáticas y rúbrica humana. No se ejecutarán manualmente 75 scripts.

Se seleccionará un representante por cada celda modelo–modo de entrada: 15 scripts en total. La regla, fijada antes de ver resultados finales, será:

1. ordenar las cinco repeticiones completadas por F1 diagnóstico;
2. seleccionar la mediana;
3. desempatar por el menor número de repetición;
4. si ninguna repetición es ejecutable, conservar la mediana como `blocked` y no sustituirla.

Cada representante pasa por HITL. Solo un script aprobado y que supere preflight y sandbox estático se ejecuta sobre una copia del dataset mediante el runtime externo ya previsto por AURA. El CSV resultante se importa al Laboratorio, se reaudita con el mismo motor y se conserva el `HealthDelta`. Un rechazo o bloqueo también es resultado experimental.

## 9. Análisis y reporte

El reporte final presenta una matriz 3 × 5 y separa cuatro dimensiones:

1. calidad diagnóstica;
2. fidelidad y seguridad del script;
3. desempeño y estabilidad operacional;
4. valoración humana y efecto antes/después.

Se reportan resultados por modelo, por modo de entrada y por interacción modelo–entrada. Con cinco repeticiones se usarán estadísticas descriptivas e intervalos bootstrap; no se harán afirmaciones causales fuertes.

El score compuesto existente puede mostrarse como indicador exploratorio, pero no elegirá un ganador ni sustentará por sí solo una conclusión. El Laboratorio eliminará la acción de “aplicar ganador” del recorrido formal y mostrará “mejor por dimensión”.

## 10. Artefactos del expediente TFM

Una campaña cerrada exporta:

- `campaign.json`: fuente completa y canónica;
- `runs.csv`: tabla plana para análisis;
- `report.md`: método, matrices, resultados, límites y conclusiones;
- `report.pdf`: versión legible para anexos;
- `manifest.json`: hashes, versiones, conteos y referencias.

Los artefactos finales se congelan bajo `experiments/final-evaluation/results/<campaign-id>/` y el documento del TFM cita esos archivos, no cifras copiadas manualmente.

## 11. Gate de evidencia formal

La campaña solo se marca `formal_valid` cuando:

- dataset, oráculos, modelos, runtime, prompts y configuración están congelados;
- las 75 unidades fueron intentadas y los fallos permanecen visibles;
- toda salida completada tiene evaluación automática y rúbrica humana;
- los 15 representantes están aprobados, rechazados o bloqueados explícitamente;
- toda ejecución aprobada tiene salida importada, reauditoría y delta;
- no existe drift de hashes o configuración durante la campaña;
- JSON, CSV, Markdown, PDF y manifiesto se generan y validan.

Con este gate, el Laboratorio cierra OE4 y produce la evaluación LLM necesaria para el TFM; al mismo tiempo aporta evidencia a OE3, OE5 y OE6.

## 12. Fuera de alcance

- comparar proveedores cloud en la campaña final;
- añadir más datasets antes del depósito;
- ejecutar scripts sin HITL;
- afirmar que AURA ejecuta Python dentro del navegador;
- sustituir fallos reales por mocks;
- declarar un mejor modelo universal o extrapolar fuera del dataset controlado.

## 13. Fuentes de los modelos

- [Unsloth Qwen3 8B GGUF — `UD-Q4_K_XL`](https://huggingface.co/unsloth/Qwen3-8B-GGUF/blob/main/Qwen3-8B-UD-Q4_K_XL.gguf)
- [Unsloth Gemma 3 4B IT QAT GGUF — `UD-Q4_K_XL`](https://huggingface.co/unsloth/gemma-3-4b-it-qat-GGUF/blob/main/gemma-3-4b-it-qat-UD-Q4_K_XL.gguf)
- [Unsloth DeepSeek R1 0528 Qwen3 8B GGUF — `UD-Q4_K_XL`](https://huggingface.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF/blob/main/DeepSeek-R1-0528-Qwen3-8B-UD-Q4_K_XL.gguf)
