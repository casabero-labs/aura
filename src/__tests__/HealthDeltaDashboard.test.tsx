/**
 * HealthDeltaDashboard Tests — Phase 6 Loop 2
 *
 * Validates component render output for all 4 statuses,
 * scores, issues, caveats, summary, and notice.
 * Node environment with renderToString — avoids jsdom timeout.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import HealthDeltaDashboard from '../components/HealthDeltaDashboard';

function renderHtml(props: Record<string, unknown>): string {
  return renderToString(createElement(HealthDeltaDashboard, props as any));
}

describe('HealthDeltaDashboard', () => {
  describe('status rendering', () => {
    it('renders improved status', () => {
      expect(renderHtml({ status: 'improved' })).toContain('Improved');
    });

    it('renders unchanged status', () => {
      expect(renderHtml({ status: 'unchanged' })).toContain('Unchanged');
    });

    it('renders worsened status', () => {
      expect(renderHtml({ status: 'worsened' })).toContain('Worsened');
    });

    it('renders inconclusive status', () => {
      expect(renderHtml({ status: 'inconclusive' })).toContain('Inconclusive');
    });

    it('renders status badge with data-testid', () => {
      const html = renderHtml({ status: 'improved' });
      expect(html).toContain('data-testid="status-badge"');
    });
  });

  describe('score display', () => {
    it('shows score before and after', () => {
      const html = renderHtml({ status: 'improved', scoreBefore: 75, scoreAfter: 100 });
      expect(html).toContain('75');
      expect(html).toContain('100');
    });

    it('shows score delta', () => {
      const html = renderHtml({ status: 'improved', delta: 25, scoreBefore: 75, scoreAfter: 100 });
      expect(html).toContain('+25');
    });

    it('shows negative delta', () => {
      const html = renderHtml({ status: 'worsened', delta: -10, scoreBefore: 80, scoreAfter: 70 });
      expect(html).toContain('-10');
    });

    it('shows zero delta', () => {
      const html = renderHtml({ status: 'unchanged', delta: 0, scoreBefore: 75, scoreAfter: 75 });
      expect(html).toContain('data-testid="score-delta"');
    });

    it('renders score bar element', () => {
      const html = renderHtml({ status: 'improved', scoreBefore: 50, scoreAfter: 80 });
      expect(html).toContain('data-testid="score-bar"');
    });
  });

  describe('issues display', () => {
    it('shows issues before and after', () => {
      const html = renderHtml({ status: 'improved', beforeIssueCount: 5, afterIssueCount: 1 });
      expect(html).toContain('data-testid="issues-before"');
      expect(html).toContain('5');
      expect(html).toContain('1');
    });

    it('shows issue delta', () => {
      const html = renderHtml({ status: 'improved', issueDelta: -4, beforeIssueCount: 5, afterIssueCount: 1 });
      expect(html).toContain('data-testid="issue-delta"');
      expect(html).toContain('-4');
    });

    it('shows positive issue delta', () => {
      const html = renderHtml({ status: 'worsened', issueDelta: 3, beforeIssueCount: 0, afterIssueCount: 3 });
      expect(html).toContain('+3');
    });
  });

  describe('output dataset', () => {
    it('renders output rows', () => {
      const html = renderHtml({ status: 'improved', outputRowCountBefore: 5, outputRowCountAfter: 5 });
      expect(html).toContain('data-testid="output-rows"');
      expect(html).toContain('output-rows">5');
    });

    it('renders output columns', () => {
      const html = renderHtml({ status: 'improved', outputColumnCountBefore: 4, outputColumnCountAfter: 4 });
      expect(html).toContain('data-testid="output-cols"');
    });

    it('renders changed cells', () => {
      const html = renderHtml({ status: 'improved', changedCellsEstimate: 10, outputRowCountBefore: 3, outputColumnCountBefore: 2 });
      expect(html).toContain('data-testid="changed-cells"');
      expect(html).toContain('10');
    });

    it('omits output section when no dataset data', () => {
      const html = renderHtml({ status: 'improved' });
      expect(html).not.toContain('data-testid="output-summary"');
    });
  });

  describe('caveats', () => {
    it('renders caveats list when present', () => {
      const html = renderHtml({ status: 'improved', caveats: ['CAVEAT_A', 'CAVEAT_B'] });
      expect(html).toContain('data-testid="caveats"');
      expect(html).toContain('CAVEAT_A');
      expect(html).toContain('CAVEAT_B');
    });

    it('omits caveats section when empty array', () => {
      const html = renderHtml({ status: 'improved', caveats: [] });
      expect(html).not.toContain('data-testid="caveats"');
    });
  });

  describe('summary', () => {
    it('renders summary text', () => {
      const html = renderHtml({ status: 'improved', summary: 'Custom delta text.' });
      expect(html).toContain('data-testid="delta-summary"');
      expect(html).toContain('Custom delta text.');
    });
  });

  describe('limitation notice', () => {
    it('always includes the notice about controlled fixtures', () => {
      const html = renderHtml({ status: 'improved' });
      expect(html).toContain('data-testid="limitation-notice"');
      expect(html).toContain('HealthDelta is computed');
      expect(html).toContain('not independent external validation');
    });
  });
});
