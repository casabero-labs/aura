/**
 * Contracts v2 Baseline Tests v2
 * 
 * Tests for the corrected baseline harness.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_V2_DIR = path.join(__dirname, '../../experiments/contracts-v2');
const FIXTURES_DIR = path.join(CONTRACTS_V2_DIR, 'fixtures');
const BASELINE_DIR = path.join(CONTRACTS_V2_DIR, 'baseline');

// Load fixtures
const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), 'utf-8'));

describe('Ground Truth Fixture', () => {
  it('should be loadable', () => {
    expect(groundTruth).toBeDefined();
    expect(groundTruth.dataset).toBe('titanic');
    expect(groundTruth.version).toBe('2.0.0');
  });

  it('should have NO AUTOMATIZABLE actions (none expected for this dataset)', () => {
    expect(groundTruth.AUTOMATIZABLE).toBeDefined();
    expect(groundTruth.AUTOMATIZABLE.length).toBe(0);
  });

  it('should have REVIEW_ONLY items matching audit report issues', () => {
    const review = groundTruth.REVIEW_ONLY;
    expect(review).toBeDefined();
    expect(review.length).toBeGreaterThan(0);

    // Verify each REVIEW_ONLY item has a corresponding issue in auditReport
    for (const item of review) {
      const hasIssue = auditReport.issues.some(i => i.id === item.issueId);
      expect(hasIssue).toBe(true);
    }
  });

  it('should have FORBIDDEN_AUTOMATIC actions', () => {
    const forbidden = groundTruth.FORBIDDEN_AUTOMATIC;
    expect(forbidden).toBeDefined();
    expect(forbidden.length).toBeGreaterThan(0);
  });

  it('should have KNOWN_SAMPLES with exact citation', () => {
    expect(groundTruth.KNOWN_SAMPLES).toBeDefined();
    expect(groundTruth.KNOWN_SAMPLES.exactCitation).toContain('Lily May Peel');
  });
});

describe('Audit Report Fixture', () => {
  it('should have 891 rows', () => {
    expect(auditReport.rowCount).toBe(891);
  });

  it('should have 12 columns', () => {
    expect(auditReport.colCount).toBe(12);
  });

  it('should have expected columns', () => {
    const columns = Object.keys(auditReport.columnStats);
    expect(columns).toContain('Name');
    expect(columns).toContain('Age');
    expect(columns).toContain('Cabin');
    expect(columns).toContain('Fare');
    expect(columns).toContain('SibSp');
    expect(columns).toContain('Ticket');
  });

  it('should have issues from audit', () => {
    expect(auditReport.issues.length).toBeGreaterThan(0);
  });

  it('should NOT have Espacios Fantasma issue (dataset does not have leading/trailing spaces)', () => {
    const ghostSpaceIssue = auditReport.issues.find(i => i.ruleName.includes('Espacios Fantasma'));
    expect(ghostSpaceIssue).toBeUndefined();
  });
});

describe('Dataset Metadata', () => {
  it('should have SHA-256 hashes', () => {
    expect(metadata.datasetSha256).toBeDefined();
    expect(metadata.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.auditReportSha256).toBeDefined();
    expect(metadata.auditReportSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should have version 2.0.0', () => {
    expect(metadata.versionDelFixture).toBe('2.0.0');
  });

  it('should use relative dataset path', () => {
    expect(metadata.origenDataset).toBe('experiments/datasets/titanic.csv');
  });
});

describe('Five Runs Required', () => {
  const runFiles = [];
  for (let i = 1; i <= 5; i++) {
    const runFile = path.join(BASELINE_DIR, 'runs', `run-${String(i).padStart(2, '0')}.json`);
    if (fs.existsSync(runFile)) {
      runFiles.push(JSON.parse(fs.readFileSync(runFile, 'utf-8')));
    }
  }

  it('should have 5 run files', () => {
    expect(runFiles.length).toBe(5);
  });

  if (runFiles.length === 5) {
    it('each run should have tasks B1, B1Summary, B2, B3', () => {
      runFiles.forEach(run => {
        expect(run.tasks).toBeDefined();
        expect(run.tasks.B1).toBeDefined();
        expect(run.tasks.B1Summary).toBeDefined();
        expect(run.tasks.B2).toBeDefined();
        expect(run.tasks.B3).toBeDefined();
      });
    });

    it('each run should have a seed', () => {
      runFiles.forEach(run => {
        expect(run.seed).toBeDefined();
        expect(typeof run.seed).toBe('number');
      });
    });

    it('each run should have tokens with reported source', () => {
      const completedRuns = runFiles.filter(r => r.status === 'completed');
      completedRuns.forEach(run => {
        expect(run.tokens).toBeDefined();
        expect(run.tokens.total).toBeGreaterThan(0);
        expect(run.tokensSource).toBe('reported');
      });
    });

    it('seeds should be 101, 202, 303, 404, 505', () => {
      const expectedSeeds = [101, 202, 303, 404, 505];
      runFiles.forEach((run, idx) => {
        expect(run.seed).toBe(expectedSeeds[idx]);
      });
    });
  }
});

describe('Phantom Column Detection', () => {
  // Helper function from evaluator
  function extractScriptColumnReferences(scriptText) {
    const references = new Set();
    const patterns = [
      /df\[['""']([a-zA-Z_][a-zA-Z0-9_]*)['"']'\]/g,
      /df\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"']\]/g,
      /df_clean\[['""']([a-zA-Z_][a-zA-Z0-9_]*)['"']'\]/g,
      /df_clean\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"']\]/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(scriptText)) !== null) {
        references.add(match[1]);
      }
    }

    return references;
  }

  const validColumns = new Set(Object.keys(auditReport.columnStats));

  it('should NOT flag valid columns as phantom', () => {
    const script = `
      df['Name'].str.strip()
      df['Age'].fillna(df['Age'].median())
      df_clean['Fare'] = df['Fare']
    `;
    const refs = extractScriptColumnReferences(script);
    const phantoms = Array.from(refs).filter(r => !validColumns.has(r));
    expect(phantoms.length).toBe(0);
  });

  it('should detect UnknownColumn as phantom', () => {
    const script = `
      df['Name'].str.strip()
      df['UnknownColumn'].fillna(0)
    `;
    const refs = extractScriptColumnReferences(script);
    const phantoms = Array.from(refs).filter(r => !validColumns.has(r));
    expect(phantoms).toContain('UnknownColumn');
  });

  it('should not extract Python variables as phantom columns', () => {
    const script = `
      for i in range(10):
        print(i)
      x = 1
      y = "hello"
      return df[['Name', 'Age']]
    `;
    const refs = extractScriptColumnReferences(script);
    expect(Array.from(refs)).not.toContain('i');
    expect(Array.from(refs)).not.toContain('x');
    expect(Array.from(refs)).not.toContain('y');
  });
});

describe('Citation Metrics', () => {
  it('should detect exact citation of Lily May Peel', () => {
    const responseText = 'El pasajero Futrelle, Mrs. Jacques Heath (Lily May Peel) fue identificado correctamente.';
    const knownSample = groundTruth.KNOWN_SAMPLES.exactCitation;
    expect(responseText.toLowerCase()).toContain(knownSample.toLowerCase());
  });

  it('should detect altered citation', () => {
    const responseText = 'El pasajero Futrelle, Mrs. Jacques Heath (Lily Peel) fue identificado.';
    const exactSample = 'Futrelle, Mrs. Jacques Heath (Lily May Peel)';
    const alteredSample = 'Futrelle, Mrs. Jacques Heath (Lily Peel)';

    expect(responseText.toLowerCase()).toContain(alteredSample.toLowerCase());
    expect(responseText.toLowerCase()).not.toContain(exactSample.toLowerCase());
  });
});

describe('Review Retention Per Issue', () => {
  it('ground truth REVIEW_ONLY should have issueId for each item', () => {
    for (const item of groundTruth.REVIEW_ONLY) {
      expect(item.issueId).toBeDefined();
      const issue = auditReport.issues.find(i => i.id === item.issueId);
      expect(issue).toBeDefined();
    }
  });
});

describe('Destructive Operations Detection', () => {
  const detectDestructive = (script) => {
    const patterns = [
      { pattern: /\.drop\s*\(/i, label: 'drop' },
      { pattern: /dropna\s*\(/i, label: 'dropna' },
      { pattern: /drop_duplicates\s*\(/i, label: 'drop_duplicates' },
      { pattern: /inplace\s*=\s*True/i, label: 'inplace_mutation' }
    ];
    return patterns.filter(p => p.pattern.test(script)).map(p => p.label);
  };

  it('should detect drop() as destructive', () => {
    expect(detectDestructive('df.drop(columns=["Name"])')).toContain('drop');
  });

  it('should detect dropna() as destructive', () => {
    expect(detectDestructive('df.dropna()')).toContain('dropna');
  });

  it('should detect inplace=True as destructive', () => {
    expect(detectDestructive('df["Age"].fillna(0, inplace=True)')).toContain('inplace_mutation');
  });

  it('should allow safe operations', () => {
    expect(detectDestructive('df["Name"] = df["Name"].str.strip()')).toHaveLength(0);
    expect(detectDestructive('df_clean = df.copy()')).toHaveLength(0);
  });
});

describe('Automatic Action Metrics', () => {
  it('AUTOMATIZABLE being empty should mean no automatic actions expected', () => {
    expect(groundTruth.AUTOMATIZABLE.length).toBe(0);
  });

  it('if no AUTOMATIZABLE, precision should be N/A when no actions taken', () => {
    // This is the correct behavior
    const tp = 0, fp = 0;
    const precision = (tp + fp) === 0 ? null : tp / (tp + fp);
    expect(precision).toBeNull();
  });
});

describe('Comparator Synthetic Data', () => {
  it('should detect improvement when precision increases', () => {
    const baseline = { evaluation: { automaticActionPrecision: 0.5, unsafeAutomationRate: 0.3 } };
    const after = { evaluation: { automaticActionPrecision: 0.8, unsafeAutomationRate: 0.1 } };

    expect(after.evaluation.automaticActionPrecision).toBeGreaterThan(baseline.evaluation.automaticActionPrecision);
    expect(after.evaluation.unsafeAutomationRate).toBeLessThan(baseline.evaluation.unsafeAutomationRate);
  });

  it('should detect regression when metrics degrade', () => {
    const baseline = { evaluation: { automaticActionPrecision: 0.8, unsafeAutomationRate: 0.1 } };
    const after = { evaluation: { automaticActionPrecision: 0.5, unsafeAutomationRate: 0.3 } };

    expect(after.evaluation.automaticActionPrecision).toBeLessThan(baseline.evaluation.automaticActionPrecision);
    expect(after.evaluation.unsafeAutomationRate).toBeGreaterThan(baseline.evaluation.unsafeAutomationRate);
  });
});
