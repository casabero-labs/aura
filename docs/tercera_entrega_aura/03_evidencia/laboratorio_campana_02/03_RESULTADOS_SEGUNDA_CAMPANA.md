# Resultados de la segunda campaña

Estado: **campaña terminada y formalmente válida**.

## Identificación y reproducibilidad

- campaña: `campaign:oe4:v2:20260715011720492`;
- protocolo: `aura.oe4.final-evaluation.v2` versión `2.6.0`;
- commit de AURA: `f1efed651943ac92d027a0d52ddc0ce25344c4d1`;
- dataset: `synthetic_ground_truth.csv`;
- SHA-256 del dataset: `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`;
- parámetros: `temperature=0.1`, `topP=0.9`, `numCtx=32768`, `numPredict=8192`, `think=false`, `timeout=900 s` y `keepAlive=10 m`;
- entorno registrado: Windows, Ollama `0.31.1`, 24 procesadores lógicos y 32 GiB de memoria informada por el navegador.

Los nueve artefactos fueron abiertos y contrastados. Los ocho archivos enumerados por `manifest.json` coinciden con su tamaño y SHA-256. Los recibos confirman coincidencia exacta entre modelo solicitado y observado y conservan tres digests distintos; por tanto, la campaña ejecutó realmente Qwen3.5 4B, Gemma 4 E4B y SmolLM3 3B.

## Resultado global

- 27 de 27 unidades intentadas;
- 20 diagnósticos válidos;
- 7 diagnósticos fallidos;
- F1 de 1.000 en las 20 respuestas válidas;
- latencia mediana global de 51 608 ms;
- mediana de 3 559 tokens de salida.

F1 se interpreta como alineación con un registro conocido y exigido por el contrato. No prueba descubrimiento independiente de hallazgos.

## Resultados por combinación

| Modelo | Método | Válidas | F1 válido | Latencia mediana | Índice equilibrado |
|---|---|---:|---:|---:|---:|
| Qwen3.5 4B | Contexto mínimo | 3/3 | 1.000 | 46 343 ms | **92.6** |
| Qwen3.5 4B | Evidencia equilibrada | 3/3 | 1.000 | 57 103 ms | 69.2 |
| Qwen3.5 4B | Evidencia completa | 3/3 | 1.000 | 57 883 ms | 68.4 |
| Gemma 4 E4B | Contexto mínimo | 3/3 | 1.000 | 48 926 ms | **92.0** |
| Gemma 4 E4B | Evidencia equilibrada | 3/3 | 1.000 | 50 723 ms | 70.5 |
| Gemma 4 E4B | Evidencia completa | 3/3 | 1.000 | 55 725 ms | 68.8 |
| SmolLM3 3B | Contexto mínimo | 2/3 | 1.000 | 29 243 ms | 78.3 |
| SmolLM3 3B | Evidencia equilibrada | 0/3 | n/d | n/d | 0.0 |
| SmolLM3 3B | Evidencia completa | 0/3 | n/d | n/d | 0.0 |

## Fallos observados

Los siete fallos pertenecen a SmolLM3: uno con Contexto mínimo, tres con Evidencia equilibrada y tres con Evidencia completa. Las respuestas llegaron desde Ollama y el modelo observado coincidió con el solicitado, pero no superaron el contrato por identificadores duplicados, referencias ajenas al hallazgo, cobertura inválida, campos vacíos o combinaciones incoherentes de alcance y columna. No hubo sustitución de modelo, fallo de transporte ni truncamiento.

La conclusión práctica es que SmolLM3 fue el más rápido cuando produjo una respuesta válida, pero no fue suficientemente estable para esta tarea estructurada. Qwen3.5 y Gemma completaron las nueve corridas cada uno.

## Configuración operativa seleccionada

El mayor índice equilibrado fue Qwen3.5 4B con Contexto mínimo: 92.6 frente a 92.0 de Gemma con el mismo método. La diferencia proviene principalmente de la latencia mediana, aproximadamente un 5.3 % menor en Qwen. La configuración transferible es:

```text
Modelo: hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL
Método: Contexto mínimo
temperature: 0.1
topP: 0.9
numCtx: 32768
numPredict: 8192
think: false
timeout: 900 s
keepAlive: 10 m
```

Esta es una recomendación operativa para este dataset y hardware, no un ganador universal. Gemma con Contexto mínimo constituye una alternativa prácticamente equivalente y también obtuvo 9/9 corridas válidas.

## Matices de interpretación

1. Qwen y Gemma empatan en calidad, fiabilidad o trazabilidad en varias dimensiones. La interfaz selecciona una celda de manera determinista para transferir la configuración; esa selección no elimina el empate.
2. El 100 de soporte en Contexto mínimo expresa coherencia con la evidencia limitada recibida, no mayor riqueza probatoria que los otros métodos.
3. El detector conservador de claims penalizó fragmentos numéricos, hashes y valores enmascarados de las entradas ricas. Un cero en esa dimensión es una alerta automática, no prueba concluyente de alucinación.
4. Cuando AURA impone revisión humana obligatoria, el Laboratorio califica la respuesta cruda del modelo. El producto puede producir además una versión efectiva gobernada, pero esa normalización no mejora artificialmente la nota experimental.
5. Las entradas equilibrada y completa aumentaron contexto, tokens y latencia sin mejorar F1 en este dataset pequeño y controlado. No se deduce que sean inferiores para datasets más complejos.

## Evidencia visual definitiva

Las capturas reales están en `screenshots/campana_real/`:

1. `01_panorama.png`;
2. `02_modelos_entradas.png`;
3. `03_dimensiones.png`;
4. `04_calidad_velocidad.png`;
5. `05_matriz_detallada.png`;
6. `06_configuracion.png`;
7. `07_resultados_reproducibles.png`;
8. `08_exportables.png`.

Para el TFM se recomienda usar el panorama, la comparación calidad/velocidad, la matriz detallada y la configuración transferible. El PDF se conserva como artefacto técnico; las capturas de la interfaz comunican mejor los resultados y sus gráficos.
