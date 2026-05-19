/**
 * ChromePromptProvider — Gemini Nano via Chrome Built-in AI (Prompt API).
 * 
 * Referencia TFM: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Usa el modelo Gemini Nano integrado en Chrome (chrome://flags/#prompt-api-for-gemini-nano).
 * No requiere API key, no envía datos fuera del dispositivo.
 * 
 * Requisitos:
 * - Chrome 127+ con "Built-in AI" habilitado
 * - chrome://flags/#prompt-api-for-gemini-nano = Enabled
 * - chrome://flags/#optimization-guide-debug-mode = Enabled (dev)
 * 
 * Mecanismos anti-alucinación aplicados:
 * - M1: Temperatura 0.1 (baja varianza estocástica)
 * - M2: Anclaje semántico via Smart Sample JSON
 * - M3: Paradigma Copy-Paste (bad_samples textuales)
 * - M4: Cadena de razonamiento forzada
 * - M5: Structured JSON output
 */

import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';

// Chrome AI Prompt API types (experimental)
interface ChromeSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

interface ChromeAI {
  assistant(): Promise<{
    create(options?: { systemPrompt?: string; temperature?: number }): Promise<ChromeSession>;
    capabilities(): Promise<{ available: boolean; defaultTemperature: number }>;
  }>;
}

declare global {
  interface Window {
    ai?: ChromeAI;
  }
}

export class ChromePromptProvider implements AIProvider {
  readonly name = 'Chrome AI';
  readonly type = 'local' as const;

  private model = 'gemini-nano';
  private temperature: number;
  private session: ChromeSession | null = null;
  private sessionPromise: Promise<ChromeSession> | null = null;

  constructor(temperature: number = 0.1) {
    this.temperature = temperature;
  }

  private async getCapabilities(): Promise<{ available: boolean; defaultTemperature: number }> {
    if (typeof window === 'undefined' || !window.ai) {
      return { available: false, defaultTemperature: 0 };
    }
    try {
      const ai = await window.ai.assistant();
      return await ai.capabilities();
    } catch {
      return { available: false, defaultTemperature: 0 };
    }
  }

  async isAvailable(): Promise<boolean> {
    const caps = await this.getCapabilities();
    return caps.available;
  }

  private async getSession(): Promise<ChromeSession> {
    if (!this.sessionPromise) {
      this.sessionPromise = (async () => {
        if (typeof window === 'undefined' || !window.ai) {
          throw new Error('Chrome AI API no disponible');
        }
        const ai = await window.ai.assistant();
        const session = await ai.create({
          temperature: this.temperature,
        });
        this.session = session;
        return session;
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

  async preloadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    // Chrome Nano se descarga y gestiona automáticamente por el navegador
    // Solo verificamos disponibilidad
    const available = await this.isAvailable();
    if (!available) {
      onProgress?.(0, 'Chrome AI no disponible. Revisá chrome://flags');
      throw new Error('Chrome AI no disponible');
    }
    onProgress?.(100, 'Gemini Nano listo');
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
