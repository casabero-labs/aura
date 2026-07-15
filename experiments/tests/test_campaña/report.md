# Informe de evaluación LLM - campaign:oe4:v2:20260714203639584

Generado: 2026-07-14T22:28:55.117Z
Validez formal: **formal_valid**
- Todos los gates formales están satisfechos.

## Método

Protocolo aura.oe4.final-evaluation.v2 v2.5.0. Matriz 3 × 3 × 3 = 27 unidades. Dataset synthetic_ground_truth con SHA-256 4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49.

## Entorno y modelos

Modelos congelados: hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL, hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL, hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL. Modos de entrada: prompt_libre, smart_sample, recommended. Cada corrida conserva snapshot de hardware, runtime, modelo, inferencia, prompt y hashes.

## Matriz de corridas y fallos

Corridas observadas: 27. Intentadas: 27. Completadas: 19. Fallidas: 8. Estados: awaiting_human: 19, failed: 8.

| Modelo | Entrada | Corridas | Completadas | Fallidas | F1 medio | Latencia mediana ms |
|---|---|---:|---:|---:|---:|---:|
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 3 | 0 | 1.000 | 49606 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | smart_sample | 3 | 3 | 0 | 1.000 | 57523 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | recommended | 3 | 3 | 0 | 1.000 | 56517 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 3 | 0 | 1.000 | 49415 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | smart_sample | 3 | 3 | 0 | 1.000 | 51376 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | recommended | 3 | 3 | 0 | 1.000 | 53929 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | prompt_libre | 3 | 1 | 2 | 1.000 | 27077 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | smart_sample | 3 | 0 | 3 | n/d | n/d |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | recommended | 3 | 0 | 3 | n/d | n/d |

## Calidad diagnóstica

F1 primario global: media 1.000, mediana 1.000, mínimo 1.000 y máximo 1.000. La cobertura del motor y los descubrimientos extendidos permanecen separados del F1 primario.

## Contrato y alucinaciones

Fidelidad de evidencia media: 100.00 %. Anclaje medio: 93.16 %. Las columnas y claims sin soporte se conservan por corrida en campaign.json y se resumen por celda.

## Método de calificación automática

Coincidencia exacta ruleId + columnId + scope contra el oráculo congelado del dataset controlado.

Precisión mide cuántos hallazgos declarados son correctos; recall mide cuántos hallazgos esperados fueron encontrados; F1 es su media armónica. Fiabilidad es la proporción de corridas válidas. Contrato, evidencia, alucinaciones y eficiencia se calculan de forma determinista a partir de la respuesta, el snapshot, el recibo y las métricas de Ollama.

## Latencia, tokens y estabilidad

Latencia total mediana: 51376 ms. Tokens de salida medianos: 3568. Los fallos y reintentos permanecen visibles; no se reemplazan por ceros ni se eliminan.

## Scores de apoyo a la decisión

| Modelo | Entrada | Exactitud | Fiabilidad | Contrato | Evidencia | Sin alucinaciones | Eficiencia | Equilibrado |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 100.0 | 100.0 | 100.0 | 66.7 | 54.6 | 94.4 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | smart_sample | 100.0 | 100.0 | 0.0 | 95.8 | 0.0 | 47.1 | 71.7 |
| hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL | recommended | 100.0 | 100.0 | 100.0 | 93.3 | 0.0 | 47.9 | 86.4 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 54.8 | 97.7 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | smart_sample | 100.0 | 100.0 | 0.0 | 95.8 | 0.0 | 52.7 | 72.0 |
| hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | recommended | 100.0 | 100.0 | 33.3 | 93.3 | 0.0 | 50.2 | 76.5 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | 33.3 | 100.0 | 100.0 | 100.0 | 100.0 | 86.7 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | smart_sample | n/d | 0.0 | n/d | n/d | n/d | n/d | 0.0 |
| hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL | recommended | n/d | 0.0 | n/d | n/d | n/d | n/d | 0.0 |

Índice equilibrado: exactitud 35 %, fiabilidad 20 %, contrato 15 %, evidencia 15 %, ausencia de alucinaciones 10 % y eficiencia 5 %. El índice equilibrado repondera únicamente las dimensiones medibles. Es ayuda de decisión para esta campaña, no una afirmación de superioridad universal.

## Recomendaciones por objetivo

| Objetivo | Modelo | Entrada | Score | Justificación |
|---|---|---|---:|---|
| balanced | hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 97.7 | Mejor equilibrio entre calidad, estabilidad, contrato, evidencia, seguridad y velocidad. |
| diagnostic_quality | hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | prompt_libre | 100.0 | Mayor F1 medio frente al oráculo controlado. |
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

La campaña campaign:oe4:v2:20260714203639584 satisface los gates de evidencia formal. Los resultados permiten comparar modelos y modos por dimensión, sin afirmar superioridad universal ni corrección automática garantizada.
