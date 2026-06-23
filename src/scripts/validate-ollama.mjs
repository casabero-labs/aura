#!/usr/bin/env node

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const baseUrl = getArg('base-url', process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const model = getArg('model', process.env.OLLAMA_MODEL || 'qwen2.5:3b');
const prompt = getArg('prompt', 'Responde en una frase: AURA puede usar Ollama local.');
const timeoutMs = Number(getArg('timeout-ms', process.env.OLLAMA_TIMEOUT_MS || '60000'));

const fail = (message, detail) => {
  console.error(`FAIL ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
};

const requestJson = async (url, options = {}, timeout = timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      fail(`Respuesta no JSON desde ${url}`, text.slice(0, 500));
    }
    if (!response.ok) {
      fail(`HTTP ${response.status} desde ${url}`, JSON.stringify(json, null, 2));
    }
    return json;
  } catch (error) {
    fail(`No se pudo conectar a ${url}`, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
};

console.log(`AURA Ollama validation`);
console.log(`baseUrl=${baseUrl}`);
console.log(`model=${model}`);

const tags = await requestJson(`${baseUrl}/api/tags`, {}, 10000);
const models = Array.isArray(tags.models) ? tags.models : [];
const installed = models.some(entry => entry.name === model || entry.name?.startsWith(`${model}:`));

console.log(`server=ok`);
console.log(`installedModels=${models.length}`);

if (!installed) {
  fail(
    `Modelo ${model} no instalado`,
    `Descargalo con: ollama pull ${model}\nLuego repite: npm run ollama:validate -- --model=${model}`
  );
}

const startedAt = Date.now();
const chat = await requestJson(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0.1 },
    keep_alive: '10m',
    stream: false,
  }),
});

const text = chat.message?.content?.trim() || '';
if (!text) {
  fail(`El modelo ${model} respondio vacio`, JSON.stringify(chat, null, 2).slice(0, 1000));
}

console.log(`chat=ok`);
console.log(`latencyMs=${Date.now() - startedAt}`);
console.log(`response=${text.slice(0, 240)}`);
