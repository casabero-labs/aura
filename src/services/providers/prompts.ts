/**
 * Prompt compartido para todos los proveedores de IA.
 *
 * Centralizar el prompt garantiza que el benchmark (OE2) compare
 * modelos bajo condiciones idénticas — mismo input, mismo criterio.
 *
 * Referencia: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Mecanismos: M2 (Anclaje Semántico), M3 (Copy-Paste), M4 (Cadena Forzada)
 */

import { AuditReport, InputMode, PromptContractConfig } from '../../types';

/**
 * Construye el "Smart Sample" — el registro de datos mejorado
 * que se inyecta en el prompt del LLM.
 *
 * Mecanismo M2 (Anclaje Semántico): El modelo SOLO puede razonar
 * sobre datos presentes en este JSON. No tiene acceso al dataset crudo.
 */
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
  // Mecanismo M3 (Copy-Paste): Los bad_samples son valores reales
  // del dataset que el modelo DEBE citar textualmente.
  detected_issues: report.issues.map(i => ({
    rule: i.ruleName,
    category: i.category,
    column: i.column,
    details: i.description,
    bad_samples: i.sampleValues.slice(0, 3)
  }))
});

export const DEFAULT_PROMPT_CONTRACT: PromptContractConfig = {
  objective: 'Diagnosticar causas probables y producir una salida lista para generar un script Python/Pandas de limpieza asistida.',
  evidencePolicy: 'strict',
  requireScriptReadiness: true,
  includeHumanReviewLabels: true,
  includeCopyPasteEvidence: true,
  extraInstructions: '',
};

export const normalizePromptContract = (contract?: PromptContractConfig): PromptContractConfig => ({
  ...DEFAULT_PROMPT_CONTRACT,
  ...(contract || {}),
  objective: contract?.objective?.trim() || DEFAULT_PROMPT_CONTRACT.objective,
});

/**
 * Prompt de analisis streaming.
 * Contrato de evidencia: el LLM explica hallazgos deterministas sin inventar.
 */
// ── Enhanced Registry Builder ──

const buildEnhancedRegistry = (report: AuditReport): Record<string, any> => ({
  physical_context: {
    total_rows: report.rowCount,
    total_columns: report.colCount,
    detected_delimiter: report.delimiterDetected,
    quality_score: report.score,
    duplicate_rows: report.duplicateRows,
  },
  column_registry: Object.values(report.columnStats).map(c => ({
    name: c.name,
    inferred_type: c.inferredType,
    semantic_type: c.semanticType || undefined,
    nulls: c.nullCount,
    unique_count: c.uniqueCount,
    top_frequencies: c.topFreq?.slice(0, 5).map(t => ({ value: String(t.value).substring(0, 40), count: t.count })),
    sample_values: c.sampleValues?.slice(0, 3),
    iqr: c.iqr,
    zeros: c.zeros,
    cardinality_pct: ((c.uniqueCount / report.rowCount) * 100).toFixed(1) + '%',
  })),
  rule_activations: report.issues.map(i => ({
    rule_id: i.ruleName,
    category: i.category,
    severity: i.severity,
    column: i.column,
    affected_count: i.count,
    affected_pct: i.affectedPercentage.toFixed(2) + '%',
    description: i.description,
    bad_samples: i.sampleValues.slice(0, 5),
  })),
});

// ── Copy-Paste Bad Samples Builder ──

const buildCopyPasteBlock = (report: AuditReport): string => {
  const issuesWithSamples = report.issues.filter(i => i.sampleValues.length > 0);
  if (issuesWithSamples.length === 0) {
    return 'No hay bad samples disponibles en este dataset. Usa las reglas activadas y estadisticas observadas.';
  }
  return issuesWithSamples.slice(0, 10).map(i =>
    `- Regla "${i.ruleName}" en columna "${i.column || 'dataset'}" detecto: ${i.sampleValues.slice(0, 5).map(v => `"${String(v).substring(0, 50)}"`).join(', ')}`
  ).join('\n');
};

// ── Input Mode Prompt Builders ──

const buildPromptLibrePrompt = (report: AuditReport): string => {
  const columnNames = Object.keys(report.columnStats).join(', ');
  return `Analiza este dataset y entrega un diagnostico de calidad de datos con recomendaciones y, si aplica, codigo Python/Pandas.

Columnas disponibles:
${columnNames}

Contexto minimo:
- Filas: ${report.rowCount}
- Columnas: ${report.colCount}
- Score actual: ${report.score}/100

No recibiras reglas activadas ni muestras problematicas. Debes inferir los problemas probables a partir del esquema.
Responde en espanol.`;
};

const buildSmartSamplePrompt = (report: AuditReport, contract?: PromptContractConfig): string => {
  const promptContract = normalizePromptContract(contract);
  const jsonSummary = buildSmartSample(report);
  const json_data = JSON.stringify(jsonSummary, null, 2);

  return `Actua como revisor tecnico de calidad de datos. Explica la evidencia disponible de forma reproducible.

Objetivo: ${promptContract.objective}

Recibiras un resumen JSON del motor determinista de AURA con columnas observadas, tipos inferidos y reglas activadas. No tienes acceso al CSV completo.

JSON observado:
${json_data}

Reglas de honestidad:
- No inventes columnas, valores, relaciones ni causas.
- Cita la regla determinista, la columna y la evidencia disponible.
- Si haces una inferencia de dominio, etiquetala como "Hipotesis no validada".
- No generes script Python en esta respuesta.

Formato:
## Estado de ejecucion
## Hallazgos respaldados por evidencia
## Hipotesis no validadas
## Acciones recomendadas
## Limites de la respuesta

Responde en espanol, tono sobrio y verificable.`;
};

const buildEnhancedRegistryPrompt = (report: AuditReport): string => {
  const registry = buildEnhancedRegistry(report);
  const json_data = JSON.stringify(registry, null, 2);

  return `Actua como ingeniero de calidad de datos. Recibiras un registro tecnico completo del dataset con columnas, tipos semanticos, reglas activadas y evidencias.

Registro tecnico:
${json_data}

Reglas:
- Razona SOLO sobre columnas, reglas y muestras del registro.
- Para cada hallazgo, cita la regla y bad_samples textuales si existen.
- Las hipotesis no comprobables deben etiquetarse "Hipotesis no validada".
- No generes script Python aqui.

Formato:
## Estado de ejecucion
## Hallazgos respaldados (cita regla + bad samples)
## Hipotesis no validadas
## Acciones recomendadas
## Columnas con mayor riesgo

Responde en espanol.`;
};

const buildCopyPasteBadSamplesPrompt = (report: AuditReport): string => {
  const cpBlock = buildCopyPasteBlock(report);

  return `Actua como auditor de calidad de datos. Tu tarea es CITAR TEXTUALMENTE los bad samples detectados por el motor determinista y explicar por que representan un problema de calidad.

Contexto: ${report.rowCount} filas, ${report.colCount} columnas, score ${report.score}/100.

Bad samples detectados:
${cpBlock}

Reglas OBLIGATORIAS:
- M4 Copy-Paste: CITA TEXTUALMENTE al menos 3 bad samples del listado anterior en tu diagnostico.
- Para cada bad sample citado, explica la regla que lo detecto y el riesgo tecnico.
- No inventes columnas ni valores adicionales.
- Si no encuentras bad samples suficientes, explica que el motor no detecto mas.

Formato:
## Bad samples observados
Copia aqui los valores textuales del listado anterior con el formato "valor" (regla, columna).

## Riesgo por bad sample
Para cada valor citado, explica el riesgo.

## Recomendaciones
Acciones seguras basadas en los bad samples observados.

Responde en espanol, citando valores textuales.`;
};

const buildRecommendedPrompt = (report: AuditReport): string => {
  const registry = buildEnhancedRegistry(report);
  const cpBlock = buildCopyPasteBlock(report);
  const json_data = JSON.stringify(registry, null, 2);

  return `Actua como revisor tecnico de calidad de datos con maxima evidencia disponible. Recibes el registro tecnico completo del dataset Y los bad samples detectados.

Registro tecnico:
${json_data}

Bad samples detectados:
${cpBlock}

Reglas OBLIGATORIAS:
- Anclaje semantico (M2): razona solo sobre columnas y reglas del registro.
- Copy-Paste (M4): CITA TEXTUALMENTE los bad samples del listado.
- Para cada hallazgo: regla → columna → bad sample citado → riesgo → accion.
- Las hipotesis no comprobables deben etiquetarse "Hipotesis no validada".
- No generes script Python aqui.

Formato:
## Estado de ejecucion
## Hallazgos respaldados (regla + columna + bad sample textual)
## Hipotesis no validadas
## Acciones recomendadas
## Limites de la respuesta

Responde en espanol, sobrio, academico, con citas textuales de bad samples.`;
};

// ── Main Builder (mode-aware) ──

export const buildAnalysisPrompt = (
  report: AuditReport,
  contract?: PromptContractConfig,
  inputMode?: InputMode
): string => {
  switch (inputMode) {
    case 'prompt_libre':
      return buildPromptLibrePrompt(report);
    case 'enhanced_registry':
      return buildEnhancedRegistryPrompt(report);
    case 'copy_paste_bad_samples':
      return buildCopyPasteBadSamplesPrompt(report);
    case 'recommended':
      return buildRecommendedPrompt(report);
    case 'smart_sample':
    default:
      return buildSmartSamplePrompt(report, contract);
  }
};

export const buildScriptPrompt = (
  report: AuditReport,
  diagnosisText: string,
  diagnosisBrief?: string,
  contract?: PromptContractConfig,
): string => {
  const promptContract = normalizePromptContract(contract);
  const jsonSummary = buildSmartSample(report);

  return `
Actua como ingeniero de datos senior. Debes generar un script Python/Pandas de limpieza asistida para AURA usando SOLO:
1. El paquete estructurado del motor determinista.
2. El diagnostico previo del LLM.

No hagas un nuevo diagnostico. No inventes columnas. No agregues librerias innecesarias. No elimines columnas automaticamente. Todo cambio ambiguo debe quedar comentado como HITL.

Contrato cognitivo:
- Capa 2 con anclaje semantico: el script debe estar anclado a reglas, columnas y muestras observadas.
- M4 Copy-Paste: copia nombres de columnas exactamente como aparecen en el paquete.
- Paradigma copy-paste: cada bloque del script debe incluir comentario con regla fuente y columna fuente.
- Privacidad local-first: el script trabaja sobre un dataframe df ya cargado; no lee rutas externas ni envia datos a red.
- Objetivo del diagnostico usado: ${promptContract.objective}

Paquete estructurado:
${JSON.stringify(jsonSummary, null, 2)}

Resumen operativo del diagnostico para script:
${diagnosisBrief || buildDiagnosisScriptBrief(diagnosisText)}

Diagnostico previo:
${diagnosisText || 'No hay diagnostico previo disponible.'}

Formato obligatorio de salida:
Devuelve solo un bloque de codigo Python. El script debe:
- importar pandas y numpy;
- definir una funcion clean_dataset(df: pd.DataFrame) -> pd.DataFrame;
- crear df_clean = df.copy();
- aplicar solo operaciones trazables a columnas existentes;
- conservar comentarios # AURA: regla=... columna=...;
- no ejecutar archivos, no leer CSV, no escribir disco;
- terminar con return df_clean.
`;
};

export const buildDiagnosisSummaryPrompt = (diagnosisText: string): string => `
Resume el siguiente diagnostico de calidad de datos para alimentar un generador de script Python/Pandas.

No agregues problemas nuevos. No inventes columnas. Extrae solo decisiones operativas utiles para script.

Formato obligatorio:
## Resumen operativo para script
- Problemas priorizados:
- Acciones automatizables:
- Acciones que requieren HITL:
- Columnas que NO deben modificarse automaticamente:
- Riesgos del script:

Diagnostico:
${diagnosisText}
`;

export const buildDiagnosisScriptBrief = (diagnosisText: string): string => {
  const cleaned = diagnosisText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>-]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const priorityLines = cleaned.filter((line) =>
    /accion|automatizable|revision humana|requiere|columna|riesgo|regla|script/i.test(line)
  ).slice(0, 10);

  const source = priorityLines.length > 0 ? priorityLines : cleaned.slice(0, 8);
  return source.length > 0
    ? source.map((line) => `- ${line}`).join('\n')
    : '- No hay diagnostico operativo disponible.';
};

export const extractPythonScript = (text: string): string => {
  const fenced = text.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('import ');
  return (start >= 0 ? candidate.slice(start) : candidate).trim();
};

/**
 * Prompt para reporte ejecutivo JSON (PDF).
 * Mecanismo M5 (Structured Output): Schema JSON estricto.
 */
export const buildExecutivePrompt = (report: AuditReport): string => {
  const summaryContext = {
    score: report.score,
    rows: report.rowCount,
    columns: report.colCount,
    duplicate_rows: report.duplicateRows,
    total_issues: report.issues.length,
    critical_issues: report.issues.filter(i => i.severity === 'critical').length,
    dataset_structure: Object.values(report.columnStats).map(c => ({
      name: c.name,
      type: c.inferredType,
      nulls: c.nullCount,
      unique: c.uniqueCount,
      sample_values: c.sampleValues,
    })),
    top_issues: report.issues.slice(0, 12).map(i => ({
      rule: i.ruleName,
      category: i.category,
      column: i.column,
      severity: i.severity,
      count: i.count,
      affected_percentage: i.affectedPercentage,
      description: i.description,
      sample_values: i.sampleValues.slice(0, 3),
    }))
  };

  return `
    Actua como un revisor tecnico de calidad de datos preparando un informe profesional y verificable.

    Analiza este resumen de calidad de datos y estructura:
    ${JSON.stringify(summaryContext)}

    Genera un informe ejecutivo en JSON estricto.

    Reglas de honestidad:
    - No inventes columnas, cifras, dominios, PII, relaciones derivables ni causas.
    - Solo puedes reportar problemas contenidos en "top_issues" o estadisticas presentes en "dataset_structure".
    - Si el dominio no es demostrable, usa "Dominio no inferible con evidencia suficiente".
    - Las acciones destructivas deben ir como requires_human_review y safeToSimulate=false.

    1. "dataset_technical_description": Redacta un parrafo tecnico describiendo filas, columnas, tipos y score. NO inventes cifras.
    2. "executive_summary": Resume la salud de datos segun score y reglas activadas.
    3. "business_impact": Describe riesgos tecnicos verificables, no riesgos de negocio especulativos.
    4. "python_script": Genera solo operaciones Pandas de bajo riesgo sobre columnas existentes. No elimines columnas salvo que haya una regla determinista clara y aun asi comenta que requiere revision humana.
    5. "remediation_actions": Genera acciones estructuradas para simulacion segura. Usa solo estos tipos: trim_whitespace, normalize_placeholders, drop_exact_duplicates, normalize_casing, convert_disguised_numbers, requires_human_review. Marca safeToSimulate=false cuando sea ambiguo, destructivo o requiera criterio de dominio.

    La estructura JSON requerida es:
    {
      "title": "Un título formal y descriptivo (ej. Informe de Auditoría Técnica: [Dominio Inferido])",
      "domain_inferred": "Una frase corta del dominio",
      "dataset_technical_description": "Párrafo descriptivo de la estructura...",
      "executive_summary": "Resumen ejecutivo...",
      "business_impact": "Impacto en negocio...",
      "key_findings": ["Hallazgo 1", "Hallazgo 2", "Hallazgo 3"],
      "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
      "python_script": "import pandas as pd\\nimport numpy as np\\n\\n# Código de limpieza aquí...",
      "remediation_actions": [
        {
          "id": "accion-1",
          "type": "trim_whitespace",
          "column": "nombre_columna",
          "description": "Descripcion breve de la accion",
          "safeToSimulate": true,
          "requiresHumanReview": false
        }
      ]
    }
  `;
};
