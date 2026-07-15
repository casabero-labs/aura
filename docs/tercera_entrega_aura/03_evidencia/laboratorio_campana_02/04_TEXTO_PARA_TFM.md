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

Este apartado debe completarse únicamente después de exportar la segunda campaña. Debe incluir: número de diagnósticos válidos y fallidos; tabla por modelo y método; métricas de alineación, fiabilidad, evidencia, seguridad y eficiencia; configuración recomendada por objetivo; y limitaciones observadas. No deben copiarse aquí las cifras del recorrido E2E ni las de la campaña piloto como si fueran resultados definitivos.
