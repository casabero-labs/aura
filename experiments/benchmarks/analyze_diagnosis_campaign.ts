import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildDiagnosisCampaignBaseline,
  type DiagnosisCampaignArtifactLike,
} from '../../src/services/benchmark/diagnosisCampaignBaseline';

const main = async (): Promise<void> => {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    throw new Error(
      'Usage: npx tsx experiments/benchmarks/analyze_diagnosis_campaign.ts <campaign.json> [baseline.json]',
    );
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const artifact = JSON.parse(await readFile(inputPath, 'utf8')) as DiagnosisCampaignArtifactLike;
  const baseline = buildDiagnosisCampaignBaseline(artifact);
  const serialized = `${JSON.stringify(baseline, null, 2)}\n`;

  if (outputArg) {
    const outputPath = resolve(process.cwd(), outputArg);
    await writeFile(outputPath, serialized, 'utf8');
    process.stdout.write(`${outputPath}\n`);
  } else {
    process.stdout.write(serialized);
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
