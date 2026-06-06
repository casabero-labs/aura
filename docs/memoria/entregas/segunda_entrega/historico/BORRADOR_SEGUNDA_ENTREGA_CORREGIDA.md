# Borrador base de segunda entrega corregida

> Proposito: transformar la primera entrega revisada en una segunda entrega mas ordenada, medible y coherente con la implementacion actual de AURA.

## 1. Criterio de continuidad

La segunda entrega no debe reescribir desde cero la primera entrega. Debe conservar su motivacion central, pero corregir el orden metodologico de los objetivos y mostrar mayor madurez experimental.

La narrativa debe pasar de "AURA como herramienta con varios modulos" a "AURA como flujo verificable de diagnostico y mejora de calidad del dato".

## 2. Objetivo general propuesto

Desarrollar AURA, una arquitectura local-first para auditoria inteligente de calidad del dato, que combine un motor determinista reproducible con modelos LLM locales o cloud para diagnosticar hallazgos, generar scripts de limpieza auditables y comparar experimentalmente el desempeno de los modelos bajo un flujo human-in-the-loop.

## 3. Objetivos especificos propuestos

### OE1. Arquitectura local-first

Desarrollar una arquitectura local-first que permita cargar, procesar y auditar datasets desde el navegador, reduciendo la exposicion de datos sensibles y habilitando la ejecucion de componentes deterministas y cognitivos en entornos locales o cloud.

### OE2. Motor determinista

Diseñar e implementar un motor de auditoria determinista basado en reglas explicitas, expresiones regulares, heuristica de tipos y estadistica descriptiva, capaz de generar hallazgos reproducibles sobre anomalias estructurales del dataset.

### OE3. Diagnostico y generacion de scripts con LLM

Implementar una capa cognitiva basada en LLM, local o cloud, que reciba los hallazgos estructurados del motor determinista, diagnostique causas probables de los problemas de calidad y genere scripts Python/Pandas orientados a corregir o asistir el proceso de limpieza del dataset.

### OE4. Modulo de comparacion experimental

Implementar un modulo de comparacion integrado al flujo de AURA para evaluar modelos LLM locales y cloud bajo el mismo esquema de entrada, midiendo latencia, cumplimiento de formato, presencia de alucinaciones, validez de scripts generados y utilidad para la mejora del dataset.

## 4. Correccion sobre "precision total nivel 1"

La frase "precision total en anomalias de Nivel 1" debe eliminarse como promesa. La segunda entrega debe reemplazarla por una formulacion experimental:

> Evaluar el desempeno del motor determinista sobre anomalias estructurales de Nivel 1 mediante metricas de precision, recall, F1, falsos positivos y falsos negativos.

Justificacion:

- el motor determinista es reproducible, pero no infalible;
- la evidencia preliminar muestra falsos positivos;
- ese resultado no debilita AURA, sino que justifica la capa LLM como filtro contextual y el flujo HITL como control humano.

## 5. Flujo metodologico que debe guiar la segunda entrega

1. El usuario carga un dataset en el navegador.
2. AURA procesa el CSV localmente y obtiene perfil del dataset.
3. El motor determinista genera un `AuditReport` reproducible.
4. El sistema construye un smart sample con hallazgos, columnas, tipos y muestras.
5. Un LLM local o cloud diagnostica los hallazgos sin acceder libremente al dataset completo.
6. El LLM genera un script Python/Pandas de limpieza o asistencia.
7. El sistema valida el script contra columnas existentes, acciones destructivas y cobertura de issues.
8. El humano revisa, edita y aprueba el script antes de cualquier accion.
9. El modulo comparativo registra metricas del modelo usado.
10. AURA exporta reporte, JSON de evidencia, issues, script aprobado y resultados de comparacion.

## 6. Mapeo entre objetivos, capas y evidencia

| Objetivo | Capa de AURA | Evidencia actual | Evidencia pendiente |
|---|---|---|---|
| OE1. Arquitectura local-first | Capa 0 | `csvService.ts`, `webllmProvider.ts`, configuracion local/cloud | Documentar con diagrama y limites de privacidad por modo |
| OE2. Motor determinista | Capa 1 | `auditEngine.ts`, `AuditReport`, resultados preliminares del motor | Separar metricas por tipo de regla y dataset |
| OE3. Diagnostico y scripts LLM | Capa 2 | `prompts.ts`, `AIProvider`, `generateExecutiveReport`, `scriptValidationService.ts` | Integrar validacion de script en el flujo visible |
| OE4. Comparacion integrada | Capa 3 | `benchmarkService.ts`, `BenchmarkLab`, `hallucinationDetector.ts`, `evaluationService.ts` | Conectar benchmark con la ejecucion real de diagnostico/script |

## 7. Estructura recomendada del documento de segunda entrega

### Capitulo 1. Introduccion refinada

Mantener motivacion y problema de la primera entrega. Ajustar solo lo necesario para reflejar que AURA ya tiene implementacion, resultados preliminares y un flujo experimental.

### Capitulo 2. Estado del arte

Cerrar con una comparacion clara entre herramientas rule-based, cloud, LLM-based y AURA. La diferencia de AURA debe expresarse como una cadena verificable: evidencia determinista, LLM restringido, HITL y benchmark.

### Capitulo 3. Objetivos y metodologia

Insertar los objetivos reordenados. Explicar que el orden sigue el flujo real de AURA: primero arquitectura, despues motor, despues capa cognitiva, finalmente comparacion experimental.

### Capitulo 5. Desarrollo de la contribucion

Describir el sistema por capas y por flujo de uso. Evitar mezclar detalles de benchmark dentro del motor determinista o scripts dentro de la arquitectura. Cada capa debe tener responsabilidad, entrada, salida y evidencia.

### Resultados preliminares

Presentar como preliminar lo que ya este medido. No defender corridas fallidas como evidencia. El benchmark LLM solo debe considerarse valido si la ejecucion completa tiene credenciales, modelo disponible, dataset identificado y metricas exportables.

### Conclusiones preliminares

Cerrar con avance por objetivo, no con afirmaciones definitivas. La idea fuerte es que AURA ya demuestra una arquitectura evaluable y trazable, aunque aun falten corridas formales para consolidar resultados.

## 8. Decision editorial

La segunda entrega debe evitar tres problemas:

- objetivos en un orden que no coincide con el flujo del sistema;
- promesas absolutas como "precision total";
- benchmark presentado como modulo decorativo.

El documento debe defender que la comparacion de modelos forma parte del ciclo de diagnostico y limpieza, no una actividad aislada.

