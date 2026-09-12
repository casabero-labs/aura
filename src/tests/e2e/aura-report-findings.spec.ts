import { expect, test } from '@playwright/test';

const issue = (
  id: string,
  ruleName: string,
  column: string | null,
  ruleId = 'rule:null-values',
  authorized = false,
) => ({
  id,
  ...(column ? { column } : {}),
  ruleId,
  ruleName,
  category: 'Integridad y Estructura',
  description: `${ruleName}: evidencia controlada para la revisión del informe.`,
  severity: 'warning',
  count: 1,
  affectedPercentage: 25,
  sampleValues: [],
  automaticAuthorization: {
    actionType: authorized ? 'drop_exact_duplicates' : 'inspect_missingness',
    authorized,
    conditionsMet: authorized ? ['full-row-equality-confirmed'] : [],
    reason: authorized ? 'Duplicado exacto confirmado.' : 'Requiere decisión de dominio.',
  },
});

const auditFixture = {
  score: 76,
  rowCount: 4,
  colCount: 3,
  duplicateRows: 1,
  delimiterDetected: ',',
  scoreBreakdown: [],
  issues: [
    issue('duplicate-rows', 'Filas Duplicadas', null, 'rule:exact-duplicates', true),
    issue('null-name', 'Valores Nulos', 'nombre'),
    issue('null-email', 'Valores Nulos', 'email'),
    issue('null-city', 'Valores Nulos', 'ciudad'),
  ],
  columnStats: {},
};

const diagnosisFixture = {
  version: 2,
  evidenceEnvelopeRef: 'env-aura-ux-002',
  promptHash: 'prompt-aura-ux-002',
  promptVersion: 'diagnosis-v2-e2e',
  rawResponseHash: 'raw-aura-ux-002',
  metrics: {
    latencyMs: 0,
    tokensGenerated: 0,
    model: 'controlled-fixture',
    provider: 'fixture',
    isLocal: true,
  },
  diagnosis: {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: 'env-aura-ux-002',
    responseId: 'diag-aura-ux-002',
    generatedAt: '2026-07-18T00:00:00.000Z',
    limitations: ['Fixture controlado para validar representación única.'],
    issues: [{
      issueId: 'duplicate-rows',
      evidenceRefs: [],
      hypothesis: 'La eliminación requiere confirmar la política de conservación.',
      confidence: 0.95,
      requiresHumanReview: true,
      limits: ['No corregir automáticamente.'],
    }],
    diagnosisBlocks: [{
      issueId: 'duplicate-rows',
      ruleId: 'rule:exact-duplicates',
      columnId: null,
      scope: 'dataset',
      observation: 'Hay una fila duplicada exacta.',
      recommendation: 'Confirmar cuál registro conservar.',
    }],
  },
  remediationContext: {
    evidenceEnvelopeRef: 'env-aura-ux-002',
    datasetFingerprint: 'fixture-4x3',
    columns: [],
    issues: [],
  },
};

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 780 },
];

for (const viewport of viewports) {
  test(`AURA-UX-002 — una entidad por finding.id — ${viewport.name}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.waitForFunction(() => (
      typeof (window as any).__L9_SET_REPORT__ === 'function'
      && typeof (window as any).__PHASE4_INJECT__ === 'function'
      && typeof (window as any).__PHASE4_SET_STATE__ === 'function'
    ));
    await page.evaluate(([report, diagnosis]) => {
      (window as any).__L9_SET_REPORT__(report);
      (window as any).__PHASE4_INJECT__(diagnosis, null, {
        analysisText: 'Fixture controlado con cuatro hallazgos únicos.',
      });
      (window as any).__PHASE4_SET_STATE__('diagnostic_report');
    }, [auditFixture, diagnosisFixture]);

    const stage = page.getByTestId('diagnostic-report-stage');
    await expect(stage).toBeVisible();
    await expect(page.getByTestId('diagnostic-report-findings-count')).toHaveText('4');
    await expect(page.getByTestId('diagnostic-finding-card')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Filas Duplicadas', exact: true })).toHaveCount(1);

    const duplicateCard = page.locator('[data-finding-id="finding-duplicate-rows"]');
    await expect(duplicateCard).toContainText('Hallazgo determinista');
    await expect(duplicateCard).toContainText('Decisión humana');
    await expect(duplicateCard).toContainText('Remediación opcional');
    await expect(duplicateCard).toContainText('Revisión humanaSí');

    const cardSurface = await duplicateCard.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderStyle };
    });
    expect(cardSurface.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(cardSurface.border).toBe('solid');

    await page.getByTestId('diagnostic-report-export-main').focus();
    const focusStyle = await page.getByTestId('diagnostic-report-export-main').evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.outlineStyle}:${style.outlineWidth}:${style.borderColor}`;
    });
    expect(focusStyle).not.toBe('none:0px:rgba(0, 0, 0, 0)');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(runtimeErrors).toEqual([]);

    await page.screenshot({
      path: `test-results/aura-report-findings-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
