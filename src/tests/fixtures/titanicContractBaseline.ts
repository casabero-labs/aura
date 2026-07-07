/**
 * Titanic Contract Baseline Fixture — L18.
 *
 * Controlled AuditReportInput with 6 representative rows.
 * Covers: trim (auto_safe), nulls (review), outliers (review),
 *         high cardinality (not_actionable), identifier (review).
 *
 * Not a real dataset. Not used for production inference.
 */
import type { AuditReportInput } from '../../contracts/llm/evidenceEnvelopeV2';

export const TITANIC_CONTROLLED_ROWS = [
  { PassengerId: '1',  Name: '  Braund, Mr. Owen Harris  ', Age: '22',   Ticket: 'A/5 21171' },
  { PassengerId: '2',  Name: 'Cumings, Mrs. John Bradley', Age: '38',   Ticket: 'PC 17599' },
  { PassengerId: '3',  Name: 'Heikkinen, Miss. Laina',    Age: '26',   Ticket: 'STON/O2. 3101282' },
  { PassengerId: '4',  Name: 'Futrelle, Mrs. Jacques Heath', Age: null, Ticket: '113803' },
  { PassengerId: '5',  Name: 'Allen, Mr. William Henry',  Age: '200',  Ticket: '373450' },
  { PassengerId: '6',  Name: '  Moran, Mr. James  ',       Age: '18',   Ticket: '330877' },
];

export const TITANIC_CONTRACT_BASELINE_FIXTURE: AuditReportInput = {
  score: 78,
  rowCount: 6,
  colCount: 4,
  duplicateRows: 0,
  delimiterDetected: ',',

  issues: [
    {
      id: 'hygiene-ghost-Name',
      column: 'Name',
      ruleName: 'Espacios Fantasma (Trim)',
      ruleId: 'rule:trim-whitespace',
      category: 'Higiene de Texto',
      description: 'Textos con espacios invisibles al inicio/final.',
      severity: 'info',
      count: 2,
      affectedPercentage: 33.3,
      sampleValues: ['  Braund, Mr. Owen Harris  ', '  Moran, Mr. James  '],
      automaticAuthorization: {
        actionType: 'trim_whitespace',
        authorized: true,
        conditionsMet: ['string-column', 'leading-or-trailing-whitespace-confirmed'],
        reason: 'Deterministic lossless normalization',
      },
    },
    {
      id: 'integrity-null-Age',
      column: 'Age',
      ruleName: 'Valores Nulos / Vacíos',
      ruleId: 'rule:null-values',
      category: 'Integridad',
      description: 'Advertencia: Faltan datos.',
      severity: 'warning',
      count: 1,
      affectedPercentage: 16.7,
      sampleValues: [null],
      automaticAuthorization: {
        actionType: 'null_values',
        authorized: false,
        conditionsMet: [],
        reason: 'No automatic authorization for null/outlier rules',
      },
    },
    {
      id: 'logic-outlier-tukey-Age',
      column: 'Age',
      ruleName: 'Outliers Leves (Tukey 1.5×)',
      ruleId: 'rule:mild-outliers',
      category: 'Lógica',
      description: 'Valor Age=200 (row 5) supera 1.5× IQR.',
      severity: 'warning',
      count: 1,
      affectedPercentage: 16.7,
      sampleValues: [200],
      automaticAuthorization: {
        actionType: 'null_values',
        authorized: false,
        conditionsMet: [],
        reason: 'No automatic authorization for null/outlier rules',
      },
    },
    {
      id: 'semantic-long-tail-Ticket',
      column: 'Ticket',
      ruleName: 'Cola Larga Categórica',
      ruleId: 'rule:long-tail-categorical',
      category: 'Semántica',
      description: '6 valores distintos en 6 filas (100%) — alta cardinalidad.',
      severity: 'info',
      count: 6,
      affectedPercentage: 100,
      sampleValues: ['A/5 21171', 'PC 17599', 'STON/O2. 3101282'],
      automaticAuthorization: {
        actionType: 'none',
        authorized: false,
        conditionsMet: [],
        reason: 'No automaticAuthorization provided by engine',
      },
    },
    {
      id: 'semantic-id-PassengerId',
      column: 'PassengerId',
      ruleName: 'Identificador / ID',
      ruleId: 'rule:identifier-column',
      category: 'Semántica',
      description: 'PassengerId es un identificador único por fila (cardinalidad = rowCount).',
      severity: 'info',
      count: 6,
      affectedPercentage: 100,
      sampleValues: ['1', '2', '3'],
      automaticAuthorization: {
        actionType: 'none',
        authorized: false,
        conditionsMet: [],
        reason: 'Identifier columns are not automatically actionable',
      },
    },
  ],

  columnStats: {
    PassengerId: { inferredType: 'number', semanticType: 'identifier', distinctCount: 6, nullCount: 0, nullPercentage: 0, topValues: [{ value: '1', count: 1, percentage: 16.7 }], stats: {} },
    Name:        { inferredType: 'string', semanticType: 'name', distinctCount: 6, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 16.7 }], stats: {} },
    Age:         { inferredType: 'number', semanticType: 'age', distinctCount: 5, nullCount: 1, nullPercentage: 16.7, topValues: [{ value: '22', count: 1, percentage: 16.7 }], stats: { min: 18, max: 200, mean: 60.8, median: 26 } },
    Ticket:      { inferredType: 'string', semanticType: 'ticket', distinctCount: 6, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'A/5 21171', count: 1, percentage: 16.7 }], stats: {} },
  },

  datasetProfile: {
    columns: [
      { name: 'PassengerId', inferredType: 'number', semanticType: 'identifier', cardinality: 6 },
      { name: 'Name',        inferredType: 'string', semanticType: 'name', cardinality: 6 },
      { name: 'Age',         inferredType: 'number', semanticType: 'age', cardinality: 5 },
      { name: 'Ticket',      inferredType: 'string', semanticType: 'ticket', cardinality: 6 },
    ],
  },

  scoreBreakdown: [
    { reason: 'Espacios Fantasma (Trim): Name', points: 2, category: 'Higiene de Texto', severity: 'info', ruleId: 'rule:trim-whitespace' },
    { reason: 'Valores Nulos: Age', points: 5, category: 'Integridad', severity: 'warning', ruleId: 'rule:null-values' },
    { reason: 'Outliers Tukey: Age', points: 3, category: 'Lógica', severity: 'warning', ruleId: 'rule:mild-outliers' },
    { reason: 'Cola Larga: Ticket', points: 2, category: 'Semántica', severity: 'info', ruleId: 'rule:long-tail-categorical' },
    { reason: 'Identificador: PassengerId', points: 0, category: 'Semántica', severity: 'info', ruleId: 'rule:identifier-column' },
  ],
};
