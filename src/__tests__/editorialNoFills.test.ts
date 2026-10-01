/**
 * Sin rellenos tintados (decisión 2026-10-01, docs/plans/2026-10-01-aura-sin-rellenos.md).
 *
 * Editorial en AURA no admite superficies grises: el fondo es siempre el
 * lienzo, la estructura se marca con filete y el estado con texto y peso.
 *
 * 1. Los tokens de superficie resuelven al lienzo y los tintes de estado son
 *    transparentes, en claro y en oscuro.
 * 2. Trinquete de rellenos literales en CSS y en `style` inline de TSX: el
 *    presupuesto solo puede bajar y llega a 0 al cerrar la fase 2 del plan.
 *    Las hojas Editoriales (`styles/editorial-*.css`) ya deben estar limpias.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(SRC, file), 'utf-8');

/** Fase 2 cerrada el 2026-10-01: 0 rellenos heredados. No subir. */
const LEGACY_FILL_BUDGET = 0;

const NEUTRAL_VARS = new Set([
  'bg', 'canvas', 'editorial-canvas',
  // Neutralizados por el test de tokens: resuelven al lienzo o a transparent.
  'surface', 'surface2', 'surface-raised', 'surface-hover',
  'editorial-surface', 'editorial-surface-quiet',
  'green-bg', 'warning-bg', 'error-bg', 'error-surface', 'code-bg',
]);
// Tinta: inversión de botones, progreso, interruptor y marcas de selección.
const INK_VARS = new Set(['ink', 'editorial-ink']);
// Color de línea solo como filete (elemento de 0.5 a 2 px).
const LINE_VARS = new Set([
  'border', 'border-strong', 'border-faint', 'line',
  'editorial-line', 'editorial-line-soft', 'editorial-line-strong', 'ink-faint',
]);
const KEYWORDS = new Set(['transparent', 'none', 'inherit', 'initial', 'unset', 'currentcolor']);
const SCRIM_SELECTOR = /overlay|backdrop|scrim|\.prompt-modal(?![\w-])/i;
// Filete: elemento de 0.5–2 px. Las rejillas con gap sobre fondo de línea no
// cuentan: una fila incompleta deja un bloque gris.
const HAIRLINE = /\b(height|width|min-height|block-size|inline-size)\s*:\s*(0\.5|1|1\.5|2)px/;
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\bcolor-mix\(|\b(white|black|gray|grey|silver|whitesmoke|gainsboro)\b/i;

type Fill = { where: string; selector: string; value: string };

const isAllowedFill = (value: string, selector: string, ruleBody: string): boolean => {
  const v = value.trim().toLowerCase();
  if (KEYWORDS.has(v)) return true;
  if (SCRIM_SELECTOR.test(selector)) return true;
  const withoutVars = v.replace(/var\(--[a-z0-9-]+(?:\s*,[^)]*)?\)/g, '');
  if (LITERAL_COLOR.test(withoutVars)) return false;
  const vars = [...v.matchAll(/var\(--([a-z0-9-]+)/g)].map(m => m[1]);
  return vars.every(name => (
    NEUTRAL_VARS.has(name)
    || INK_VARS.has(name)
    || (LINE_VARS.has(name) && HAIRLINE.test(ruleBody))
  ));
};

const cssFiles = () => [
  'index.css',
  ...fs.readdirSync(path.join(SRC, 'styles')).filter(f => f.endsWith('.css')).map(f => `styles/${f}`),
].filter(f => !f.endsWith('casabero-editorial.tokens.css'));

const cssFills = (file: string): Fill[] => {
  const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
  const fills: Fill[] = [];
  for (const [, rawSelector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.trim();
    if (selector.startsWith('@') || /^(from|to|\d+%)/.test(selector)) continue;
    for (const [, value] of body.matchAll(/(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/g)) {
      if (!isAllowedFill(value, selector, body)) fills.push({ where: file, selector, value: value.trim() });
    }
  }
  return fills;
};

const tsxFiles = (dir: string): string[] => fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap(entry => {
  const rel = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return tsxFiles(rel);
  return entry.name.endsWith('.tsx') ? [rel] : [];
});

const inlineFills = (): Fill[] => ['App.tsx', ...tsxFiles('components')].flatMap(file => (
  [...read(file).matchAll(/background(?:Color)?\s*:\s*(['"`])(.*?)\1/g)]
    .filter(([, , value]) => !isAllowedFill(value, '', ''))
    .map(([, , value]) => ({ where: file, selector: 'style', value }))
));

const tokenBlock = (selector: string): Record<string, string> => {
  const css = read('styles/casabero-editorial.tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf(`${selector} {`);
  expect(start, `bloque ${selector}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
};

const resolve = (tokens: Record<string, string>, name: string): string => {
  let value = tokens[name];
  for (let hops = 0; value && hops < 10; hops += 1) {
    const ref = value.match(/^var\((--[a-z0-9-]+)\)$/);
    if (!ref || !tokens[ref[1]]) break;
    value = tokens[ref[1]];
  }
  return value;
};

describe('Editorial sin rellenos tintados', () => {
  const light = tokenBlock('[data-casabero-theme="editorial"]');
  const dark = { ...light, ...tokenBlock('[data-casabero-theme="editorial"][data-theme="dark"]') };

  it.each([['claro', light], ['oscuro', dark]] as const)('las superficies resuelven al lienzo (%s)', (_mode, tokens) => {
    const canvas = tokens['--editorial-canvas'];
    for (const name of ['--editorial-surface', '--editorial-surface-quiet', '--surface', '--surface2', '--surface-raised', '--surface-hover', '--error-surface', '--code-bg']) {
      expect(resolve(tokens, name), name).toBe(canvas);
    }
    for (const name of ['--green-bg', '--warning-bg', '--error-bg']) {
      expect(resolve(tokens, name), name).toBe('transparent');
    }
  });

  it('las hojas Editoriales no añaden rellenos', () => {
    const editorial = cssFiles().filter(f => f.startsWith('styles/')).flatMap(cssFills);
    expect(editorial).toEqual([]);
  });

  it('los rellenos heredados no superan el presupuesto (solo puede bajar)', () => {
    const legacy = [...cssFills('index.css'), ...inlineFills()];
    const report = legacy.map(f => `${f.where} · ${f.selector} → ${f.value}`).join('\n');
    expect(legacy.length, `Rellenos fuera de contrato:\n${report}`).toBeLessThanOrEqual(LEGACY_FILL_BUDGET);
  });
});
