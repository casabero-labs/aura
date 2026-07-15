# Informe de evaluación LLM - campaign:oe4:v2:20260715011720492

Generado: 2026-07-15T01:54:15.873Z
Validez formal: **formal_valid**
- Todos los gates formales están satisfechos.

## Método

Protocolo aura.oe4.final-evaluation.v2 v2.6.0. Matriz 3 × 3 × 3 = 27 unidades. Dataset synthetic_ground_truth con SHA-256 4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49.

## Entorno y modelos

Modelos congelados: hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL, hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL, hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL. Modos de entrada: prompt_libre, smart_sample, recommended. Cada corrida conserva snapshot de hardware, runtime, modelo, inferencia, prompt y hashes.

## Matriz de corridas y fallos

Corridas observadas: 27. Intentadas: 27. Completadas: 20. Fallidas: 7. Estados: completed: 20, failed: 7.

| Modelo | Entrada | Corridas | Completadas | Fallidas | Alineación GT (F1) | Latencia mediana ms |
|---|---|---:|---:|---:|---:|---:|
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 3 | 0 | 1.000 | 46343 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | smart_sample | 3 | 3 | 0 | 1.000 | 57103 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | recommended | 3 | 3 | 0 | 1.000 | 57883 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 3 | 0 | 1.000 | 48926 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | smart_sample | 3 | 3 | 0 | 1.000 | 50723 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | recommended | 3 | 3 | 0 | 1.000 | 55725 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 2 | 1 | 1.000 | 29243 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | smart_sample | 3 | 0 | 3 | n/d | n/d |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | recommended | 3 | 0 | 3 | n/d | n/d |

## Alineación con ground truth

Alineación F1 global con el ground truth: media 1.000, mediana 1.000, mínimo 1.000 y máximo 1.000. Es un control descriptivo frente a un registro conocido, no una prueba de descubrimiento independiente.

## Contrato y alucinaciones

Fidelidad de evidencia media: 100.00 %. Anclaje medio: 93.50 %. Las columnas y claims sin soporte se conservan por corrida en campaign.json y se resumen por celda.

## Método de calificación automática

Alineación exacta ruleId + columnId + scope contra el ground truth congelado del dataset controlado.

Precisión mide cuántos hallazgos declarados coinciden con el ground truth; recall mide cuántos hallazgos esperados fueron reproducidos; F1 resume ambos. Fiabilidad es la proporción de corridas válidas. Contrato, evidencia, claims sin soporte y eficiencia se calculan de forma determinista a partir de la respuesta, el snapshot, el recibo y las métricas de Ollama.

## Latencia, tokens y estabilidad

Latencia total mediana: 51608 ms. Tokens de salida medianos: 3559. Los fallos y reintentos permanecen visibles; no se reemplazan por ceros ni se eliminan.

## Scores de apoyo a la decisión

| Modelo | Entrada | Alineación GT | Fiabilidad | Contrato | Evidencia | Sin claims no soportados | Eficiencia | Equilibrado |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 63.1 | 92.6 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | smart_sample | 100.0 | 100.0 | 0.0 | 95.8 | 0.0 | 51.2 | 69.2 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | recommended | 100.0 | 100.0 | 100.0 | 93.3 | 0.0 | 50.5 | 68.4 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 59.8 | 92.0 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | smart_sample | 100.0 | 100.0 | 0.0 | 95.8 | 0.0 | 57.7 | 70.5 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | recommended | 100.0 | 100.0 | 0.0 | 93.3 | 0.0 | 52.5 | 68.8 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 66.7 | 100.0 | 100.0 | 50.0 | 100.0 | 78.3 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | smart_sample | n/d | 0.0 | n/d | n/d | n/d | n/d | 0.0 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | recommended | n/d | 0.0 | n/d | n/d | n/d | n/d | 0.0 |

Índice equilibrado: fiabilidad 35 %, evidencia 25 %, ausencia de claims sin soporte 20 % y eficiencia 20 %. Alineación GT y contrato tienen peso 0 % porque funcionan como control descriptivo y gate de validez. Precisión, recall y F1 describen alineación con un registro de hallazgos conocido y exigido por contrato; por eso no aportan peso al índice equilibrado. El cumplimiento del contrato actúa como condición de validez, no como premio doble. El índice repondera únicamente fiabilidad, evidencia, seguridad frente a claims sin soporte y eficiencia. Es ayuda de decisión para esta campaña, no una afirmación de superioridad universal.

## Recomendaciones por objetivo

| Objetivo | Modelo | Entrada | Score | Justificación |
|---|---|---|---:|---|
| balanced | hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | prompt_libre | 92.6 | Mejor equilibrio medido entre fiabilidad, evidencia visible, ausencia de claims sin soporte y velocidad. |
| diagnostic_quality | hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | Mayor calidad operativa combinando soporte de evidencia, seguridad frente a claims sin soporte y fiabilidad. |
| reliability | hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | Mayor proporción de diagnósticos válidos entre las corridas intentadas. |
| traceability | hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | Mayor soporte y anclaje a la evidencia visible del método de entrada. |
| speed | hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | Menor latencia mediana relativa dentro de esta campaña y este hardware. |

No existe un campo ni una conclusión de ganador universal. Cada resultado se interpreta dentro de su dimensión.

## Amenazas a la validez

- Un único dataset controlado limita la generalización externa.
- Tres repeticiones permiten estadística descriptiva, no afirmaciones causales fuertes.
- El hardware y el runtime local condicionan latencia y throughput.
- El índice equilibrado depende de ponderaciones explícitas y debe interpretarse junto con sus dimensiones.
- La evaluación del Laboratorio cubre diagnóstico LLM; script, HITL y remediación pertenecen al pipeline normal.

## Conclusiones acotadas

La campaña campaign:oe4:v2:20260715011720492 satisface los gates de evidencia formal. Los resultados permiten comparar modelos y modos por dimensión, sin afirmar superioridad universal ni corrección automática garantizada.
