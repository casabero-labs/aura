/**
 * Phantom column detector.
 *
 * Per Fase 0D requirements:
 * - A phantom column is detected only when:
 *   1. AST extract shows df['col'] or df_clean['col'] reference
 *   2. The column name is NOT in the audit report's columnStats
 * - Variable names, function names, string literals, etc. are NOT columns.
 */

/**
 * Detect phantom columns by comparing AST-extracted columns against audit report.
 *
 * @param {Object} ast - Result from extractActionsAST
 * @param {Object} auditReport - The AuditReport
 * @returns {{phantoms: Array<string>, valid: Array<string>}}
 */
export function detectPhantomColumns(ast, auditReport) {
  const validColumns = new Set(Object.keys(auditReport.columnStats));
  const extracted = ast.columns || [];

  const phantoms = [];
  const valid = [];

  for (const col of extracted) {
    if (validColumns.has(col)) {
      valid.push(col);
    } else {
      phantoms.push(col);
    }
  }

  return { phantoms, valid };
}