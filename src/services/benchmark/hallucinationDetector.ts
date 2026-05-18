import { AuditReport, ColumnStats, IssueSeverity, QualityIssue } from '../../types';

/**
 * HallucinationReport
 * Reporte de alucinaciones detectadas en la respuesta del LLM
 */
export interface HallucinationReport {
  hallucinatedColumns: string[];    // Columnas mencionadar que no existen en columnStats
  unsupportedClaims: ClaimIssue[];   // Afirmaciones numéricas sin soporte en AuditReport
  jsonCompliance: boolean;           // Si la respuesta es JSON válido con campos requeridos
  formatErrors: FormatError[];       // Errores de formato detectados
  pythonScriptColumnsValid: boolean;  // Si las columnas en scripts Python son válidas
  invalidScriptColumns: string[];     // Columnas usadas en scripts que no existen
}

/**
 * Afirmación numérica no soportada por los datos
 */
export interface ClaimIssue {
  claim: string;           // Texto de la afirmación (ej: "42 valores nulos")
  expected: number | null;  // Valor esperado según AuditReport (null si no aplica)
  actual: number | null;   // Lo que dice el LLM (null si no es numérico)
  claimType: 'nullCount' | 'uniqueCount' | 'score' | 'issueCount' | 'rowCount' | 'colCount' | 'unknown';
}

/**
 * Error de formato en la respuesta del LLM
 */
export interface FormatError {
  field?: string;          // Campo faltante o inválido (en JSON)
  message: string;
}

/**
 * Conjuntos de datos del AuditReport para verificación rápida
 */
interface AuditData {
  columnStats: Record<string, ColumnStats>;
  issues: QualityIssue[];
  score: number;
  rowCount: number;
  colCount: number;
}

/**
 * Extrae todas las columnas mencionadas en un texto (entre comillas/backticks)
 * y las usadas en acceso a df (df['col'] o df["col"])
 */
const extractMentionedColumns = (text: string): string[] => {
  // Columnas en código: df['col'] o df["col"]
  const scriptMatches = text.matchAll(/df\[[']([^'"]+)['"]\]|df\[["]([^"]+)["]\]]/g);
  const scriptCols = Array.from(scriptMatches, m => m[1] || m[2]);

  // Columnas entre comillas/backticks en texto
  const quotedMatches = text.matchAll(/[`'"]([A-Za-z_][\w .\-+]{1,60})[`'"]/g);
  const quotedCols = Array.from(quotedMatches, m => m[1]);

  return Array.from(new Set([...scriptCols, ...quotedCols]));
};

/**
 * Verifica si un valor numérico reportado coincide aproximadamente con el valor real.
 * Usa tolerancia del 5% para evitar falsos positivos por redondeo del LLM.
 */
const matchesApproximately = (reported: number, actual: number, tolerance = 0.05): boolean => {
  if (actual === 0) return reported === 0;
  const diff = Math.abs(reported - actual) / actual;
  return diff <= tolerance;
};

/**
 * Detecta columnas que no existen en el AuditReport (columnas fantasma).
 * Filtra también nombres genéricos que no son columnas.
 */
const detectPhantomColumns = (report: AuditReport, text: string): string[] => {
  const knownColumns = new Set(Object.keys(report.columnStats));
  const knownIssueNames = new Set(report.issues.map(i => i.ruleName));

  const nonColumns = new Set([
    'dataset.csv', 'df', 'python', 'pandas', 'numpy', 'csv', 'dataframe',
    'dataset', 'data', 'file', 'column', 'row', 'value', 'index'
  ]);

  return extractMentionedColumns(text)
    .filter(col => !knownColumns.has(col))
    .filter(col => !knownIssueNames.has(col))
    .filter(col => !nonColumns.has(col.toLowerCase()));
};

/**
 * Detecta cifras inventadas comparando números mencionados con los valores
 * reales del AuditReport (nullCount, uniqueCount, score, issue counts, etc.)
 */
const detectUnsupportedClaims = (report: AuditReport, text: string): ClaimIssue[] => {
  const claims: ClaimIssue[] = [];

  // Recopilar todos los valores verificables del AuditReport
  const verifiableValues: Array<{ value: number; type: ClaimIssue['claimType'] }> = [];

  // nullCount por columna
  Object.values(report.columnStats).forEach(col => {
    if (col.nullCount > 0) {
      verifiableValues.push({ value: col.nullCount, type: 'nullCount' });
    }
    if (col.uniqueCount > 0) {
      verifiableValues.push({ value: col.uniqueCount, type: 'uniqueCount' });
    }
  });

  // Score general
  verifiableValues.push({ value: report.score, type: 'score' });

  // RowCount y colCount
  verifiableValues.push({ value: report.rowCount, type: 'rowCount' });
  verifiableValues.push({ value: report.colCount, type: 'colCount' });

  // Issue counts por severidad
  const criticalCount = report.issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
  const warningCount = report.issues.filter(i => i.severity === IssueSeverity.WARNING).length;
  const infoCount = report.issues.filter(i => i.severity === IssueSeverity.INFO).length;
  if (criticalCount > 0) verifiableValues.push({ value: criticalCount, type: 'issueCount' });
  if (warningCount > 0) verifiableValues.push({ value: warningCount, type: 'issueCount' });
  if (infoCount > 0) verifiableValues.push({ value: infoCount, type: 'issueCount' });

  // Buscar todos los números en el texto (excluyendo años, versiones, etc.)
  const numberMatches = text.matchAll(/(\d+(?:\.\d+)?)/g);
  const mentionedNumbers = Array.from(numberMatches, m => parseFloat(m[1]));

  mentionedNumbers.forEach(reported => {
    // Solo verificar números entre 1 y el máximo rowCount * 2 (para porcentajes)
    if (reported < 1 || reported > report.rowCount * 2) return;

    // Buscar si algún valor verificable coincide aproximadamente
    const match = verifiableValues.find(v => matchesApproximately(reported, v.value));

    if (!match) {
      // No se encontró coincidencia - podría ser una cifra inventada
      // Solo reportar si es un número "redondo" sospechoso (múltiplo de 10 o 100)
      // que no coincide con ningún valor real
      const isSuspiciousRound = (reported % 10 === 0 && reported > 0) && reported > report.rowCount;

      if (isSuspiciousRound || reported > 1000) {
        claims.push({
          claim: String(reported),
          expected: null,
          actual: reported,
          claimType: 'unknown'
        });
      }
    }
  });

  return claims;
};

/**
 * Verifica si el texto es JSON válido y tiene los campos requeridos
 * del ExecutiveReportContent.
 */
const checkJsonCompliance = (
  text: string
): { compliant: boolean; errors: FormatError[] } => {
  const errors: FormatError[] = [];
  const requiredFields = [
    'title',
    'domain_inferred',
    'dataset_technical_description',
    'executive_summary',
    'business_impact',
    'key_findings',
    'recommendations'
  ];

  // Intentar extraer JSON del texto (puede estar envuelto en markdown)
  let jsonStr = text.trim();

  // Si está en bloque de código markdown, extraer el contenido
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Si empieza con { y termina con }, intentar parsear
  if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
    return {
      compliant: false,
      errors: [{ message: 'La respuesta no es un objeto JSON válido' }]
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e: any) {
    return {
      compliant: false,
      errors: [{ message: `JSON inválido: ${e.message}` }]
    };
  }

  // Verificar campos requeridos
  requiredFields.forEach(field => {
    if (!(field in parsed)) {
      errors.push({ field, message: `Campo requerido '${field}' ausente` });
    } else if (field === 'key_findings' || field === 'recommendations') {
      if (!Array.isArray(parsed[field])) {
        errors.push({ field, message: `Campo '${field}' debe ser un array` });
      }
    } else if (typeof parsed[field] !== 'string') {
      errors.push({ field, message: `Campo '${field}' debe ser string` });
    }
  });

  return {
    compliant: errors.length === 0,
    errors
  };
};

/**
 * Valida columnas usadas en scripts Python contra columnStats.
 * Retorna las columnas inválidas.
 */
const validatePythonScriptColumns = (
  report: AuditReport,
  pythonScript: string
): { valid: boolean; invalidColumns: string[] } => {
  if (!pythonScript) return { valid: true, invalidColumns: [] };

  const knownColumns = new Set(Object.keys(report.columnStats));

  // Extraer df['col'] o df["col"] del script
  const columnMatches = pythonScript.matchAll(/df\[[']([^'"]+)['"]\]|df\[["]([^"]+)["]\]]/g);
  const scriptColumns = Array.from(columnMatches, m => m[1] || m[2]);

  const invalidColumns = scriptColumns.filter(col => !knownColumns.has(col));

  return {
    valid: invalidColumns.length === 0,
    invalidColumns
  };
};

/**
 * Función principal: detecta todas las alucinaciones en la respuesta del LLM
 * comparándola contra el AuditReport (Capa 1 - verdad ground).
 *
 * @param report  - AuditReport generado por auditEngine.ts (verificación ground truth)
 * @param responseText - Texto de respuesta del LLM a verificar
 * @param pythonScript - Script Python opcional si está embebido en la respuesta
 * @returns HallucinationReport con todos los hallazgos
 */
export const detectHallucinations = (
  report: AuditReport,
  responseText: string,
  pythonScript?: string
): HallucinationReport => {
  const phantomColumns = detectPhantomColumns(report, responseText);
  const unsupportedClaims = detectUnsupportedClaims(report, responseText);
  const jsonCheck = checkJsonCompliance(responseText);

  // Si hay script Python, validar sus columnas
  const scriptToValidate = pythonScript || (responseText.match(/```python\n([\s\S]*?)```|```\n([\s\S]*?)```/)?.[1] || '');
  const scriptValidation = validatePythonScriptColumns(report, scriptToValidate);

  return {
    hallucinatedColumns: phantomColumns,
    unsupportedClaims,
    jsonCompliance: jsonCheck.compliant,
    formatErrors: jsonCheck.errors,
    pythonScriptColumnsValid: scriptValidation.valid,
    invalidScriptColumns: scriptValidation.invalidColumns
  };
};

/**
 * Versión simplificada que solo detecta columnas fantasma.
 * Útil para detección rápida en streaming.
 */
export const detectPhantomColumnsOnly = (
  report: AuditReport,
  text: string
): string[] => {
  return detectPhantomColumns(report, text);
};

/**
 * Verifica si un script Python específico tiene columnas válidas.
 */
export const validateScriptColumns = (
  report: AuditReport,
  script: string
): { valid: boolean; invalidColumns: string[] } => {
  return validatePythonScriptColumns(report, script);
};

/**
 * Verifica compliance de JSON sin hacer detección completa de alucinaciones.
 */
export const checkJsonFormat = (
  text: string
): { compliant: boolean; errors: FormatError[] } => {
  return checkJsonCompliance(text);
};