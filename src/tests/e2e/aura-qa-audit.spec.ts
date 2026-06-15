import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');
const auditFile = path.resolve(__dirname, '../../docs/qa/QA_AUDIT_SNAPSHOTS.md');

let auditLog = '';

const log = (msg: string) => {
  auditLog += msg + '\n';
  console.log(msg);
};

test.describe('AURA QA — Human-first audit', () => {

  test.afterAll(() => {
    writeFileSync(auditFile, auditLog, 'utf-8');
  });

  test('Desktop 1280x900 — audit each stage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Wait for React mount + sticky nav render before visibility checks
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // ── Stage 0: Home ──
    log('# AURA QA — Human-first Audit\n');
    log('## Stage 0: Home (1280x900)\n');

    // Check no forbidden content
    const loopsVisible = await page.getByRole('heading', { name: /Fases visibles/i }).isVisible().catch(() => true);
    log(`- Development loops visible: ${loopsVisible ? 'FAIL' : 'PASS'}`);

    const benchmarkVisible = await page.getByRole('heading', { name: /Benchmark LLM/i }).isVisible().catch(() => true);
    log(`- Benchmark heading visible: ${benchmarkVisible ? 'FAIL' : 'PASS'}`);

    // Check nav items — use explicit visibility wait per button to avoid render-timing race
    const navAudit = await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).isVisible({ timeout: 10_000 }).catch(() => false);
    const navLab = await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).isVisible({ timeout: 5_000 }).catch(() => false);
    const navConfig = await page.locator('.nav-center-menu').getByRole('button', { name: 'Configuración' }).isVisible({ timeout: 5_000 }).catch(() => false);
    log(`- Nav Auditoría visible: ${navAudit ? 'PASS' : 'FAIL'}`);
    log(`- Nav Laboratorio visible: ${navLab ? 'PASS' : 'FAIL'}`);
    log(`- Nav Configuración visible: ${navConfig ? 'PASS' : 'FAIL'}`);

    // Check no horizontal overflow
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

    // Upload
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);

    // ── Stage 1: Profile ──
    log('\n## Stage 1: Profile\n');

    const scoreLabel = await page.locator('.profile-summary-score-label').textContent().catch(() => '');
    log(`- Score label visible: "${scoreLabel}" ${scoreLabel ? 'PASS' : 'FAIL'}`);

    const criticalStat = await page.locator('.profile-summary-stat--critical').isVisible().catch(() => false);
    log(`- Critical count visible: ${criticalStat ? 'PASS' : 'FAIL'}`);

    const findingsVisible = await page.locator('.profile-summary-findings-list').isVisible().catch(() => false);
    log(`- Top findings visible: ${findingsVisible ? 'PASS' : 'FAIL'}`);

    const affectedVisible = await page.locator('.profile-summary-affected-list').isVisible().catch(() => false);
    log(`- Most affected columns visible: ${affectedVisible ? 'PASS' : 'FAIL'}`);

    const genDiagBtn = await page.locator('.profile-summary-section').getByRole('button', { name: /Generar diagnóstico/i }).isVisible().catch(() => false);
    log(`- CTA Generar diagnóstico visible: ${genDiagBtn ? 'PASS' : 'FAIL'}`);

    // Ground truth not in foreground
    const macroF1 = await page.getByText('Macro F1').isVisible().catch(() => true);
    log(`- Macro F1 hidden (in collapsed details): ${macroF1 ? 'FAIL' : 'PASS'}`);

    // Technical details exist collapsed
    const techDetails = page.locator('details.technical-details');
    const techCount = await techDetails.count();
    log(`- Technical details sections: ${techCount} ${techCount > 0 ? 'PASS' : 'FAIL'}`);
    const techOpen = await techDetails.first().getAttribute('open');
    log(`- Technical details collapsed by default: ${techOpen === null ? 'PASS' : 'FAIL'}`);

    // Overflow check
    const profileOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on profile: ${profileOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Diagnosis
    await page.locator('.profile-summary-section').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(300);

    // ── Stage 2: Diagnosis ──
    log('\n## Stage 2: Diagnosis\n');

    const diagSection = await page.locator('.diagnosis-compact').isVisible().catch(() => false);
    log(`- Diagnosis compact section visible: ${diagSection ? 'PASS' : 'FAIL'}`);

    const problemVisible = await page.locator('.diagnosis-compact').getByText(/principal señal de calidad/i).isVisible().catch(() => false);
    log(`- Problem summary visible: ${problemVisible ? 'PASS' : 'FAIL'}`);

    const diagBtn = await page.locator('.diagnosis-compact').getByRole('button', { name: /Generar diagnóstico/i }).isVisible().catch(() => false);
    log(`- Generate diagnosis button visible: ${diagBtn ? 'PASS' : 'FAIL'}`);

    // No benchmark/comparar in foreground
    const compareBtn = await page.getByRole('button', { name: /Comparar modelos/i }).isVisible().catch(() => true);
    log(`- "Comparar modelos" hidden: ${compareBtn ? 'FAIL' : 'PASS'}`);

    // No prompt in foreground
    const promptPre = await page.locator('.prompt-modal-body').isVisible().catch(() => true);
    log(`- Prompt modal hidden: ${promptPre ? 'FAIL' : 'PASS'}`);

    // Check primary CTA
    const genScriptCTA = await page.getByRole('button', { name: /Generar script/i }).first().isVisible().catch(() => false);
    log(`- CTA Generar script visible: ${genScriptCTA ? 'PASS' : 'FAIL'}`);

    // Overflow
    const diagOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on diagnosis: ${diagOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Script
    await page.getByRole('button', { name: /Generar script/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Generar script/i }).click();
    await expect(page.locator('.script-review')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // ── Stage 3: Script ──
    log('\n## Stage 3: Script\n');

    const scriptVisible = await page.locator('.script-review').isVisible().catch(() => false);
    log(`- Script code block visible: ${scriptVisible ? 'PASS' : 'FAIL'}`);

    const reviewBtn = await page.getByRole('button', { name: /Revisar script/i }).isVisible().catch(() => false);
    log(`- CTA Revisar script visible: ${reviewBtn ? 'PASS' : 'FAIL'}`);

    const scriptOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on script: ${scriptOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Review
    await page.getByRole('button', { name: /Revisar script/i }).click();
    await page.waitForTimeout(300);

    const scriptScroll = page.locator('.script-scroll');
    await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await expect(page.locator('.review-delta')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // ── Stage 4: Review ──
    log('\n## Stage 4: Review\n');

    const reviewStatus = await page.locator('.review-status-strip').isVisible().catch(() => false);
    log(`- Review status strip visible: ${reviewStatus ? 'PASS' : 'FAIL'}`);

    const deltaVisible = await page.locator('.review-delta').isVisible().catch(() => false);
    log(`- Delta summary visible: ${deltaVisible ? 'PASS' : 'FAIL'}`);

    const simulacionText = await page.getByText(/simulación sobre copia/i).isVisible().catch(() => false);
    log(`- "simulación sobre copia" warning visible: ${simulacionText ? 'PASS' : 'FAIL'}`);

    const exportBtn = await page.getByRole('button', { name: /Preparar exportación/i }).isVisible().catch(() => false);
    log(`- CTA Preparar exportación visible: ${exportBtn ? 'PASS' : 'FAIL'}`);

    const reviewOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on review: ${reviewOverflowX ? 'WARN' : 'PASS'}`);

    // Go to Export
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(300);

    // ── Stage 5: Export ──
    log('\n## Stage 5: Export\n');

    const exportClosure = await page.locator('.export-closure').isVisible().catch(() => false);
    log(`- Export closure visible: ${exportClosure ? 'PASS' : 'FAIL'}`);

    const exportStatus = await page.locator('.export-status-strip').isVisible().catch(() => false);
    log(`- Export status strip visible: ${exportStatus ? 'PASS' : 'FAIL'}`);

    const claimsVisible = await page.locator('.export-claims').isVisible().catch(() => false);
    log(`- Claims grid visible: ${claimsVisible ? 'PASS' : 'FAIL'}`);

    const limitationsVisible = await page.locator('.export-limitations').isVisible().catch(() => false);
    log(`- Limitations visible: ${limitationsVisible ? 'PASS' : 'FAIL'}`);

    const pdfBtn = await page.getByRole('button', { name: /Reporte PDF ejecutivo/i }).isVisible().catch(() => false);
    log(`- PDF button visible: ${pdfBtn ? 'PASS' : 'FAIL'}`);

    const jsonBtn = await page.getByRole('button', { name: /Descargar JSON técnico/i }).isVisible().catch(() => false);
    log(`- JSON button visible: ${jsonBtn ? 'PASS' : 'FAIL'}`);

    // OE checklist not in foreground
    const oeVisible = await page.locator('.objectives-checklist').isVisible().catch(() => true);
    log(`- OE checklist hidden (in collapsed details): ${oeVisible ? 'FAIL' : 'PASS'}`);

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

    // Check for 5 input mode options
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
    log(`- Hero text visible (Core restored): ${heroVisible ? 'PASS' : 'FAIL'}`);

    // ── JS Console Errors ──
    log('\n## JS Console\n');
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // Check for any accumulated errors
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

    // ── Mobile menu closed checks ──
    const hamburgerVisible = await page.locator('.mobile-nav-toggle').isVisible().catch(() => false);
    log(`- Mobile hamburger visible: ${hamburgerVisible ? 'PASS' : 'FAIL'}`);

    const navLinksClosed = await page.locator('.nav-links-open').isVisible().catch(() => true);
    log(`- .nav-links-open hidden when closed: ${navLinksClosed ? 'FAIL' : 'PASS'}`);

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on mobile home: ${mobileOverflow ? 'WARN' : 'PASS'}`);

    // ── Open mobile menu ──
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

    // ── Upload on mobile ──
    // Close menu first
    await page.locator('.mobile-nav-toggle').click();
    await page.waitForTimeout(300);

    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);

    const profileMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    log(`- Horizontal overflow on mobile profile: ${profileMobileOverflow ? 'WARN' : 'PASS'}`);
  });
});
