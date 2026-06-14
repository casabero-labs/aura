import { describe, expect, it } from 'vitest';
import { buildDevelopmentLoopProgram } from '../services/developmentLoops';

describe('AURA development loop program', () => {
  it('starts with deterministic evidence as the active loop when no dataset is loaded', () => {
    const program = buildDevelopmentLoopProgram();

    expect(program.has).toContain('Motor determinista reproducible y pipeline local-first funcionando en navegador.');
    expect(program.nextLoop.id).toBe('loop-02');
    expect(program.nextLoop.status).toBe('active');
    expect(program.loops[0].status).toBe('done');
  });

  it('moves to benchmark once deterministic profile exists', () => {
    const program = buildDevelopmentLoopProgram({ hasReport: true });

    expect(program.loops.find((loop) => loop.id === 'loop-02')?.status).toBe('done');
    expect(program.nextLoop.id).toBe('loop-03');
    expect(program.nextLoop.e2eGate).toContain('laboratorio');
  });

  it('moves to closeout when HITL evidence exists', () => {
    const program = buildDevelopmentLoopProgram({
      hasReport: true,
      hasBenchmarkResults: true,
      hasApprovedScript: true,
      hasImprovementRun: true,
    });

    expect(program.nextLoop.id).toBe('loop-05');
    expect(program.nextLoop.status).toBe('active');
  });
});
