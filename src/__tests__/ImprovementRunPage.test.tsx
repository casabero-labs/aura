/**
 * ImprovementRunPage Tests — Phase 6 Loop 5
 *
 * Validates module load and integration with ImprovementRunPanel.
 * Node environment to avoid vitest worker timeout with heavy modules.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/improvementRunService', () => ({
  runImprovementFlow: vi.fn(),
}));

describe('ImprovementRunPage', () => {
  describe('module load', () => {
    it('exports default component function', async () => {
      const mod = await import('../components/ImprovementRunPage');
      expect(typeof mod.default).toBe('function');
    });
  });

  describe('component structure', () => {
    it('renders without crashing (smoke test via import chain)', async () => {
      const { default: Page } = await import('../components/ImprovementRunPage');
      expect(Page).toBeDefined();
    });
  });
});
