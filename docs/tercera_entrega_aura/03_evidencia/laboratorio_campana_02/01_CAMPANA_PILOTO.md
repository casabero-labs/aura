# Campaña piloto: evidencia de ajuste

## Resultado observado

La primera campaña completó los 27 intentos: 19 diagnósticos fueron válidos y 8 fallaron. Se conserva completa como evidencia de ingeniería, pero no se mezcla con los resultados formales posteriores.

## Para qué sirvió

El piloto permitió identificar:

1. respuestas truncadas cuando `numPredict` era insuficiente;
2. una ruta histórica del Laboratorio que no usaba exactamente el procesador del pipeline normal;
3. gobernanza de revisión humana que no debía delegarse al modelo;
4. claims marcados erróneamente como no soportados aunque el valor estaba visible para el mismo hallazgo;
5. una interfaz insuficiente para explicar estado, fallos y selección final.

## Decisión

La campaña queda etiquetada como piloto. No se eliminan fallos ni se repiten silenciosamente. El protocolo 2.6.0 inaugura la segunda campaña después de corregir metodología, visualización, exportación y transferencia al diagnóstico normal.

## Uso en el documento

Puede presentarse como evidencia del proceso iterativo y de las amenazas detectadas. No debe utilizarse para declarar un modelo recomendado ni para comparar scores definitivos.
