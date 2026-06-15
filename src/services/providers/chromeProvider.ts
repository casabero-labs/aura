/**
 * ChromePromptProvider — Gemini Nano via Chrome Built-in AI API.
 * 
 * Referencia TFM: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Usa la API moderna de Chrome (LanguageModel / window.ai).
 * No requiere API key, no envía datos fuera del dispositivo.
 * 
 * Requisitos:
 * - Chrome 127+ con "Built-in AI" habilitado
 * - chrome://flags/#prompt-api-for-gemini-nano = Enabled
 * - chrome://flags/#optimization-guide-on-device-model = Enabled
 * 
 * Mecanismos anti-alucinación aplicados:
 * - M1: Temperatura 0.1 (baja varianza estocástica)
 * - M2: Anclaje semántico via Smart Sample JSON
 * - M3: Paradigma Copy-Paste (bad_samples textuales)
 * - M4: Cadena de razonamiento forzada
 * - M5: Structured JSON output
 */

import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent, ProviderProgressEvent } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';

// Chrome AI types (modern LanguageModel API)
interface LanguageModelAvailability {
  available: 'readily' | 'after-download' | 'no';
}

interface LanguageModel {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

interface ChromeAI {
  languageModel?: {
    availability(options?: { expectedInputLanguages?: string[] }): Promise<LanguageModelAvailability>;
    create(options?: { systemPrompt?: string; temperature?: number; topK?: number }): Promise<LanguageModel>;
  };
  assistant?: () => Promise<{
    create(options?: { systemPrompt?: string; temperature?: number }): Promise<unknown>;
    capabilities(): Promise<{ available: boolean; defaultTemperature: number }>;
  }>;
}

declare global {
  interface Window {
    ai?: ChromeAI;
  }
}

export class ChromePromptProvider implements AIProvider {
  readonly name = 'Chrome AI / Gemini Nano';
  readonly type = 'chrome' as const;

  private model = 'gemini-nano';
  private temperature: number;
  private session: LanguageModel | null = null;
  private sessionPromise: Promise<LanguageModel> | null = null;

  constructor(temperature: number = 0.1) {
    this.temperature = temperature;
  }

  async getAvailabilityDetails(): Promise<{ available: boolean; downloading: boolean; reason: string }> {
    if (typeof window === 'undefined' || !window.ai) {
      return { available: false, downloading: false, reason: 'Chrome AI API no presente en este navegador.' };
    }

    try {
      if (window.ai.languageModel) {
        const result = await window.ai.languageModel.availability();
        if (result.available === 'readily') {
          return { available: true, downloading: false, reason: 'Gemini Nano disponible.' };
        }
        if (result.available === 'after-download') {
          return { available: false, downloading: true, reason: 'Chrome necesita descargar Gemini Nano. No cierres esta pestaña.' };
        }
        return { available: false, downloading: false, reason: 'Gemini Nano no disponible en este dispositivo.' };
      }

      // Fallback to old assistant() API
      if (window.ai.assistant) {
        const ai = await window.ai.assistant();
        const caps = await ai.capabilities();
        return { available: caps.available, downloading: false, reason: caps.available ? 'Disponible via API legacy.' : 'No disponible via API legacy.' };
      }

      return { available: false, downloading: false, reason: 'API de Chrome AI no detectada.' };
    } catch {
      return { available: false, downloading: false, reason: 'Error al verificar disponibilidad de Chrome AI.' };
    }
  }

  async isAvailable(): Promise<boolean> {
    const details = await this.getAvailabilityDetails();
    return details.available;
  }

  private async getSession(): Promise<LanguageModel> {
    if (!this.sessionPromise) {
      this.sessionPromise = (async () => {
        if (typeof window === 'undefined' || !window.ai) {
          throw new Error('Chrome AI API no disponible');
        }

        // Try modern LanguageModel API first
        if (window.ai.languageModel) {
          const session = await window.ai.languageModel.create({
            temperature: this.temperature,
            topK: 40,
          });
          this.session = session;
          return session;
        }

        // Fallback to legacy assistant() API
        if (window.ai.assistant) {
          const ai = await window.ai.assistant();
          const legacySession = await ai.create({ temperature: this.temperature });
          this.session = legacySession as unknown as LanguageModel;
          return this.session;
        }

        throw new Error('Chrome AI API no disponible');
      })();
    }
    return this.sessionPromise;
  }

  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<ProviderMetrics> {
    if (!await this.isAvailable()) {
      onChunk('⚠️ Chrome AI no disponible. Habilitá en chrome://flags/#prompt-api-for-gemini-nano');
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
        if (firstTokenTime === 0) {
          firstTokenTime = performance.now() - startTime;
        }

        // Streaming de Chrome devuelve el texto acumulado, enviamos solo el delta
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
      timestamp: new Date().toISOString()
    };
  }

  async generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('Chrome AI API no disponible');
    }

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    try {
      const session = await this.getSession();
      const response = await session.prompt(prompt);
      const totalTime = performance.now() - startTime;

      let content: ExecutiveReportContent;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = JSON.parse(jsonMatch[0]);
        } else {
          content = this.fallbackContent(report, response);
        }
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
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`Chrome AI error: ${(error as Error).message}`);
    }
  }

  async generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('Chrome AI API no disponible');
    }

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
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        content = this.fallbackContent(report, fullText);
      }
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
        timestamp: new Date().toISOString()
      }
    };
  }

  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('Chrome AI API no disponible');
    }

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
        timestamp: new Date().toISOString()
      }
    };
  }

  async generateTextWithProgress(
    prompt: string,
    onProgress: (event: ProviderProgressEvent) => void,
  ): Promise<{ text: string; metrics: ProviderMetrics }> {
    onProgress({ stage: 'checking', message: 'Verificando disponibilidad de Chrome AI' });

    const availability = await this.getAvailabilityDetails();

    if (availability.downloading) {
      onProgress({
        stage: 'downloading',
        message: 'Chrome está descargando Gemini Nano. No cierres esta pestaña.',
      });

      // Wait and retry — Chrome downloads automatically in background
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retry = await this.getAvailabilityDetails();
        if (retry.available) break;
        if (!retry.downloading) {
          onProgress({ stage: 'error', message: 'Descarga de Gemini Nano falló. Revisa chrome://flags.' });
          throw new Error('Chrome AI descarga fallida');
        }
      }

      const finalCheck = await this.getAvailabilityDetails();
      if (!finalCheck.available) {
        onProgress({ stage: 'error', message: 'Gemini Nano no se completó. Intenta en chrome://flags.' });
        throw new Error('Chrome AI no disponible tras esperar descarga');
      }
    }

    if (!availability.available && !availability.downloading) {
      onProgress({ stage: 'error', message: availability.reason });
      throw new Error(availability.reason);
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
    const availability = await this.getAvailabilityDetails();

    if (availability.available) {
      onProgress?.(100, 'Gemini Nano ya está disponible.');
      return;
    }

    if (availability.downloading) {
      onProgress?.(50, 'Chrome está descargando Gemini Nano. No cierres esta pestaña.');

      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retry = await this.getAvailabilityDetails();
        if (retry.available) {
          onProgress?.(100, 'Gemini Nano listo.');
          return;
        }
        if (!retry.downloading) break;
        onProgress?.(50 + Math.min(i * 2, 40), 'Descargando Gemini Nano...');
      }
    }

    onProgress?.(0, 'Chrome AI no disponible. Revisa chrome://flags/#prompt-api-for-gemini-nano');
    throw new Error('Chrome AI no disponible');
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
      timestamp: new Date().toISOString()
    };
  }
}
