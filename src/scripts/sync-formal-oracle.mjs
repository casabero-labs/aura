import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsDir, '..', '..');
const canonical = resolve(
  repoRoot,
  'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json',
);
const deployable = resolve(
  repoRoot,
  'src/services/benchmark/oracles/diagnostic-oracle.v1.json',
);

await mkdir(dirname(deployable), { recursive: true });
await copyFile(canonical, deployable);
console.log(`Oracle desplegable sincronizado: ${deployable}`);
