# Metodología del Laboratorio AURA

## Finalidad

El Laboratorio compara modelos de lenguaje y métodos de entrada en una tarea concreta: reproducir un diagnóstico estructurado de calidad de datos a partir de evidencia controlada. No pretende determinar un modelo universalmente superior.

## Diseño experimental

La matriz cruza tres modelos, tres métodos de entrada y tres repeticiones, para un total de 27 diagnósticos evaluados. Cada bloque de modelo incluye un calentamiento que se excluye de las métricas. Los parámetros de inferencia, el dataset, el ground truth y las versiones de contrato se congelan al crear la campaña.

Los métodos son Contexto mínimo, Evidencia equilibrada y Evidencia completa. Cambian la cantidad de evidencia visible, pero utilizan el mismo constructor, prompt efectivo, parser, validador y evaluador que el diagnóstico normal de AURA.

## Referencia y métricas

El ground truth contiene las combinaciones esperadas de regla, columna y alcance. Precisión, recall y F1 miden alineación con esa referencia conocida; no se interpretan como descubrimiento independiente.

La selección práctica se apoya en cuatro dimensiones:

- fiabilidad, 35 %: diagnósticos válidos entre intentos;
- soporte de evidencia, 25 %: fidelidad y anclaje a información visible;
- seguridad frente a claims sin soporte, 20 %;
- eficiencia, 20 %: latencia relativa dentro del mismo hardware.

El contrato funciona como gate. Una corrida inválida se conserva, reduce fiabilidad y no recibe un score operativo inventado.

El soporte de evidencia mide coherencia con la información que cada método hizo visible, no cantidad absoluta de contexto. Por ello, un resultado de 100 en Contexto mínimo significa que la respuesta se mantuvo dentro de su evidencia limitada; no significa que haya recibido muestras, políticas o anclajes equivalentes a Evidencia completa.

## Control de claims

Un número, fecha, valor enmascarado o hash solo se considera respaldado cuando aparece en la evidencia visible del mismo `issueId`. Un valor visible para otro hallazgo no puede prestarse como soporte. Contexto mínimo no recibe muestras y, por tanto, no obtiene crédito por ellas.

El extractor de claims es conservador. Puede marcar fragmentos numéricos presentes en descripciones técnicas, valores enmascarados o referencias `sha256` como posibles afirmaciones sin soporte. Estos casos deben interpretarse como alertas automáticas para inspección, no como demostración definitiva de una alucinación.

El Laboratorio conserva dos planos cuando AURA aplica gobernanza determinista: la respuesta cruda del modelo se califica tal como fue producida, mientras el diagnóstico efectivo del producto puede elevar `requiresHumanReview` sin modificar identificadores, referencias ni contenido sustantivo. Esta separación evita otorgar crédito artificial al modelo.

## Alcance

Los resultados solo aplican al dataset, modelos, métodos, parámetros y hardware registrados. La revisión humana, la generación del script y la remediación pertenecen al pipeline normal y no forman parte de la evaluación del Laboratorio.
