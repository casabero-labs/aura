# Linea oficial de AURA para la segunda entrega

> Criterio de continuidad para mantener consistencia entre memoria, codigo, experimentos y agentes.
> Este archivo no reemplaza la primera entrega revisada; la protege y orienta los ajustes necesarios para la segunda entrega.

## 0. Principio de continuidad con la primera entrega

La primera entrega fue revisada positivamente. Por tanto, la segunda entrega no debe alejarse de su narrativa central ni reescribir el trabajo desde cero. La tarea es:

1. Conservar la motivacion, el planteamiento y el posicionamiento innovador que el profesor valoro.
2. Integrar la retroalimentacion recibida: tabla comparativa, contraste rule-based/cloud/LLM-based, menor densidad conceptual y validacion experimental mas robusta.
3. Cerrar los capitulos 2 y 3 con cambios quirurgicos, no con una reconstruccion completa.
4. Avanzar el capitulo 5 con evidencia de implementacion, diagramas, requisitos, capturas y resultados preliminares.
5. Preparar bocetos de resultados, introduccion refinada y conclusiones, sin exigir aun conclusiones definitivas.

## 1. Tesis oficial

AURA es una arquitectura hibrida determinista-cognitiva para diagnostico de calidad del dato. La contribucion se mantiene alineada con la primera entrega: combinar calidad del dato, LLMs, privacidad local-first, benchmarking y gobernanza. El ajuste para la segunda entrega es formular esa contribucion de modo mas medible: una cadena por capas que busca reducir riesgos de privacidad, variabilidad y alucinacion cuando se usan LLMs para diagnosticar datasets.

La idea central es:

> El motor determinista genera evidencia reproducible; el LLM interpreta esa evidencia bajo restricciones; el humano valida las acciones finales.

## 2. Formulaciones canonicas

### Motor determinista

Usar:

> Motor determinista reproducible basado en reglas explicitas, expresiones regulares, heuristica de tipos y estadistica descriptiva.

Evitar:

> Precision 100%, EM = 1.00, matematicamente innegable.

Matiz:

La Capa 1 puede tener alto recall y aun producir falsos positivos. Eso no debilita la arquitectura; justifica la necesidad de la Capa 2.

### Local-first

Usar:

> AURA procesa el CSV crudo y ejecuta la auditoria determinista en el navegador. La capa cognitiva puede funcionar con inferencia local WebLLM/WebGPU o con proveedor cloud, enviando en ese caso un smart sample y no el dataset completo.

Evitar:

> Todo se procesa localmente, los datos nunca salen del navegador.

Matiz:

Esa afirmacion solo es cierta en modo local completo. En modo Gemini, la app debe presentarse como minimizacion de datos enviados, no como cero salida.

### Anti-alucinacion

Usar:

> Mecanismos de mitigacion de alucinaciones: smart sample, anclaje semantico, copy-paste evidence, baja temperatura y salida estructurada.

Evitar:

> Erradicar alucinaciones.

Matiz:

La reduccion de alucinaciones debe medirse con benchmark. Hasta entonces, se presenta como mecanismo de mitigacion, no como garantia absoluta.

### Publicacion cientifica

Usar:

> Arquitectura evaluable mediante benchmarks sobre precision/recall del motor, latencia, cumplimiento de formato, tasa de alucinacion y calidad de scripts HITL.

Evitar:

> Resultados concluyentes sin ejecutar benchmark.

## 3. Objetivos especificos canonicos

Los objetivos siguientes son una formulacion recomendada para consolidar el Capitulo 3. Deben integrarse respetando la estructura y el tono ya revisados en la primera entrega.

### OE1

Diseñar e implementar un motor de auditoria determinista basado en reglas explicitas, expresiones regulares, heuristica de tipos y estadistica descriptiva, capaz de generar hallazgos reproducibles sobre anomalias estructurales y servir como base factual para la capa cognitiva posterior.

### OE2

Evaluar comparativamente modelos LLM cloud y locales bajo un mismo esquema de entrada estructurada, midiendo latencia, cumplimiento de formato, presencia de alucinaciones y utilidad de las recomendaciones generadas.

### OE3

Desarrollar una arquitectura local-first que procese el dataset crudo en navegador y permita comparar inferencia local frente a inferencia cloud en terminos de privacidad, latencia y calidad diagnostica.

### OE4

Generar scripts de limpieza en Python/Pandas a partir de los hallazgos detectados, manteniendo un flujo human-in-the-loop en el que las transformaciones sean auditables antes de su ejecucion.

## 4. Capas canonicas

| Capa | Rol | Riesgo que mitiga | Evidencia en repo |
|---|---|---|---|
| Capa 0. Infraestructura local-first | Ejecutar parsing y auditoria inicial en navegador; habilitar WebLLM | Exposicion de datos y dependencia cloud | `src/services/csvService.ts`, `src/services/providers/webllmProvider.ts`, `src/services/aiProvider.ts` |
| Capa 1. Motor determinista | Generar hallazgos reproducibles | Diagnostico sin base factual | `src/services/auditEngine.ts`, `docs/tablas/catalogo_reglas_motor_determinista.md` |
| Capa 2. Estabilidad cognitiva | Interpretar hallazgos bajo restricciones | Alucinacion, recomendaciones no soportadas | `src/services/providers/prompts.ts`, `src/services/providers/geminiProvider.ts`, `src/services/providers/webllmProvider.ts` |
| Capa 3. Gobernanza HITL | Generar reportes y scripts revisables | Automatizacion opaca o destructiva | `src/services/pdfGenerator.ts`, `src/components/ScriptReview.tsx` |

## 5. Benchmarks necesarios

| Benchmark | Pregunta | Metricas |
|---|---|---|
| Motor determinista | Que detecta la Capa 1 y donde falla? | Precision, recall, F1, TP, FP, FN por regla |
| Smart sample vs prompt libre | El anclaje reduce alucinaciones? | Campos inventados, hallazgos sin evidencia, citas correctas |
| Cloud vs local | Que trade-off existe entre privacidad y rendimiento? | Latencia, first token, tokens/s, disponibilidad, datos enviados |
| Scripts HITL | Las acciones son auditables y ejecutables? | Ejecutabilidad, cobertura de issues, operaciones destructivas, claridad |

## 6. Archivos que deben alinearse con este criterio

- `README.md`
- `GEMINI.md`
- `docs/CENTRO_COMANDO_ACADEMICO.md`
- `docs/tablas/catalogo_reglas_motor_determinista.md`
- `docs/tablas/tabla_comparativa_herramientas.md`
- `docs/publicacion/borrador_articulo.md`
- `experiments/benchmarks/validate_deterministic.ts`
- Documento Word de segunda entrega.
