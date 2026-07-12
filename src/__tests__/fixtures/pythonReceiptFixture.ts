import { sha256hex } from '../../contracts/llm/hash';
import {
  buildPythonExecutionReceipt,
  type PythonExecutionReceiptV1,
} from '../../services/benchmark/pythonExecutionReceipt';

export const createPythonReceiptFixture = (input: {
  runId: string;
  approvedScriptHash: string;
  scriptText?: string;
  beforeDatasetSha256: string;
  afterDatasetSha256?: string;
  completedAt?: string;
}): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: input.runId,
  approvedScriptHash: input.approvedScriptHash,
  scriptTextSha256: sha256hex(input.scriptText ?? 'def clean_dataset(df):\n    return df\n'),
  beforeDatasetSha256: input.beforeDatasetSha256,
  afterDatasetSha256: input.afterDatasetSha256 ?? 'b'.repeat(64),
  pythonVersion: '3.12.1',
  pandasVersion: '2.2.0',
  platform: 'test-platform',
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed',
    startedAt: '2026-07-11T12:00:00.000Z',
    completedAt: input.completedAt ?? '2026-07-11T12:00:01.000Z',
    durationMs: 1000,
    stdoutSha256: sha256hex(''),
    stderrSha256: sha256hex(''),
    error: null,
  },
  output: { rowCount: 50, columnCount: 15 },
});

