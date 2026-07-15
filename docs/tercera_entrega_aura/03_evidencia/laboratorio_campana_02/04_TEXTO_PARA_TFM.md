# Texto base para el TFM — Laboratorio de evaluación LLM

## Diseño experimental

El Laboratorio de AURA compara modelos locales y métodos de composición de entrada sobre un dataset controlado con ground truth previamente definido. La unidad experimental es una combinación de modelo, método de entrada y repetición. El protocolo de la segunda campaña contempla tres modelos, tres métodos de entrada —contexto mínimo, evidencia equilibrada y evidencia completa— y tres repeticiones por combinación, para un total de 27 diagnósticos evaluados. Los fallos se conservan como parte del resultado y reducen la estimación de fiabilidad.

## Evaluación automática

La evaluación no depende de la opinión de otro modelo de lenguaje. AURA contrasta la respuesta estructurada con el ground truth y con la evidencia visible que recibió el modelo. La alineación con el ground truth se expresa mediante precisión, recall y F1; estas métricas describen concordancia con la referencia controlada, no descubrimiento independiente. Además, se miden la fiabilidad de las corridas, el cumplimiento del contrato, el anclaje a evidencia, la ausencia de columnas o afirmaciones sin soporte, la latencia y el consumo de tokens.

El índice de decisión operativo pondera fiabilidad (35 %), soporte de evidencia (25 %), ausencia de afirmaciones no soportadas (20 %) y eficiencia (20 %). La alineación con ground truth se informa de manera separada y el cumplimiento del contrato funciona como condición de validez. Esta separación evita contar dos veces una cobertura que el propio contrato ya exige.

## Interpretación y selección

AURA no declara un ganador universal. El resultado se presenta por combinación de modelo y método de entrada, e incluye recomendaciones según el objetivo: equilibrio general, calidad operativa, estabilidad, trazabilidad o velocidad. Al seleccionar una celda de la matriz o un resultado del gráfico, la aplicación traduce la elección a una configuración reproducible para el pipeline normal: modelo, método de entrada, temperatura, `top_p`, ventana de contexto, límite de salida, modo de razonamiento, semilla, permanencia del modelo y tiempo máximo de espera.

## Trazabilidad y exportación

El expediente de campaña contiene el documento canónico del experimento, una tabla de corridas, informes Markdown y PDF, un resumen estructurado de resultados, la metodología, un glosario, la configuración seleccionada y un manifiesto con hashes. Esto permite revisar qué modelo fue solicitado y observado, qué entrada se utilizó, qué respuesta produjo, qué validaciones superó y cómo se calculó el resultado.

## Alcance y limitaciones

Las conclusiones son válidas para el dataset controlado, los modelos, las cuantizaciones, los parámetros y el hardware registrados en la campaña. No demuestran superioridad universal. El Laboratorio se limita a evaluar el diagnóstico LLM; la revisión humana, la generación de scripts, la aprobación HITL, la ejecución Python y la reauditoría permanecen en el pipeline normal de AURA.

## Resultado de la segunda campaña

La segunda campaña ejecutó las 27 unidades previstas y fue declarada formalmente válida por AURA. Se obtuvieron 20 diagnósticos válidos y siete fallos. Qwen3.5 4B y Gemma 4 E4B completaron correctamente sus nueve corridas, mientras que SmolLM3 3B completó dos de nueve. Los siete fallos de SmolLM3 correspondieron a incumplimientos estructurales o referenciales del contrato; no se observaron sustituciones de modelo, fallos de transporte ni truncamientos. Los recibos registraron coincidencia entre cada modelo solicitado y observado y tres digests diferentes, lo que aporta evidencia de que se ejecutaron los tres modelos previstos.

Todas las respuestas válidas obtuvieron precisión, recall y F1 de 1.000 frente al ground truth. Este resultado debe leerse como reproducción correcta de un registro canónico que el contrato exige cubrir, y no como capacidad de descubrimiento independiente. En términos de estabilidad, Qwen3.5 y Gemma alcanzaron el 100 %, frente al 22.2 % de SmolLM3. El modelo pequeño presentó la menor latencia en sus corridas válidas, pero su elevada tasa de fallo impide recomendarlo para este diagnóstico estructurado.

La combinación con mayor índice equilibrado fue Qwen3.5 4B con Contexto mínimo, con 92.6 puntos, seguida muy de cerca por Gemma 4 E4B con Contexto mínimo, con 92.0. Ambas completaron tres de tres repeticiones y obtuvieron el máximo en alineación, fiabilidad, cumplimiento del contrato y coherencia con la evidencia visible. Qwen registró una latencia mediana de 46.3 segundos, frente a 48.9 segundos de Gemma; esta diferencia de eficiencia explica principalmente la selección automática. Por tanto, AURA recomienda Qwen3.5 4B con Contexto mínimo para el siguiente diagnóstico bajo las condiciones de esta campaña, sin afirmar una superioridad universal.

Las entradas de Evidencia equilibrada y Evidencia completa conservaron la cobertura del ground truth, pero incrementaron el volumen de entrada, la salida y la latencia sin aportar una mejora de F1 en este dataset pequeño. Además, el extractor conservador de afirmaciones sin soporte señaló fragmentos numéricos y valores transformados por privacidad en algunas respuestas. Estas alertas no deben equipararse automáticamente a alucinaciones: expresan una limitación del detector que se conserva de forma explícita en la evidencia.

Los resultados muestran el valor práctico del Laboratorio: permite descartar una opción rápida pero inestable, identificar dos modelos sólidos y transferir una configuración exacta al pipeline normal. La conclusión se limita al dataset, modelos cuantizados, parámetros, runtime y hardware registrados. La evaluación con otros datasets controlados constituye una línea futura necesaria para estimar generalización externa.

## Configuración resultante para Auditoría

La configuración seleccionada fue `hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`, método Contexto mínimo, `temperature=0.1`, `topP=0.9`, `numCtx=32768`, `numPredict=8192`, razonamiento desactivado, permanencia de diez minutos y timeout de 900 segundos. AURA conserva estos valores en `selected-configuration.json` y permite aplicarlos al siguiente diagnóstico normal sin iniciar automáticamente una ejecución.
