import { describe, expect, it } from 'vitest';
import { createImprovementRun, calculateHealthDelta } from '../services/improvementService';
import { runAudit } from '../services/auditEngine';
import { HitlDecision, HitlChecklistItem } from '../types';

const makeHitlDecision = (overrides: Partial<HitlDecision> = {}): HitlDecision => ({
  approved: true,
  timestamp: new Date().toISOString(),
  safetyScoreAtApproval: 85,
  coverageAtApproval: 75,
  checklist: [
    { criterion: 'Columnas validas', passed: true, detail: 'Sin columnas fantasma.' },
    { criterion: 'Cobertura', passed: true, detail: '75% cobertura.' },
    { criterion: 'Operaciones destructivas', passed: true, detail: 'Sin operaciones detectadas.' },
    { criterion: 'Uso de Pandas', passed: true, detail: 'Pandas importado.' },
    { criterion: 'Revision humana', passed: true, detail: 'Revisor verifico el codigo completo.' },
  ],
  ...overrides,
});

const baseData = [
  { id: 1, name: ' Alice  ', status: 'N/A', amount: '10' },
  { id: 1, name: ' Alice  ', status: 'N/A', amount: '10' },
  { id: 2, name: 'bob', status: 'ok', amount: '20' },
  { id: 3, name: 'BOB', status: 'null', amount: '30' },
  { id: 4, name: 'Carol', status: 'ok', amount: '40' },
];

const fields = ['id', 'name', 'status', 'amount'];
const initialReport = runAudit(baseData, fields, ',');

describe('HitlDecision — contrato', () => {
  it('construye HitlDecision valida con todos los campos requeridos', () => {
    const decision = makeHitlDecision();

    expect(decision.approved).toBe(true);
    expect(decision.safetyScoreAtApproval).toBe(85);
    expect(decision.coverageAtApproval).toBe(75);
    expect(decision.checklist).toHaveLength(5);
    expect(decision.timestamp).toBeTruthy();
    expect(decision.reviewerNotes).toBeUndefined();
  });

  it('incluye reviewerNotes cuando hay advertencias', () => {
    const decision = makeHitlDecision({
      safetyScoreAtApproval: 40,
      reviewerNotes: 'Aprobado con reservas: safetyScore bajo, revisar antes de produccion.',
    });

    expect(decision.reviewerNotes).toBeTruthy();
    expect(decision.safetyScoreAtApproval).toBe(40);
  });

  it('permite rechazo explícito con checklist fallido', () => {
    const checklist: HitlChecklistItem[] = [
      { criterion: 'Columnas', passed: false, detail: '2 columnas fantasma: salario, telefono.' },
      { criterion: 'Cobertura', passed: false, detail: '0% cobertura.' },
    ];

    const decision = makeHitlDecision({
      approved: false,
      safetyScoreAtApproval: 10,
      coverageAtApproval: 0,
      checklist,
      reviewerNotes: 'Rechazado: columnas inexistentes y sin cobertura.',
    });

    expect(decision.approved).toBe(false);
    expect(decision.checklist.filter((c) => !c.passed).length).toBe(2);
  });
});

describe('createImprovementRun with HitlDecision', () => {
  it('crea run que conserva la decision HITL', () => {
    const decision = makeHitlDecision();
    const run = createImprovementRun({
      originalData: baseData,
      fields,
      delimiter: ',',
      initialReport,
      benchmarkResults: [],
      hitlDecision: decision,
    });

    expect(run.hitlDecision).toBeDefined();
    expect(run.hitlDecision!.approved).toBe(true);
    expect(run.hitlDecision!.safetyScoreAtApproval).toBe(85);
    expect(run.hitlDecision!.checklist).toHaveLength(5);
  });

  it('calcula healthDelta y lo incluye en el run', () => {
    const decision = makeHitlDecision();
    const run = createImprovementRun({
      originalData: baseData,
      fields,
      delimiter: ',',
      initialReport,
      benchmarkResults: [],
      hitlDecision: decision,
    });

    expect(run.healthDelta).toBeDefined();
    expect(run.healthDelta!.beforeScore).toBeGreaterThanOrEqual(0);
    expect(run.healthDelta!.afterScore).toBeGreaterThanOrEqual(0);
    // Duplicates should be reduced after drop_duplicates simulation
    expect(run.healthDelta!.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  it('run sin decision HITL no tiene hitlDecision', () => {
    const run = createImprovementRun({
      originalData: baseData,
      fields,
      delimiter: ',',
      initialReport,
      benchmarkResults: [],
    });

    expect(run.hitlDecision).toBeUndefined();
  });
});

describe('calculateHealthDelta', () => {
  it('calcula delta positivo tras remover duplicados', () => {
    const cleanData = [
      { id: 1, name: 'Alice', status: 'ok' },
      { id: 2, name: 'Bob', status: 'ok' },
      { id: 3, name: 'Carol', status: 'ok' },
    ];
    const after = runAudit(cleanData, ['id', 'name', 'status'], ',');

    // Simulate before (with duplicates) vs after (clean)
    const delta = calculateHealthDelta(initialReport, after);

    expect(delta.beforeScore).toBeLessThanOrEqual(100);
    expect(delta.afterScore).toBeLessThanOrEqual(100);
    // After removing duplicates, score should improve or stay same
    expect(delta.afterScore).toBeGreaterThanOrEqual(delta.beforeScore);
  });
});
