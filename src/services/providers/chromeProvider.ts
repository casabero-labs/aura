/**
 * ChromePromptProvider — Gemini Nano via Chrome Built-in AI Prompt API.
 * 
 * Detects the modern global `LanguageModel` API (Chrome 138+),
 * falls back to `window.ai.languageModel` and `window.ai.assistant`.
 * No requiere API key, no envía datos fuera del dispositivo.
 * 
 * Mecanismos anti-alucinación:
 * - M1: Temperatura 0.1
 * - M2: Anclaje semántico via Smart Sample JSON
 * - M3: Paradigma Copy-Paste
 * - M4: Cadena de razonamiento forzada
 * - M5: Structured JSON output
 */

import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent, ProviderProgressEvent, ProviderTextRequestOptions, StructuredFragmentRequest } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';
import { detectChromeAiAvailability, NormalizedAvailability, NormalizedStatus } from '../chromeAvailability';
import { NetworkGuard, NetworkGuardResult } from '../networkGuard';
import { PrivacyReceiptService, PrivacyReceipt } from '../privacyReceipt';

// ── Chrome AI Type Declarations ──

/** Progress event from model download monitoring */
interface DownloadProgressEvent extends Event {
  loaded: number;
  total: number;
}

/** Model download monitor (from LanguageModel.create monitor callback) */
interface DownloadMonitor extends EventTarget {
  addEventListener(type: 'downloadprogress', listener: (e: DownloadProgressEvent) => void): void;
}

/** Modern global LanguageModel (Chrome 138+) */
interface LanguageModelCreateOptions {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  expectedInputs?: Array<{ type: 'text'; languages?: string[] }>;
  expectedOutputs?: Array<{ type: 'text'; languages?: string[] }>;
  monitor?: (m: DownloadMonitor) => void;
  signal?: AbortSignal;
}

interface GlobalLanguageModel {
  availability(options?: { expectedInputLanguages?: string[] }): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  create(options?: LanguageModelCreateOptions): Promise<ChromeSession>;
}

/** window.ai bridge (older Chrome 127-137) */
interface ChromeAIBridge {
  languageModel?: {
    availability(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
    create(options?: { systemPrompt?: string; temperature?: number; topK?: number; monitor?: (m: DownloadMonitor) => void }): Promise<{
      prompt(input: string): Promise<string>;
      promptStreaming(input: string): ReadableStream;
      destroy(): void;
    }>;
  };
  assistant?: () => Promise<{
    create(options?: { systemPrompt?: string; temperature?: number }): Promise<{
      prompt(input: string): Promise<string>;
      promptStreaming(input: string): ReadableStream;
      destroy(): void;
    }>;
    capabilities(): Promise<{ available: boolean; defaultTemperature: number }>;
  }>;
}

declare global {
  var LanguageModel: GlobalLanguageModel | undefined;
  interface Window {
    ai?: ChromeAIBridge;
  }
}

// ── Diagnostics ──

export type ChromeAiApiSurface = 'LanguageModel' | 'window.ai.languageModel' | 'window.ai.assistant' | 'none';

export type ChromeAiStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'session_start_failed' | 'error';

export interface ChromeAiDiagnostic {
  apiSurface: ChromeAiApiSurface;
  status: ChromeAiStatus;
  rawAvailability?: unknown;
  message: string;
  actions: string[];
}

/** Detect which API surface is available in this browser */
function detectApiSurface(): ChromeAiApiSurface {
  try {
    if (typeof globalThis.LanguageModel !== 'undefined') {
      return 'LanguageModel';
    }
  } catch { /* ignore */ }

  try {
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
      return 'window.ai.languageModel';
    }
  } catch { /* ignore */ }

  try {
    if (typeof window !== 'undefined' && window.ai?.assistant) {
      return 'window.ai.assistant';
    }
  } catch { /* ignore */ }

  return 'none';
}

async function smokeTestSession(surface: ChromeAiApiSurface): Promise<{ passed: boolean; error?: string }> {
  try {
    let session: { prompt(input: string): Promise<string>; destroy?(): void } | null = null;
    
    if (surface === 'LanguageModel') {
      session = await globalThis.LanguageModel!.create();
      const response = await session.prompt('Responde solo: OK');
      session.destroy?.();
      return { passed: response.includes('OK') };
    }
    
    if (surface === 'window.ai.languageModel') {
      session = await window.ai!.languageModel!.create();
      const response = await session.prompt('Responde solo: OK');
      session.destroy?.();
      return { passed: response.includes('OK') };
    }
    
    if (surface === 'window.ai.assistant') {
      const ai = await window.ai!.assistant!();
      session = await ai.create();
      const response = await session.prompt('Responde solo: OK');
      session.destroy?.();
      return { passed: response.includes('OK') };
    }
    
    return { passed: false, error: 'No API surface' };
  } catch (e) {
    return { passed: false, error: (e as Error).message };
  }
}

/** Full diagnostic of Chrome AI availability - uses detectChromeAiAvailability as single source of truth */
export async function getChromeAiDiagnostic(): Promise<ChromeAiDiagnostic> {
  const normalized = await detectChromeAiAvailability();

  const surfaceMap: Record<NormalizedAvailability['apiSurface'], ChromeAiApiSurface> = {
    'LanguageModel': 'LanguageModel',
    'window.ai.languageModel': 'window.ai.languageModel',
    'window.ai.assistant': 'window.ai.assistant',
    'none': 'none',
  };

  let finalStatus: ChromeAiStatus;
  let actions: string[] = [];
  
  switch (normalized.status) {
    case 'ready':
      finalStatus = 'available';
      actions = ['Puedes generar diagnósticos con Chrome AI.'];
      break;
    case 'downloadable':
      finalStatus = 'downloadable';
      actions = [
        'Pulsa "Preparar Gemini Nano" para iniciar la descarga.',
        'No cierres esta pestaña durante la descarga.',
        'La descarga puede pesar varios GB.',
      ];
      break;
    case 'downloading':
      finalStatus = 'downloading';
      actions = ['Espera a que termine la descarga.'];
      break;
    case 'unavailable':
    case 'api_missing':
    case 'error':
      finalStatus = 'unavailable';
      actions = [
        'Verifica que uses Chrome 138 o superior.',
        'Abre chrome://flags y busca "Prompt API" o "Built-in AI".',
        'Activa las opciones disponibles y reinicia Chrome.',
        'Revisa chrome://on-device-internals para ver modelos descargados.',
        'Prueba con Ollama local como alternativa.',
      ];
      break;
    default:
      finalStatus = 'error';
      actions = ['Estado desconocido. Reinicia Chrome e intenta de nuevo.'];
  }
  
  if (normalized.status === 'ready' && normalized.apiSurface !== 'none') {
    const smokeTest = await smokeTestSession(surfaceMap[normalized.apiSurface]);
    if (!smokeTest.passed) {
      finalStatus = 'session_start_failed';
      actions = [
        'Chrome AI fue detectado, pero la sesión falló al iniciar.',
        'Error: ' + (smokeTest.error || 'desconocido'),
        'Reinicia Chrome e intenta de nuevo.',
        'Si el problema persiste, prueba con Ollama local.',
      ];
    }
  }

  return {
    apiSurface: surfaceMap[normalized.apiSurface],
    status: finalStatus,
    rawAvailability: normalized.availabilityRaw,
    message: normalized.message,
    actions,
  };
}

// ── Session (internal) ──

interface ChromePromptOptions {
  responseConstraint?: Record<string, unknown>;
  signal?: AbortSignal;
}

interface ChromeSession {
  prompt(input: string, options?: ChromePromptOptions): Promise<string>;
  promptStreaming(input: string, options?: ChromePromptOptions): ReadableStream<string | BufferSource>;
  clone?(options?: { signal?: AbortSignal }): Promise<ChromeSession>;
  destroy(): void;
}

/**
 * A run of whitespace this long means constrained decoding degenerated: the
 * JSON grammar allows unlimited whitespace and Gemini Nano can keep emitting
 * newlines until the context window is exhausted.
 */
export const DEGENERATE_WHITESPACE_RUN = 64;

export class ChromeStreamDegeneratedError extends Error {
  constructor(readonly partialText: string) {
    super(`Gemini Nano emitió más de ${DEGENERATE_WHITESPACE_RUN} espacios seguidos; la respuesta se interrumpió.`);
    this.name = 'ChromeStreamDegeneratedError';
  }
}

const trailingWhitespace = (text: string): number => text.length - text.trimEnd().length;

/**
 * Read a Prompt API stream into text. Current Chrome emits string deltas;
 * Chrome 127-137 emitted the cumulative text so far; some builds emit bytes.
 * The previous implementation passed strings to `TextDecoder.decode`, which
 * throws, and then silently re-ran the whole generation with `prompt()`.
 */
export async function readPromptStream(
  stream: ReadableStream<string | BufferSource>,
  onDelta: (delta: string) => void,
  options: { guardWhitespace?: boolean } = {},
): Promise<{ text: string; firstChunkMs: number }> {
  const startedAt = performance.now();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let firstChunkMs = 0;
  let whitespaceRun = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
      if (!chunk) continue;
      if (firstChunkMs === 0) firstChunkMs = performance.now() - startedAt;
      const delta = text.length > 0 && chunk.length > text.length && chunk.startsWith(text)
        ? chunk.slice(text.length)
        : chunk;
      text += delta;
      onDelta(delta);
      if (options.guardWhitespace) {
        whitespaceRun = delta.trim().length === 0 ? whitespaceRun + delta.length : trailingWhitespace(delta);
        if (whitespaceRun > DEGENERATE_WHITESPACE_RUN) {
          await reader.cancel().catch(() => undefined);
          throw new ChromeStreamDegeneratedError(text);
        }
      }
    }
    const tail = decoder.decode();
    if (tail) {
      text += tail;
      onDelta(tail);
    }
  } finally {
    reader.releaseLock?.();
  }
  return { text, firstChunkMs };
}

// ── Provider ──

export class ChromePromptProvider implements AIProvider {
  readonly name = 'Chrome AI / Gemini Nano';
  readonly type = 'chrome' as const;

  private model = 'gemini-nano';
  private session: ChromeSession | null = null;
  private sessionPromise: Promise<ChromeSession> | null = null;
  private pendingMonitor: DownloadMonitor | null = null;
  private networkGuard: NetworkGuard | null = null;
  private privacyReceiptService: PrivacyReceiptService | null = null;
  private _sessionCreated: boolean = false;
  private _generationMethod: 'promptStreaming' | 'prompt' | 'failed' = 'failed';
  /** Session primed with a system instruction; cloned for every fragment, never prompted. */
  private fragmentBase: { systemInstruction: string; session: Promise<ChromeSession> } | null = null;

  getApiSurface(): ChromeAiApiSurface {
    return detectApiSurface();
  }

  async getAvailabilityDetails(): Promise<ChromeAiDiagnostic> {
    return getChromeAiDiagnostic();
  }

  async getNormalizedAvailability(): Promise<NormalizedAvailability> {
    return detectChromeAiAvailability();
  }

  async isAvailable(): Promise<boolean> {
    const availability = await detectChromeAiAvailability();
    return availability.status === 'ready';
  }

  async isDownloadable(): Promise<boolean> {
    const availability = await detectChromeAiAvailability();
    return availability.status === 'downloadable' || availability.status === 'ready';
  }

  async startNetworkMonitoring(): Promise<void> {
    this.networkGuard = new NetworkGuard();
    this.networkGuard.start();
  }

  async stopNetworkMonitoring(): Promise<NetworkGuardResult | null> {
    if (this.networkGuard) {
      const result = this.networkGuard.stop();
      this.networkGuard = null;
      return result;
    }
    return null;
  }

  async generatePrivacyReceipt(
    data: any[][],
    columns: string[],
    networkResult: NetworkGuardResult,
    availability: NormalizedAvailability,
  ): Promise<PrivacyReceipt> {
    this.privacyReceiptService = new PrivacyReceiptService();
    this.privacyReceiptService.startTracking();
    return this.privacyReceiptService.generateReceipt(
      data,
      columns,
      networkResult,
      availability,
      this._sessionCreated,
      this._generationMethod
    );
  }

  private async createSession(
    onDownloadProgress?: (progress: number, message: string) => void,
  ): Promise<ChromeSession> {
    const surface = detectApiSurface();

    if (surface === 'none') {
      throw new Error('Chrome AI API no detectada en este navegador.');
    }

    try {
      // Modern global LanguageModel (Chrome 138+) - clean session without temperature/topK
      if (surface === 'LanguageModel') {
        let session: ChromeSession;
        try {
          const createOptions: { monitor?: (m: DownloadMonitor) => void } = {};
          if (onDownloadProgress) {
            createOptions.monitor = (m) => {
              m.addEventListener('downloadprogress', (e: DownloadProgressEvent) => {
                const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
                onDownloadProgress(pct, `Descargando Gemini Nano ${pct}%`);
              });
            };
          }
          session = await globalThis.LanguageModel!.create(createOptions);
        } catch (monitorError) {
          // Fallback: create without monitor if monitor causes error
          session = await globalThis.LanguageModel!.create();
        }
        return session;
      }

      // window.ai.languageModel (Chrome 127-137) - clean session
      if (surface === 'window.ai.languageModel') {
        let session: ChromeSession;
        try {
          const createOptions: { monitor?: (m: DownloadMonitor) => void } = {};
          if (onDownloadProgress) {
            createOptions.monitor = (m) => {
              m.addEventListener('downloadprogress', (e: any) => {
                const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
                onDownloadProgress(pct, `Descargando Gemini Nano ${pct}%`);
              });
            };
          }
          session = await window.ai!.languageModel!.create(createOptions);
        } catch (monitorError) {
          session = await window.ai!.languageModel!.create();
        }
        return session;
      }

      // Legacy window.ai.assistant
      if (surface === 'window.ai.assistant') {
        const ai = await window.ai!.assistant!();
        const session = await ai.create();
        return session as unknown as ChromeSession;
      }

      throw new Error('No se pudo crear sesión de Chrome AI.');
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('activation') || msg.includes('user')) {
        throw new Error('Chrome requiere interacción del usuario para activar Gemini Nano. Pulsa "Preparar Gemini Nano".');
      }
      if (msg.includes('session')) {
        throw new Error('Chrome AI fue detectado, pero la sesión falló al iniciar. Acciones: Probar sesión simple, Reiniciar Chrome, Usar Ollama local');
      }
      throw err;
    }
  }

  private async getSession(
    onDownloadProgress?: (progress: number, message: string) => void,
  ): Promise<ChromeSession> {
    if (!this.sessionPromise) {
      this.sessionPromise = this.createSession(onDownloadProgress);
    }
    return this.sessionPromise;
  }

  /**
   * A clean session per request. The cached session from `getSession()` only
   * guarantees the model is downloaded; prompting it would keep every earlier
   * diagnosis in its 9k-token context.
   */
  private async createPromptSession(
    options: { systemInstruction?: string; signal?: AbortSignal } = {},
  ): Promise<ChromeSession> {
    const surface = detectApiSurface();
    if (surface === 'LanguageModel') {
      const initialPrompts = options.systemInstruction
        ? [{ role: 'system' as const, content: options.systemInstruction }]
        : undefined;
      try {
        return await globalThis.LanguageModel!.create({
          ...(initialPrompts ? { initialPrompts } : {}),
          expectedInputs: [{ type: 'text', languages: ['es', 'en'] }],
          expectedOutputs: [{ type: 'text', languages: ['es'] }],
          ...(options.signal ? { signal: options.signal } : {}),
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        // Builds without language hints reject the options object.
        return globalThis.LanguageModel!.create(initialPrompts ? { initialPrompts } : undefined);
      }
    }
    if (surface === 'window.ai.languageModel') {
      return window.ai!.languageModel!.create(
        options.systemInstruction ? { systemPrompt: options.systemInstruction } : undefined,
      ) as unknown as Promise<ChromeSession>;
    }
    if (surface === 'window.ai.assistant') {
      const ai = await window.ai!.assistant!();
      return ai.create(
        options.systemInstruction ? { systemPrompt: options.systemInstruction } : undefined,
      ) as unknown as Promise<ChromeSession>;
    }
    throw new Error('Chrome AI API no detectada en este navegador.');
  }

  /**
   * Stream one prompt on a fresh session. Falls back to `prompt()` only when
   * the stream cannot start; a stream that fails midway is an error, not a
   * reason to generate the whole answer again.
   */
  private async runPrompt(
    prompt: string,
    onDelta: (delta: string) => void,
    options: { signal?: AbortSignal; responseConstraint?: Record<string, unknown>; guardWhitespace?: boolean; session?: ChromeSession } = {},
  ): Promise<{ text: string; firstChunkMs: number }> {
    const session = options.session ?? await this.createPromptSession({ signal: options.signal });
    this._sessionCreated = true;
    const promptOptions: ChromePromptOptions = {
      ...(options.responseConstraint ? { responseConstraint: options.responseConstraint } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    };
    try {
      let stream: ReadableStream<string | BufferSource> | null = null;
      try {
        stream = session.promptStreaming(prompt, promptOptions);
      } catch (startError) {
        if (options.signal?.aborted) throw startError;
        stream = null;
      }
      if (!stream) {
        const text = await session.prompt(prompt, promptOptions);
        this._generationMethod = 'prompt';
        onDelta(text);
        return { text, firstChunkMs: 0 };
      }
      const result = await readPromptStream(stream, onDelta, { guardWhitespace: options.guardWhitespace });
      this._generationMethod = 'promptStreaming';
      return result;
    } catch (error) {
      this._generationMethod = 'failed';
      throw error;
    } finally {
      try { session.destroy(); } catch { /* ignore */ }
    }
  }

  private metricsFor(startTime: number, firstChunkMs: number, text: string): ProviderMetrics {
    return {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(performance.now() - startTime),
      firstTokenMs: Math.round(firstChunkMs),
      tokensGenerated: Math.round(text.length / 4),
      isLocal: true,
      timestamp: new Date().toISOString(),
    };
  }

  private parseExecutiveContent(report: AuditReport, text: string): ExecutiveReportContent {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackContent(report, text);
    } catch {
      return this.fallbackContent(report, text);
    }
  }

  // ── AIProvider Implementation ──

  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<ProviderMetrics> {
    const availability = await detectChromeAiAvailability();
    if (availability.status !== 'ready') {
      onChunk(`⚠️ ${availability.message}`);
      return this.emptyMetrics();
    }

    const startTime = performance.now();
    try {
      const { text, firstChunkMs } = await this.runPrompt(buildAnalysisPrompt(report), onChunk);
      return this.metricsFor(startTime, firstChunkMs, text);
    } catch (error) {
      console.error('Chrome AI Error:', error);
      onChunk(`\n\n**Error:** ${(error as Error).message}`);
      return this.metricsFor(startTime, 0, '');
    }
  }

  async generateExecutiveReport(
    report: AuditReport,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    return this.generateExecutiveReportStream(report, () => undefined);
  }

  async generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    const availability = await detectChromeAiAvailability();
    if (availability.status !== 'ready') throw new Error(availability.message);

    const startTime = performance.now();
    try {
      const { text, firstChunkMs } = await this.runPrompt(buildExecutivePrompt(report), onChunk);
      return { content: this.parseExecutiveContent(report, text), metrics: this.metricsFor(startTime, firstChunkMs, text) };
    } catch (error) {
      throw new Error(`Chrome AI streaming error: ${(error as Error).message}`);
    }
  }

  async generateText(
    prompt: string,
    options?: ProviderTextRequestOptions,
  ): Promise<{ text: string; metrics: ProviderMetrics }> {
    const availability = await detectChromeAiAvailability();
    if (availability.status !== 'ready') throw new Error(availability.message);

    const startTime = performance.now();
    const { text, firstChunkMs } = await this.runPrompt(prompt, () => undefined, { signal: options?.signal });
    return { text, metrics: this.metricsFor(startTime, firstChunkMs, text) };
  }

  async generateTextWithProgress(
    prompt: string,
    onProgress: (event: ProviderProgressEvent) => void,
    options?: ProviderTextRequestOptions,
  ): Promise<{ text: string; metrics: ProviderMetrics }> {
    onProgress({ stage: 'checking', message: 'Verificando disponibilidad de Chrome AI' });
    await this.ensureModelReady(onProgress);

    onProgress({ stage: 'loading', message: 'Creando sesión de Gemini Nano' });
    const startTime = performance.now();
    try {
      const session = await this.createPromptSession({ signal: options?.signal });
      onProgress({ stage: 'generating', message: 'Generando respuesta con Gemini Nano' });
      const { text, firstChunkMs } = await this.runPrompt(
        prompt,
        (delta) => onProgress({ stage: 'generating', message: 'Recibiendo respuesta de Gemini Nano', chunk: delta }),
        { signal: options?.signal, session },
      );
      onProgress({ stage: 'completed', progress: 100, message: 'Respuesta recibida de Chrome AI' });
      return { text, metrics: this.metricsFor(startTime, firstChunkMs, text) };
    } catch (error) {
      onProgress({ stage: 'error', message: (error as Error).message });
      throw error;
    }
  }

  /**
   * One short JSON request for a single issue (diagnosis per issue). The
   * system instruction is primed once and the session is cloned per request
   * so no fragment sees another fragment's text.
   */
  async generateStructuredFragment(
    request: StructuredFragmentRequest,
  ): Promise<{ text: string; metrics: ProviderMetrics }> {
    const startTime = performance.now();
    if (!this.fragmentBase || this.fragmentBase.systemInstruction !== request.systemInstruction) {
      const previous = this.fragmentBase;
      this.fragmentBase = {
        systemInstruction: request.systemInstruction,
        session: this.createPromptSession({ systemInstruction: request.systemInstruction }),
      };
      previous?.session.then((session) => session.destroy()).catch(() => undefined);
      this.fragmentBase.session.catch(() => { this.fragmentBase = null; });
    }
    const base = await this.fragmentBase.session;
    const session = base.clone
      ? await base.clone(request.signal ? { signal: request.signal } : undefined)
      : await this.createPromptSession({ systemInstruction: request.systemInstruction, signal: request.signal });
    const { text, firstChunkMs } = await this.runPrompt(request.prompt, request.onChunk ?? (() => undefined), {
      session,
      signal: request.signal,
      responseConstraint: request.responseSchema,
      guardWhitespace: true,
    });
    return { text, metrics: this.metricsFor(startTime, firstChunkMs, text) };
  }

  /** Download the model when needed; throw when Chrome AI cannot run here. */
  async ensureModelReady(onProgress: (event: ProviderProgressEvent) => void = () => undefined): Promise<void> {
    const availability = await detectChromeAiAvailability();
    if (availability.status === 'downloadable' || availability.status === 'downloading') {
      onProgress({ stage: 'downloading', progress: 0, message: 'Gemini Nano necesita descargarse. Iniciando descarga...' });
      await this.getSession((pct, msg) => onProgress({ stage: 'downloading', progress: pct, message: msg }));
      this._sessionCreated = true;
      onProgress({ stage: 'loading', message: 'Modelo descargado.' });
      return;
    }
    if (availability.status !== 'ready') {
      onProgress({ stage: 'error', message: availability.message });
      throw new Error(availability.message);
    }
  }

  async preloadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    const availability = await detectChromeAiAvailability();

    if (availability.status === 'ready') {
      onProgress?.(100, 'Gemini Nano ya está disponible.');
      return;
    }

    if (availability.status === 'downloadable') {
      onProgress?.(0, 'Iniciando descarga de Gemini Nano...');

      try {
        await this.getSession((pct, msg) => {
          onProgress?.(pct, msg);
        });
        onProgress?.(100, 'Gemini Nano listo.');
      } catch (err) {
        onProgress?.(0, `Error: ${(err as Error).message}`);
        throw new Error(`Descarga de Gemini Nano falló: ${(err as Error).message}`);
      }
      return;
    }

    onProgress?.(0, availability.message);
    throw new Error(availability.message);
  }

  async unloadModel(): Promise<void> {
    const fragmentBase = this.fragmentBase;
    this.fragmentBase = null;
    fragmentBase?.session.then((session) => session.destroy()).catch(() => undefined);
    if (this.session) {
      try { this.session.destroy(); } catch { /* ignore */ }
      this.session = null;
      this.sessionPromise = null;
    }
  }

  private fallbackContent(report: AuditReport, rawText: string): ExecutiveReportContent {
    return {
      title: 'AURA - Informe Chrome AI',
      domain_inferred: 'Dominio no inferido',
      dataset_technical_description: `Dataset con ${report.rowCount} filas y ${report.colCount} columnas. Score: ${report.score}/100.`,
      executive_summary: rawText.slice(0, 500),
      business_impact: 'Revisar hallazgos del motor determinista.',
      key_findings: report.issues.slice(0, 5).map(i => `${i.severity}: ${i.ruleName}`),
      recommendations: ['Revisar datos críticos', 'Aplicar limpieza re-auditable'],
    };
  }

  private emptyMetrics(): ProviderMetrics {
    return {
      provider: this.name,
      model: this.model,
      latencyMs: 0,
      firstTokenMs: 0,
      tokensGenerated: 0,
      isLocal: true,
      timestamp: new Date().toISOString(),
    };
  }
}
