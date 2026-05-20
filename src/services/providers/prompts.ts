/**
 * Prompt compartido para todos los proveedores de IA.
 * 
 * Centralizar el prompt garantiza que el benchmark (OE2) compare
 * modelos bajo condiciones idénticas — mismo input, mismo criterio.
 * 
 * Referencia: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Mecanismos: M2 (Anclaje Semántico), M3 (Copy-Paste), M4 (Cadena Forzada)
 */

import { AuditReport, PromptContractConfig } from '../../types';

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
export const buildAnalysisPrompt = (report: AuditReport, contract?: PromptContractConfig): string => {
  const promptContract = normalizePromptContract(contract);
  const jsonSummary = buildSmartSample(report);
  const json_data = JSON.stringify(jsonSummary, null, 2);
  const evidenceMode = promptContract.evidencePolicy === 'strict'
    ? 'Politica estricta: solo puedes razonar sobre columnas, reglas, muestras y estadisticas presentes en el JSON observado.'
    : 'Politica balanceada: puedes proponer hipotesis, pero deben quedar separadas como no validadas y nunca sustituir la evidencia determinista.';
  const copyPasteRule = promptContract.includeCopyPasteEvidence
    ? '- M4 Copy-Paste: cuando exista evidencia en bad_samples o sample_values, cita valores textuales del paquete para anclar la interpretacion.\n'
    : '';
  const hitlRule = promptContract.includeHumanReviewLabels
    ? '- Etiqueta como "requiere revision humana" toda accion ambigua, destructiva, sensible o dependiente del dominio.\n'
    : '';
  const scriptReadiness = promptContract.requireScriptReadiness
    ? `
## Criterios para generar script
Entrega una lista operativa que pueda ser usada por el siguiente paso para generar Python/Pandas:
- Accion Pandas sugerida:
- Columna exacta:
- Regla que justifica la accion:
- Riesgo de aplicar automaticamente:
- Condicion HITL:
No escribas codigo aqui; deja la decision preparada para el modulo de script.
`
    : '';
  const extraInstructions = promptContract.extraInstructions?.trim()
    ? `\nInstrucciones guiadas adicionales:\n${promptContract.extraInstructions.trim()}\n`
    : '';

  return `
Actua como revisor tecnico de calidad de datos para un trabajo academico. Tu tarea NO es impresionar ni descubrir defectos imaginarios: tu tarea es explicar la evidencia disponible de forma reproducible.

Objetivo del contrato:
${promptContract.objective}

Recibiras un resumen JSON generado por el motor determinista de AURA. El JSON contiene solo columnas observadas, tipos inferidos, estadisticas basicas y reglas activadas. No tienes acceso al CSV completo.

${evidenceMode}

JSON observado:
${json_data}

Reglas obligatorias de honestidad:
- No inventes columnas, valores, relaciones, tablas dimension, PII, dominios ni causas.
- No afirmes que una columna es constante, derivable, sensible o eliminable si eso no aparece en "detected_issues" o en las estadisticas entregadas.
- Si haces una inferencia de dominio, etiquetala como "Hipotesis no validada" y explica que se basa solo en nombres de columnas.
- Si una recomendacion requiere criterio humano o conocimiento de dominio, etiquetala como "requiere revision humana".
- Cita siempre la regla determinista, la columna y la evidencia disponible cuando exista.
- No generes script Python en esta respuesta. El script se genera en otro paso con validacion HITL.
${copyPasteRule}${hitlRule}${extraInstructions}

Formato obligatorio:

## Estado de ejecucion
Indica que el analisis parte del motor determinista de AURA, con filas, columnas, score y numero de reglas activadas.

## Hallazgos respaldados por evidencia
Lista solo problemas presentes en "detected_issues". Para cada hallazgo:
- Regla:
- Columna:
- Evidencia observada:
- Riesgo tecnico:
- Accion segura:

## Hipotesis no validadas
Incluye aqui cualquier interpretacion de dominio o decision que no pueda probarse con el JSON. Si no hay base suficiente, escribe "Sin hipotesis defendible con la evidencia actual".

## Acciones recomendadas
Separa en:
- Automatizables de bajo riesgo.
- Requieren revision humana.
- No recomendadas por falta de evidencia.

${scriptReadiness}

## Limites de la respuesta
Explica en 2-3 bullets que este LLM no sustituye el motor determinista, que no vio el dataset completo y que sus inferencias no cuentan como evidencia experimental formal.

Responde en español, con tono sobrio, academico y verificable.
  `;
};

export const buildScriptPrompt = (
  report: AuditReport,
  diagnosisText: string,
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
