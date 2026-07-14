# Limitaciones del diagnóstico LLM local

## Texto sintetizado para incorporar al TFM

La evaluación se ejecutó localmente mediante Ollama en un MacBook Air M4 con
16 GB de memoria unificada y modelos cuantizados. Esta decisión favorece la
privacidad y la reproducibilidad, pero limita el tamaño del modelo que puede
cargarse, la ventana práctica de contexto, la longitud de salida y el tiempo de
respuesta. Por tanto, los resultados obtenidos describen este entorno y no
deben generalizarse como rendimiento universal de los modelos evaluados.

Durante la prueba exploratoria se observó una respuesta interrumpida al alcanzar
el límite configurado de 4096 tokens de salida. Ollama informó el motivo
`done_reason=length` y el JSON terminó antes de cerrar su estructura. El motor
determinista sí completó el perfil y detectó 29 hallazgos; el fallo ocurrió en
la explicación estructurada solicitada al LLM. AURA conserva este caso como una
corrida fallida y no intenta reparar ni validar automáticamente una respuesta
incompleta.

Para no excluir hallazgos ni alterar el contrato únicamente con el fin de hacer
cabida a la respuesta, el dataset Phase 8 se conserva como prueba de estrés y
la campaña del TFM emplea `synthetic_ground_truth.csv`. Este segundo dataset
controlado contiene 15 filas, 9 columnas, incidencias conocidas y un ground
truth explícito. Su menor complejidad permite evaluar el diagnóstico completo
bajo las restricciones del equipo disponible. Esta decisión reduce el alcance
de generalización y debe interpretarse como evaluación experimental sobre un
caso controlado, no como validación sobre datasets grandes.

Una infraestructura con mayor memoria permite utilizar modelos más grandes y
ventanas más amplias, lo que puede reducir estas restricciones, aunque no
elimina por sí solo los límites de salida de los proveedores. Los servicios
cloud pueden ofrecer mayor capacidad, pero también aplican ventanas de contexto,
cuotas y límites de generación. En consecuencia, la capacidad debe verificarse
para cada combinación de hardware, modelo, proveedor y contrato de entrada.

## Mejora futura derivada

Después de construir el perfil determinista, AURA podrá estimar la complejidad
del diagnóstico mediante el número de columnas, hallazgos, muestras y tokens de
entrada y salida esperados. Con esa información podrá recomendar un método de
entrada y una capacidad mínima de modelo, o advertir que el entorno local no es
adecuado y sugerir un modelo de mayor capacidad o un proveedor cloud. La
recomendación será contextual y explicable; no se presentará como un modelo
ganador universal.
