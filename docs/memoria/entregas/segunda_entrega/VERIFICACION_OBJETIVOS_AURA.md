# Informe de Verificación de Objetivos Académicos — AURA

Este informe proporciona una auditoría técnica completa del código fuente de **AURA** contrastándolo de forma rigurosa con los objetivos específicos (OE) detallados en el documento `BORRADOR_SEGUNDA_ENTREGA_CORREGIDA.md` del Trabajo Fin de Máster (TFM).

---

## Índice de Cumplimiento

```mermaid
gantt
    title Estado de Implementación por Objetivo Técnico
    dateFormat  YYYY-MM-DD
    section OE1. Local-First
    Parser CSV en Navegador (PapaParse)   :done, 2026-05-10, 2026-05-19
    Inferencia Local (WebLLM WebGPU)     :done, 2026-05-12, 2026-05-19
    Paquete Smart Sample (Privacidad)     :done, 2026-05-14, 2026-05-19
    section OE2. Motor Determinista
    26 Reglas de Calidad Activas         :done, 2026-05-10, 2026-05-19
    Heurística de Tipos y Semántica      :done, 2026-05-12, 2026-05-19
    Estadística Descriptiva y Outliers   :done, 2026-05-13, 2026-05-19
    section OE3. Diagnóstico e HITL
    Anclaje Semántico de Prompts         :done, 2026-05-14, 2026-05-19
    Validación de Operaciones Pandas     :done, 2026-05-15, 2026-05-19
    Simulador de Remediación             :done, 2026-05-16, 2026-05-19
    section OE4. Comparación Lab
    Métricas de Latencia y Token Rate    :done, 2026-05-16, 2026-05-19
    Detección Científica Alucinaciones   :done, 2026-05-17, 2026-05-19
    Fórmula de Score Compuesto           :done, 2026-05-18, 2026-05-19
```

---

## 1. OE1. Arquitectura Local-First y Límites de Privacidad

> **Definición de Tesis**: *"Desarrollar una arquitectura local-first que permita cargar, procesar y auditar datasets desde el navegador, reduciendo la exposición de datos sensibles y habilitando la ejecución de componentes deterministas y cognitivos en entornos locales o cloud."*

### Descomposición en Preguntas de Verificación

* **¿Cómo se procesa y audita el dataset localmente? ¿Los datos se filtran al servidor?**
  * *Verificación*: Todo el flujo inicial de AURA es **local-first**. El archivo subido por el usuario se procesa directamente en la memoria del navegador. No existe ningún componente de backend o servidor remoto que reciba el dataset crudo.
* **¿Qué motor realiza la lectura de los datos y cuál es su límite?**
  * *Verificación*: Se utiliza la biblioteca **PapaParse** en [csvService.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/csvService.ts). Para evitar el bloqueo del hilo principal de ejecución en el navegador al procesar archivos gigantescos, se define un umbral técnico de rendimiento (`preview: 5000` filas) y se activa la autodección de delimitadores (`delimiter: ""`).
* **¿Cómo se ejecutan los modelos LLM locales?**
  * *Verificación*: A través de **WebLLM** en [webllmProvider.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/providers/webllmProvider.ts), que utiliza la API de **WebGPU** de los navegadores modernos para descargar y ejecutar modelos de lenguaje (como *Llama-3* o *Qwen-2.5*) directamente en la tarjeta gráfica local del usuario. También se provee soporte nativo para **Chrome AI** (`window.ai`) en [chromeProvider.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/providers/chromeProvider.ts).
* **¿Cómo se protegen los datos si se decide usar un LLM cloud (como Gemini)?**
  * *Verificación*: Se implementa el mecanismo **Smart Sampling** (Muestreo Inteligente) mediante la función `buildSmartSample` en [prompts.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/providers/prompts.ts). En lugar de enviar el dataset completo de miles de filas, se construye un paquete resumen en formato JSON que contiene metadatos globales, la firma estadística descriptiva de las columnas y una lista selecta de un máximo de 3 ejemplos problemáticos (`bad_samples`) por regla activada.
* **¿Dónde se presenta este control en la interfaz de usuario?**
  * *Verificación*: En [DiagnosisStep.tsx](file:///Users/casabero/Documents/GitHub/aura/src/components/DiagnosisStep.tsx#L298-L316), la UI renderiza una advertencia visual dinámica llamada `.privacy-notice`. Si el usuario elige "Local-First", se muestra un escudo verde de privacidad (**"Modo local (WebGPU)"**), garantizando que ningún dato saldrá de su máquina. Si elige "Cloud", se muestra una advertencia (**"Modo cloud"**) explicando que se enviará únicamente el resumen estructurado JSON a servidores externos.

```typescript
// Evidencia de Smart Sampling en src/services/providers/prompts.ts:L20-L44
export const buildSmartSample = (report: AuditReport) => ({
  context: {
    total_rows: report.rowCount,
    total_columns: report.colCount,
    detected_delimiter: report.delimiterDetected,
    quality_score: report.score
  },
  columns: Object.values(report.columnStats).map(c => ({
    name: c.name,
    type: c.inferredType,
    nulls: c.nullCount,
    unique: c.uniqueCount,
    top_values: c.topFreq?.map(t => t.value),
    sample_values: c.sampleValues
  })),
  detected_issues: report.issues.map(i => ({
    rule: i.ruleName,
    category: i.category,
    column: i.column,
    details: i.description,
    bad_samples: i.sampleValues.slice(0, 3) // Evidencia sin filtraciones masivas
  }))
});
```

---

## 2. OE2. Motor Determinista (Capa 1)

> **Definición de Tesis**: *"Diseñar e implementar un motor de auditoria determinista basado en reglas explicitas, expresiones regulares, heuristica de tipos y estadistica descriptiva, capaz de generar hallazgos reproducibles sobre anomalias estructurales del dataset."*

### Descomposición en Preguntas de Verificación

* **¿Cómo trabaja el motor determinista de AURA?**
  * *Verificación*: Todo el análisis ocurre de manera estrictamente algorítmica y reproducible en [auditEngine.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/auditEngine.ts). Acepta el arreglo de filas crudas y devuelve un `AuditReport` tipado con precisión matemática.
* **¿Cuáles son las reglas explícitas declaradas?**
  * *Verificación*: El motor implementa exactamente **26 reglas explícitas** agrupadas y categorizadas:
    1. **Integridad estructural**: `Filas Duplicadas` (mediante hashes rápidos de memoria), `Valores Nulos` (críticos si >20%), `Columnas Constantes` (entropía cero), `Tipos Mixtos (Dirty Object)` (mezcla conflictiva de string y number).
    2. **Higiene del dato**: `Espacios Fantasma` (trimming), `Mojibake / Encoding Roto` (mediante la expresión regular `\u00C3[\u0080-\u00BF]`), `Caos de Capitalización` (mismos términos en mayúsculas/minúsculas), `Placeholders Tóxicos` (valores máscara como `"n/a"`, `"undefined"`, `"999"`), `Espacios Múltiples` (dobles espacios internos), `Símbolos Sospechosos` (caracteres no alfanuméricos en IDs/Nombres), `Desbordamiento de Texto` (>300 caracteres).
    3. **Tipos de datos ocultos**: `Números Disfrazados` (valores numéricos almacenados como strings), `Fechas Ocultas` (cadenas con formato de fecha), `IDs Corruptos` (IDs enteros convertidos por error a floats con sufijo `.0`), `Hora Redundante` (`00:00:00` implícita).
    4. **Reglas de lógica y dominio**: `Negativos Imposibles` (en campos biológicos/financieros positivos), `Outliers Extremos (IQR 3x)`, `Outliers Leves (Tukey 1.5x)`, `Formato de Email Inválido` (regex robusto), `Longitud de Teléfonos Variable` (comparando cada número telefónico contra la moda de longitud de la columna), `Fechas Futuras (Freshness)` (detección de valores por defecto futuros como `2099-12-31`), `Incoherencia Temporal` (fecha de inicio posterior a fecha de fin), `Redundancia Temporal Derivable` (columnas de tiempo redundantes que pueden ser calculadas a partir de una fecha/hora).
* **¿Qué heurística de inferencia de tipos está implementada?**
  * *Verificación*: En `calculateStats` y `detectSemanticType` (L74-L115), AURA realiza inferencia en dos fases:
    1. **Tipo Primitivo**: Porcentaje de conversión de tipos (>90% numérico define columna numérica; >80% dates define tipo fecha; mezcla relevante define `mixed` o "dirty object").
    2. **Tipo Semántico**: Analiza una muestra de las primeras 100 filas contra expresiones regulares complejas (`REGEX_EMAIL`, `REGEX_PHONE`, `REGEX_URL`, `REGEX_IP`, `REGEX_UUID`, `REGEX_ZIP`, `REGEX_CURRENCY`, `REGEX_PERCENTAGE`) combinado con un bono de coincidencia léxica sobre palabras clave del encabezado de la columna (`SEMANTIC_KEYWORDS`).
* **¿Cómo describe la estadística al dataset?**
  * *Verificación*: Para columnas numéricas, se calcula la media, mediana, mínimo, máximo, desviación estándar, **coeficiente de variación (CV)**, **asimetría (skewness)** y el **Rango Intercuartílico (IQR)**. Se aplican las vallas estadísticas:
    * $\text{Valla Tukey Mild Outliers} = [Q_1 - 1.5 \times IQR, \ Q_3 + 1.5 \times IQR]$
    * $\text{Valla Extreme Outliers} = [Q_1 - 3.0 \times IQR, \ Q_3 + 3.0 \times IQR]$
* **¿Cómo se presentan estos hallazgos en la UI?**
  * *Verificación*: Se despliegan a través de un panel modular interactivo que incluye:
    * `ScoreGauge.tsx` y `ScoreBreakdown.tsx`: Muestra el puntaje global de calidad (0 a 100) y el desglose de penalizaciones según categoría.
    * `RuleActivationMatrix.tsx`: Una cuadrícula visual que mapea qué reglas del motor se activaron y en qué columnas del dataset.
    * `FindingsTable.tsx` e `IssueList.tsx`: Tablas detalladas con severidad (Crítica, Advertencia, Info) y ejemplos en vivo de las filas corruptas.
    * `ColumnStatsPanel.tsx`: Despliega histogramas de frecuencia, análisis descriptivo estadístico y diagramas de caja (`BoxPlot.tsx`) basados en IQR.

---

## 3. OE3. Diagnóstico y Generación de Scripts con LLM (Capas 2 y 3)

> **Definición de Tesis**: *"Implementar una capa cognitiva basada en LLM, local o cloud, que reciba los hallazgos estructurados del motor determinista, diagnostique causas probables de los problemas de calidad y genere scripts Python/Pandas orientados a corregir o asistir el proceso de limpieza del dataset."*

### Descomposición en Preguntas de Verificación

* **¿Cómo interactúa la capa cognitiva con los hallazgos deterministas?**
  * *Verificación*: El prompt del LLM está diseñado bajo un modelo de **Anclaje Semántico (Mecanismo M2)** en [prompts.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/providers/prompts.ts#L50-L97). El prompt prohíbe explícitamente al LLM hacer afirmaciones no respaldadas por el JSON de entrada:
    > *"Tu tarea NO es impresionar ni descubrir defectos imaginarios: tu tarea es explicar la evidencia disponible de forma reproducible."*
    > *"No inventes columnas, valores, relaciones, tablas dimensión, PII, dominios ni causas."*
* **¿Cómo se generan los scripts de remediación?**
  * *Verificación*: En una fase dedicada del pipeline (`ScriptGenerationStep.tsx`), AURA utiliza `buildExecutivePrompt` para ordenar al LLM generar un bloque JSON limpio que contiene código Python/Pandas ejecutable y un listado de acciones atómicas de remediación (`trim_whitespace`, `normalize_placeholders`, etc.) que pueden ser simuladas de forma segura.
* **¿Existe verificación sobre la seguridad del script antes de que el usuario lo apruebe?**
  * *Verificación*: Sí. Se implementa en [scriptValidationService.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/scriptValidationService.ts). AURA valida el script contra dos grandes riesgos de estabilidad:
    1. **Columnas Fantasma (Alucinación)**: Verifica mediante regex si el código Pandas del LLM referencia columnas que no existen en el dataset original.
    2. **Acciones Destructivas (Seguridad)**: Detecta patrones regex potencialmente dañinos (`.drop()`, `dropna()`, `drop_duplicates()`, `del df[...]`, `inplace=True`). Si se detecta cualquiera de estos, activa la advertencia y marca la bandera `requiresHumanReview = true`.
* **¿Cómo se implementa el flujo Human-in-the-Loop (HITL)?**
  * *Verificación*: En [ScriptReview.tsx](file:///Users/casabero/Documents/GitHub/aura/src/components/ScriptReview.tsx), la interfaz presenta una terminal interactiva para el usuario. Éste puede **inspeccionar**, **editar el script de forma libre** (corrigiendo cualquier alucinación en el código) y probar su ejecución en un entorno simulado antes de exportar el PDF con los resultados oficiales.

```typescript
// Evidencia de Validación de Operaciones Destructivas en scriptValidationService.ts:L4-L10
const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\.drop\s*\(/i, label: 'drop' },
  { pattern: /dropna\s*\(/i, label: 'dropna' },
  { pattern: /drop_duplicates\s*\(/i, label: 'drop_duplicates' },
  { pattern: /del\s+df\[/i, label: 'delete_column' },
  { pattern: /inplace\s*=\s*True/i, label: 'inplace_mutation' },
];
```

---

## 4. OE4. Módulo de Comparación Experimental (Capa 3)

> **Definición de Tesis**: *"Implementar un modulo de comparacion integrado al flujo de AURA para evaluar modelos LLM locales y cloud bajo el mismo esquema de entrada, midiendo latencia, cumplimiento de formato, presencia de alucinaciones, validez de scripts generados y utilidad para la mejora del dataset."*

### Descomposición en Preguntas de Verificación

* **¿Cómo está estructurado el módulo de comparación experimental (Benchmark)?**
  * *Verificación*: AURA cuenta con un laboratorio formal de experimentación implementado en `BenchmarkLab.tsx`, `BenchmarkPanel.tsx` y `evaluationService.ts`. Permite configurar experimentos controlados con los mismos estímulos y registrar los resultados bajo variables estadísticas rigurosas.
* **¿Qué métricas evalúa y cómo se calcula el Score Compuesto?**
  * *Verificación*: En [evaluationService.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/benchmark/evaluationService.ts#L16-L33), se calcula una métrica compuesta ponderada que suma exactamente $1.0$. Cada variable es normalizada en un rango continuo $[0, 1]$:
    
    $$\text{Score Compuesto} = 0.25 \cdot S_{\text{JSON}} + 0.25 \cdot S_{\text{No-Alucinación}} + 0.15 \cdot S_{\text{Latencia}} + 0.10 \cdot S_{\text{Eficiencia}} + 0.10 \cdot S_{\text{Script}} + 0.15 \cdot S_{\text{Precisión Cifras}}$$

    * *Cumplimiento de Formato ($S_{\text{JSON}}$)*: $1.0$ si parsea como JSON estructurado, $0.0$ si falla.
    * *Tasa de Alucinación ($S_{\text{No-Alucinación}}$)*: Basado en el volumen de columnas fantasma respecto al tamaño de la respuesta.
    * *Latencia ($S_{\text{Latencia}}$)*: Escalamiento inverso respecto a la latencia máxima registrada.
    * *Eficiencia de Tokens ($S_{\text{Eficiencia}}$)*: Medición de tokens por segundo normalizado sobre un máximo esperado de $100$ tok/s.
    * *Calidad del Script ($S_{\text{Script}}$)*: Validado según inclusión funcional de código útil.
    * *Precisión de Afirmaciones ($S_{\text{Precisión Cifras}}$)*: Proporción de números inventados sobre hechos reales del motor determinista.
* **¿Cómo se detectan científicamente las alucinaciones del LLM en el benchmark?**
  * *Verificación*: Se realiza a través de [hallucinationDetector.ts](file:///Users/casabero/Documents/GitHub/aura/src/services/benchmark/hallucinationDetector.ts). El detector actúa como un **árbitro independiente** contrastando la respuesta de texto libre del LLM contra el `AuditReport` factual (Capa 1):
    1. **Columnas Fantasma (`detectPhantomColumns`)**: Extrae mediante regex todas las referencias de comillas y variables (ej: `df['salario_mensual']`). Compara cada una contra las claves existentes en `columnStats`. Si no existe, se etiqueta como alucinación estructural.
    2. **Cifras Inventadas (`detectUnsupportedClaims`)**: Extrae cada cifra numérica mencionada por el LLM. Las contrasta con una tolerancia del 5% contra el catálogo de verdades del motor (cantidad de nulos reales, score asignado, registros duplicados, etc.). Si el modelo afirma, por ejemplo, *"Existen 450 registros corruptos"* pero el motor contó 45, se registra como una afirmación no soportada.
* **¿Cómo se exportan y visualizan las métricas para la tesis?**
  * *Verificación*: En [BenchmarkCharts.tsx](file:///Users/casabero/Documents/GitHub/aura/src/components/BenchmarkCharts.tsx), se renderizan gráficos de dispersión (Scatter Plots) y barras interactivos usando la biblioteca **Recharts**, visualizando:
    * Latencia de Primer Token vs Tiempo Total de Respuesta.
    * Token rate por segundo.
    * Correlación entre Score Compuesto y Costo del Modelo.
  * Adicionalmente, `evaluationService.ts` provee la función `exportBenchmarkJson` para exportar las corridas de experimentación en un JSON estructurado con cálculos de **Media**, **Desviación Estándar** y el **Coeficiente de Variación (CV)**, listo para ser copiado directamente en las tablas estadísticas del Capítulo 6 del TFM.

```typescript
// Evidencia de Detección de Afirmaciones Numéricas Inventadas en hallucinationDetector.ts:L135-L157
mentionedNumbers.forEach(reported => {
  if (reported < 1 || reported > report.rowCount * 2) return;

  const match = verifiableValues.find(v => matchesApproximately(reported, v.value));

  if (!match) {
    const isSuspiciousRound = (reported % 10 === 0 && reported > 0) && reported > report.rowCount;

    if (isSuspiciousRound || reported > 1000) {
      claims.push({
        claim: String(reported),
        expected: null,
        actual: reported,
        claimType: 'unknown' // Cifra inventada detectada con rigor matemático
      });
    }
  }
});
```

---

## Conclusión de la Auditoría

AURA **no es un prototipo conceptual**, sino una implementación de alta fidelidad que cumple con absoluta correspondencia técnica los cuatro objetivos específicos del TFM. La división física de responsabilidades en el código (`src/services/` y `src/components/`) es simétrica a la **Arquitectura de 4 Capas de Estabilidad**:

1. **Capa 0 (Infraestructura)** → PapaParse, `csvService.ts`, `webllmProvider.ts` y WebGPU.
2. **Capa 1 (Motor Determinista)** → `auditEngine.ts` con sus **26 reglas** e inferencia estadística.
3. **Capa 2 (Estabilidad Cognitiva)** → `prompts.ts` (M2/M3), `scriptValidationService.ts` y selector de modo de privacidad en UI.
4. **Capa 3 (Gobernanza y Trazabilidad)** → `evaluationService.ts`, `hallucinationDetector.ts`, simulación de remediación interactiva y logs de auditoría estructurados.
