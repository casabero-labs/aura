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

import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent, ProviderProgressEvent } from '../../types';
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
interface GlobalLanguageModel {
  availability(options?: { expectedInputLanguages?: string[] }): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  create(options?: {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
    monitor?: (m: DownloadMonitor) => void;
  }): Promise<{
    prompt(input: string): Promise<string>;
    promptStreaming(input: string): ReadableStream;
    destroy(): void;
  }>;
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

export type ChromeAiStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'error';

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

/** Full diagnostic of Chrome AI availability */
export async function getChromeAiDiagnostic(): Promise<ChromeAiDiagnostic> {
  const surface = detectApiSurface();

  if (surface === 'none') {
    return {
      apiSurface: 'none',
      status: 'unavailable',
      message: 'Chrome AI no está habilitado en este navegador.',
      actions: [
        'Verifica que uses Chrome 138 o superior.',
        'Abre chrome://flags y busca "Prompt API" o "Built-in AI".',
        'Activa las opciones disponibles y reinicia Chrome.',
        'Revisa chrome://on-device-internals para ver modelos descargados.',
      ],
    };
  }

  try {
    let availability: { available: string };
    let raw: unknown;

    if (surface === 'LanguageModel') {
      availability = await globalThis.LanguageModel!.availability();
      raw = availability;
    } else if (surface === 'window.ai.languageModel') {
      availability = await window.ai!.languageModel!.availability();
      raw = availability;
    } else {
      // window.ai.assistant — legacy, no availability() granular
      const ai = await window.ai!.assistant!();
      const caps = await ai.capabilities();
      availability = { available: caps.available ? 'readily' : 'no' };
      raw = caps;
    }

    const av = availability.available;

    if (av === 'readily') {
      return {
        apiSurface: surface,
        status: 'available',
        rawAvailability: raw,
        message: 'Gemini Nano listo para usar en este navegador.',
        actions: ['Puedes generar diagnósticos con Chrome AI.'],
      };
    }

    if (av === 'after-download') {
      return {
        apiSurface: surface,
        status: 'downloadable',
        rawAvailability: raw,
        message: 'Gemini Nano requiere una descarga inicial antes de usarse.',
        actions: [
          'Pulsa "Preparar Gemini Nano" para iniciar la descarga.',
          'No cierres esta pestaña durante la descarga.',
          'La descarga puede pesar varios GB.',
        ],
      };
    }

    // av === 'no'
    return {
      apiSurface: surface,
      status: 'unavailable',
      rawAvailability: raw,
      message: 'Gemini Nano no está disponible en este dispositivo.',
      actions: [
        'Verifica los flags en chrome://flags.',
        'Revisa chrome://on-device-internals.',
        'Prueba con Ollama o Cloud como alternativa.',
      ],
    };
  } catch (err) {
    return {
      apiSurface: surface,
      status: 'error',
      rawAvailability: undefined,
      message: `Error al verificar Gemini Nano: ${(err as Error).message}`,
      actions: [
        'Reinicia Chrome e intenta de nuevo.',
        'Revisa chrome://on-device-internals.',
      ],
    };
  }
}

// ── Session (internal) ──

interface ChromeSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

// ── Provider ──

export class ChromePromptProvider implements AIProvider {
  readonly name = 'Chrome AI / Gemini Nano';
  readonly type = 'chrome' as const;

  private model = 'gemini-nano';
  private temperature: number;
  private session: ChromeSession | null = null;
  private sessionPromise: Promise<ChromeSession> | null = null;
  private pendingMonitor: DownloadMonitor | null = null;
  private networkGuard: NetworkGuard | null = null;
  private privacyReceiptService: PrivacyReceiptService | null = null;

  constructor(temperature: number = 0.1) {
    this.temperature = temperature;
  }

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
    availability: NormalizedAvailability
  ): Promise<PrivacyReceipt> {
    this.privacyReceiptService = new PrivacyReceiptService();
    this.privacyReceiptService.startTracking();
    return this.privacyReceiptService.generateReceipt(data, columns, networkResult, availability);
  }

  private async createSession(
    onDownloadProgress?: (progress: number, message: string) => void,
  ): Promise<ChromeSession> {
    const surface = detectApiSurface();

    if (surface === 'none') {
      throw new Error('Chrome AI API no detectada en este navegador.');
    }

    try {
      // Modern global LanguageModel (Chrome 138+)
      if (surface === 'LanguageModel') {
        const session = await globalThis.LanguageModel!.create({
          temperature: this.temperature,
          topK: 40,
          monitor(m) {
            m.addEventListener('downloadprogress', (e: DownloadProgressEvent) => {
              const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
              onDownloadProgress?.(pct, `Descargando Gemini Nano ${pct}%`);
            });
          },
        });
        return session;
      }

      // window.ai.languageModel (Chrome 127-137)
      if (surface === 'window.ai.languageModel') {
        const session = await window.ai!.languageModel!.create({
          temperature: this.temperature,
          topK: 40,
          monitor(m) {
            m.addEventListener('downloadprogress', (e: any) => {
              const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
              onDownloadProgress?.(pct, `Descargando Gemini Nano ${pct}%`);
            });
          },
        });
        return session;
      }

      // Legacy window.ai.assistant
      if (surface === 'window.ai.assistant') {
        const ai = await window.ai!.assistant!();
        const session = await ai.create({ temperature: this.temperature });
        return session as unknown as ChromeSession;
      }

      throw new Error('No se pudo crear sesión de Chrome AI.');
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('activation') || msg.includes('user')) {
        throw new Error('Chrome requiere interacción del usuario para activar Gemini Nano. Pulsa "Preparar Gemini Nano".');
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

  // ── AIProvider Implementation ──

  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<ProviderMetrics> {
    const diag = await getChromeAiDiagnostic();
    if (diag.status !== 'available') {
      onChunk(`⚠️ ${diag.message}`);
      return this.emptyMetrics();
    }

    const prompt = buildAnalysisPrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;

    try {
      const session = await this.getSession();
      const stream = session.promptStreaming(prompt);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let previousText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;

        const delta = text.slice(previousText.length);
        if (delta) {
          tokensGenerated += Math.round(delta.length / 4);
          onChunk(delta);
        }
        previousText = text;
      }
    } catch (error) {
      console.error('Chrome AI Error:', error);
      onChunk(`\n\n**Error:** ${(error as Error).message}`);
    }

    const totalTime = performance.now() - startTime;
    return {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(totalTime),
      firstTokenMs: Math.round(firstTokenTime),
      tokensGenerated,
      isLocal: true,
      timestamp: new Date().toISOString(),
    };
  }

  async generateExecutiveReport(
    report: AuditReport,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    const diag = await getChromeAiDiagnostic();
    if (diag.status !== 'available') throw new Error(diag.message);

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    try {
      const session = await this.getSession();
      const response = await session.prompt(prompt);
      const totalTime = performance.now() - startTime;

      let content: ExecutiveReportContent;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        content = jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackContent(report, response);
      } catch {
        content = this.fallbackContent(report, response);
      }

      return {
        content,
        metrics: {
          provider: this.name,
          model: this.model,
          latencyMs: Math.round(totalTime),
          firstTokenMs: Math.round(totalTime),
          tokensGenerated: Math.round(response.length / 4),
          isLocal: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Chrome AI error: ${(error as Error).message}`);
    }
  }

  async generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    const diag = await getChromeAiDiagnostic();
    if (diag.status !== 'available') throw new Error(diag.message);

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let fullText = '';

    try {
      const session = await this.getSession();
      const stream = session.promptStreaming(prompt);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let previousText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;

        const delta = text.slice(previousText.length);
        if (delta) {
          tokensGenerated += Math.round(delta.length / 4);
          fullText += delta;
          onChunk(delta);
        }
        previousText = text;
      }
    } catch (error) {
      throw new Error(`Chrome AI streaming error: ${(error as Error).message}`);
    }

    const totalTime = performance.now() - startTime;
    let content: ExecutiveReportContent;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      content = jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackContent(report, fullText);
    } catch {
      content = this.fallbackContent(report, fullText);
    }

    return {
      content,
      metrics: {
        provider: this.name,
        model: this.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(firstTokenTime),
        tokensGenerated,
        isLocal: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    const diag = await getChromeAiDiagnostic();
    if (diag.status !== 'available') throw new Error(diag.message);

    const startTime = performance.now();
    const session = await this.getSession();
    const response = await session.prompt(prompt);
    const totalTime = performance.now() - startTime;

    return {
      text: response,
      metrics: {
        provider: this.name,
        model: this.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: Math.round(response.length / 4),
        isLocal: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async generateTextWithProgress(
    prompt: string,
    onProgress: (event: ProviderProgressEvent) => void,
  ): Promise<{ text: string; metrics: ProviderMetrics }> {
    onProgress({ stage: 'checking', message: 'Verificando disponibilidad de Chrome AI' });

    const diag = await getChromeAiDiagnostic();

    if (diag.status === 'downloadable') {
      onProgress({
        stage: 'downloading',
        progress: 0,
        message: 'Gemini Nano necesita descargarse. Iniciando descarga...',
      });

      // Create session with monitor to track download
      const session = await this.getSession((pct, msg) => {
        onProgress({ stage: 'downloading', progress: pct, message: msg });
      });

      onProgress({ stage: 'loading', message: 'Modelo descargado. Creando sesión...' });

      const startTime = performance.now();
      let firstTokenTime = 0;
      let tokensGenerated = 0;
      let fullText = '';

      try {
        onProgress({ stage: 'generating', message: 'Generando diagnóstico con Gemini Nano' });
        const stream = session.promptStreaming(prompt);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let previousText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;
          const delta = text.slice(previousText.length);
          if (delta) {
            tokensGenerated += Math.round(delta.length / 4);
            fullText += delta;
          }
          previousText = text;
        }

        const totalTime = performance.now() - startTime;
        onProgress({ stage: 'completed', progress: 100, message: 'Diagnóstico completado con Chrome AI' });

        return {
          text: fullText,
          metrics: {
            provider: this.name,
            model: this.model,
            latencyMs: Math.round(totalTime),
            firstTokenMs: Math.round(firstTokenTime),
            tokensGenerated,
            isLocal: true,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        onProgress({ stage: 'error', message: (error as Error).message });
        throw error;
      }
    }

    if (diag.status !== 'available') {
      onProgress({ stage: 'error', message: diag.message });
      throw new Error(diag.message);
    }

    onProgress({ stage: 'loading', message: 'Creando sesión de Gemini Nano' });

    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let fullText = '';

    try {
      const session = await this.getSession();
      onProgress({ stage: 'generating', message: 'Generando diagnóstico con Gemini Nano' });

      const stream = session.promptStreaming(prompt);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let previousText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;
        const delta = text.slice(previousText.length);
        if (delta) {
          tokensGenerated += Math.round(delta.length / 4);
          fullText += delta;
        }
        previousText = text;
      }

      const totalTime = performance.now() - startTime;
      onProgress({ stage: 'completed', progress: 100, message: 'Diagnóstico completado con Chrome AI' });

      return {
        text: fullText,
        metrics: {
          provider: this.name,
          model: this.model,
          latencyMs: Math.round(totalTime),
          firstTokenMs: Math.round(firstTokenTime),
          tokensGenerated,
          isLocal: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      onProgress({ stage: 'error', message: (error as Error).message });
      throw error;
    }
  }

  async preloadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    const diag = await getChromeAiDiagnostic();

    if (diag.status === 'available') {
      onProgress?.(100, 'Gemini Nano ya está disponible.');
      return;
    }

    if (diag.status === 'downloadable') {
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

    onProgress?.(0, diag.message);
    throw new Error(diag.message);
  }

  async unloadModel(): Promise<void> {
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
