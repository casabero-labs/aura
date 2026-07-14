/**
 * Ollama Local Bridge — Browser-to-Loopback Connectivity Service
 *
 * All calls originate from the user's browser, never from AURA's server.
 * Architecture: Browser JS → http://127.0.0.1:11434 → Ollama local
 */

import { detectPlatform, PlatformInfo } from './platformDetection';
import { FINAL_EVALUATION_OLLAMA_MODEL_IDS } from './modelRegistry';

export type OllamaLocalStatus =
  | 'not_configured'
  | 'permission_required'
  | 'permission_denied'
  | 'cors_blocked'
  | 'server_unreachable'
  | 'timeout'
  | 'model_missing'
  | 'insecure_context'
  | 'unsupported_browser'
  | 'ready'
  | 'unknown_error';

export interface OllamaModelInfo {
  name: string;
  model?: string;
  modified_at: string;
  size: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaPullProgressEvent {
  status: string;
  percent: number | null;
  completedBytes: number | null;
  totalBytes: number | null;
  digest: string | null;
}

export interface OllamaLocalDiagnostic {
  status: OllamaLocalStatus;
  message: string;
  recommendedActions: string[];
  details: {
    endpoint: string;
    platform: PlatformInfo;
    remoteOrigin: string;
    connectionPath: 'browser_to_loopback';
    dataSentToAuraBackend: false;
    corsConfigured: boolean | null;
    modelsInstalled: string[];
    selectedModel?: string;
    selectedModelSize?: number | null;
    chatTestPassed: boolean | null;
    errorDetail?: string;
    checkedAt: string;
  };
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const LOCALHOST_ENDPOINT = 'http://localhost:11434';
const IPV6_ENDPOINT = 'http://[::1]:11434';
const ENDPOINT_TIMEOUT_MS = 8000;
const RECOMMENDED_MODEL = FINAL_EVALUATION_OLLAMA_MODEL_IDS[0];
const ALTERNATIVE_MODEL = FINAL_EVALUATION_OLLAMA_MODEL_IDS[1];
const MODEL_HEAVY_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function normalizeEndpoint(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) {
    return DEFAULT_ENDPOINT;
  }

  let url = rawUrl.trim();

  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname || '127.0.0.1';
    if (!parsed.port) parsed.port = '11434';
    parsed.pathname = '/';
    url = parsed.origin;
  } catch {
    url = DEFAULT_ENDPOINT;
  }

  return url;
}

export function isLocalLoopback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function isPublicEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return !isLocalLoopback(url) && !host.endsWith('.local') && !host.endsWith('.lan');
  } catch {
    return true;
  }
}

export function isModelHeavy(size: number): boolean {
  return size > MODEL_HEAVY_BYTES;
}

function getRequestInit(): RequestInit {
  const init: RequestInit & { targetAddressSpace?: string } = {
    signal: AbortSignal.timeout(ENDPOINT_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    targetAddressSpace: 'local' as any,
  };
  return init;
}

async function tryFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options ?? getRequestInit());
  } catch {
    return await fetch(url, {
      signal: AbortSignal.timeout(ENDPOINT_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function testOllamaEndpoint(endpoint: string): Promise<{
  reachable: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const resp = await tryFetch(`${endpoint}/api/tags`);
    return { reachable: resp.ok, status: resp.status };
  } catch (e: any) {
    return { reachable: false, error: e.message || 'fetch failed' };
  }
}

export async function fetchOllamaModels(endpoint: string): Promise<OllamaModelInfo[]> {
  const resp = await tryFetch(`${endpoint}/api/tags`);
  if (!resp.ok) {
    throw new Error(`Ollama returned ${resp.status}`);
  }
  const data = await resp.json();
  return data.models || [];
}

export async function pullOllamaModel(
  endpoint: string,
  model: string,
  onProgress: (event: OllamaPullProgressEvent) => void,
): Promise<void> {
  const normalized = normalizeEndpoint(endpoint);
  if (!isLocalLoopback(normalized)) {
    throw new Error('AURA solo permite descargar modelos en un Ollama local (127.0.0.1 o localhost).');
  }
  const request: RequestInit & { targetAddressSpace?: string } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    targetAddressSpace: 'local',
  };
  const response = await fetch(`${normalized}/api/pull`, request);
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { error?: string; message?: string };
      detail = payload.error ?? payload.message ?? '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`Ollama rechazó la descarga (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Ollama no entregó un flujo de progreso para la descarga.');
  const decoder = new TextDecoder();
  let buffer = '';
  const emit = (raw: string): void => {
    if (!raw.trim()) return;
    const event = JSON.parse(raw) as {
      status?: string; completed?: number; total?: number; digest?: string; error?: string;
    };
    if (event.error) throw new Error(event.error);
    const completed = typeof event.completed === 'number' ? event.completed : null;
    const total = typeof event.total === 'number' ? event.total : null;
    onProgress({
      status: event.status ?? 'procesando',
      percent: completed !== null && total !== null && total > 0
        ? Math.min(100, Math.round((completed / total) * 100))
        : event.status === 'success' ? 100 : null,
      completedBytes: completed,
      totalBytes: total,
      digest: event.digest ?? null,
    });
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(emit);
  }
  buffer += decoder.decode();
  emit(buffer);
}

export async function testOllamaChat(
  endpoint: string,
  model: string,
): Promise<{ passed: boolean; response?: string; error?: string }> {
  try {
    const resp = await tryFetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responde solo: OK' }],
        stream: false,
        keep_alive: '1m',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      return { passed: false, error: `HTTP ${resp.status}` };
    }

    const data = await resp.json();
    const content = data.message?.content || '';
    return { passed: content.includes('OK'), response: content };
  } catch (e: any) {
    return { passed: false, error: e.message || 'chat failed' };
  }
}

export async function diagnoseOllamaLocal(
  baseUrl?: string,
  selectedModel?: string,
): Promise<OllamaLocalDiagnostic> {
  const platform = detectPlatform();
  const remoteOrigin = (typeof window !== 'undefined' ? window.location.origin : 'unknown');
  const endpoint = normalizeEndpoint(baseUrl);

  const baseDiagnostic: Omit<OllamaLocalDiagnostic, 'status' | 'message' | 'recommendedActions'> = {
    details: {
      endpoint,
      platform,
      remoteOrigin,
      connectionPath: 'browser_to_loopback',
      dataSentToAuraBackend: false,
      corsConfigured: null,
      modelsInstalled: [],
      chatTestPassed: null,
      checkedAt: new Date().toISOString(),
    },
  };

  if (!platform.isSecureContext) {
    return {
      ...baseDiagnostic,
      status: 'insecure_context',
      message: 'AURA debe servirse sobre HTTPS para conectar con Ollama local.',
      recommendedActions: [
        'Accede a AURA via https://aura.casabero.com',
        'Las conexiones a loopback requieren contexto seguro.',
      ],
    };
  }

  if (platform.browser === 'safari' || platform.browser === 'firefox') {
    if (platform.browser === 'safari') {
      return {
        ...baseDiagnostic,
        status: 'unsupported_browser',
        message: 'Safari no permite conexiones a localhost desde sitios HTTPS externos.',
        recommendedActions: [
          'Usa Chrome o Edge para la conexión local con Ollama.',
          'Firefox puede requerir configuración adicional de permisos.',
        ],
      };
    }
  }

  if (isPublicEndpoint(endpoint)) {
    return {
      ...baseDiagnostic,
      status: 'not_configured',
      message: 'El endpoint configurado no es una dirección loopback local.',
      recommendedActions: [
        'Usa http://127.0.0.1:11434 como endpoint de Ollama.',
        'Los endpoints remotos no están permitidos.',
      ],
    };
  }

  const endpointTest = await testOllamaEndpoint(endpoint);

  if (!endpointTest.reachable) {
    const errorMsg = endpointTest.error || 'unreachable';

    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      if (platform.browser === 'chrome' || platform.browser === 'edge') {
        return {
          ...baseDiagnostic,
          status: 'permission_required',
          message: 'El navegador necesita permiso para conectarse a la red local.',
          recommendedActions: [
            'Haz clic en "Solicitar permiso y conectar" para autorizar.',
            'En Chrome/Edge, aparece un diálogo de permiso de red local.',
            `El origen ${remoteOrigin} necesita acceso a ${endpoint}.`,
          ],
        };
      }
    }

    const corsTest = await testOllamaEndpoint(endpoint);
    if (corsTest.error?.includes('CORS') || corsTest.status === 403 || corsTest.status === 0) {
      return {
        ...baseDiagnostic,
        details: { ...baseDiagnostic.details, corsConfigured: false },
        status: 'cors_blocked',
        message: `Ollama no autoriza el origen ${remoteOrigin}.`,
        recommendedActions: [
          `Configura OLLAMA_ORIGINS="${remoteOrigin}" en tu sistema.`,
          'Revisa las instrucciones según tu sistema operativo.',
          'Reinicia Ollama después de configurar la variable.',
        ],
      };
    }

    return {
      ...baseDiagnostic,
      status: 'server_unreachable',
      message: `Ollama no está respondiendo en ${endpoint}.`,
      recommendedActions: [
        'Asegúrate de que Ollama esté abierto e iniciado.',
        'En macOS, abre la app Ollama desde Aplicaciones.',
        'En Linux, ejecuta: ollama serve',
        'En Windows, abre Ollama desde el menú Inicio.',
      ],
    };
  }

  let models: OllamaModelInfo[] = [];
  try {
    models = await fetchOllamaModels(endpoint);
  } catch {
    return {
      ...baseDiagnostic,
      status: 'timeout',
      message: 'Ollama respondió pero /api/tags tardó demasiado.',
      recommendedActions: [
        'Reinicia Ollama e intenta de nuevo.',
        'Verifica que no haya otro proceso usando el puerto 11434.',
      ],
    };
  }

  const modelNames = models.map(m => m.name);

  if (modelNames.length === 0) {
    return {
      ...baseDiagnostic,
      details: { ...baseDiagnostic.details, modelsInstalled: [] },
      status: 'model_missing',
      message: 'Ollama funciona pero no tiene modelos instalados.',
      recommendedActions: [
        `Ejecuta: ollama pull ${RECOMMENDED_MODEL}`,
        `Alternativa ligera: ollama pull ${ALTERNATIVE_MODEL}`,
        'Después de descargar, vuelve a verificar la conexión.',
      ],
    };
  }

  const recommendedInstalled = modelNames.some(
    n => n === RECOMMENDED_MODEL || n.startsWith(RECOMMENDED_MODEL),
  );
  const alternativeInstalled = modelNames.some(
    n => n === ALTERNATIVE_MODEL || n.startsWith(ALTERNATIVE_MODEL),
  );

  let testModel: string;
  let testModelSize: number | null = null;

  if (selectedModel && modelNames.includes(selectedModel)) {
    testModel = selectedModel;
    const info = models.find(m => m.name === selectedModel);
    testModelSize = info?.size ?? null;
  } else if (recommendedInstalled) {
    testModel = RECOMMENDED_MODEL;
  } else if (alternativeInstalled) {
    testModel = ALTERNATIVE_MODEL;
  } else {
    testModel = modelNames[0];
    const info = models.find(m => m.name === testModel);
    testModelSize = info?.size ?? null;
  }

  const chatTest = await testOllamaChat(endpoint, testModel);

  return {
    ...baseDiagnostic,
    details: {
      ...baseDiagnostic.details,
      modelsInstalled: modelNames,
      selectedModel: testModel,
      selectedModelSize: testModelSize,
      chatTestPassed: chatTest.passed,
      corsConfigured: true,
      errorDetail: chatTest.error,
    },
    status: 'ready',
    message: `Ollama listo. Modelo activo: ${testModel}.`,
    recommendedActions: [
      'Puedes continuar con el diagnóstico usando Ollama local.',
      'Los datos no salen de este equipo.',
    ],
  };
}

// ── Endpoint Classification ──

export function classifyEndpointHost(host: string): 'loopback' | 'private_lan' | 'public' {
  const lower = host.toLowerCase().trim();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '[::1]') {
    return 'loopback';
  }
  const parts = lower.split('.');
  if (parts.length === 4) {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    if (!isNaN(first) && !isNaN(second)) {
      if (first === 10) return 'private_lan';
      if (first === 172 && second >= 16 && second <= 31) return 'private_lan';
      if (first === 192 && second === 168) return 'private_lan';
    }
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

// ── Legacy Diagnostic Type (for test compatibility) ──

export interface OllamaDiagnostic {
  state: string;
  endpoint: string;
  model?: string;
  strategy: string;
  stages: Array<{ id: string; label: string; status: 'success' | 'error' | 'warning' | 'pending'; message: string; durationMs: number }>;
  durationMs?: number;
  browser: string;
  browserVersion?: string;
  isSecureContext: boolean;
  origin: string;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    cause: string;
  };
}

// ── Diagnostic Formatters ──

export function buildCopyableDiagnostic(diagnostic: OllamaDiagnostic): string {
  const lines: string[] = [
    '=== AURA · Ollama Diagnostic ===',
    `State: ${diagnostic.state}`,
    `Endpoint: ${diagnostic.endpoint}`,
  ];
  if (diagnostic.model) lines.push(`Model: ${diagnostic.model}`);
  lines.push(`Strategy: ${diagnostic.strategy}`);
  lines.push(`Browser: ${diagnostic.browser}${diagnostic.browserVersion ? ' ' + diagnostic.browserVersion : ''}`);
  lines.push(`Origin: ${diagnostic.origin}`);
  lines.push(`Secure Context: ${diagnostic.isSecureContext}`);
  lines.push(`Timestamp: ${diagnostic.timestamp}`);
  if (diagnostic.durationMs !== undefined) {
    lines.push(`Duration: ${diagnostic.durationMs}ms`);
  }
  lines.push('');
  lines.push('--- Stages ---');
  for (const stage of diagnostic.stages) {
    lines.push(`[${stage.status}] ${stage.label}: ${stage.message} (${stage.durationMs}ms)`);
  }
  if (diagnostic.error) {
    lines.push('');
    lines.push('--- Error ---');
    lines.push(`Name: ${diagnostic.error.name}`);
    lines.push(`Message: ${diagnostic.error.message}`);
    lines.push(`Cause: ${diagnostic.error.cause}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function buildCurlCommand(endpoint: string, origin: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return `curl -i -H "Origin: ${origin}" ${base}/api/tags`;
}

export function buildPowerShellCurlCommand(endpoint: string, origin: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return `curl.exe -i -H "Origin: ${origin}" ${base}/api/tags`;
}

/**
 * macOS service setup used by the in-product assistant.
 *
 * Homebrew already owns port 11434 when its service is running, so starting a
 * second `ollama serve` process is both unnecessary and misleading. Restarting
 * the service is what makes the existing process inherit OLLAMA_ORIGINS.
 */
export function buildMacOSHomebrewSetupCommand(origin: string): string {
  return [
    'brew services list | grep ollama',
    `launchctl setenv OLLAMA_ORIGINS "${origin}"`,
    'brew services restart ollama',
  ].join('\n');
}

export function buildMacOSAppSetupCommand(origin: string): string {
  return [
    `launchctl setenv OLLAMA_ORIGINS "${origin}"`,
    'open -a Ollama',
  ].join('\n');
}

export function buildVerifyEnvCommand(os: string, origin: string): string {
  switch (os.toLowerCase()) {
    case 'macos':
      return `launchctl getenv OLLAMA_ORIGINS\necho "Expected: ${origin}"`;
    case 'linux':
      return `systemctl show ollama.service --property=Environment 2>/dev/null | grep -o "OLLAMA_ORIGINS=${origin}" || echo "OLLAMA_ORIGINS=${origin} not set"`;
    case 'windows':
      return `powershell -Command "[System.Environment]::GetEnvironmentVariable('OLLAMA_ORIGINS','User')"\necho "Expected: ${origin}"`;
    default:
      return 'No disponible para sistema operativo desconocido';
  }
}
