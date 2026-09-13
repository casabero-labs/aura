import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');

describe('Casabero Editorial source audit', () => {
  it('passes without legacy visual selectors or new un-tokenized UI literals', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-editorial-ui.mjs'], {
      cwd: srcRoot,
      encoding: 'utf8',
    });

    expect(output).toMatch(/AUDIT PASS/);
  });
});
