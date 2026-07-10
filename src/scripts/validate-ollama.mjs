#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, statfs, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');

const getArg = (args, name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

export const parseOllamaClientVersion = (output) => {
  const explicitClient = output.match(/client version is\s+v?([0-9]+(?:\.[0-9]+){1,3})/i);
  if (explicitClient) return explicitClient[1];

  const standard = output.match(/ollama version is\s+v?([0-9]+(?:\.[0-9]+){1,3})/i);
  if (standard) return standard[1];

  throw new Error(`No se pudo extraer la version del cliente Ollama: ${output.trim()}`);
};

export const assertFrozenModelIdentifiers = (manifestIds, protocolIds) => {
  const same =
    manifestIds.length === 3 &&
    protocolIds.length === 3 &&
    JSON.stringify(manifestIds) === JSON.stringify(protocolIds);
  if (!same) {
    throw new Error(
      'Los identificadores del manifiesto no coinciden exactamente con el protocolo OE4 congelado.',
    );
  }
};

const requestJson = async (url, options = {}, timeoutMs = 600_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Respuesta no JSON desde ${url}: ${text.slice(0, 500)}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} desde ${url}: ${JSON.stringify(json)}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const bytesToGiB = (bytes) => bytes / 1024 ** 3;
const nsToMs = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value / 1_000_000)
    : null;

const readClientVersion = async () => {
  const { stdout, stderr } = await execFile('ollama', ['--version']);
  return parseOllamaClientVersion(`${stdout}\n${stderr}`);
};

const findExactModel = (models, expectedId) =>
  models.find((entry) => entry?.name === expectedId || entry?.model === expectedId);

export const runOllamaPreflight = async (options = {}) => {
  const args = options.args ?? process.argv.slice(2);
  const baseUrl = getArg(
    args,
    'base-url',
    options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  ).replace(/\/$/, '');
  const timeoutMs = Number(
    getArg(args, 'timeout-ms', options.timeoutMs ?? process.env.OLLAMA_TIMEOUT_MS ?? '600000'),
  );
  const prompt = getArg(
    args,
    'prompt',
    options.prompt ?? 'Responde exactamente: AURA_OLLAMA_OK',
  );
  const manifestPath = resolve(
    getArg(
      args,
      'manifest',
      options.manifestPath ?? resolve(repoRoot, 'experiments/final-evaluation/model-manifest.v1.json'),
    ),
  );
  const protocolPath = resolve(
    getArg(
      args,
      'protocol',
      options.protocolPath ?? resolve(repoRoot, 'experiments/final-evaluation/protocol.v1.json'),
    ),
  );
  const outputPath = resolve(
    getArg(
      args,
      'output',
      options.outputPath ?? resolve(repoRoot, 'experiments/final-evaluation/preflight/ollama-preflight.latest.json'),
    ),
  );

  const manifest = await readJson(manifestPath);
  const protocol = await readJson(protocolPath);
  const manifestIds = manifest.models.map((entry) => entry.id);
  assertFrozenModelIdentifiers(manifestIds, protocol.models);

  const singleModel = getArg(args, 'model', options.model ?? '');
  const selectedIds = singleModel ? [singleModel] : manifestIds;
  const formal = !singleModel;

  const server = await requestJson(`${baseUrl}/api/version`, {}, 10_000);
  const serverVersion = String(server.version ?? '').trim();
  const clientVersion = options.clientVersion ?? (await readClientVersion());
  if (!serverVersion) throw new Error('Ollama no devolvio serverVersion en /api/version.');
  if (clientVersion !== serverVersion) {
    throw new Error(
      `Versiones Ollama desalineadas: cliente=${clientVersion}, servidor=${serverVersion}. Reinicia o actualiza ambos antes de OE4.`,
    );
  }

  const disk = await statfs(repoRoot);
  const freeDiskBytes = disk.bavail * disk.bsize;
  const manifestSizeGB = manifest.models.reduce(
    (total, entry) => total + Number(entry.referenceSizeGB ?? 0),
    0,
  );
  const defaultMinimumGB = Math.ceil(manifestSizeGB * 1.2 * 100) / 100;
  const minimumFreeDiskGB = Number(
    getArg(args, 'min-free-gb', options.minimumFreeDiskGB ?? defaultMinimumGB),
  );
  const freeDiskGB = bytesToGiB(freeDiskBytes);
  if (freeDiskGB < minimumFreeDiskGB) {
    throw new Error(
      `Espacio insuficiente: ${freeDiskGB.toFixed(2)} GiB libres; se requieren ${minimumFreeDiskGB.toFixed(2)} GiB.`,
    );
  }

  const tags = await requestJson(`${baseUrl}/api/tags`, {}, 10_000);
  const installedModels = Array.isArray(tags.models) ? tags.models : [];
  const missing = selectedIds.filter((id) => !findExactModel(installedModels, id));
  if (missing.length > 0) {
    const commands = missing.map((id) => `ollama pull ${id}`).join('\n');
    throw new Error(`Faltan modelos OE4 exactos:\n${missing.join('\n')}\n\nInstalalos con:\n${commands}`);
  }

  const modelReceipts = [];
  for (const modelId of selectedIds) {
    const installed = findExactModel(installedModels, modelId);
    const digest = String(installed?.digest ?? '').trim();
    if (!/^[a-f0-9]{64}$/i.test(digest)) {
      throw new Error(`Digest Ollama ausente o invalido para ${modelId}.`);
    }

    const startedAt = Date.now();
    const chat = await requestJson(
      `${baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          options: {
            temperature: protocol.inference.temperature,
            top_p: protocol.inference.topP,
            num_ctx: protocol.inference.numCtx,
            num_predict: Math.min(protocol.inference.numPredict, 64),
          },
          keep_alive: '0',
          stream: false,
        }),
      },
      timeoutMs,
    );
    const text = String(chat.message?.content ?? '').trim();
    if (!text) throw new Error(`El modelo ${modelId} respondio vacio en el smoke test.`);

    modelReceipts.push({
      id: modelId,
      digest,
      sizeBytes: installed.size ?? null,
      details: installed.details ?? null,
      smoke: {
        ok: true,
        responsePreview: text.slice(0, 240),
        observedLatencyMs: Date.now() - startedAt,
        promptTokens: chat.prompt_eval_count ?? null,
        outputTokens: chat.eval_count ?? null,
        totalDurationMs: nsToMs(chat.total_duration),
        loadDurationMs: nsToMs(chat.load_duration),
        promptEvalDurationMs: nsToMs(chat.prompt_eval_duration),
        evalDurationMs: nsToMs(chat.eval_duration),
      },
    });
  }

  const receipt = {
    contractId: 'aura.oe4.ollama-preflight.v1',
    contractVersion: '1.0.0',
    status: 'passed',
    formal,
    capturedAt: new Date().toISOString(),
    baseUrl,
    protocolId: protocol.id,
    protocolVersion: protocol.version,
    clientVersion,
    serverVersion,
    disk: {
      freeBytes: freeDiskBytes,
      freeGB: Number(freeDiskGB.toFixed(2)),
      minimumRequiredGB: minimumFreeDiskGB,
    },
    models: modelReceipts,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { receipt, outputPath };
};

const isMain =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  console.log('AURA Ollama formal preflight');
  try {
    const { receipt, outputPath } = await runOllamaPreflight();
    console.log(`server=ok version=${receipt.serverVersion}`);
    console.log(`client=ok version=${receipt.clientVersion}`);
    console.log(`freeDiskGB=${receipt.disk.freeGB}`);
    for (const model of receipt.models) {
      console.log(`model=ok id=${model.id}`);
      console.log(`digest=${model.digest}`);
      console.log(`response=${model.smoke.responsePreview}`);
    }
    console.log(`receipt=${outputPath}`);
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
