/**
 * Sin rellenos tintados — Fase 4 (docs/plans/2026-10-01-aura-sin-rellenos.md).
 *
 * Barrido de estilos calculados: recorre las vistas de los recorridos en claro
 * y oscuro, a 390 y 1280 px, y exige que ningún elemento visible pinte un fondo
 * distinto del lienzo. `editorialNoFills.test.ts` vigila el CSS fuente; este
 * spec vigila lo que el navegador termina pintando (Tailwind, inline, cascada).
 *
 * Excepciones del contrato: filetes (≤ 2 px), velo de diálogos, tinta en
 * controles (progreso, interruptor, marcas de radio y casilla, botones).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import { AURA_EXPERIMENT_DATABASE_NAME } from '../../services/benchmark/indexedDbExperimentStore';
import { OE4_MODELS } from '../../services/benchmark/finalEvaluationProtocol';

const here = path.dirname(fileURLToPath(import.meta.url));
const validCsv = path.join(here, 'fixtures', 'titanic-mini.csv');

const THEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

type Violation = { view: string; node: string; size: string; background: string };

async function sweep(page: Page, view: string): Promise<Violation[]> {
  await page.waitForTimeout(350); // deja terminar transiciones de 280 ms
  const found = await page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean);
      return { r: +r, g: +g, b: +b, a: +a };
    };
    const probe = (token: string) => {
      const el = document.createElement('div');
      el.style.color = `var(${token})`;
      document.body.appendChild(el);
      const c = parse(getComputedStyle(el).color);
      el.remove();
      return c;
    };
    const canvas = parse(getComputedStyle(document.body).backgroundColor) ?? probe('--bg');
    const ink = probe('--ink');
    const same = (a: ReturnType<typeof parse>, b: ReturnType<typeof parse>) =>
      !!a && !!b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) <= 6;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const INK_CONTROL = 'a, button, [role="button"], [role="progressbar"], [role="switch"], [role="radio"], [role="checkbox"], input, label, progress, summary, [class*="progress"], [class*="switch"], [class*="radio"], [class*="check"]';

    const describe = (el: Element, pseudo: string) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${id ? `[data-testid=${id}]` : ''}${cls ? `.${cls}` : ''}${pseudo}`;
    };

    const out: { node: string; size: string; background: string }[] = [];
    const check = (el: Element, pseudo: '' | '::before' | '::after') => {
      const s = getComputedStyle(el, pseudo || undefined);
      if (pseudo && (s.content === 'none' || s.content === 'normal')) return;
      if (s.display === 'none' || s.visibility === 'hidden') return;
      const bg = parse(s.backgroundColor);
      const image = s.backgroundImage;
      const hasImage = image && image !== 'none' && !/^url\(/.test(image);
      if ((!bg || bg.a === 0) && !hasImage) return;

      let w: number;
      let h: number;
      if (pseudo) {
        w = parseFloat(s.width) || 0;
        h = parseFloat(s.height) || 0;
      } else {
        const r = el.getBoundingClientRect();
        w = r.width;
        h = r.height;
        if (w === 0 || h === 0) return;
      }
      if (pseudo && (w === 0 || h === 0)) return;
      // Filete: elemento de 0.5–2 px.
      if (Math.min(w, h) <= 2) return;
      const inkControl = el.matches(INK_CONTROL) || !!el.closest('[role="progressbar"], [role="switch"], [role="radiogroup"]');
      if (!hasImage) {
        if (same(bg, canvas)) return;
        // Velo de diálogo: fijo y cubriendo el viewport.
        if (s.position === 'fixed' && w >= vw * 0.9 && h >= vh * 0.9 && bg!.a < 1) return;
        // Tinta: inversión de controles, y marcas de 12 px o menos
        // (puntos de paso, barras de datos, progreso).
        if (same(bg, ink) && (inkControl || Math.min(w, h) <= 12)) return;
      } else if (inkControl) {
        // Marca de radio o casilla dibujada con gradiente de tinta y lienzo.
        const stops = [...image.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]));
        if (stops.length && stops.every((c) => same(c, ink) || same(c, canvas) || same(c, { r: 0, g: 0, b: 0, a: 1 }) || same(c, { r: 255, g: 255, b: 255, a: 1 }))) return;
      }
      out.push({ node: describe(el, pseudo), size: `${Math.round(w)}×${Math.round(h)}`, background: hasImage ? image : s.backgroundColor });
    };

    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (el.closest('[aria-hidden="true"]') && el.tagName.toLowerCase() === 'svg') continue;
      check(el, '');
      check(el, '::before');
      check(el, '::after');
    }
    return out;
  });
  return found.map((f) => ({ view, ...f }));
}

async function openSettings(page: Page, label: string) {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await nav.getByRole('button', { name: 'Configuración' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByTestId('settings-view')).toBeVisible();
}

async function goHome(page: Page) {
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Ir al inicio' }).click();
}

async function setPipelineState(page: Page, state: string) {
  await page.evaluate((st) => { (window as any).__PHASE4_SET_STATE__(st); }, state);
  await page.waitForTimeout(600);
}

async function injectDiagnosis(page: Page) {
  await page.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
  const fingerprint: string | null = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint ?? null);
  expect(fingerprint).toBeTruthy();
  const { diagnosis, plan } = buildPhase4TitanicFixture(fingerprint!);
  await page.evaluate(([d, p]) => {
    (window as any).__PHASE4_INJECT__(d, p, { analysisText: 'Diagnóstico E2E — Titanic mini' });
  }, [diagnosis, plan] as const);
  await page.waitForTimeout(800);
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`sin rellenos — ${theme} ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(viewport);
      await page.addInitScript((t) => { localStorage.setItem('aura_theme', t); }, theme);
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const violations: Violation[] = [];
      const visit = async (view: string) => { violations.push(...await sweep(page, view)); };

      // J01 Inicio y carga.
      await visit('inicio');
      for (const label of ['General', 'IA y proveedores', 'Evidencia', 'Privacidad y datos', 'Diagnóstico avanzado']) {
        await openSettings(page, label);
        await visit(`configuración · ${label}`);
      }
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Ayuda' }).click();
      await visit('ayuda');
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Laboratorio' }).click();
      await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible({ timeout: 15_000 });
      await visit('laboratorio · insumos');
      await goHome(page);

      await page.getByRole('button', { name: 'Empezar auditoría' }).click();
      await expect(page.getByRole('heading', { name: 'Cargar CSV' })).toBeVisible();
      await visit('auditoría · cargar');
      await page.getByTestId('csv-file-input').setInputFiles(path.join(here, 'editorial-no-fills.spec.ts'));
      await expect(page.getByRole('alert')).toContainText('.csv');
      await visit('auditoría · error de carga (J02)');

      // J03 perfil.
      await page.getByTestId('csv-file-input').setInputFiles(validCsv);
      await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
      await visit('perfil (J03)');

      // J04 diagnóstico y drawer.
      await page.getByTestId('profile-continue-diagnosis').click();
      await expect(page.getByTestId('diagnosis-hero-panel')).toBeVisible();
      await visit('diagnóstico (J04)');
      await page.getByTestId('diagnosis-config-toggle').click();
      await expect(page.getByTestId('diagnosis-quick-config-modal')).toBeVisible();
      await visit('diagnóstico · drawer');
      await page.getByRole('button', { name: 'Cancelar' }).click();

      // J07 informe determinista y exportación.
      await page.getByRole('button', { name: /informe determinista|Continuar sin diagnóstico/i }).first().click();
      await expect(page.getByTestId('diagnostic-report-executive-summary')).toBeVisible({ timeout: 20_000 });
      await visit('informe determinista (J07)');
      await page.getByTestId('diagnostic-report-export-main').click();
      await expect(page.getByTestId('export-stage')).toBeVisible();
      await visit('exportación');

      // J15 diálogo de nuevo análisis.
      await page.getByTestId('nav-new-analysis').click();
      await expect(page.getByTestId('new-analysis-dialog')).toBeVisible();
      await visit('nuevo análisis · diálogo (J15)');
      await page.getByRole('button', { name: 'Cancelar' }).click();

      // Rama de corrección (J08–J10) con diagnóstico inyectado por el harness,
      // sobre una carga nueva: Exportación no monta el harness.
      await page.evaluate(() => localStorage.removeItem('aura_pipeline_session_v1'));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Empezar auditoría' }).click();
      await page.getByTestId('csv-file-input').setInputFiles(validCsv);
      await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
      await setPipelineState(page, 'diagnosis');
      await injectDiagnosis(page);
      for (const [state, testId] of [
        ['diagnostic_report', 'diagnostic-report-stage'],
        ['script', 'remediation-stage'],
        ['review', 'review-stage'],
        ['execution', 'apply-verify-step'],
      ] as const) {
        await setPipelineState(page, state);
        await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 15_000 });
        await visit(`corrección · ${state}`);
      }

      // J17 standalone de Ollama.
      await page.goto('/?view=ollama-setup', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('ollama-standalone-view')).toBeVisible();
      await visit('ollama standalone (J17)');

      const unique = new Map<string, Violation>();
      for (const v of violations) unique.set(`${v.node}|${v.background}`, v);
      const report = [...unique.values()].map((v) => `${v.view} → ${v.node} ${v.size} ${v.background}`);
      expect(report, `Rellenos fuera del contrato (${theme}, ${viewport.width}px)`).toEqual([]);
    });
  }
}

// J12–J13 Laboratorio con campaña controlada: el harness OE4 simula las
// corridas; aquí solo se simula el catálogo de Ollama para habilitar la creación.
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`sin rellenos — Laboratorio ${theme} ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(viewport);
      await page.addInitScript((t) => { localStorage.setItem('aura_theme', t); }, theme);
      await page.route('**/api/tags', (route) => route.fulfill({
        json: { models: OE4_MODELS.map((name) => ({ name, model: name, size: 1, digest: name, modified_at: '2026-07-11T18:00:00.000Z' })) },
      }));
      await page.goto('/');
      await page.evaluate(async (databaseName) => {
        localStorage.removeItem('aura_oe4_e2e_first_call_released');
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(databaseName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        });
      }, AURA_EXPERIMENT_DATABASE_NAME);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const violations: Violation[] = [];
      const visit = async (view: string) => { violations.push(...await sweep(page, view)); };

      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Laboratorio' }).click();
      await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Crear experimento' }).click();
      await expect(page.getByText('25 / 27')).toBeVisible();
      await visit('laboratorio · campaña creada');

      await page.getByRole('button', { name: 'Reanudar experimento' }).click();
      await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);
      await visit('laboratorio · corrida en curso');
      await page.evaluate(() => window.__OE4_E2E_RELEASE__?.());
      await expect(page.getByText('27 / 27')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('heading', { name: 'Reporte listo' })).toBeVisible();
      await visit('laboratorio · reporte y matriz');

      await page.getByRole('button', { name: 'Visualizar resultados', exact: true }).click();
      await expect(page.getByTestId('oe4-results-chart-overview')).toBeVisible();
      await visit('laboratorio · resultados · panorama');
      await page.getByRole('tab', { name: 'Dimensiones' }).click();
      await expect(page.getByTestId('oe4-results-chart-dimensions')).toBeVisible();
      await visit('laboratorio · resultados · dimensiones');
      await page.getByRole('tab', { name: 'Calidad y velocidad' }).click();
      await expect(page.getByTestId('oe4-results-chart-quality_speed')).toBeVisible();
      await visit('laboratorio · resultados · calidad y velocidad');

      const unique = new Map<string, Violation>();
      for (const v of violations) unique.set(`${v.node}|${v.background}`, v);
      const report = [...unique.values()].map((v) => `${v.view} → ${v.node} ${v.size} ${v.background}`);
      expect(report, `Rellenos fuera del contrato en Laboratorio (${theme}, ${viewport.width}px)`).toEqual([]);
    });
  }
}
