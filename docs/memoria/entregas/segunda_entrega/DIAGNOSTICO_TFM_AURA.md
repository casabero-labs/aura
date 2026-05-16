# Diagnostico estrategico del TFM AURA

> Lectura contextual del repositorio, la primera entrega, la retroalimentacion docente, la app y los artefactos experimentales.
> Fecha de revision: 2026-05-15.
> Criterio: conservar la narrativa validada en la primera entrega y orientar los ajustes hacia los requerimientos de semana 10.

## 1. Tesis central recomendada

AURA debe presentarse como una arquitectura hibrida para diagnostico de calidad del dato que combina:

1. Un motor determinista reproducible, local y auditable.
2. Una capa cognitiva con LLM anclada a evidencias generadas por el motor.
3. Un flujo de gobernanza human-in-the-loop mediante reportes y scripts de limpieza revisables.

La contribucion cientifica mas fuerte no es afirmar que el motor determinista tiene precision perfecta, sino demostrar que las reglas deterministas tienen alto valor como generadoras de evidencia reproducible, aunque produzcan ruido en escenarios semanticamente ambiguos. Ese ruido justifica la Capa 2: el LLM no sustituye al motor, lo interpreta, prioriza y contextualiza.

## 2. Estado actual por objetivo especifico

| Objetivo | Estado | Evidencia existente | Riesgo principal |
|---|---|---|---|
| OE1. Motor determinista | Implementado y validado preliminarmente | `src/services/auditEngine.ts`, `experiments/results/deterministic_validation.json`, `docs/tablas/resultados_motor_determinista.md` | La memoria y algunas tablas aun hablan de EM = 1.00, pero la validacion actual muestra Precision = 37.93%, Recall = 84.62%, F1 = 52.38%. |
| OE2. Benchmarking multi-modelo | Parcial | `src/services/aiProvider.ts`, proveedores Gemini/WebLLM, script `benchmark_multi_modelo.ts` | `benchmark_multimodelo.json` no contiene resultados validos porque fallo la API key. Falta ejecucion real y metodologia clara. |
| OE3. Arquitectura local-first | Implementada en parte | `WebLLMProvider`, `checkWebGPUSupport`, parsing local de CSV, configuracion Cloud/Local | Debe distinguirse con precision: la fase determinista es local; la fase cognitiva puede ser local o cloud segun proveedor. |
| OE4. Scripts auditables HITL | Implementado conceptualmente | prompts, `pdfGenerator.ts`, reporte ejecutivo con `python_script` | Falta evidencia experimental de calidad del script generado y criterios de revision humana. |

## 3. Ajuste narrativo clave

### Formulacion a evitar

> "El motor determinista garantiza precision total EM = 1.00."

Esta frase queda debilitada por los resultados actuales. Puede defenderse determinismo/reproducibilidad, pero no precision empirica perfecta.

### Formulacion recomendada

> "El motor determinista garantiza reproducibilidad operacional: ante el mismo dataset produce el mismo conjunto de hallazgos. La validacion preliminar muestra alto recall, pero tambien falsos positivos en contextos ambiguos; por ello AURA incorpora una capa cognitiva encargada de contextualizar, priorizar y convertir los hallazgos en acciones auditables."

Esta version es mas cientifica, mas honesta y mas fuerte: convierte una limitacion en argumento arquitectonico.

## 4. Prioridades para la segunda entrega

### P0. Ajustar coherencia cientifica sin romper continuidad

- Sustituir afirmaciones de precision perfecta por reproducibilidad determinista.
- Actualizar la tabla comparativa para no afirmar EM = 1.00 en AURA.
- Separar "deteccion determinista" de "interpretacion cognitiva".
- Aclarar que local-first es un modo arquitectonico y que Gemini implica salida a nube si se usa como proveedor.

### P1. Avanzar Capitulo 5 con evidencia real

Estructura sugerida:

1. Arquitectura general de AURA.
2. Capa 0: infraestructura local-first y soberania del dato.
3. Capa 1: motor determinista, catalogo de reglas y resultados de validacion.
4. Capa 2: capa cognitiva, smart sample y mecanismos anti-alucinacion.
5. Capa 3: gobernanza HITL, PDF y scripts Pandas.
6. Interfaz de usuario y flujo operativo.
7. Benchmarking preliminar.

### P2. Ejecutar benchmark LLM de verdad

Minimo viable para segunda entrega:

- Gemini 2.0 Flash con API key valida.
- Gemini 1.5 Pro o 1.5 Flash.
- Un modelo local WebLLM desde interfaz, aunque sea con medicion manual documentada.

Metricas minimas:

- Latencia total.
- Cumplimiento de formato JSON.
- Inclusion de script Pandas.
- Alucinacion basica: columnas inventadas frente al esquema real.
- Calidad cualitativa del diagnostico.

### P3. Convertir feedback docente en cambios visibles

El profesor pidio:

- Tabla comparativa entre herramientas y AURA.
- Refuerzo de contrastes rule-based vs cloud vs LLM-based.
- Reduccion de afirmaciones extensas y mejor equilibrio de densidad conceptual.
- Validacion experimental robusta.

Ya existe material para esto en `docs/tablas/`, pero falta integrarlo en el Word con formato academico.

## 5. Riesgos academicos detectados

1. Referencias futuras o muy recientes deben verificarse antes de entrega final.
   Algunas citas 2026 pueden ser correctas si existen, pero conviene revisar una por una para evitar bibliografia fragil.

2. El concepto "local-first" debe usarse con cuidado.
   Si Gemini se usa por defecto, no puede afirmarse que todo el sistema es local en todos los modos. La formulacion segura es: AURA ofrece una arquitectura local-first y soporta inferencia local mediante WebLLM; cuando se usa Gemini, solo se envia el smart sample y no el CSV completo.

3. El benchmark multi-modelo todavia no prueba OE2.
   El archivo actual registra error de API key. No debe presentarse como resultado experimental hasta ejecutarlo correctamente.

4. La validacion determinista actual es pequena.
   El dataset sintetico de 15 filas sirve como prueba controlada, no como validacion general. Debe llamarse "validacion preliminar controlada".

## 6. Propuesta de posicionamiento cientifico

Titulo tecnico-publicable:

> AURA: arquitectura hibrida determinista-cognitiva para diagnostico local-first de calidad del dato con mecanismos de mitigacion de alucinaciones

Contribucion principal:

> Un patron arquitectonico que usa reglas deterministas para generar evidencia reproducible y LLMs para traducir dicha evidencia en diagnosticos semanticos y acciones de limpieza auditables, reduciendo el riesgo de caja negra mediante smart samples, copy-paste evidence, salida estructurada y supervision humana.

## 7. Siguiente accion recomendada

Crear el borrador de la segunda entrega a partir del Word de la primera entrega y trabajar primero tres piezas:

1. Reescritura del Capitulo 3.3 para alinear metodologia y arquitectura.
2. Redaccion completa del Capitulo 5 usando los artefactos actuales.
3. Actualizacion de tablas de resultados con lenguaje de "preliminar" y no de "conclusivo".
