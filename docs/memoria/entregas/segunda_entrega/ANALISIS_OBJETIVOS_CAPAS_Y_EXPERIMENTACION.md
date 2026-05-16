# Analisis de objetivos, capas y experimentacion

> Documento de trabajo para la segunda entrega.
> Proposito: alinear objetivos del Capitulo 3, Arquitectura de Capas de Estabilidad 3.3.3, implementacion actual de AURA y benchmarks necesarios para una posible publicacion cientifica.

## 1. Idea central que debe defender el TFM

AURA no debe presentarse solo como una aplicacion de limpieza de datos. La propuesta fuerte es una arquitectura experimental para reducir el riesgo de diagnosticos imprecisos cuando se usan LLMs en calidad del dato.

El problema de fondo es este:

- Los LLMs alojados en la nube pueden producir salidas variables, incompletas o alucinadas.
- En calidad del dato, una alucinacion no es solo un error textual: puede inducir decisiones de limpieza incorrectas.
- Si el dataset contiene informacion sensible, enviar datos completos a la nube tambien introduce riesgos de privacidad.

La hipotesis arquitectonica de AURA es que una cadena por capas puede reducir esos riesgos:

1. La Capa 0 reduce riesgo de privacidad y dependencia cloud.
2. La Capa 1 produce evidencia determinista y verificable.
3. La Capa 2 usa LLMs, pero anclados a esa evidencia.
4. La Capa 3 devuelve el control al humano mediante trazabilidad y scripts auditables.

Esta formulacion permite que el TFM sea desarrollo de software y experimentacion: se construye AURA y se miden los efectos de sus capas.

## 2. Relacion entre objetivos especificos y capas

| Objetivo | Capa relacionada | Que demuestra | Evidencia actual | Evidencia pendiente |
|---|---|---|---|---|
| OE1. Motor de auditoria determinista | Capa 1 | Que es posible detectar fallos estructurales con reglas reproducibles antes de consultar un LLM | `src/services/auditEngine.ts`, `docs/tablas/catalogo_reglas_motor_determinista.md`, `experiments/results/deterministic_validation.json` | Ampliar dataset de validacion y separar metricas por tipo de regla |
| OE2. Benchmarking multi-modelo | Capa 2 | Que distintos LLMs se comportan diferente bajo el mismo smart sample | `src/services/aiProvider.ts`, `GeminiProvider`, `WebLLMProvider`, `benchmark_multi_modelo.ts` | Ejecutar benchmark valido con API key y pruebas locales WebLLM |
| OE3. Arquitectura local-first | Capa 0 | Que el procesamiento local reduce exposicion de datos y habilita inferencia local | Parsing local, auditoria local, WebLLMProvider, selector cloud/local | Medir diferencias local vs cloud: privacidad, latencia, disponibilidad, costo |
| OE4. Scripts auditables HITL | Capa 3 | Que el resultado no queda en una recomendacion opaca, sino en acciones revisables | Prompt ejecutivo, `pdfGenerator.ts`, campo `python_script` | Evaluar si los scripts generados son correctos, ejecutables y no destructivos |

## 3. Lectura tecnica de la Capa 1 en AURA

La Capa 1 ya esta implementada en `src/services/auditEngine.ts`. Aunque en la memoria se puede explicar como un enfoque equivalente a validaciones clasicas con Python/Pandas, en la app esta escrita en TypeScript porque debe ejecutarse en el navegador, sin enviar el CSV a un servidor.

Su salida principal es un `AuditReport`, definido en `src/types.ts`, que contiene:

- `score`: indice de salud del dataset.
- `rowCount` y `colCount`: dimensiones del archivo.
- `duplicateRows`: duplicados exactos.
- `issues`: lista estructurada de hallazgos.
- `columnStats`: estadisticas por columna.
- `scoreBreakdown`: penalizaciones por categoria.
- `delimiterDetected`: delimitador detectado.

Cada `QualityIssue` incluye:

- regla activada;
- columna afectada;
- categoria;
- severidad;
- conteo;
- porcentaje afectado;
- muestras de valores problematicos.

Esto es fundamental para 3.3.3: la Capa 1 convierte el dataset crudo en evidencia estructurada. Esa evidencia es lo que luego recibe la Capa 2. El LLM no deberia inventar desde cero; debe interpretar objetos detectados por reglas.

## 4. Familias de reglas del motor determinista

| Familia | Reglas observadas | Funcion metodologica |
|---|---|---|
| Integridad y estructura | duplicados, nulos, columnas constantes, tipos mixtos | Detectar fallos basicos de consistencia, completitud y esquema |
| Higiene de texto | espacios fantasma, mojibake, capitalizacion irregular, placeholders, espacios multiples, simbolos sospechosos | Detectar suciedad textual frecuente en ETL y carga manual |
| Tipos e inferencia | numeros disfrazados, fechas ocultas, IDs corruptos, hora redundante | Identificar columnas cuyo tipo real no coincide con su representacion |
| Logica de negocio | negativos imposibles, outliers IQR, incoherencia temporal, emails invalidos, telefonos variables, URLs erroneas | Detectar violaciones de reglas plausibles de dominio |
| Semantica y seguridad | IPs y tarjetas como PII | Identificar riesgos regulatorios y de exposicion de datos sensibles |

La Capa 1 es fuerte porque es reproducible: la misma entrada produce la misma salida. Pero no debe venderse como semanticamente perfecta. Algunas reglas tienen falsos positivos porque todavia no comprenden el dominio. Ese limite justifica la Capa 2.

## 5. Como las capas se refuerzan entre si

```text
Dataset CSV
   |
   v
Capa 0: ejecucion local-first
   - El CSV se procesa en navegador.
   - Se reduce exposicion de datos crudos.
   |
   v
Capa 1: motor determinista
   - Extrae hechos: nulos, duplicados, outliers, PII, errores de formato.
   - Produce AuditReport.
   |
   v
Capa 2: LLM controlado
   - Recibe smart sample, no necesariamente todo el dataset.
   - Contextualiza hallazgos y reduce ruido.
   - Se compara Gemini vs WebLLM/local.
   |
   v
Capa 3: gobernanza HITL
   - Genera reporte y scripts Pandas.
   - El humano revisa antes de ejecutar.
```

La relacion cientifica es:

- Capa 0 protege el entorno.
- Capa 1 protege la factualidad.
- Capa 2 protege la interpretabilidad.
- Capa 3 protege la responsabilidad de decision.

## 6. Reformulacion conceptual para 3.3.3

La seccion 3.3.3 debe explicar que las capas son una estrategia metodologica de control de riesgo. No son solo modulos tecnicos.

Propuesta conceptual:

> La Arquitectura de Capas de Estabilidad de AURA se plantea como una estrategia metodologica para reducir los riesgos de privacidad, variabilidad y alucinacion en diagnosticos de calidad del dato asistidos por LLMs. La arquitectura no delega el diagnostico completo al modelo generativo; antes construye una base determinista de evidencia, limita la informacion que recibe la IA, estructura su salida y conserva la decision final en manos del usuario. De esta forma, cada capa mitiga una fuente distinta de incertidumbre y refuerza a la siguiente.

## 7. Que benchmark necesitamos para publicar

Para que AURA sea publicable, los benchmarks deben responder preguntas cientificas, no solo mostrar que la app funciona.

### Pregunta experimental 1

**La Capa 1 detecta fallos estructurales de forma reproducible?**

Medicion:

- Precision.
- Recall.
- F1-score.
- Resultados por tipo de regla.
- Tiempo de ejecucion.

Datasets:

- Sintetico con ground truth controlado.
- Titanic o Adult Income con errores inyectados.
- Dataset adicional con PII y texto sucio.

### Pregunta experimental 2

**El smart sample reduce alucinaciones frente a enviar un prompt no anclado?**

Condiciones:

- Prompt sin evidencia estructurada.
- Prompt con smart sample de AURA.
- Prompt con smart sample + copy-paste bad samples.

Metricas:

- Campos inventados.
- Recomendaciones no soportadas por datos.
- Porcentaje de hallazgos citados con evidencia.
- Cumplimiento de formato JSON.

### Pregunta experimental 3

**Modelos locales vs cloud: que se gana y que se pierde?**

Comparacion:

- Gemini 2.0 Flash.
- Gemini 1.5 Flash o Pro.
- Llama/Qwen local via WebLLM.

Metricas:

- Latencia total.
- First token latency.
- Tokens por segundo.
- Cumplimiento JSON.
- Inclusion de script Pandas.
- Alucinacion de columnas.
- Privacidad: datos crudos enviados / no enviados.

### Pregunta experimental 4

**Los scripts generados son utiles y auditables?**

Metricas:

- Ejecutabilidad del script.
- Porcentaje de reglas prioritarias cubiertas.
- Operaciones destructivas sin confirmacion.
- Claridad para revision humana.
- Correspondencia entre issue detectado y transformacion propuesta.

## 8. Conclusiones que podrian emerger

El TFM no necesita demostrar que AURA es perfecta. Necesita demostrar algo mas interesante:

1. Las reglas deterministas son necesarias porque producen evidencia estable.
2. Las reglas por si solas generan ruido en contextos semanticamente ambiguos.
3. Los LLMs aportan contextualizacion, pero solo son confiables si estan anclados a evidencia.
4. La inferencia local puede mejorar privacidad, aunque puede introducir costes de latencia, memoria o disponibilidad.
5. La salida final debe ser revisable por humanos, especialmente cuando implica transformar datos.

Esa conclusion tiene perfil cientifico porque no es una defensa ingenua de la IA generativa. Es una arquitectura hibrida con controles, medicion y limites reconocidos.

## 9. Ajuste recomendado de los objetivos

### OE1 actual

> Diseñar un motor de auditoria determinista basado en TypeScript, utilizando expresiones regulares, heuristica de tipos y estadistica descriptiva (IQR) para garantizar precision total en anomalias de Nivel 1.

### OE1 sugerido

> Diseñar e implementar un motor de auditoria determinista basado en reglas explicitas, expresiones regulares, heuristica de tipos y estadistica descriptiva, capaz de generar hallazgos reproducibles sobre anomalias estructurales y servir como base factual para la capa cognitiva posterior.

Ventaja:

Evita prometer precision total antes de medirla y alinea el objetivo con la contribucion real.

### OE2 sugerido

> Evaluar comparativamente modelos LLM cloud y locales bajo un mismo esquema de entrada estructurada, midiendo latencia, cumplimiento de formato, presencia de alucinaciones y utilidad de las recomendaciones generadas.

### OE3 sugerido

> Desarrollar una arquitectura local-first que procese el dataset crudo en navegador y permita comparar inferencia local frente a inferencia cloud en terminos de privacidad, latencia y calidad diagnostica.

### OE4 sugerido

> Generar scripts de limpieza en Python/Pandas a partir de los hallazgos detectados, manteniendo un flujo human-in-the-loop en el que las transformaciones sean auditables antes de su ejecucion.

## 10. Proxima decision de trabajo

Para avanzar ordenadamente, la siguiente tarea deberia ser reescribir la seccion 3 completa con esta logica:

1. Objetivos ajustados para que sean medibles.
2. Metodologia CRISP-DM + Scrum + arquitectura experimental.
3. 3.3.3 como puente entre desarrollo y experimentacion.
4. Cerrar con un esquema de validacion experimental ligado a cada objetivo.

