import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// AURA es local-first: la configuración de IA no se sincroniza con un servidor
// compartido. El cliente services/api se retiró por completo; si alguien
// reintroduce la sincronización, estos tests lo señalan.
const SRC = resolve(__dirname, '..');

const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__' || entry.startsWith('.')) return [];
  const path = join(dir, entry);
  if (statSync(path).isDirectory()) return sourceFiles(path);
  return /\.(ts|tsx)$/.test(entry) ? [path] : [];
});

describe('local-first: sin cliente de API de configuración', () => {
  it('services/api ya no existe', () => {
    expect(existsSync(join(SRC, 'services/api.ts'))).toBe(false);
  });

  it('ningún módulo importa services/api ni sincroniza la configuración', () => {
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"][./]*(?:services\/)?api['"]/);
      expect(source, file).not.toMatch(/loadFromApi|syncToApi/);
    }
  });

  it('Privacidad no afirma que las preferencias se sincronizan con una API', () => {
    const privacy = readFileSync(join(SRC, 'components/settings/PrivacySection.tsx'), 'utf8');
    expect(privacy).not.toMatch(/api\.available|Se sincronizan con la API/);
  });
});
