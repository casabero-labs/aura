# Observaciones sobre la seccion 3.3.3

> Documento de trabajo para corregir la segunda entrega del TFM.
> Seccion analizada: `3.3.3 Arquitectura de Capas de Estabilidad`.

## 1. Diagnostico general

La seccion tiene una idea muy potente: presentar AURA como una arquitectura por capas que protege el diagnostico de calidad del dato desde la infraestructura hasta la gobernanza humana. Esta estructura es defendible y diferencial, especialmente porque conecta privacidad, reproducibilidad, LLMs y trazabilidad.

No conviene cambiar el corazon de la seccion, porque la primera entrega fue bien valorada. El ajuste recomendado es de precision academica y direccion para lo que viene. La redaccion actual mezcla metodologia, arquitectura, resultados esperados y afirmaciones empiricas. Para una segunda entrega mas solida, conviene separar:

- Lo que AURA ya implementa.
- Lo que AURA permite metodologicamente.
- Lo que todavia debe demostrarse mediante validacion experimental.

## 2. Observaciones criticas

### 2.1. Matizar "precision del 100%" como objetivo experimental

Texto actual problematico:

> "Al ejecutarse localmente, el motor auditEngine.ts ejecuta chequeos de asercion estadistica (...) con una precision del 100% (EM/LS = 1,00)..."

Problema:

Los resultados actuales en `experiments/results/deterministic_validation.json` no sostienen esa afirmacion. La validacion preliminar muestra:

| Metrica | Valor |
|---|---:|
| Precision | 37.93% |
| Recall | 84.62% |
| F1-score | 52.38% |
| True positives | 22 |
| False positives | 36 |
| False negatives | 4 |

Interpretacion:

El motor no debe venderse como empiricamente perfecto. Su fortaleza real es que es reproducible, auditable y estable: ante el mismo dataset genera los mismos hallazgos. Esa es una base cientifica mas fuerte y honesta.

Propuesta de ajuste sin romper la idea original:

> "Al ejecutarse localmente, el motor `auditEngine.ts` aplica reglas deterministas basadas en estadistica descriptiva, expresiones regulares y hashes de 32 bits. Su principal aporte no es sustituir el juicio semantico, sino producir una base de evidencia reproducible: ante el mismo conjunto de datos, el sistema genera los mismos hallazgos estructurales. La validacion preliminar muestra un recall elevado, aunque tambien falsos positivos en contextos semanticamente ambiguos, lo que justifica la incorporacion posterior de una capa cognitiva de contextualizacion."

### 2.2. Matizar el alcance de local-first

Texto actual problematico:

> "Al procesar todo localmente, AURA elimina la variabilidad..."

Problema:

La app permite dos modos de IA:

- Cloud: Gemini.
- Local: WebLLM mediante WebGPU.

Por tanto, no siempre "todo" se procesa localmente. La fase determinista si ocurre localmente en navegador. La fase cognitiva puede ser local o cloud segun configuracion.

Propuesta:

> "AURA adopta un enfoque local-first: el parsing del CSV y la auditoria determinista se ejecutan en el navegador. Para la capa cognitiva, el sistema contempla dos modos: inferencia local mediante WebLLM/WebGPU o inferencia cloud mediante Gemini, enviando en este ultimo caso un resumen inteligente y no el dataset completo."

### 2.3. Mantener la logica en Capitulo 3 y ampliar detalle en Capitulo 5

Problema:

La seccion 3.3.3 pertenece a metodologia. Sin embargo, ahora contiene detalles tecnicos extensos de implementacion: WebGPU, cuantizacion, hashes, IQR, prompt engineering, scripts Pandas.

Recomendacion:

En el Capitulo 3 debe quedarse la justificacion metodologica de la arquitectura, como ya se planteo en la primera entrega. El detalle tecnico debe ampliarse en el Capitulo 5, no eliminarse de 3.3.3.

Distribucion recomendada:

| Contenido | Ubicacion sugerida |
|---|---|
| Por que se usa una arquitectura por capas | Cap. 3.3.3 |
| Diagrama general de capas | Cap. 3.3.3 o inicio Cap. 5 |
| Detalle de `auditEngine.ts` y reglas | Cap. 5.3 |
| Smart sample, prompts y M1-M5 | Cap. 5.4 |
| PDF y scripts Pandas HITL | Cap. 5.5 |
| Benchmark y metricas | Cap. 5.7 / Cap. 6 |

### 2.4. Evitar afirmaciones absolutas

Expresiones a suavizar:

- "soberania absoluta"
- "erradicando las alucinaciones"
- "matematicamente innegable"
- "garantiza que el mismo conjunto de datos produzca siempre el mismo resultado" si incluye LLM cloud
- "sin sacrificar la capacidad diagnostica" si no esta medido

Formulaciones mas academicas:

- "reduce el riesgo de exposicion de datos"
- "mitiga las alucinaciones"
- "proporciona una base reproducible de evidencia"
- "favorece la repetibilidad de la fase determinista"
- "permite evaluar el compromiso entre privacidad, latencia y capacidad diagnostica"

## 3. Ajuste sugerido para 3.3.3

Este texto no debe asumirse como reemplazo automatico. Es una version de apoyo para insertar cambios quirurgicos en el Word, manteniendo la narrativa aprobada en la primera entrega.

### 3.3.3 Arquitectura de Capas de Estabilidad

La metodologia tecnica de AURA se organiza mediante una Arquitectura de Capas de Estabilidad, concebida para separar responsabilidades y reducir los riesgos asociados al diagnostico automatizado de calidad del dato. Esta arquitectura combina procesamiento local, reglas deterministas, interpretacion asistida por LLM y supervision humana. Su objetivo no es delegar la limpieza de datos a un sistema opaco, sino construir un flujo verificable en el que cada fase produzca evidencia trazable para la siguiente.

La arquitectura se estructura en cuatro capas:

**Capa 0. Infraestructura soberana local-first.** Esta capa establece que la carga, lectura y auditoria inicial del dataset se ejecutan en el navegador del usuario. De este modo, los datos crudos no necesitan abandonar el entorno local durante la fase determinista. AURA contempla, ademas, la posibilidad de ejecutar modelos locales mediante WebLLM y WebGPU, aunque mantiene compatibilidad con proveedores cloud como Gemini cuando el usuario decide priorizar disponibilidad o rendimiento sobre soberania completa del dato.

**Capa 1. Motor determinista.** El motor `auditEngine.ts` aplica reglas reproducibles sobre el dataset: deteccion de duplicados, valores nulos, inconsistencias de tipo, errores de formato, outliers y posibles datos sensibles. Esta capa no pretende resolver la interpretacion semantica del dominio, sino producir una base objetiva de hallazgos estructurales. La validacion preliminar muestra que el motor alcanza un recall elevado en errores inyectados, pero tambien genera falsos positivos en situaciones ambiguas; por ello, su papel metodologico es funcionar como generador de evidencia verificable para la capa cognitiva posterior.

**Capa 2. Estabilidad cognitiva.** El LLM no opera directamente sobre el dataset completo, sino sobre un resumen inteligente generado por la capa determinista. Este resumen incluye metadatos, estadisticas por columna, reglas activadas y muestras acotadas de valores problematicos. Para reducir el riesgo de alucinaciones, AURA incorpora mecanismos como baja temperatura, anclaje semantico, citacion de muestras reales mediante el paradigma copy-paste y salida estructurada en JSON para los reportes ejecutivos.

**Capa 3. Gobernanza y trazabilidad.** La ultima capa devuelve el control al usuario mediante reportes interpretables y scripts de limpieza en Python/Pandas. AURA no modifica automaticamente el dataset original; propone acciones revisables bajo un enfoque human-in-the-loop. Esto permite que el analista valide las transformaciones antes de aplicarlas y conserva la trazabilidad entre hallazgo, recomendacion y accion correctiva.

Esta organizacion por capas permite estudiar AURA como un sistema hibrido: las reglas deterministas aportan reproducibilidad, los LLM aportan contextualizacion semantica y la supervision humana mantiene la responsabilidad final sobre las decisiones de limpieza. En consecuencia, la arquitectura propuesta responde al problema de las cascadas de datos mediante un flujo auditable que combina precision operacional, interpretabilidad y gobernanza.

## 4. Acciones pendientes sobre el Word

- Insertar numeracion explicita `3.3.3 Arquitectura de Capas de Estabilidad`.
- Ajustar la version actual hacia una formulacion mas metodologica y menos conclusiva.
- Mover detalles tecnicos extensos al Capitulo 5.
- Añadir una figura de cuatro capas con fuente propia.
- Cruzar esta seccion con la tabla de resultados preliminares del motor determinista.
- Revisar que las referencias citadas existan y esten en formato APA 7.
