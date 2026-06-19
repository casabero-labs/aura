import { describe, expect, it } from 'vitest';
import { buildColabNotebook, buildColabNotebookJSON } from '../services/colabExporter';

const stubParams = {
  datasetName: 'Incidentes_Policiales.csv',
  csvFields: ['Address', 'AddressType', 'CallDateTime', 'City', 'CrimeId', 'Disposition', 'OriginalCrimeTypeName'],
  approvedScript: 'import pandas as pd\n\ndef clean_dataset(df):\n    df = df.copy()\n    df["City"] = df["City"].str.lower()\n    return df\n',
  auditSummary: {
    score: 79,
    rowCount: 5000,
    colCount: 7,
    issueCount: 5,
    truncated: true,
  },
};

describe('colabExporter', () => {
  describe('buildColabNotebook', () => {
    it('produces a valid nbformat 4 notebook structure', () => {
      const notebook = buildColabNotebook(stubParams);
      expect(notebook.nbformat).toBe(4);
      expect(notebook.nbformat_minor).toBe(5);
      expect(notebook.metadata.kernelspec.name).toBe('python3');
      expect(notebook.metadata.language_info.name).toBe('python');
    });

    it('contains markdown and code cells', () => {
      const notebook = buildColabNotebook(stubParams);
      const mdCells = notebook.cells.filter(c => c.cell_type === 'markdown');
      const codeCells = notebook.cells.filter(c => c.cell_type === 'code');
      expect(mdCells.length).toBeGreaterThanOrEqual(4);
      expect(codeCells.length).toBeGreaterThanOrEqual(4);
    });

    it('includes the approved script verbatim', () => {
      const notebook = buildColabNotebook(stubParams);
      const scriptCell = notebook.cells.find(c =>
        c.cell_type === 'code' && c.source.some(line => line.includes('clean_dataset'))
      );
      expect(scriptCell).toBeDefined();
      const sourceText = scriptCell!.source.join('');
      expect(sourceText).toContain('def clean_dataset(df)');
      expect(sourceText).toContain('df["City"] = df["City"].str.lower()');
    });

    it('includes privacy warning', () => {
      const notebook = buildColabNotebook(stubParams);
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      expect(allSource).toMatch(/ADVERTENCIA DE PRIVACIDAD/);
      expect(allSource).toMatch(/fuera de AURA/);
      expect(allSource).toMatch(/Google Cloud/);
    });

    it('includes instructions to re-audit in AURA', () => {
      const notebook = buildColabNotebook(stubParams);
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      expect(allSource).toMatch(/Vuelve a AURA/);
      expect(allSource).toMatch(/re-auditar/);
    });

    it('does not include raw data', () => {
      const notebook = buildColabNotebook(stubParams);
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      // No actual row data should be embedded
      expect(allSource).not.toMatch(/San Francisco,160903280/);
      expect(allSource).not.toMatch(/"CrimeId".*"160903280"/);
    });

    it('includes truncated preview warning when applicable', () => {
      const notebook = buildColabNotebook(stubParams);
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      expect(allSource).toMatch(/Preview limitado a 5\.000 filas/);
    });

    it('omits truncated warning when not applicable', () => {
      const notebook = buildColabNotebook({ ...stubParams, auditSummary: { ...stubParams.auditSummary, truncated: false } });
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      expect(allSource).not.toMatch(/Preview limitado a 5\.000 filas/);
    });

    it('includes dataset metadata in header', () => {
      const notebook = buildColabNotebook(stubParams);
      const allSource = notebook.cells.map(c => c.source.join('')).join('\n');
      expect(allSource).toContain('Incidentes_Policiales.csv');
      expect(allSource).toContain('79/100');
      expect(allSource).toContain('5.000');
    });
  });

  describe('buildColabNotebookJSON', () => {
    it('produces valid JSON', () => {
      const json = buildColabNotebookJSON(stubParams);
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.nbformat).toBe(4);
    });

    it('JSON is well-formatted (pretty-printed)', () => {
      const json = buildColabNotebookJSON(stubParams);
      expect(json.startsWith('{')).toBe(true);
      expect(json).toContain('\n  ');
    });
  });
});
