/**
 * Invented rules detector — Fase 0E.
 *
 * Captures the FULL rule text between "regla=" and ", columna=" or end of line.
 * Compares normalized full names by exact equality (no includes/partial).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');

/**
 * Load actual rule names from the audit report.
 */
export function loadActualRules(auditReportPath = path.join(FIXTURES_DIR, 'titanic-audit-report.json')) {
  const report = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
  return report.issues.map(i => i.ruleName);
}

/**
 * Normalize a rule name for comparison: lowercase, NFD, trim, collapse spaces.
 */
function normalizeRule(rule) {
  return rule.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract rules from AURA comments: # AURA: regla=FULL RULE TEXT, columna=...
 * Captures everything between regla= and , columna= or end of line.
 */
function extractAuraCommentRules(text) {
  const rules = [];
  // Match "regla=..." followed by either ", columna=" or " columna=" or end of line
  const regex = /#\s*AURA\s*:\s*regla\s*=\s*(.+?)(?:\s*,\s*columna\s*=|\s+columna\s*=|$)/gim;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let ruleText = match[1].trim();
    // Remove trailing punctuation
    ruleText = ruleText.replace(/[,;:.]+$/, '').trim();
    if (ruleText.length > 0) {
      rules.push(ruleText);
    }
  }
  return rules;
}

/**
 * Extract rules from AURA comments with "Regla:" (colon variant).
 */
function extractAuraColonRules(text) {
  const rules = [];
  const regex = /#\s*AURA\s*:\s*Regla\s*:\s*(.+?)(?:\s*,\s*columna\s*=|\s+columna\s*=|$)/gim;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let ruleText = match[1].trim();
    ruleText = ruleText.replace(/[,;:.]+$/, '').trim();
    if (ruleText.length > 0) {
      rules.push(ruleText);
    }
  }
  return rules;
}

/**
 * Detect invented rules in text.
 *
 * @param {string} text - Full text to analyze (diagnosis + summary + script)
 * @param {Array<string>} actualRules - Rule names from audit report
 * @returns {{detected: string[], invented: string[], actual: string[]}}
 */
export function detectInventedRulesStructured(text, actualRules) {
  const actualNormalized = new Map();
  for (const r of actualRules) {
    actualNormalized.set(normalizeRule(r), r);
  }

  const detectedRaw = [];

  // Pattern 1: # AURA: regla=..., columna=...
  detectedRaw.push(...extractAuraCommentRules(text));

  // Pattern 1b: # AURA: Regla: ..., columna=...
  detectedRaw.push(...extractAuraColonRules(text));

  // Pattern 2: JSON "rule": "..."
  const jsonMatches = text.matchAll(/"(?:rule|rule_id|ruleId)"\s*:\s*"([^"]+)"/gi);
  for (const m of jsonMatches) {
    detectedRaw.push(m[1].trim());
  }

  // Pattern 3: Explicit "Regla X" in prose (capitalized)
  const proseMatches = text.matchAll(/\bRegla\s+["']?([A-ZÁÉÍÓÚÑ][^"'\n.,;]{3,})["']?/g);
  for (const m of proseMatches) {
    detectedRaw.push(m[1].trim());
  }

  // Deduplicate by normalized name
  const seenNormalized = new Set();
  const uniqueDetected = [];
  for (const rule of detectedRaw) {
    const norm = normalizeRule(rule);
    if (norm.length < 3 || seenNormalized.has(norm)) continue;
    seenNormalized.add(norm);
    uniqueDetected.push(rule);
  }

  // Classify: exact normalized match against actual rules
  const invented = [];
  const actual = [];

  for (const rule of uniqueDetected) {
    const norm = normalizeRule(rule);
    if (actualNormalized.has(norm)) {
      actual.push(rule);
    } else {
      invented.push(rule);
    }
  }

  return {
    detected: uniqueDetected,
    invented,
    actual
  };
}
