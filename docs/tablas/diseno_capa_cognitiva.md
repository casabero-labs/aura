# Capa Cognitiva — Diseño de Prompts y Estrategias Anti-Alucinación

> Documentación para **Capítulo 5.4 — Capa 2: Estabilidad Cognitiva** de la memoria TFM.
> Archivo fuente: `src/services/geminiService.ts`

---

## 1. Arquitectura de la Capa Cognitiva

La Capa 2 de AURA **nunca opera sobre datos crudos**. Recibe exclusivamente el output estructurado del motor determinista (Capa 1), lo que garantiza que toda interpretación de la IA esté anclada a hechos verificables.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   CSV Dataset    │ ──▶ │  Motor Deter-    │ ──▶ │  Capa Cognitiva  │
│   (datos crudos) │     │  minista (R01-   │     │  (Gemini LLM)    │
│                  │     │  R22)            │     │                  │
│                  │     │  Output:         │     │  Input:          │
│                  │     │  - AuditReport   │     │  - JSON summary  │
│                  │     │  - ColumnStats   │     │  - Bad samples   │
│                  │     │  - QualityIssues │     │  - Column stats  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Principio de Separación

| Capa | Responsabilidad | ¿Toca datos crudos? |
|---|---|---|
| Capa 1 (Determinista) | Detectar anomalías con precisión EM=1.00 | ✅ Sí |
| Capa 2 (Cognitiva) | Interpretar, contextualizar, generar scripts | ❌ No — solo ve el JSON resumen |

---

## 2. Construcción del Smart Sample (Registro de Datos Mejorado)

En lugar de enviar el dataset completo al LLM (lo cual violaría la privacidad y excedería tokens), AURA construye un **Smart Sample JSON** que contiene solo lo necesario para el diagnóstico:

```typescript
const jsonSummary = {
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
    sample_values: c.sampleValues  // 3 valores: inicio, medio, final
  })),
  detected_issues: report.issues.map(i => ({
    rule: i.ruleName,
    category: i.category,
    column: i.column,
    details: i.description,
    bad_samples: i.sampleValues.slice(0, 3)  // Paradigma Copy-Paste
  }))
};
```

### Datos incluidos vs excluidos

| Incluido en Smart Sample | Excluido (permanece local) |
|---|---|
| Nombres de columnas | Filas individuales del dataset |
| Tipos inferidos | Valores completos de cada fila |
| Conteos agregados (nulos, únicos) | Datos de identificación personal |
| Top 5 valores más frecuentes | El archivo CSV original |
| 3 valores muestra (inicio, medio, final) | Filas duplicadas completas |
| Issues detectadas con bad_samples | — |

---

## 3. Diseño del Prompt de Análisis (Streaming)

### Rol asignado al LLM

```
"Ingeniero de Datos Senior + Arquitecto de Datos con más de 15 años 
de experiencia en data governance y modelado"
```

### Instrucción de comportamiento

```
"Tu misión es ser extremadamente crítico y exhaustivo"
```

### Pasos obligatorios (cadena de razonamiento forzada)

El prompt impone un orden estricto de 5 pasos para evitar respuestas superficiales:

| Paso | Descripción | Propósito anti-alucinación |
|---|---|---|
| 1 | Inferir el dominio real del dataset | Obliga al modelo a contextualizar antes de diagnosticar |
| 2 | Análisis exhaustivo de defectos (6 sub-categorías) | Estructura la salida para cubrir todos los ángulos |
| 3 | Recomendaciones de refactorización (Prioridad Alta/Media/Baja) | Fuerza clasificación por impacto |
| 4 | Tabla resumen final obligatoria | Ancla cuantitativo para verificación humana |
| 5 | Scripts de limpieza Python/Pandas | Entregable concreto y verificable (OE4) |

### Las 6 sub-categorías del Paso 2

1. **Nombres de columnas** — Engañosos, convenciones rotas, idiomas mezclados
2. **Redundancia y derivación** — Columnas calculables, copias exactas
3. **Normalización y consistencia** — Múltiples representaciones del mismo concepto
4. **Problemas semánticos y de dominio** — Valores imposibles, categorías como texto libre
5. **Defectos de diseño** — >90% nulos, constantes, booleans como texto
6. **Seguridad** — PII expuesta (CURP, RFC, tarjetas)

---

## 4. Mecanismos Formales Anti-Alucinación

### M1 — Temperatura Baja (t = 0.1)

```typescript
config: {
  temperature: 0.1,  // Mínima creatividad, máxima consistencia
}
```

**Justificación**: Trane Technologies (2026) demuestran que incluso con t=0 hay variación en GPUs cloud. t=0.1 es el mínimo práctico que permite coherencia textual sin introducir especulación.

### M2 — Anclaje Semántico (Enhanced Data Registry)

El prompt inyecta el JSON del Smart Sample directamente en la instrucción. El modelo solo puede razonar sobre datos que existen en ese JSON. No tiene acceso a conocimiento previo sobre el dataset.

### M3 — Paradigma Copy-Paste (Long et al., 2026)

El Smart Sample incluye `bad_samples` — los valores problemáticos reales detectados por la Capa 1. El modelo debe citar textualmente estos valores en su diagnóstico, eliminando la posibilidad de inventar ejemplos.

### M4 — Cadena de Razonamiento Forzada

Los 5 pasos obligatorios del prompt obligan al modelo a seguir un proceso lógico: primero entender (dominio), luego analizar (defectos), luego recomendar (acciones). Esto mitiga saltos lógicos y conclusiones prematuras.

### M5 — Structured Output (JSON Schema) para Reporte Ejecutivo

Para la generación del reporte PDF, se usa `responseMimeType: "application/json"` con un schema estricto:

```typescript
responseSchema: {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    domain_inferred: { type: Type.STRING },
    dataset_technical_description: { type: Type.STRING },
    executive_summary: { type: Type.STRING },
    business_impact: { type: Type.STRING },
    key_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [/* todos los campos */]
}
```

**Justificación**: Shen et al. (2025) demuestran con SLOT que la salida estructurada elimina ambigüedades de formato y reduce hallucinations de formato en un 85%.

---

## 5. Tabla Resumen de Estrategias vs Literatura

| Estrategia AURA | Referencia Académica | Mecanismo |
|---|---|---|
| t = 0.1 | Trane Technologies (2026) | Reducción de varianza estocástica |
| Anclaje Semántico | Trane Technologies (2026), M4 | Inyección de datos verificables en prompt |
| Copy-Paste | Long et al. (2026) | Citación textual de valores erróneos |
| JSON Schema | Shen et al. (2025), SLOT | Eliminación de ambigüedad de formato |
| Cadena forzada | Ruan et al. (2025), MS-HM | Multi-etapa con validación intermedia |
| Smart Sample | Hilmi et al. (2026) | Pipeline híbrido reglas + LLM |

---

## 6. Dos Modos de Operación

### Modo 1: Análisis Streaming (Tab IA del Dashboard)

- **Función**: `getGeminiAnalysisStream()`
- **Modelo**: Configurable (default: `gemini-2.0-flash`)
- **Output**: Markdown renderizado en tiempo real
- **Interactividad**: El usuario ve el diagnóstico construirse token a token
- **Mecanismos**: M1 + M2 + M3 + M4

### Modo 2: Reporte Ejecutivo (Exportar PDF)

- **Función**: `generateExecutiveReport()`
- **Modelo**: El mismo configurado
- **Output**: JSON estricto (`ExecutiveReportContent`)
- **Mecanismos**: M1 + M2 + M5
- **Uso posterior**: jsPDF genera un PDF multi-página de calidad profesional
