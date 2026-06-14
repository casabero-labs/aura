import { describe, expect, it } from 'vitest';
import {
  findPipelineDevelopmentRow,
  PIPELINE_DEVELOPMENT_MATRIX,
  PIPELINE_STAGE_ORDER,
} from '../services/pipelineDevelopmentMatrix';

describe('AURA pipeline development matrix', () => {
  it('covers the six visible AURA pipeline stages in order', () => {
    expect(PIPELINE_STAGE_ORDER).toEqual([
      'upload',
      'profile',
      'diagnosis',
      'script',
      'review',
      'export',
    ]);

    expect(PIPELINE_DEVELOPMENT_MATRIX.map((row) => row.stageLabel)).toEqual([
      'Subir CSV',
      'Perfilar',
      'Diagnóstico',
      'Script',
      'Revisar',
      'Exportar',
    ]);
  });

  it('keeps every row actionable for academic consolidation', () => {
    for (const row of PIPELINE_DEVELOPMENT_MATRIX) {
      expect(row.currentState.length).toBeGreaterThanOrEqual(3);
      expect(row.reviewRequirement.length).toBeGreaterThanOrEqual(3);
      expect(row.strengths.length).toBeGreaterThanOrEqual(3);
      expect(row.weaknesses.length).toBeGreaterThanOrEqual(3);
      expect(row.developmentObjectives.length).toBeGreaterThanOrEqual(3);
      expect(row.loop.id).toMatch(/^L\d{2}-[A-Z]$/);
      expect(row.loop.visibleResult).toContain('evidencia');
      expect(row.loop.e2eGate).toContain('->');
    }
  });

  it('maps pipeline state to the development row used by the UI', () => {
    expect(findPipelineDevelopmentRow('profile')?.loop.title).toBe('Validacion determinista formal');
    expect(findPipelineDevelopmentRow('diagnosis')?.reviewRequirement.join(' ')).toContain('benchmark multimodelo');
    expect(findPipelineDevelopmentRow('export')?.developmentObjectives.join(' ')).toContain('paquete TFM/articulo');
  });
});
