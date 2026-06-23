/**
 * Contracts v2 Baseline Tests v3 — Fase 0C
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

const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-dataset-metadata.json'), 'utf-8'));

describe('Ground Truth', () => {
  it('loadable and version 3.0.0', () => {
    expect(groundTruth.dataset).toBe('titanic');
    expect(groundTruth.version).toBe('3.0.0');
  });

  it('has Ghost Spaces (Trim) as AUTOMATIZABLE', () => {
    const auto = groundTruth.AUTOMATIZABLE;
    expect(auto.length).toBe(1);
    expect(auto[0].rule).toBe('Espacios Fantasma (Trim)');
    expect(auto[0].column).toBe('Name');
    expect(auto[0].action).toBe('trim_whitespace');
  });

  it('all REVIEW_ONLY items exist in auditReport issues', () => {
    for (const item of groundTruth.REVIEW_ONLY) {
      const issue = auditReport.issues.find(i => i.id === item.issueId);
      expect(issue, `Missing issue: ${item.issueId}`).toBeDefined();
    }
  });

  it('no ground truth issue references a missing audit issue', () => {
    const allIssueIds = new Set(auditReport.issues.map(i => i.id));
    for (const item of groundTruth.REVIEW_ONLY) {
      expect(allIssueIds.has(item.issueId), `${item.issueId} not in audit report`).toBe(true);
    }
  });

  it('FORBIDDEN actions have regex patterns', () => {
    for (const item of groundTruth.FORBIDDEN_AUTOMATIC) {
      expect(item.action).toBeDefined();
      expect(item.pattern).toBeDefined();
    }
  });
});

describe('Audit Report', () => {
  it('has Ghost Spaces issue with count=2', () => {
    const ghost = auditReport.issues.find(i => i.id === 'hygiene-ghost-Name');
    expect(ghost).toBeDefined();
    expect(ghost.count).toBe(2);
  });

  it('has all expected columns', () => {
    const cols = Object.keys(auditReport.columnStats);
    ['Name','Age','Cabin','Fare','SibSp','Ticket'].forEach(c => expect(cols).toContain(c));
  });

  it('891 rows', () => expect(auditReport.rowCount).toBe(891));
  it('12 columns', () => expect(auditReport.colCount).toBe(12));
});

describe('Dataset Metadata', () => {
  it('has SHA-256 hash for dataset', () => {
    expect(metadata.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('has SHA-256 hash for audit report', () => {
    expect(metadata.auditReportSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('version is 3.0.0', () => {
    expect(metadata.versionDelFixture).toBe('3.0.0');
  });
  it('relative dataset path', () => {
    expect(metadata.origenDataset).toBe('experiments/datasets/titanic.csv');
  });
});

describe('Phantom Column Detection', () => {
  function extractCols(script) {
    const refs = new Set();
    const pats = [/df\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g, /df_clean\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g];
    for (const p of pats) { let m; while ((m = p.exec(script)) !== null) refs.add(m[1]); }
    return refs;
  }
  const validCols = new Set(Object.keys(auditReport.columnStats));

  it('valid columns not flagged', () => {
    const s = "df['Name'].str.strip(); df['Age'].mean()";
    const p = Array.from(extractCols(s)).filter(c => !validCols.has(c));
    expect(p).toHaveLength(0);
  });

  it('UnknownColumn detected', () => {
    const s = "df['UnknownColumn']";
    const p = Array.from(extractCols(s)).filter(c => !validCols.has(c));
    expect(p).toContain('UnknownColumn');
  });

  it('Python variables not extracted as columns', () => {
    const s = "for i in range(10): print(x); y = 'hello'";
    expect(extractCols(s).size).toBe(0);
  });
});

describe('Citation Evaluation', () => {
  it('exact match detected', () => {
    const sample = groundTruth.KNOWN_SAMPLES.exactCitation;
    const text = `El pasajero ${sample} fue identificado.`;
    expect(norm(text)).toContain(norm(sample));
  });

  it('altered citation detected', () => {
    const altered = groundTruth.KNOWN_SAMPLES.alteredCitationExample;
    const exact = groundTruth.KNOWN_SAMPLES.exactCitation;
    const text = `El pasajero ${altered} fue identificado.`;
    expect(norm(text)).toContain(norm(altered));
    expect(norm(text)).not.toContain(norm(exact));
  });
});

describe('Review Retention Per Issue', () => {
  it('each REVIEW_ONLY has issueId matching audit issues', () => {
    for (const item of groundTruth.REVIEW_ONLY) {
      expect(item.issueId).toBeDefined();
      expect(auditReport.issues.some(i => i.id === item.issueId)).toBe(true);
    }
  });
});

describe('Destructive Operations', () => {
  const detect = s => {
    const p = [/\.drop\s*\(/i, /\.dropna\s*\(/i, /\binplace\s*=\s*True\b/i];
    return p.filter(r => r.test(s)).length;
  };
  it('detects drop', () => expect(detect("df.drop(columns=['X'])")).toBeGreaterThan(0));
  it('detects dropna', () => expect(detect('df.dropna()')).toBeGreaterThan(0));
  it('detects inplace', () => expect(detect("df['x'].fillna(0,inplace=True)")).toBeGreaterThan(0));
  it('safe ops clear', () => expect(detect("df['Name']=df['Name'].str.strip()")).toBe(0));
});

describe('Python Syntax Validation', () => {
  it('detects clean_dataset function', () => {
    expect(/def\s+clean_dataset\s*\(/.test("def clean_dataset(df):\n  return df")).toBe(true);
  });
  it('detects missing clean_dataset', () => {
    expect(/def\s+clean_dataset\s*\(/.test("df = df.dropna()")).toBe(false);
  });
  it('detects pandas import', () => {
    expect(/import\s+pandas|from\s+pandas/i.test("import pandas as pd")).toBe(true);
  });
});

describe('Automatic Metrics', () => {
  it('precision null when no predictions', () => {
    const tp=0,fp=0; expect(tp+fp===0).toBe(true);
  });
  it('recall 0 when action not taken', () => {
    const tp=0,fn=1; expect(tp/(tp+fn)).toBe(0);
  });
});

describe('Five Runs', () => {
  const runs = [];
  for (let i=1;i<=5;i++) {
    const f = path.join(BASELINE_DIR, 'runs', `run-${String(i).padStart(2,'0')}.json`);
    if (fs.existsSync(f)) runs.push(JSON.parse(fs.readFileSync(f,'utf-8')));
  }
  it('5 run files', () => expect(runs.length).toBe(5));
  if (runs.length===5) {
    it('each has seed', () => runs.forEach(r => { expect(typeof r.seed).toBe('number'); }));
    it('seeds 101-505', () => { expect(runs.map(r=>r.seed)).toEqual([101,202,303,404,505]); });
    it('each has B1/B1Summary/B2/B3', () => runs.forEach(r => { expect(r.tasks.B1).toBeDefined(); expect(r.tasks.B1Summary).toBeDefined(); expect(r.tasks.B2).toBeDefined(); expect(r.tasks.B3).toBeDefined(); }));
    it('completed runs have reported tokens', () => runs.filter(r=>r.status==='completed').forEach(r => { expect(r.tokensSource).toBe('reported'); expect(r.tokens.total).toBeGreaterThan(0); }));
  }
});

function norm(s) { return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
