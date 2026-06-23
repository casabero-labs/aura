/**
 * Structured invented rules detector.
 *
 * Per Fase 0D requirements:
 * - Detect rules only via structured patterns:
 *   1. `# AURA: regla=...` comments in code
 *   2. JSON `"rule": "..."` or `"rule_id": "..."` fields
 *   3. Explicit `Regla "..."` or `Regla: ...` mentions in prose
 *
 * - NOT every quoted string is a rule.
 * - Normalize detected rule names and compare to actual rule names in audit report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');

/**
 * Load the actual rule names from the audit report.
 */
export function loadActualRules(auditReportPath = path.join(FIXTURES_DIR, 'titanic-audit-report.json')) {
  const report = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
  return report.issues.map(i => i.ruleName);
}

/**
 * Normalize a rule name for comparison.
 */
function normalizeRule(rule) {
  return rule.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Detect invented rules in text.
 *
 * @param {string} text - The full text to analyze
 * @param {Array<string>} actualRules - List of actual rule names from audit report
 * @returns {{detected: Array, invented: Array, actual: Array}}
 */
export function detectInventedRulesStructured(text, actualRules) {
  const actualNormalized = new Set(actualRules.map(normalizeRule));
  const detected = new Set();

  // Pattern 1: Python comments "# AURA: regla=..."
  // Stop at whitespace (because "columna=" comes after a space) or comma/semicolon/newline
  const commentMatches = text.match(/#\s*AURA\s*:\s*regla\s*=\s*(\S+)/gi) || [];
  for (const m of commentMatches) {
    const rm = m.match(/regla\s*=\s*(\S+)/i);
    if (rm) detected.add(rm[1].trim());
  }

  // Pattern 2: JSON fields "rule": "..." or "rule_id": "..."
  const jsonRuleMatches = text.match(/"(?:rule|rule_id|ruleId)"\s*:\s*"([^"]+)"/gi) || [];
  for (const m of jsonRuleMatches) {
    const jm = m.match(/"([^"]+)"\s*$/);
    if (jm) detected.add(jm[1].trim());
  }

  // Pattern 3: Explicit "Regla X" / "regla: X" in prose
  const explicitMatches = text.match(/\bRegla\s+["']?([A-ZÁÉÍÓÚÑ][^"'\n.,;]+)["']?/g) || [];
  for (const m of explicitMatches) {
    const em = m.match(/Regla\s+["']?([^"'\n.,;]+)["']?/);
    if (em) detected.add(em[1].trim());
  }

  const invented = [];
  const actual = [];
  for (const rule of detected) {
    const norm = normalizeRule(rule);
    if (norm.length < 4) continue; // Skip very short

    // Check if it matches any actual rule
    const isActual = Array.from(actualNormalized).some(ar =>
      ar === norm || ar.includes(norm) || norm.includes(ar)
    );

    if (isActual) actual.push(rule);
    else invented.push(rule);
  }

  return {
    detected: Array.from(detected),
    invented,
    actual
  };
}