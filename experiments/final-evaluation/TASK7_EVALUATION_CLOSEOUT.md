# Cierre OE4 Task 7 — evaluación automática y rúbrica humana

Fecha: 11 de julio de 2026.

## Resultado

Task 7 queda cerrada en código. AURA puede puntuar las respuestas guardadas sin
modificar los oráculos, el dataset, la matriz experimental ni la salida cruda de
los modelos. Las dimensiones permanecen separadas y ninguna produce por sí sola
un ganador obligatorio.

## Qué quedó implementado

- TP, FP, FN, precisión, recall y F1 sobre las claves primarias.
- Descubrimientos correctos fuera del denominador primario reportados aparte.
- Cobertura del motor sobre las 55 incidencias fuente del oráculo congelado.
- Fidelidad a la evidencia según el modo de entrada y anclaje a hallazgo, regla,
  columna, evidencia y bad sample cuando corresponde.
- Registro separado de columnas, reglas, claves y claims sin soporte.
- Evaluación del script por contrato, sintaxis, función `clean_dataset`,
  columnas, imports, operaciones peligrosas y cobertura del oráculo de acciones.
- Métricas operativas separadas de calidad: duración, tokens, errores y
  estabilidad de las dos etapas.
- Rúbrica humana de claridad, trazabilidad y accionabilidad en escala 0–4.
- Revisor y fecha obligatorios; una puntuación 0 o 4 exige nota justificativa.
- El score compuesto histórico aparece en exportaciones únicamente como
  `exploratoryCompositeScore`.

## Reglas de interpretación

- `prompt_libre` no recibe una fidelidad artificial: se registra `null` porque
  no incluye el paquete de evidencias del motor.
- Una respuesta vacía obtiene anclaje 0, no anclaje perfecto.
- Un descubrimiento extendido correcto no se convierte automáticamente en falso
  positivo del F1 primario.
- Un script inseguro, incompleto o con una acción no autorizada no queda elegible
  para revisión de ejecución.
- Fallos, timeouts y etapas ausentes permanecen visibles en estabilidad.

## Evidencia de validación

- Pruebas focales y dependientes: 43/43.
- Suite completa: 1669 aprobadas y 6 omitidas de forma prevista.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; permanecen las advertencias conocidas de chunks
  grandes e imports mixtos, sin error de compilación.

## Siguiente paso

Task 8 debe seleccionar de forma determinista un representante por cada una de
las nueve celdas modelo–modo. Cada representante conservará una resolución HITL
explícita y solo los aprobados podrán pasar a ejecución externa y reauditoría.
