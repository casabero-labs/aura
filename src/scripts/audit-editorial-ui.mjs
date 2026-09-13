#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(srcRoot, '..');

const forbidden = [
  /editorial-pilot/,
  /showcase-ink/i,
  /Playfair Display/,
  /JetBrains Mono/,
  /--font-serif:\s*"?Inter/i,
  /\[data-theme=["']dark["']\]/,
];

const uiRoots = [
  'App.tsx',
  'index.tsx',
  'index.html',
  'index.css',
  'components',
  'services',
  'styles',
];

const sourceExtensions = new Set(['.css', '.html', '.mjs', '.ts', '.tsx']);

function collectFiles(relativePath) {
  const absolutePath = path.join(srcRoot, relativePath);
  if (!existsSync(absolutePath)) return [];
  const info = statSync(absolutePath);
  if (info.isFile()) return [absolutePath];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return collectFiles(child);
    return sourceExtensions.has(path.extname(entry.name)) ? [path.join(srcRoot, child)] : [];
  });
}
function lineNumber(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function relativeSourcePath(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

const files = [...new Set(uiRoots.flatMap(collectFiles))].sort();
const forbiddenFindings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    const match = pattern.exec(text);
    if (match) {
      forbiddenFindings.push(`${relativeSourcePath(file)}:${lineNumber(text, match.index)} ${pattern}`);
    }
  }
}

const inlineFindings = [];
const colorFindings = [];
const editorialTokenFiles = new Set([
  'src/styles/editorial-tokens.css',
  'src/services/editorialArtifactTheme.ts',
]);
const diffTargets = [
  'src/App.tsx',
  'src/index.tsx',
  'src/index.html',
  'src/index.css',
  'src/components',
  'src/services',
  'src/styles',
];

let diff = '';
try {
  diff = execFileSync('git', ['-C', repoRoot, 'diff', '--unified=0', '--', ...diffTargets], { encoding: 'utf8' });
} catch {
  diff = '';
}

let currentFile = '';
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice('+++ b/'.length);
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const added = line.slice(1);

  if (/style=\{\{/.test(added)) {
    const dynamicOnly = /\b(?:display|width|height|opacity|--[a-z0-9-]+)\s*:/.test(added);
    if (!dynamicOnly) inlineFindings.push(`${currentFile}: inline style requires a semantic class`);
  }

  const hasColorLiteral = /#[0-9a-f]{3,8}\b|\brgba?\(/i.test(added);
  if (!hasColorLiteral || editorialTokenFiles.has(currentFile)) continue;
  const isCompatibilityToken = currentFile === 'src/index.css' && /^\s*--[a-z0-9-]+\s*:/.test(added);
  const isSemanticReference = /var\(--|EDITORIAL_ARTIFACT_THEME|color-mix\(/.test(added);
  if (!isCompatibilityToken && !isSemanticReference) {
    colorFindings.push(`${currentFile}: new visual literal requires Editorial token`);
  }
}

const findings = [...forbiddenFindings, ...inlineFindings, ...colorFindings];
console.log(`Editorial source audit: ${files.length} UI source files scanned`);
if (forbiddenFindings.length) {
  console.log('Forbidden legacy references:');
  forbiddenFindings.forEach((finding) => console.log(`- ${finding}`));
}
if (inlineFindings.length) {
  console.log('New static inline styles:');
  inlineFindings.forEach((finding) => console.log(`- ${finding}`));
}
if (colorFindings.length) {
  console.log('New un-tokenized visual literals:');
  colorFindings.forEach((finding) => console.log(`- ${finding}`));
}

if (findings.length > 0) {
  console.log(`AUDIT FAIL: ${findings.length} finding(s)`);
  process.exitCode = 1;
} else {
  console.log('AUDIT PASS: legacy visual selectors are absent and new UI literals are tokenized.');
}
