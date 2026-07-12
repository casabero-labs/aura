#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalJson = (value) => {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return 'null';
};

const args = process.argv.slice(2);
const arg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const bundlePath = arg('--bundle');
const inputPath = arg('--input');
const outputPath = arg('--output');
const receiptPath = arg('--receipt');
const python = arg('--python') ?? 'python3';
if (!bundlePath || !inputPath || !outputPath || !receiptPath) {
  process.stderr.write('Uso: node run-python-representative.mjs --bundle bundle.json --input source.csv --output result.csv --receipt receipt.json [--python python3]\n');
  process.exit(2);
}

const absolute = (path) => resolve(process.cwd(), path);
const bundle = JSON.parse(await readFile(absolute(bundlePath), 'utf8'));
const beforeBytes = await readFile(absolute(inputPath));
if (bundle.contractId !== 'aura.python-execution-bundle.v1' || bundle.contractVersion !== '1.0.0') {
  throw new Error('Bundle de ejecución AURA inválido.');
}
if (sha256(bundle.scriptText) !== bundle.scriptTextSha256) throw new Error('El texto del script no coincide con el bundle.');
if (bundle.scriptHashPayload?.scriptText !== bundle.scriptText) throw new Error('El payload del script no coincide con su texto.');
if (sha256(canonicalJson(bundle.scriptHashPayload)) !== bundle.approvedScriptHash) throw new Error('El hash del contrato aprobado no coincide con el bundle.');
if (sha256(beforeBytes) !== bundle.beforeDatasetSha256) throw new Error('El CSV fuente no coincide con el hash congelado.');

const workDir = await mkdtemp(join(tmpdir(), 'aura-python-representative-'));
const scriptPath = join(workDir, 'approved_script.py');
const metadataPath = join(workDir, 'output-metadata.json');
await writeFile(scriptPath, bundle.scriptText, 'utf8');

let pythonVersion = 'unknown';
let pandasVersion = null;
let platform = 'unknown';
try {
  const environment = await exec(python, ['-c', 'import json,platform,sys; import pandas; print(json.dumps({"python":sys.version.split()[0],"pandas":pandas.__version__,"platform":platform.platform()}))']);
  const parsed = JSON.parse(environment.stdout.trim());
  pythonVersion = parsed.python;
  pandasVersion = parsed.pandas;
  platform = parsed.platform;
} catch (error) {
  pythonVersion = error?.code === 'ENOENT' ? 'unavailable' : 'unknown';
}

let syntax = { status: 'passed', error: null };
let executionStatus = 'failed';
let executionError = null;
let stdout = '';
let stderr = '';
let output = null;
let afterDatasetSha256 = null;
const startedAt = new Date().toISOString();
const startedMs = Date.now();

try {
  await exec(python, ['-m', 'py_compile', scriptPath], { timeout: 30_000 });
} catch (error) {
  syntax = { status: 'failed', error: String(error?.stderr || error?.message || error) };
  executionError = 'La ejecución no comenzó porque falló la compilación Python.';
  stderr = syntax.error;
}

if (syntax.status === 'passed') {
  const wrapper = [
    'import importlib.util,json,pandas as pd,sys',
    'script_path,input_path,output_path,metadata_path=sys.argv[1:5]',
    'spec=importlib.util.spec_from_file_location("aura_approved_script",script_path)',
    'module=importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'source=pd.read_csv(input_path)',
    'result=module.clean_dataset(source.copy(deep=True))',
    'assert isinstance(result,pd.DataFrame), "clean_dataset must return a pandas DataFrame"',
    'result.to_csv(output_path,index=False,lineterminator="\\n")',
    'open(metadata_path,"w",encoding="utf-8").write(json.dumps({"rowCount":int(result.shape[0]),"columnCount":int(result.shape[1])}))',
  ].join(';');
  try {
    const result = await exec(python, ['-c', wrapper, scriptPath, absolute(inputPath), absolute(outputPath), metadataPath], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
    output = JSON.parse(await readFile(metadataPath, 'utf8'));
    afterDatasetSha256 = sha256(await readFile(absolute(outputPath)));
    executionStatus = 'passed';
  } catch (error) {
    stdout = String(error?.stdout ?? '');
    stderr = String(error?.stderr ?? '');
    executionError = String(error?.message ?? error);
  }
}

const completedAt = new Date().toISOString();
const payload = {
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: bundle.runId,
  approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256,
  pythonVersion,
  pandasVersion,
  platform,
  syntax,
  execution: {
    status: executionStatus,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.now() - startedMs),
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    error: executionStatus === 'passed' ? null : executionError,
  },
  output,
};
const receipt = { ...payload, receiptHash: sha256(canonicalJson(payload)) };
await writeFile(absolute(receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
await rm(workDir, { recursive: true, force: true });

process.stdout.write(`${executionStatus === 'passed' ? 'OK' : 'FAILED'} ${basename(receiptPath)} ${receipt.receiptHash}\n`);
if (executionStatus !== 'passed') process.exitCode = 1;
