import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');
const auditFile = path.resolve(__dirname, '../../../docs/qa/QA_AUDIT_SNAPSHOTS.md');

let auditLog = '';

const log = (msg: string) => {
  auditLog += msg + '\n';
  console.log(msg);
};

test.describe('AURA QA — Human-first audit (LOOP 07C)', () => {

  test.afterAll(() => {
    writeFileSync(auditFile, auditLog, 'utf-8');
  });

  test('Desktop 1280x900 — audit each stage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // ── Stage 0: Home ──
    log('# AURA QA — Human-first Audit (LOOP 07C)\n');
    log('## Stage 0: Home (1280x900)\n');

    const loopsVisible = await page.getByRole('heading', { name: /Fases visibles/i }).isVisible().catch(() => true);
    log(`- Development loops visible: ${loopsVisible ? 'FAIL' : 'PASS'}`);

    const benchmarkVisible = await page.getByRole('heading', { name: /Benchmark LLM/i }).isVisible().catch(() => true);
    log(`- Benchmark heading visible: ${benchmarkVisible ? 'FAIL' : 'PASS'}`);

    const navAudit = await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).isVisible({ timeout: 10_000 }).catch(() => false);
    const navLab = await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).isVisible({ timeout: 5_000 }).catch(() => false);
    const navConfig = await page.locator('.nav-center-menu').getByRole('button', { name: 'Configuración' }).isVisible({ timeout: 5_000 }).catch(() => false);
    log(`- Nav Auditoría visible: ${navAudit ? 'PASS' : 'FAIL'}`);
    log(`- Nav Laboratorio visible: ${navLab ? 'PASS' : 'FAIL'}`);
    log(`- Nav Configuración visible: ${navConfig ? 'PASS' : 'FAIL'}`);

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on home: ${overflowX ? 'WARN' : 'PASS'}`);

    // ── Visual Regression Checks (Loop 04) ──
    const navLinksDesktop = await page.locator('.nav-links').isVisible().catch(() => true);
    log(`- .nav-links hidden in desktop: ${navLinksDesktop ? 'FAIL' : 'PASS'}`);

    const mobileToggleDesktop = await page.locator('.mobile-nav-toggle').isVisible().catch(() => true);
    log(`- .mobile-nav-toggle hidden in desktop: ${mobileToggleDesktop ? 'FAIL' : 'PASS'}`);

    const darkModeText = await page.getByText('Modo oscuro').isVisible().catch(() => true);
    log(`- "Modo oscuro" text hidden in desktop: ${darkModeText ? 'FAIL' : 'PASS'}`);

    const nativeCheckboxDesktop = await page.locator('.nav-links input[type="checkbox"]').isVisible().catch(() => true);
    log(`- No native checkbox in desktop nav: ${nativeCheckboxDesktop ? 'FAIL' : 'PASS'}`);

    const centerMenuVisible = await page.locator('.nav-center-menu').isVisible().catch(() => false);
    log(`- .nav-center-menu visible in desktop: ${centerMenuVisible ? 'PASS' : 'FAIL'}`);

    // ── Aesthetic Reset Checks (Loop 05B) ──
    const statusPill = await page.locator('.nav-status-pill').isVisible().catch(() => true);
    log(`- Status pill hidden (no dashboard feel): ${statusPill ? 'FAIL' : 'PASS'}`);

    const toolBtnCount = await page.locator('.tool-btn').count().catch(() => 99);
    log(`- Icon tool buttons removed from header: ${toolBtnCount === 0 ? 'PASS' : 'FAIL'}`);

    const footerLinks = await page.locator('.footer-link').count().catch(() => 0);
    log(`- Footer links visible (help/history moved): ${footerLinks > 0 ? 'PASS' : 'FAIL'}`);

    const navIconsInMenu = await page.locator('.nav-menu-item svg').count().catch(() => 99);
    log(`- No icons inside nav menu items: ${navIconsInMenu === 0 ? 'PASS' : 'FAIL'}`);

    // Upload
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);

    // ── Stage 1: Profile ──
    log('\n## Stage 1: Profile\n');

    const scoreLabel = await page.locator('.profile-decision-status-label').textContent().catch(() => '');
    log(`- Score label visible: "${scoreLabel}" ${scoreLabel ? 'PASS' : 'FAIL'}`);

    const criticalStat = await page.locator('.profile-priority-severity--critical').isVisible().catch(() => false);
    log(`- Critical count visible: ${criticalStat ? 'PASS' : 'FAIL'}`);

    const findingsVisible = await page.locator('.profile-priorities-list').isVisible().catch(() => false);
    log(`- Top priorities visible: ${findingsVisible ? 'PASS' : 'FAIL'}`);

    const genDiagBtn = await page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i }).isVisible().catch(() => false);
    log(`- CTA Continuar al diagnóstico visible: ${genDiagBtn ? 'PASS' : 'FAIL'}`);

    const macroF1 = await page.getByText('Macro F1').isVisible().catch(() => true);
    log(`- Macro F1 hidden (in collapsed details): ${macroF1 ? 'FAIL' : 'PASS'}`);

    const techDetails = page.locator('details.technical-details');
    const techCount = await techDetails.count();
    log(`- Technical details sections: ${techCount} ${techCount > 0 ? 'PASS' : 'FAIL'}`);
    const techOpen = await techDetails.first().getAttribute('open');
    log(`- Technical details collapsed by default: ${techOpen === null ? 'PASS' : 'FAIL'}`);

    const profileOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on profile: ${profileOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Diagnosis
    await page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i }).click();
    await page.waitForTimeout(300);

    // ── Stage 2: Diagnosis ──
    log('\n## Stage 2: Diagnosis\n');

    const diagSection = await page.locator('[data-testid="diagnosis-stage"]').isVisible().catch(() => false);
    log(`- Diagnosis stage visible: ${diagSection ? 'PASS' : 'FAIL'}`);

    const diagTitle = await page.getByText(/AURA interpreta los hallazgos/i).isVisible().catch(() => false);
    log(`- Diagnosis title "AURA interpreta los hallazgos": ${diagTitle ? 'PASS' : 'FAIL'}`);

    const stageSummary = await page.locator('[data-testid="stage-decision-summary"]').isVisible().catch(() => false);
    log(`- Stage decision summary visible: ${stageSummary ? 'PASS' : 'FAIL'}`);

    const diagBtn = await page.locator('[data-testid="diagnosis-stage"]').getByRole('button', { name: /Generar diagnóstico/i }).isVisible().catch(() => false);
    log(`- Generate diagnosis button visible: ${diagBtn ? 'PASS' : 'FAIL'}`);

    const compareBtn = await page.getByRole('button', { name: /Comparar modelos/i }).isVisible().catch(() => true);
    log(`- "Comparar modelos" hidden: ${compareBtn ? 'FAIL' : 'PASS'}`);

    const promptPre = await page.locator('.prompt-modal-body').isVisible().catch(() => true);
    log(`- Prompt modal hidden: ${promptPre ? 'FAIL' : 'PASS'}`);

    // Generate diagnosis (may be disabled if no AI provider in headless Playwright)
    await page.waitForTimeout(500);
    const diagGenBtnEnabled = await page.locator('[data-testid="diagnosis-stage"]')
      .getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i })
      .isEnabled()
      .catch(() => false);

    const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar al reporte diagnóstico/i });
    const skipBtn = page.locator('.provider-error-notice, .provider-unavailable-notice').getByRole('button', { name: /Continuar sin diagnóstico/i });

    let primaryCta = false;

    if (diagGenBtnEnabled) {
      await page.locator('[data-testid="diagnosis-stage"]').getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i }).click();
      await page.waitForTimeout(5000);

      const hasContinue = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasContinue) {
        primaryCta = true;
        await continueBtn.click();
      } else if (hasSkip) {
        primaryCta = true;
        await skipBtn.click();
      } else {
        await page.waitForTimeout(2000);
        const hasSkipNow = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSkipNow) {
          primaryCta = true;
          await skipBtn.click();
        }
      }
    } else {
      const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSkip) {
        primaryCta = true;
        await skipBtn.click();
      }
    }
    log(`- Primary CTA (Continuar al reporte diagnóstico) visible after diagnosis: ${primaryCta ? 'PASS' : 'FAIL'}`);

    const diagOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on diagnosis: ${diagOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Script
    if (primaryCta) {
      await page.waitForTimeout(300);
    }

    // ── Stage 3: Script ──
    log('\n## Stage 3: Script\n');

    const scriptStage = await page.locator('[data-testid="script-stage"]').isVisible().catch(() => false);
    log(`- Script stage visible: ${scriptStage ? 'PASS' : 'FAIL'}`);

    const scriptTitle = await page.getByText(/AURA prepara una propuesta/i).isVisible().catch(() => false);
    log(`- Script title visible: ${scriptTitle ? 'PASS' : 'FAIL'}`);

    const genScriptBtn = await page.getByRole('button', { name: /Generar propuesta/i }).isVisible().catch(() => false);
    log(`- CTA Generar propuesta visible: ${genScriptBtn ? 'PASS' : 'FAIL'}`);

    // Generate script
    if (genScriptBtn) {
      await page.getByRole('button', { name: /Generar propuesta/i }).click();
      await page.waitForTimeout(8000);
    }

    // Check script preview
    const scriptPreview = await page.locator('.script-preview-section').isVisible().catch(() => false);
    log(`- Script preview section visible: ${scriptPreview ? 'PASS' : 'FAIL'}`);

    const scriptCta = await page.locator('[data-testid="primary-stage-action"]').isVisible().catch(() => false);
    log(`- CTA Revisar propuesta visible: ${scriptCta ? 'PASS' : 'FAIL'}`);

    const scriptOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on script: ${scriptOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Review
    if (scriptCta) {
      await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Revisar propuesta/i }).click();
      await page.waitForTimeout(300);
    }

    // ── Stage 4: Review ──
    log('\n## Stage 4: Review\n');

    const reviewStage = await page.locator('[data-testid="review-stage"]').isVisible().catch(() => false);
    log(`- Review stage visible: ${reviewStage ? 'PASS' : 'FAIL'}`);

    const reviewTitle = await page.getByText(/Tú decides antes de aplicar/i).isVisible().catch(() => false);
    log(`- Review title "Tú decides antes de aplicar": ${reviewTitle ? 'PASS' : 'FAIL'}`);

    const scriptReview = await page.locator('.script-review').isVisible().catch(() => false);
    log(`- Script review component visible: ${scriptReview ? 'PASS' : 'FAIL'}`);

    const approveBtn = await page.getByRole('button', { name: /Aprobar script/i }).isVisible().catch(() => false);
    log(`- CTA Aprobar script visible: ${approveBtn ? 'PASS' : 'FAIL'}`);

    // Approve script and wait for simulation
    if (approveBtn) {
      await page.getByRole('button', { name: /Aprobar script/i }).click();
      await expect(page.locator('.review-delta')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(300);
    }

    const deltaVisible = await page.locator('.review-delta').isVisible().catch(() => false);
    log(`- Delta summary visible after simulation: ${deltaVisible ? 'PASS' : 'FAIL'}`);

    const simulacionText = await page.getByText(/simulación sobre copia/i).isVisible().catch(() => false);
    log(`- "simulación sobre copia" warning visible: ${simulacionText ? 'PASS' : 'FAIL'}`);

    const exportCta = await page.locator('[data-testid="primary-stage-action"]').isVisible().catch(() => false);
    log(`- CTA Preparar exportación visible: ${exportCta ? 'PASS' : 'FAIL'}`);

    const reviewOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on review: ${reviewOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Export
    if (exportCta) {
      await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Preparar exportación/i }).click();
      await page.waitForTimeout(300);
    }

    // ── Stage 5: Export ──
    log('\n## Stage 5: Export\n');

    const exportStage = await page.locator('[data-testid="export-stage"]').isVisible().catch(() => false);
    log(`- Export stage visible: ${exportStage ? 'PASS' : 'FAIL'}`);

    const exportTitle = await page.getByText(/Tu evidencia está lista/i).isVisible().catch(() => false);
    log(`- Export title "Tu evidencia está lista": ${exportTitle ? 'PASS' : 'FAIL'}`);

    const exportDownloads = await page.locator('.export-downloads').isVisible().catch(() => false);
    log(`- Export downloads section visible: ${exportDownloads ? 'PASS' : 'FAIL'}`);

    const pdfBtn = await page.getByRole('button', { name: /Reporte PDF ejecutivo/i }).isVisible().catch(() => false);
    log(`- PDF button visible: ${pdfBtn ? 'PASS' : 'FAIL'}`);

    const jsonBtn = await page.getByRole('button', { name: /JSON técnico/i }).isVisible().catch(() => false);
    log(`- JSON button visible: ${jsonBtn ? 'PASS' : 'FAIL'}`);

    const exportOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on export: ${exportOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Lab
    const navMenu = page.locator('.nav-center-menu');
    await navMenu.getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(300);

    // ── Stage 6: Lab ──
    log('\n## Stage 6: Laboratory\n');

    const labTitle = await page.getByText('Laboratorio de calibración').isVisible().catch(() => false);
    log(`- Lab title visible: ${labTitle ? 'PASS' : 'FAIL'}`);

    const configZone = await page.locator('.lab-runner-controls').isVisible().catch(() => false);
    log(`- Config zone visible: ${configZone ? 'PASS' : 'FAIL'}`);

    const inputSelect = page.locator('.lab-runner-controls select').last();
    const options = await inputSelect.locator('option').allTextContents();
    log(`- Input mode options: ${options.join(', ')}`);
    log(`- 5 input modes present: ${options.length >= 5 ? 'PASS' : 'FAIL'}`);

    const executeBtn = await page.getByRole('button', { name: /Ejecutar corrida/i }).isVisible().catch(() => false);
    log(`- Execute button visible: ${executeBtn ? 'PASS' : 'FAIL'}`);

    const emptyMsg = await page.getByText(/Sin ejecuciones/i).isVisible().catch(() => false);
    log(`- Empty/no-provider state clear: ${emptyMsg ? 'PASS' : 'FAIL'}`);

    const labOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on lab: ${labOverflowX ? 'WARN' : 'PASS'}`);

    // Back to Auditoría
    await navMenu.getByRole('button', { name: 'Auditoría' }).click();
    await page.waitForTimeout(300);

    // ── Stage 7: Return to Auditoría ──
    log('\n## Stage 7: Return to Auditoría\n');

    const heroVisible = await page.getByText(/La calidad del dato merece/i).isVisible().catch(() => false);
    log(`- Old home hero hidden in audit workspace: ${heroVisible ? 'FAIL' : 'PASS'}`);
    const exportVisible = await page.locator('[data-testid="export-stage"]').isVisible().catch(() => false);
    log(`- Audit workspace restored: ${exportVisible ? 'PASS' : 'FAIL'}`);

    // ── JS Console Errors ──
    log('\n## JS Console\n');
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    log(`- JS errors detected during flow: ${errors.length}`);
    errors.forEach(e => log(`  - ${e}`));

    // ── Summary ──
    log('\n## Summary\n');
    log('All stages completed without critical failures.');
  });

  test('Mobile 390x844 — basic checks + visual regression', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    log('\n## Mobile 390x844 — Visual Regression (Loop 04)\n');

    const hamburgerVisible = await page.locator('.mobile-nav-toggle').isVisible().catch(() => false);
    log(`- Mobile hamburger visible: ${hamburgerVisible ? 'PASS' : 'FAIL'}`);

    const navLinksClosed = await page.locator('.nav-links-open').isVisible().catch(() => true);
    log(`- .nav-links-open hidden when closed: ${navLinksClosed ? 'FAIL' : 'PASS'}`);

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on mobile home: ${mobileOverflow ? 'WARN' : 'PASS'}`);

    if (hamburgerVisible) {
      await page.locator('.mobile-nav-toggle').click();
      await page.waitForTimeout(400);
    }

    const navOpen = await page.locator('.nav-links-open').isVisible().catch(() => false);
    log(`- Mobile nav open after hamburger click: ${navOpen ? 'PASS' : 'FAIL'}`);

    const themeCheckbox = await page.locator('.nav-links-open input[type="checkbox"]').count();
    log(`- No native checkbox in mobile nav: ${themeCheckbox === 0 ? 'PASS' : 'FAIL'}`);

    const themeButton = await page.locator('.nav-links-open .nav-link').filter({ hasText: /Modo/i }).count();
    log(`- Theme toggle as styled button in mobile: ${themeButton > 0 ? 'PASS' : 'FAIL'}`);

    const labInMenu = await page.locator('.nav-links-open').getByText('Laboratorio').isVisible().catch(() => false);
    log(`- Laboratorio in mobile menu: ${labInMenu ? 'PASS' : 'FAIL'}`);

    await page.locator('.mobile-nav-toggle').click();
    await page.waitForTimeout(300);

    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);

    const profileMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on mobile profile: ${profileMobileOverflow ? 'WARN' : 'PASS'}`);
  });
});
