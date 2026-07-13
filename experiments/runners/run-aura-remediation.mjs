#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { access, constants, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;
const ENVELOPE_REF = /^env:[a-f0-9]{64}$/;
const SYNTAX_TIMEOUT_MS = 30_000;
const EXECUTION_TIMEOUT_MS = 120_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

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

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const usage = (commandName) => `Uso: node ${commandName} --bundle execution-bundle.json --input source.csv --output corrected.csv --receipt receipt.json [--python python3]\n`;

const parseArguments = (args) => {
  const values = new Map();
  const allowed = new Set(['--bundle', '--input', '--output', '--receipt', '--python']);
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || value === undefined || value.startsWith('--')) return null;
    values.set(name, value);
  }
  const bundle = values.get('--bundle');
  const input = values.get('--input');
  const output = values.get('--output');
  const receipt = values.get('--receipt');
  if (!bundle || !input || !output || !receipt) return null;
  return { bundle, input, output, receipt, python: values.get('--python') ?? 'python3' };
};

const safeRealpath = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const safeStat = (path) => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};

const isWithin = (candidate, parent) => {
  if (candidate === parent) return true;
  const prefix = parent.endsWith(sep) ? parent : parent + sep;
  return candidate.startsWith(prefix);
};

const resolveIdentity = (path) => {
  const stat = safeStat(path);
  if (!stat) return { path, realPath: null, exists: false, isSymlink: false, dir: dirname(path), parentReal: null };
  const realPath = stat.isSymbolicLink() ? realpathSync(path) : path;
  const parentReal = safeRealpath(dirname(path));
  return {
    path,
    realPath,
    exists: true,
    isSymlink: stat.isSymbolicLink(),
    dir: dirname(path),
    parentReal,
  };
};

const ensureParentWritable = async (path) => {
  const parent = dirname(path);
  try {
    await access(parent, constants.W_OK);
  } catch {
    throw new Error(`El directorio padre de ${path} no existe o no es accesible.`);
  }
  const stat = safeStat(path);
  if (stat) {
    if (stat.isSymbolicLink()) throw new Error(`La ruta ${path} no puede ser un symlink preexistente.`);
    try {
      await access(path, constants.W_OK);
    } catch {
      throw new Error(`El archivo existente ${path} no es escribible; no se sobreescribirá.`);
    }
  }
};

const validateArtifactPaths = async (paths) => {
  if (paths.bundle === paths.input
    || paths.bundle === paths.output
    || paths.bundle === paths.receipt
    || paths.input === paths.output
    || paths.input === paths.receipt
    || paths.output === paths.receipt) {
    throw new Error('Las rutas de bundle, fuente, salida y recibo deben ser diferentes.');
  }
  const bundle = resolveIdentity(paths.bundle);
  const input = resolveIdentity(paths.input);
  const output = resolveIdentity(paths.output);
  const receipt = resolveIdentity(paths.receipt);

  if (!bundle.exists || !bundle.realPath) throw new Error('El bundle no existe.');
  if (!input.exists || !input.realPath) throw new Error('El CSV fuente no existe.');

  for (const target of [output, receipt]) {
    if (target.realPath && (target.realPath === bundle.realPath || target.realPath === input.realPath)) {
      throw new Error('Las rutas de bundle, fuente, salida y recibo deben ser archivos distintos por identidad real.');
    }
    if (target.isSymlink) {
      throw new Error('La ruta de salida o recibo no puede ser un symlink preexistente.');
    }
  }

  await ensureParentWritable(paths.output);
  await ensureParentWritable(paths.receipt);
};

const computeBundleHash = (bundle) => {
  const { bundleHash: _bundleHash, ...rest } = bundle;
  return sha256(canonicalJson(rest));
};

const validateBundle = (bundle) => {
  if (!isRecord(bundle)) throw new Error('El bundle de ejecución debe ser un objeto JSON.');
  if (bundle.contractId !== 'aura.python-execution-bundle.v1' || bundle.contractVersion !== '1.0.0') {
    throw new Error('Bundle de ejecución AURA inválido.');
  }
  if (typeof bundle.runId !== 'string' || !bundle.runId.trim()) throw new Error('El bundle no contiene un ID de ejecución.');
  if (bundle.executionId !== undefined && bundle.executionId !== bundle.runId) throw new Error('El ID neutral no coincide con el ID histórico.');
  if (Number.isNaN(Date.parse(bundle.generatedAt))) throw new Error('La fecha del bundle es inválida.');
  if (!SHA256.test(bundle.approvedScriptHash)) throw new Error('El hash aprobado del bundle es inválido.');
  if (!SHA256.test(bundle.scriptTextSha256)) throw new Error('El hash del texto del script es inválido.');
  if (!SHA256.test(bundle.beforeDatasetSha256)) throw new Error('El hash del CSV fuente es inválido.');
  if (typeof bundle.scriptText !== 'string' || !bundle.scriptText.trim()) throw new Error('El bundle no contiene un script aprobado.');
  if (!isRecord(bundle.scriptHashPayload)) throw new Error('El payload canónico del script es inválido.');
  if (sha256(bundle.scriptText) !== bundle.scriptTextSha256) throw new Error('El texto del script no coincide con el bundle.');
  if (bundle.scriptHashPayload.scriptText !== bundle.scriptText) throw new Error('El payload del script no coincide con su texto.');
  if (sha256(canonicalJson(bundle.scriptHashPayload)) !== bundle.approvedScriptHash) throw new Error('El hash del contrato aprobado no coincide con el bundle.');
  if (bundle.inputReceiptRef !== undefined && !SHA256.test(bundle.inputReceiptRef)) throw new Error('La referencia del recibo de diagnóstico es inválida.');
  if (bundle.evidenceEnvelopeRef !== undefined && !ENVELOPE_REF.test(bundle.evidenceEnvelopeRef)) throw new Error('La referencia del envelope de evidencia es inválida.');
  if (bundle.bundleHash !== undefined) {
    if (!SHA256.test(bundle.bundleHash)) throw new Error('El bundleHash del bundle es inválido.');
    if (computeBundleHash(bundle) !== bundle.bundleHash) throw new Error('El bundleHash del bundle no coincide con su contenido.');
  }
};

const readBundle = async (bundlePath) => {
  let bundle;
  try {
    bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  } catch {
    throw new Error('El bundle de ejecución no contiene JSON válido.');
  }
  validateBundle(bundle);
  if (bundle.bundleHash === undefined) bundle.bundleHash = computeBundleHash(bundle);
  return bundle;
};

const inspectEnvironment = async (python) => {
  try {
    const probe = [
      'import json,platform,sys',
      'pandas_version=None',
      'try:',
      ' import pandas',
      ' pandas_version=pandas.__version__',
      'except Exception:',
      ' pass',
      'print(json.dumps({"python":sys.version.split()[0],"pandas":pandas_version,"platform":platform.platform()}))',
    ].join('\n');
    const environment = await exec(python, ['-c', probe], {
      timeout: SYNTAX_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    const parsed = JSON.parse(environment.stdout.trim());
    return {
      pythonVersion: typeof parsed.python === 'string' && parsed.python ? parsed.python : 'unknown',
      pandasVersion: typeof parsed.pandas === 'string' && parsed.pandas ? parsed.pandas : null,
      platform: typeof parsed.platform === 'string' && parsed.platform ? parsed.platform : 'unknown',
    };
  } catch (error) {
    return {
      pythonVersion: error?.code === 'ENOENT' ? 'unavailable' : 'unknown',
      pandasVersion: null,
      platform: 'unknown',
    };
  }
};

const executeBundle = async ({ bundle, inputPath, outputPath, receiptPath, python }) => {
  const workDir = await mkdtemp(join(tmpdir(), 'aura-remediation-'));
  const scriptPath = join(workDir, 'approved-script.py');
  const temporaryOutputPath = join(workDir, 'corrected.csv');
  const metadataPath = join(workDir, 'output-metadata.json');
  let executionPassed = false;
  let receiptWritten = false;
  let runStartedAt = new Date().toISOString();
  let runStartedMs = Date.now();
  try {
    await writeFile(scriptPath, bundle.scriptText, 'utf8');
    const environment = await inspectEnvironment(python);
    let syntax = { status: 'passed', error: null };
    let executionStatus = 'failed';
    let executionError = null;
    let stdout = '';
    let stderr = '';
    let output = null;
    let afterDatasetSha256 = null;
    const startedAt = runStartedAt;
    const startedMs = runStartedMs;

    try {
      await exec(python, ['-m', 'py_compile', scriptPath], {
        timeout: SYNTAX_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
      });
    } catch (error) {
      const syntaxDetails = String(error?.stderr || error?.message || error);
      syntax = { status: 'failed', error: 'Python syntax check failed.' };
      executionError = 'Python execution did not start because syntax validation failed.';
      stderr = syntaxDetails;
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
        const result = await exec(python, [
          '-c', wrapper, scriptPath, inputPath, temporaryOutputPath, metadataPath,
        ], {
          timeout: EXECUTION_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        stdout = result.stdout;
        stderr = result.stderr;
        output = JSON.parse(await readFile(metadataPath, 'utf8'));
        const outputBytes = await readFile(temporaryOutputPath);
        afterDatasetSha256 = sha256(outputBytes);
        await writeFile(outputPath, outputBytes);
        executionStatus = 'passed';
      } catch (error) {
        stdout = String(error?.stdout ?? '');
        stderr = String(error?.stderr ?? error?.message ?? '');
        executionError = 'Python execution failed.';
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
      pythonVersion: environment.pythonVersion,
      pandasVersion: environment.pandasVersion,
      platform: environment.platform,
      bundleHash: bundle.bundleHash,
      ...(bundle.inputReceiptRef === undefined ? {} : { inputReceiptRef: bundle.inputReceiptRef }),
      ...(bundle.evidenceEnvelopeRef === undefined ? {} : { evidenceEnvelopeRef: bundle.evidenceEnvelopeRef }),
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
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    receiptWritten = true;
    executionPassed = executionStatus === 'passed';
    return { receipt, passed: executionStatus === 'passed' };
  } finally {
    await rm(workDir, { recursive: true, force: true });
    if (!receiptWritten) {
      await rm(receiptPath, { force: true });
    }
    if (!executionPassed) {
      await rm(outputPath, { force: true });
    }
  }
};

export const runAuraRemediationCli = async (
  args,
  { commandName = 'run-aura-remediation.mjs', stdout = process.stdout, stderr = process.stderr } = {},
) => {
  if (args.length === 1 && args[0] === '--help') {
    stdout.write(usage(commandName));
    return 0;
  }
  const parsed = parseArguments(args);
  if (!parsed) {
    stderr.write(usage(commandName));
    return 2;
  }
  const cwd = process.cwd();
  const paths = {
    bundle: resolve(cwd, parsed.bundle),
    input: resolve(cwd, parsed.input),
    output: resolve(cwd, parsed.output),
    receipt: resolve(cwd, parsed.receipt),
  };
  let bundle = null;
  let result = null;
  try {
    await validateArtifactPaths(paths);
    const bundleIdentity = resolveIdentity(paths.bundle);
    const inputIdentity = resolveIdentity(paths.input);
    await Promise.all([
      rm(paths.output, { force: true }),
      rm(paths.receipt, { force: true }),
    ]);
    bundle = await readBundle(paths.bundle);
    if (bundleIdentity.realPath && inputIdentity.realPath
      && bundleIdentity.realPath === inputIdentity.realPath) {
      throw new Error('El bundle y la fuente no pueden ser el mismo archivo real.');
    }
    const sourceBytes = await readFile(paths.input);
    if (sha256(sourceBytes) !== bundle.beforeDatasetSha256) {
      throw new Error('El CSV fuente no coincide con el hash congelado.');
    }
    result = await executeBundle({
      bundle,
      inputPath: paths.input,
      outputPath: paths.output,
      receiptPath: paths.receipt,
      python: parsed.python,
    });
    stdout.write(`${result.passed ? 'OK' : 'FAILED'} ${basename(paths.receipt)} ${result.receipt.receiptHash}\n`);
    return result.passed ? 0 : 1;
  } catch (error) {
    if (paths.output !== paths.bundle && paths.output !== paths.input) {
      await rm(paths.output, { force: true });
    }
    if (paths.receipt !== paths.bundle && paths.receipt !== paths.input) {
      await rm(paths.receipt, { force: true });
    }
    stderr.write(`ERROR: ${String(error?.message ?? error)}\n`);
    return 1;
  }
};

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = await runAuraRemediationCli(process.argv.slice(2));
