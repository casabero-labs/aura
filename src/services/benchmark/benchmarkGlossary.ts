export interface BenchmarkGlossaryEntry {
  term: string;
  plainDefinition: string;
  example: string;
  category: 'Referencia' | 'Calidad' | 'Confiabilidad' | 'Evidencia' | 'Rendimiento' | 'Configuración';
}

export const BENCHMARK_GLOSSARY: BenchmarkGlossaryEntry[] = [
  { term: 'Dataset controlado', category: 'Referencia', plainDefinition: 'Archivo preparado para una prueba en la que se conoce de antemano qué problemas contiene.', example: 'Permite comprobar si una respuesta coincide con referencias verificables.' },
  { term: 'Ground truth (GT)', category: 'Referencia', plainDefinition: 'Lista de referencia con los hallazgos que se consideran correctos para el dataset controlado.', example: 'Si GT contiene un email inválido, AURA espera esa regla, columna y alcance.' },
  { term: 'TP · verdadero positivo', category: 'Calidad', plainDefinition: 'Hallazgo que el diagnóstico reportó y que también existe en el ground truth.', example: 'Reportó el email inválido que GT esperaba.' },
  { term: 'FP · falso positivo', category: 'Calidad', plainDefinition: 'Hallazgo reportado que no aparece en el ground truth.', example: 'Declaró una columna problemática que la referencia no contempla.' },
  { term: 'FN · falso negativo', category: 'Calidad', plainDefinition: 'Hallazgo presente en el ground truth que el diagnóstico no reportó.', example: 'GT esperaba mojibake y el modelo lo omitió.' },
  { term: 'Precisión', category: 'Calidad', plainDefinition: 'De todo lo que el diagnóstico afirmó, qué proporción coincide con GT.', example: 'Alta precisión significa pocos falsos positivos.' },
  { term: 'Recall', category: 'Calidad', plainDefinition: 'De todo lo que GT esperaba, qué proporción apareció en el diagnóstico.', example: 'Recall alto significa pocos hallazgos esperados omitidos.' },
  { term: 'F1', category: 'Calidad', plainDefinition: 'Media armónica entre precisión y recall. En este Laboratorio mide alineación con GT, no descubrimiento independiente.', example: 'F1=1 indica coincidencia completa con el registro esperado.' },
  { term: 'Fiabilidad', category: 'Confiabilidad', plainDefinition: 'Porcentaje de corridas intentadas que terminaron con una respuesta válida.', example: '2 válidas de 3 intentos equivalen a 66,7 %.' },
  { term: 'Cumplimiento del contrato', category: 'Confiabilidad', plainDefinition: 'La respuesta es JSON válido y respeta esquema, IDs, referencias, cobertura y recibo.', example: 'Una respuesta con Markdown alrededor del JSON no cumple.' },
  { term: 'Evidencia visible', category: 'Evidencia', plainDefinition: 'Información que realmente recibió el modelo en ese método de entrada.', example: 'Contexto mínimo no recibe las mismas muestras que evidencia completa.' },
  { term: 'Anclaje', category: 'Evidencia', plainDefinition: 'Uso correcto de referencias de evidencia disponibles para el mismo hallazgo.', example: 'Un evidenceRef solo cuenta si pertenece al issueId citado.' },
  { term: 'Claim sin soporte', category: 'Evidencia', plainDefinition: 'Dato concreto afirmado por el modelo que no estaba respaldado por la entrada visible.', example: 'Inventar un porcentaje no presente en estadísticas ni muestras.' },
  { term: 'Alucinación', category: 'Evidencia', plainDefinition: 'Contenido inventado, como una columna inexistente o un claim sin soporte.', example: 'Mencionar una columna teléfono cuando el dataset no la tiene.' },
  { term: 'Latencia', category: 'Rendimiento', plainDefinition: 'Tiempo que tardó la ejecución completa del diagnóstico.', example: 'Una latencia mediana menor implica respuesta más rápida en ese equipo.' },
  { term: 'Tokens', category: 'Rendimiento', plainDefinition: 'Unidades internas de texto que el modelo lee o genera.', example: 'numPredict limita cuántos tokens puede producir la respuesta.' },
  { term: 'Contexto mínimo', category: 'Configuración', plainDefinition: 'Entrada compacta con resumen, esquema y registro mínimo, sin muestras observadas.', example: 'Reduce volumen, pero ofrece menos detalle probatorio.' },
  { term: 'Evidencia equilibrada', category: 'Configuración', plainDefinition: 'Añade estadísticas, reglas activadas y muestras limitadas.', example: 'Busca equilibrio entre tamaño, soporte y velocidad.' },
  { term: 'Evidencia completa', category: 'Configuración', plainDefinition: 'Añade políticas, manifiestos y anclajes exactos disponibles.', example: 'Maximiza trazabilidad a costa de una entrada más grande.' },
  { term: 'Temperatura', category: 'Configuración', plainDefinition: 'Controla cuánto varía la respuesta. Valores bajos favorecen estabilidad.', example: '0,1 se usa para JSON estructurado y reproducible.' },
  { term: 'top_p', category: 'Configuración', plainDefinition: 'Limita el conjunto de opciones de texto que el modelo considera en cada paso.', example: '0,9 conserva diversidad moderada sin abrir toda la distribución.' },
  { term: 'numCtx', category: 'Configuración', plainDefinition: 'Ventana total disponible para la entrada y la respuesta.', example: 'Más contexto consume más memoria del equipo.' },
  { term: 'numPredict', category: 'Configuración', plainDefinition: 'Máximo de tokens que Ollama permite generar al modelo.', example: 'Si queda corto, el JSON puede terminar truncado.' },
  { term: 'Think', category: 'Configuración', plainDefinition: 'Indica si el modelo usa una fase de razonamiento adicional antes de responder. AURA la desactiva para el JSON formal.', example: 'think=false reduce texto oculto, demora y riesgo de truncamiento.' },
  { term: 'Seed', category: 'Configuración', plainDefinition: 'Semilla usada para intentar repetir el mismo muestreo. Un valor nulo deja la elección al runtime.', example: 'La campaña conserva el valor exacto en cada recibo.' },
  { term: 'Keep alive', category: 'Configuración', plainDefinition: 'Tiempo que Ollama mantiene el modelo cargado en memoria después de una llamada.', example: '10m evita recargar el modelo entre corridas cercanas.' },
  { term: 'Timeout', category: 'Configuración', plainDefinition: 'Tiempo máximo que AURA espera antes de declarar que una llamada no terminó.', example: '600 segundos permiten modelos locales lentos sin esperar indefinidamente.' },
  { term: 'Índice equilibrado', category: 'Calidad', plainDefinition: 'Ayuda de decisión que combina fiabilidad, evidencia, seguridad frente a claims sin soporte y eficiencia con pesos públicos.', example: 'No es un ganador universal ni sustituye la lectura de cada dimensión.' },
];

export const renderBenchmarkGlossaryMarkdown = (): string => [
  '# Glosario del Laboratorio AURA',
  '',
  'Definiciones en lenguaje sencillo para interpretar una campaña de evaluación LLM.',
  '',
  ...BENCHMARK_GLOSSARY.flatMap((entry) => [
    `## ${entry.term}`,
    '',
    entry.plainDefinition,
    '',
    `Ejemplo: ${entry.example}`,
    '',
  ]),
].join('\n');
