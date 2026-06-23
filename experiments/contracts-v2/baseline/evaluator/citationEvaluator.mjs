/**
 * Citation evaluator — character-by-character exact matching.
 *
 * Per Fase 0D requirements:
 * - No trim, no lowercase, no NFD normalization, no whitespace collapse
 * - Exact string presence in the response text
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures');

/**
 * Load all eligible samples from the audit report.
 * A sample is eligible if it is a string with length >= 4.
 */
export function loadEligibleSamples(auditReportPath = path.join(FIXTURES_DIR, 'titanic-audit-report.json')) {
  const report = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
  const samples = [];
  for (const issue of report.issues) {
    for (const s of issue.sampleValues) {
      if (typeof s === 'string' && s.length >= 4) {
        samples.push({ value: s, issueId: issue.id, column: issue.column || null });
      }
    }
  }
  return samples;
}

/**
 * Evaluate citations exactly — character-by-character, no normalization.
 *
 * @param {string} responseText - The model's response (diagnosis or full text)
 * @param {Array} eligibleSamples - List of {value, issueId, column}
 * @returns {{exactCount: number, alteredCount: number, eligibleCount: number, details: Array}}
 */
export function evaluateCitationsExact(responseText, eligibleSamples) {
  const text = responseText || '';
  let exactCount = 0;
  let alteredCount = 0;
  const details = [];

  for (const sample of eligibleSamples) {
    const value = sample.value;
    const isExact = text.includes(value);
    let isAltered = false;

    if (!isExact) {
      // Check for altered forms: try removing trailing/leading space,
      // or removing a word in the middle
      const alteredCandidates = generateAlteredForms(value);
      for (const altered of alteredCandidates) {
        if (altered !== value && text.includes(altered)) {
          isAltered = true;
          break;
        }
      }
    }

    if (isExact) exactCount++;
    else if (isAltered) alteredCount++;

    details.push({
      sample: value,
      issueId: sample.issueId,
      column: sample.column,
      exact: isExact,
      altered: isAltered
    });
  }

  return {
    exactCount,
    alteredCount,
    eligibleCount: eligibleSamples.length,
    exactRate: eligibleSamples.length > 0 ? exactCount / eligibleSamples.length : 0,
    alteredRate: eligibleSamples.length > 0 ? alteredCount / eligibleSamples.length : 0,
    details
  };
}

/**
 * Generate plausible altered forms of a sample for detection.
 * Only structural alterations, not normalization.
 */
function generateAlteredForms(value) {
  const forms = [];

  // Trimming trailing/leading whitespace (whitespace alteration)
  if (value !== value.trimEnd()) forms.push(value.trimEnd());
  if (value !== value.trimStart()) forms.push(value.trimStart());

  // Removing parenthetical content
  const noParens = value.replace(/\s*\([^)]*\)\s*/g, ' ');
  if (noParens !== value) forms.push(noParens);

  // Removing middle words (e.g., "May" from "Lily May Peel")
  const words = value.split(/\s+/);
  if (words.length > 2) {
    for (let i = 1; i < words.length - 1; i++) {
      const shorter = [...words.slice(0, i), ...words.slice(i + 1)].join(' ');
      forms.push(shorter);
    }
  }

  return forms;
}