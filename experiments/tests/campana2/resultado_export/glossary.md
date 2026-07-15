# Glosario del Laboratorio AURA

Definiciones en lenguaje sencillo para interpretar una campaña de evaluación LLM.

## Dataset controlado

Archivo preparado para una prueba en la que se conoce de antemano qué problemas contiene.

Ejemplo: Permite comprobar si una respuesta coincide con referencias verificables.

## Ground truth (GT)

Lista de referencia con los hallazgos que se consideran correctos para el dataset controlado.

Ejemplo: Si GT contiene un email inválido, AURA espera esa regla, columna y alcance.

## TP · verdadero positivo

Hallazgo que el diagnóstico reportó y que también existe en el ground truth.

Ejemplo: Reportó el email inválido que GT esperaba.

## FP · falso positivo

Hallazgo reportado que no aparece en el ground truth.

Ejemplo: Declaró una columna problemática que la referencia no contempla.

## FN · falso negativo

Hallazgo presente en el ground truth que el diagnóstico no reportó.

Ejemplo: GT esperaba mojibake y el modelo lo omitió.

## Precisión

De todo lo que el diagnóstico afirmó, qué proporción coincide con GT.

Ejemplo: Alta precisión significa pocos falsos positivos.

## Recall

De todo lo que GT esperaba, qué proporción apareció en el diagnóstico.

Ejemplo: Recall alto significa pocos hallazgos esperados omitidos.

## F1

Media armónica entre precisión y recall. En este Laboratorio mide alineación con GT, no descubrimiento independiente.

Ejemplo: F1=1 indica coincidencia completa con el registro esperado.

## Fiabilidad

Porcentaje de corridas intentadas que terminaron con una respuesta válida.

Ejemplo: 2 válidas de 3 intentos equivalen a 66,7 %.

## Cumplimiento del contrato

La respuesta es JSON válido y respeta esquema, IDs, referencias, cobertura y recibo.

Ejemplo: Una respuesta con Markdown alrededor del JSON no cumple.

## Evidencia visible

Información que realmente recibió el modelo en ese método de entrada.

Ejemplo: Contexto mínimo no recibe las mismas muestras que evidencia completa.

## Anclaje

Uso correcto de referencias de evidencia disponibles para el mismo hallazgo.

Ejemplo: Un evidenceRef solo cuenta si pertenece al issueId citado.

## Claim sin soporte

Dato concreto afirmado por el modelo que no estaba respaldado por la entrada visible.

Ejemplo: Inventar un porcentaje no presente en estadísticas ni muestras.

## Alucinación

Contenido inventado, como una columna inexistente o un claim sin soporte.

Ejemplo: Mencionar una columna teléfono cuando el dataset no la tiene.

## Latencia

Tiempo que tardó la ejecución completa del diagnóstico.

Ejemplo: Una latencia mediana menor implica respuesta más rápida en ese equipo.

## Tokens

Unidades internas de texto que el modelo lee o genera.

Ejemplo: numPredict limita cuántos tokens puede producir la respuesta.

## Contexto mínimo

Entrada compacta con resumen, esquema y registro mínimo, sin muestras observadas.

Ejemplo: Reduce volumen, pero ofrece menos detalle probatorio.

## Evidencia equilibrada

Añade estadísticas, reglas activadas y muestras limitadas.

Ejemplo: Busca equilibrio entre tamaño, soporte y velocidad.

## Evidencia completa

Añade políticas, manifiestos y anclajes exactos disponibles.

Ejemplo: Maximiza trazabilidad a costa de una entrada más grande.

## Temperatura

Controla cuánto varía la respuesta. Valores bajos favorecen estabilidad.

Ejemplo: 0,1 se usa para JSON estructurado y reproducible.

## top_p

Limita el conjunto de opciones de texto que el modelo considera en cada paso.

Ejemplo: 0,9 conserva diversidad moderada sin abrir toda la distribución.

## numCtx

Ventana total disponible para la entrada y la respuesta.

Ejemplo: Más contexto consume más memoria del equipo.

## numPredict

Máximo de tokens que Ollama permite generar al modelo.

Ejemplo: Si queda corto, el JSON puede terminar truncado.

## Think

Indica si el modelo usa una fase de razonamiento adicional antes de responder. AURA la desactiva para el JSON formal.

Ejemplo: think=false reduce texto oculto, demora y riesgo de truncamiento.

## Seed

Semilla usada para intentar repetir el mismo muestreo. Un valor nulo deja la elección al runtime.

Ejemplo: La campaña conserva el valor exacto en cada recibo.

## Keep alive

Tiempo que Ollama mantiene el modelo cargado en memoria después de una llamada.

Ejemplo: 10m evita recargar el modelo entre corridas cercanas.

## Timeout

Tiempo máximo que AURA espera antes de declarar que una llamada no terminó.

Ejemplo: 600 segundos permiten modelos locales lentos sin esperar indefinidamente.

## Índice equilibrado

Ayuda de decisión que combina fiabilidad, evidencia, seguridad frente a claims sin soporte y eficiencia con pesos públicos.

Ejemplo: No es un ganador universal ni sustituye la lectura de cada dimensión.
