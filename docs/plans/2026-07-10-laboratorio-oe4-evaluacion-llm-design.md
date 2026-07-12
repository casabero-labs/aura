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
| Gemma 4 E4B IT QAT | `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL` | 4.22 GB | `b3052f962d6449b4eb2075733c068bdec1c51eadb7b237e6c3157bfbb7b1dae0` |
| SmolLM3 3B | `hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL` | 1.94 GB | `305234462409d659233b0ea75fd1e070cc28d5add7d0480f2db02387679e3d0c` |

Corrección previa a la primera corrida formal, 12 de julio de 2026: la variante aprobada es `gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf`. DeepSeek se retira porque no ofrece una operación suficientemente holgada en el MacBook Air M4 de 16 GB; `SmolLM3-3B` conserva diversidad de familia, español nativo y una descarga de 1.94 GB.

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

El archivo histórico de ground truth se conserva byte a byte y no se corrige. Su array contiene realmente 51 incidencias `deterministic_expected`, 2 `cognitive_expected` y 2 `human_review_expected`, aunque el `summary` declara 50/3/2. La copia congelada preservará esa discrepancia y el nuevo oráculo recalculará los conteos desde `issues`, dejando `sourceMetadataMismatch: true`. Así no se altera evidencia histórica ni se propaga un resumen incorrecto.

Antes de ejecutar LLM se crearán dos oráculos versionados:

1. `diagnostic-oracle.v1.json`: normaliza el ground truth a la misma unidad que produce AURA, `ruleId + columnId + scope`; conserva los 55 IDs fuente, registra las fusiones fila→columna y clasifica cada hallazgo por alcanzabilidad y elegibilidad para la métrica primaria.
2. `remediation-oracle.v1.json`: define, para cada hallazgo, acciones esperadas, permitidas, prohibidas y sujetas a revisión humana.

Los oráculos se congelan antes de la primera corrida formal. Cualquier corrección posterior invalida esa campaña y exige una nueva versión.

### Separación de métricas

La campaña no mezclará limitaciones del motor determinista con desempeño del LLM:

1. **Cobertura del motor:** compara las 55 incidencias fuente con lo que AURA puede detectar. Las incidencias de enum de dominio, relaciones entre columnas, validez calendárica estricta, unicidad de ID o formato telefónico no emitible quedan como `out_of_engine_scope`; permanecen contabilizadas, pero no se convierten en FN del LLM.
2. **F1 diagnóstico primario:** usa el mismo denominador de claves canónicas `engine_exposed` para los tres modos: hallazgos respaldados por el ground truth y realmente presentes en la auditoría congelada que alimenta al LLM. `prompt_libre` puede obtener menor recall por recibir menos evidencia; esa diferencia es parte del efecto experimental de la composición de entrada.
3. **Fidelidad a la evidencia:** mide si el modelo reproduce correctamente los hallazgos realmente incluidos en el snapshot de entrada y evita columnas, reglas o claims inexistentes.
4. **Descubrimiento extendido:** registra por separado un hallazgo correcto fuera de la evidencia determinista cuando esté sustentado por estadísticas o muestras visibles. Nunca se suma al F1 primario ni convierte una inferencia sin soporte en TP.

`diagnostic-oracle.v1.json` deberá incluir `reachability`, `primaryEligible`, `visibleEvidenceModes`, `sourceIssueIds` y el motivo de toda exclusión de la métrica primaria. `reachability` distingue `engine_exposed`, `engine_supported_not_exposed` y `out_of_engine_scope`: las dos últimas categorías pertenecen a cobertura/falsos negativos del motor. Todos los IDs fuente quedan mapeados o excluidos explícitamente; ninguno desaparece del reporte.

## 4. Matriz experimental

La matriz principal es:

```text
1 dataset × 3 modelos × 3 modos de entrada × 5 repeticiones = 45 corridas
45 diagnósticos + 45 generaciones de script = hasta 90 llamadas LLM evaluadas
```

Los tres modos formales son:

1. `prompt_libre`: resumen mínimo, columnas y tarea; funciona como línea base de contexto limitado.
2. `smart_sample`: contrato AURA y muestra inteligente.
3. `recommended`: composición AURA recomendada con registro técnico, evidencia, reglas y bad samples.

`enhanced_registry` y `copy_paste_bad_samples` se mantienen en la aplicación por compatibilidad, pero no entran a la campaña formal: son variantes intermedias contenidas por `recommended` y aumentarían el coste sin añadir un contraste necesario para responder OE4.

Todos los modos usan el mismo schema de salida `aura.diagnosis.v2` y la misma segunda etapa de generación de `aura.script.v2`. Solo cambia la evidencia de entrada. La bifurcación actual que deja `prompt_libre` y `copy_paste_bad_samples` con una sola llamada debe desaparecer del corredor formal.

### Configuración común

- `temperature`: 0.2;
- `top_p`: 0.9;
- `think`: `false`, común a los tres modelos;
- `num_ctx`: 16384;
- `num_predict`: 1600 por llamada;
- sin seed fija, porque se medirán cinco repeticiones;
- mismo timeout, keep-alive, versión de prompts y contratos;
- si el runtime devuelve razonamiento interno a pesar de `think: false`, se conserva separado y no se califica como diagnóstico final.

La configuración común prima el control experimental. Si una guía de un modelo recomienda otros parámetros, se documentará como amenaza a la validez y no se cambiarán parámetros a mitad de campaña.

### Orden y calentamiento

Las cinco repeticiones forman bloques. El orden de modelos rota mediante el orden balanceado congelado en el protocolo y los tres modos se ordenan con una semilla predeclarada dentro de cada bloque. Antes de cada bloque de modelo se ejecuta un warm-up excluido de las métricas. Esto limita el sesgo por orden y evita cargar simultáneamente los tres modelos.

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

El Laboratorio usará IndexedDB, no `localStorage`, porque las respuestas, scripts y trazas completas pueden superar los límites de almacenamiento pequeño. La campaña se podrá pausar, cerrar y reanudar sin perder resultados.

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

- TP, FP, FN, precisión, recall y F1 primarios sobre claves `engine_exposed`;
- cobertura separada del motor frente a las 55 incidencias fuente;
- fidelidad a la evidencia incluida en cada modo y descubrimientos extendidos reportados aparte;
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

Las 45 respuestas completadas reciben tres calificaciones independientes:

- claridad;
- trazabilidad;
- accionabilidad.

Anclajes comunes: 0 = ausente o engañosa; 1 = deficiente; 2 = parcial pero utilizable; 3 = clara y suficientemente respaldada; 4 = precisa, completa y directamente utilizable. Se registra revisor, fecha y nota breve.

## 8. Ejecución dinámica representativa

Las 45 corridas generan diagnóstico y script, y las 45 reciben métricas automáticas y rúbrica humana. No se ejecutarán manualmente 45 scripts.

Se seleccionará un representante por cada celda modelo–modo de entrada: 9 scripts en total. La regla, fijada antes de ver resultados finales, será:

1. ordenar las cinco repeticiones completadas por F1 diagnóstico;
2. seleccionar la mediana;
3. desempatar por el menor número de repetición;
4. si ninguna repetición es ejecutable, conservar la mediana como `blocked` y no sustituirla.

Cada representante pasa por HITL. Solo un script aprobado y que supere preflight y sandbox estático se ejecuta sobre una copia del dataset mediante el runtime externo ya previsto por AURA. El CSV resultante se importa al Laboratorio, se reaudita con el mismo motor y se conserva el `HealthDelta`. Un rechazo o bloqueo también es resultado experimental.

## 9. Análisis y reporte

El reporte final presenta una matriz 3 × 3 y separa cuatro dimensiones:

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
- las 45 unidades fueron intentadas y los fallos permanecen visibles;
- toda salida completada tiene evaluación automática y rúbrica humana;
- los 9 representantes están aprobados, rechazados o bloqueados explícitamente;
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
- [Unsloth Gemma 4 E4B IT QAT GGUF — `UD-Q4_K_XL`](https://huggingface.co/unsloth/gemma-4-E4B-it-qat-GGUF/blob/main/gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf)
- [Unsloth SmolLM3 3B GGUF — `UD-Q4_K_XL`](https://huggingface.co/unsloth/SmolLM3-3B-GGUF/blob/main/SmolLM3-3B-UD-Q4_K_XL.gguf)
