/**
 * ollamaLocalBridge — Shared logic for browser → Ollama local connections.
 *
 * Reusable across ollama-setup.html wizard, SettingsPanel, and ollamaProvider.
 *
 * Key responsibilities:
 * - Classify endpoint type (loopback vs LAN private)
 * - Feature-detect targetAddressSpace support
 * - Build correct fetch options per endpoint type
 * - Diagnose connection failures with actionable categories
 * - Provide step-by-step diagnostic status for the UI
 */

export type OllamaConnectionState =
  | 'unknown'
  | 'ollama_unreachable'
  | 'cors_probable'
  | 'permission_probable'
  | 'timeout'
  | 'mixed_content_blocked'
  | 'endpoint_invalid'
  | 'model_missing'
  | 'chat_failed'
  | 'ready'
  | 'unknown';

export interface OllamaDiagnosticStage {
  id: string;
  label: string;
  status: 'pending' | 'testing' | 'success' | 'warning' | 'error';
  message?: string;
  durationMs?: number;
}

export interface OllamaDiagnostic {
  state: OllamaConnectionState;
  endpoint: string;
  model?: string;
  strategy: string;
  targetAddressSpace?: string;
  error?: {
    name: string;
    message: string;
    cause?: string;
  };
  stages: OllamaDiagnosticStage[];
  durationMs?: number;
  browser: string;
  browserVersion: string;
  isSecureContext: boolean;
  origin: string;
  timestamp: string;
}

export interface OllamaFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  targetAddressSpace?: string;
}

export interface OllamaModelsResult {
  models: Array<{ name: string; size?: number; modified_at?: string }>;
  endpoint: string;
}

export interface OllamaChatResult {
  message: { content: string };
  endpoint: string;
  model: string;
}

/**
 * Classify the address space of a URL host.
 */
export function classifyEndpointHost(host: string): 'loopback' | 'private_lan' | 'public' {
  const hostLower = host.toLowerCase();

  if (
    hostLower === 'localhost' ||
    hostLower === '127.0.0.1' ||
    hostLower === '::1' ||
    hostLower === '[::1]'
  ) {
    return 'loopback';
  }

  const ipv4Match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ipv4Match) {
    const b1 = parseInt(ipv4Match[1], 10);
    const b2 = parseInt(ipv4Match[2], 10);

    if (b1 === 10) return 'private_lan';
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return 'private_lan';
    if (b1 === 192 && b2 === 168) return 'private_lan';
  }

  return 'public';
}

export function isLoopbackEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return classifyEndpointHost(parsed.hostname) === 'loopback';
  } catch {
    return false;
  }
}

export function isPrivateLanEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return classifyEndpointHost(parsed.hostname) === 'private_lan';
  } catch {
    return false;
  }
}

/**
 * Feature detection: does this browser support targetAddressSpace in Request?
 */
export function supportsTargetAddressSpace(): boolean {
  try {
    const request = new Request('http://127.0.0.1/', {
      targetAddressSpace: 'loopback' as string,
    } as RequestInit);
    return (request as any).targetAddressSpace === 'loopback';
  } catch {
    return false;
  }
}

const TARGET_ADDRESS_SPACE_SUPPORTED = supportsTargetAddressSpace();

/**
 * Build fetch options for a given endpoint.
 * Loopback endpoints get different treatment than LAN private endpoints.
 */
export function buildFetchOptions(
  endpoint: string,
  options: OllamaFetchOptions = {}
): { url: string; init: RequestInit } {
  const parsed = new URL(endpoint);
  const classification = classifyEndpointHost(parsed.hostname);

  let targetAddressSpace: string | undefined;

  if (classification === 'loopback') {
    targetAddressSpace = undefined;
  } else if (classification === 'private_lan') {
    if (TARGET_ADDRESS_SPACE_SUPPORTED) {
      targetAddressSpace = 'local';
    }
  }

  const init: RequestInit = {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  };

  if (targetAddressSpace !== undefined && TARGET_ADDRESS_SPACE_SUPPORTED) {
    (init as any).targetAddressSpace = targetAddressSpace;
  }

  return {
    url: endpoint,
    init,
    _classification: classification,
    _targetAddressSpace: targetAddressSpace,
  } as any;
}

/**
 * Attempt a fetch with a specific strategy.
 * Returns { ok, status, duration, error, state }
 */
async function attemptFetch(
  url: string,
  options: OllamaFetchOptions,
  timeoutMs = 8000
): Promise<{
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: { name: string; message: string; cause?: string };
  state: OllamaConnectionState;
  corsFailed: boolean;
  timeout: boolean;
}> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const { init } = buildFetchOptions(url, { signal: controller.signal, ...options });

  let response: Response | undefined;
  let fetchError: Error | undefined;

  try {
    response = await fetch(url, init);
  } catch (err) {
    fetchError = err as Error;
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Math.round(performance.now() - start);

  if (!response) {
    const name = fetchError?.name || 'Error';
    const message = fetchError?.message || String(fetchError);

    let state: OllamaConnectionState = 'ollama_unreachable';
    let corsFailed = false;

    if (name === 'AbortError') {
      state = 'timeout';
    } else if (message.includes('Failed to fetch') || name === 'TypeError') {
      if (message.includes('Mixed Content') || message.includes('mixed-content')) {
        state = 'mixed_content_blocked';
      } else {
        state = 'cors_probable';
        corsFailed = true;
      }
    } else if (message.includes('net::ERR_CONNECTION_REFUSED')) {
      state = 'ollama_unreachable';
    } else {
      state = 'ollama_unreachable';
    }

    return {
      ok: false,
      durationMs,
      error: { name, message, cause: classifyErrorCause(fetchError) },
      state,
      corsFailed,
      timeout: state === 'timeout',
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    state: response.ok ? 'ready' : 'ollama_unreachable',
    corsFailed: false,
    timeout: false,
  };
}

/**
 * Try with no-cors to see if server responds at all (opaque response means CORS likely).
 */
async function probeWithNoCors(
  url: string,
  timeoutMs = 5000
): Promise<{ responded: boolean; opaque: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    } as RequestInit);
    clearTimeout(timer);
    return { responded: true, opaque: response.type === 'opaque' };
  } catch {
    clearTimeout(timer);
    return { responded: false, opaque: false };
  }
}

function classifyErrorCause(error: Error | undefined): string {
  if (!error) return 'unknown';
  const msg = error.message.toLowerCase();
  if (msg.includes('failed to fetch')) return 'network_or_cors';
  if (msg.includes('abort')) return 'timeout';
  if (msg.includes('mixed content')) return 'mixed_content';
  if (msg.includes('connection refused')) return 'server_down';
  if (msg.includes('origin')) return 'cors_origin';
  return 'unknown';
}

function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent || '';
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  if (edgeMatch) return { name: 'Edge', version: edgeMatch[1] };
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) return { name: 'Chrome', version: chromeMatch[1] };
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) return { name: 'Firefox', version: firefoxMatch[1] };
  const safariMatch = ua.match(/Safari\/(\d+)/);
  if (safariMatch) return { name: 'Safari', version: safariMatch[1] };
  return { name: 'Unknown', version: '0' };
}

/**
 * Run a full connection diagnostic for Ollama.
 * Returns detailed diagnostic object with step-by-step stages.
 */
export async function diagnoseOllamaConnection(
  endpoint: string,
  model: string,
  onStage?: (stage: OllamaDiagnosticStage) => void
): Promise<OllamaDiagnostic> {
  const browser = detectBrowser();
  const baseDiagnostic = {
    state: 'unknown' as OllamaConnectionState,
    endpoint,
    model,
    strategy: '',
    stages: [] as OllamaDiagnosticStage[],
    browser: browser.name,
    browserVersion: browser.version,
    isSecureContext: window.isSecureContext,
    origin: window.location.origin,
    timestamp: new Date().toISOString(),
  };

  function makeStage(id: string, label: string): OllamaDiagnosticStage {
    return { id, label, status: 'pending' };
  }

  function updateStage(stage: OllamaDiagnosticStage, status: OllamaDiagnosticStage['status'], message?: string, durationMs?: number) {
    stage.status = status;
    if (message) stage.message = message;
    if (durationMs !== undefined) stage.durationMs = durationMs;
    onStage?.(stage);
  }

  const stages = [
    makeStage('https_context', 'Contexto HTTPS'),
    makeStage('endpoint_loopback', 'Endpoint loopback'),
    makeStage('api_tags', 'Respuesta de /api/tags'),
    makeStage('cors_check', 'CORS'),
    makeStage('model_installed', 'Modelo instalado'),
    makeStage('api_chat', 'Respuesta de /api/chat'),
  ];

  const result: OllamaDiagnostic = { ...baseDiagnostic, stages };

  updateStage(stages[0], 'testing');
  if (!window.isSecureContext) {
    updateStage(stages[0], 'warning', 'AURA debe abrirse via HTTPS para acceder a Ollama local.');
    result.state = 'mixed_content_blocked';
    return result;
  }
  updateStage(stages[0], 'success', 'Contexto seguro detectado.');

  updateStage(stages[1], 'testing');
  const isLoop = isLoopbackEndpoint(endpoint);
  const isPrivateLan = isPrivateLanEndpoint(endpoint);
  if (isLoop) {
    updateStage(stages[1], 'success', `Loopback detectado: ${endpoint}`);
  } else if (isPrivateLan) {
    updateStage(stages[1], 'success', `LAN privada detectada: ${endpoint}`);
  } else {
    updateStage(stages[1], 'error', `Endpoint no es loopback ni LAN privada. Usa http://127.0.0.1:11434`);
    result.state = 'endpoint_invalid';
    return result;
  }

  const tagsUrl = `${endpoint.replace(/\/$/, '')}/api/tags`;
  updateStage(stages[2], 'testing');
  const tagsResult = await attemptFetch(tagsUrl, { method: 'GET' }, 8000);
  updateStage(stages[2], tagsResult.ok ? 'success' : 'error',
    tagsResult.ok
      ? `Ollama responde HTTP ${tagsResult.status} (${tagsResult.durationMs}ms)`
      : `Error: ${tagsResult.error?.message} (${tagsResult.durationMs}ms)`,
    tagsResult.durationMs
  );

  if (!tagsResult.ok) {
    result.state = tagsResult.state;
    result.error = tagsResult.error;
    result.strategy = 'fetch_without_targetAddressSpace';

    if (tagsResult.state === 'cors_probable') {
      updateStage(stages[3], 'warning', 'CORS falló. Probando con no-cors...');
      const noCors = await probeWithNoCors(tagsUrl);
      if (noCors.responded && noCors.opaque) {
        updateStage(stages[3], 'error', 'Servidor responde pero CORS bloquea. Configura OLLAMA_ORIGINS.');
        result.state = 'cors_probable';
      } else if (!noCors.responded) {
        updateStage(stages[3], 'error', 'Servidor no responde. Verifica que Ollama esté abierto.');
        result.state = 'ollama_unreachable';
      }
    } else if (tagsResult.state === 'timeout') {
      updateStage(stages[3], 'error', 'Timeout. Verifica que Ollama esté abierto y el endpoint sea correcto.');
      result.state = 'timeout';
    }

    return result;
  }

  let models: Array<{ name: string; size?: number }> = [];
  try {
    const data = await (await fetch(tagsUrl)).json();
    models = Array.isArray(data.models) ? data.models : [];
  } catch { }

  updateStage(stages[3], 'success', `CORS OK — Ollama acepta peticiones desde ${window.location.origin}`);

  updateStage(stages[4], 'testing');
  const installedModel = models.find(m => m.name === model || m.name.startsWith(`${model}:`));
  if (!installedModel) {
    updateStage(stages[4], 'warning', `Modelo ${model} no instalado. Ejecuta: ollama pull ${model}`);
    result.state = 'model_missing';
    return result;
  }
  updateStage(stages[4], 'success', `Modelo ${installedModel.name} instalado (${((installedModel.size || 0) / 1e9).toFixed(1)} GB)`);

  updateStage(stages[5], 'testing');
  const chatUrl = `${endpoint.replace(/\/$/, '')}/api/chat`;
  const chatResult = await attemptFetch(
    chatUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [{ role: 'user', content: 'AURA test' }],
        options: { temperature: 0.1 },
        stream: false,
        keep_alive: '10m',
      },
    },
    60000
  );

  if (!chatResult.ok) {
    updateStage(stages[5], 'error', `Chat falló: ${chatResult.error?.message}`);
    result.state = 'chat_failed';
    result.error = chatResult.error;
    return result;
  }

  let chatContent = '';
  try {
    const chatData = await (chatResult as any)._response?.json?.() || {};
    chatContent = chatData.message?.content || '';
  } catch { }

  updateStage(stages[5], 'success', `Chat exitoso — respuesta: ${chatContent.slice(0, 50)}`);
  result.state = 'ready';
  return result;
}

/**
 * Simple connectivity check: is Ollama reachable at the given endpoint?
 * Uses correct strategy per endpoint type.
 */
export async function checkOllamaReachable(endpoint: string): Promise<boolean> {
  const url = `${endpoint.replace(/\/$/, '')}/api/tags`;
  const result = await attemptFetch(url, { method: 'GET' }, 5000);
  return result.ok;
}

/**
 * List models from Ollama using correct fetch strategy.
 */
export async function listOllamaModels(endpoint: string): Promise<OllamaModelsResult> {
  const url = `${endpoint.replace(/\/$/, '')}/api/tags`;
  const result = await attemptFetch(url, { method: 'GET' }, 8000);

  if (!result.ok) {
    return { models: [], endpoint };
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    return {
      models: Array.isArray(data.models) ? data.models : [],
      endpoint,
    };
  } catch {
    return { models: [], endpoint };
  }
}

/**
 * Build a copyable technical diagnostic (no sensitive data).
 */
export function buildCopyableDiagnostic(diagnostic: OllamaDiagnostic): string {
  const lines: string[] = [
    '=== AURA · Ollama Diagnostic ===',
    `Date: ${diagnostic.timestamp}`,
    `Origin: ${diagnostic.origin}`,
    `Endpoint: ${diagnostic.endpoint}`,
    `Model: ${diagnostic.model || 'unknown'}`,
    `State: ${diagnostic.state}`,
    `Browser: ${diagnostic.browser} ${diagnostic.browserVersion}`,
    `Secure Context: ${diagnostic.isSecureContext}`,
    `Strategy: ${diagnostic.strategy || 'unknown'}`,
    `targetAddressSpace: ${diagnostic.targetAddressSpace || 'none'}`,
    `Duration: ${diagnostic.durationMs}ms`,
    '',
    '--- Stages ---',
    ...diagnostic.stages.map(
      s => `[${s.status}] ${s.label}${s.message ? `: ${s.message}` : ''}${s.durationMs ? ` (${s.durationMs}ms)` : ''}`
    ),
  ];

  if (diagnostic.error) {
    lines.push('');
    lines.push('--- Error ---');
    lines.push(`Name: ${diagnostic.error.name}`);
    lines.push(`Message: ${diagnostic.error.message}`);
    if (diagnostic.error.cause) lines.push(`Cause: ${diagnostic.error.cause}`);
  }

  return lines.join('\n');
}

/**
 * Get the curl command for testing Ollama from terminal (for diagnostics).
 */
export function buildCurlCommand(endpoint: string, origin: string): string {
  const parsed = new URL(endpoint);
  const host = parsed.host;
  const cleanOrigin = origin.replace(/\/$/, '');

  return `curl -i \\\n  -H "Origin: ${cleanOrigin}" \\\n  http://${host}/api/tags`;
}

/**
 * Get PowerShell curl command for Windows.
 */
export function buildPowerShellCurlCommand(endpoint: string, origin: string): string {
  const parsed = new URL(endpoint);
  const host = parsed.host;
  const cleanOrigin = origin.replace(/\/$/, '');

  return `curl.exe -i \`\n  -H "Origin: ${cleanOrigin}" \`\n  http://${host}/api/tags`;
}

/**
 * Get the command to verify OLLAMA_ORIGINS env var for the current OS.
 */
export function buildVerifyEnvCommand(os: string, origin: string): string {
  const cleanOrigin = origin.replace(/\/$/, '');

  switch (os) {
    case 'macos':
      return `launchctl getenv OLLAMA_ORIGINS\n# Esperado: ${cleanOrigin}`;
    case 'linux':
      return `systemctl show ollama --property=Environment\n# Esperado: OLLAMA_ORIGINS=${cleanOrigin}`;
    case 'windows':
      return `[Environment]::GetEnvironmentVariable("OLLAMA_ORIGINS", "User")\n# Esperado: ${cleanOrigin}`;
    default:
      return `# No disponible para este SO. Verifica manualmente que OLLAMA_ORIGINS incluya: ${cleanOrigin}`;
  }
}
