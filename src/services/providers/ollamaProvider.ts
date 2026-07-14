/**
 * OllamaProvider — Ollama local server provider.
 * 
 * Connects to a local Ollama instance (default http://localhost:11434).
 * Supports model listing, downloading, and chat/generate with streaming.
 * 
 * Security: only localhost endpoints by default.
 */

import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent, ProviderProgressEvent, AIConfig, ProviderTextResult, ProviderTextRequestOptions } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt, buildCompactAnalysisPrompt } from './prompts';
import { normalizeAiProviderError } from './errors';
import { DEFAULT_OLLAMA_MODEL_ID, OLLAMA_MODELS } from '../modelRegistry';
import { resolveOllamaInferenceConfig } from '../ollamaInferenceConfig';

export interface OllamaModel {
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

interface OllamaUsageFields {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  done_reason?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = DEFAULT_OLLAMA_MODEL_ID;
const COMPACT_MARGIN = 2048;

export const OLLAMA_SUGGESTED_MODELS = OLLAMA_MODELS
  .filter((model) => model.recommended)
  .map((model) => model.id);

const nanosecondsToMilliseconds = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value / 1_000_000)
    : undefined;

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama';
  readonly type = 'ollama' as const;

  private model: string;
  private temperature: number;
  private baseUrl: string;
  private aiConfig?: AIConfig;
  private numCtx: number;
  private numPredict: number;
  private topP: number;
  private seed: number | null;
  private keepAlive: string;
  private timeoutSeconds: number;

  constructor(
    model: string = DEFAULT_MODEL,
    temperature: number = 0.1,
    baseUrl: string = DEFAULT_BASE_URL,
    aiConfig?: AIConfig,
  ) {
    this.model = model;
    this.temperature = temperature;
    this.baseUrl = baseUrl;
    this.aiConfig = aiConfig;
    const inference = resolveOllamaInferenceConfig(aiConfig ?? { temperature });
    this.numCtx = inference.numCtx;
    this.numPredict = inference.numPredict;
    this.topP = inference.topP;
    this.seed = inference.seed;
    this.keepAlive = inference.keepAlive;
    this.timeoutSeconds = inference.timeoutSeconds;
  }

  private buildOptions(): Record<string, unknown> {
    return {
      temperature: this.temperature,
      top_p: this.topP,
      num_ctx: this.numCtx,
      num_predict: this.numPredict,
      ...(this.seed === null ? {} : { seed: this.seed }),
    };
  }

  private estimatePromptTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private needsCompactPrompt(promptText: string): boolean {
    const estimated = this.estimatePromptTokens(promptText);
    return estimated > this.numCtx - COMPACT_MARGIN;
  }

  private buildMetrics(
    observedLatencyMs: number,
    firstTokenMs: number,
    generatedText: string,
    usage: OllamaUsageFields & { observedModel?: string } = {},
  ): ProviderMetrics {
    const observed = (typeof usage.observedModel === 'string' && usage.observedModel.length > 0)
      ? usage.observedModel
      : null;
    return {
      provider: this.name,
      model: observed,
      latencyMs: Math.round(observedLatencyMs),
      firstTokenMs: Math.round(firstTokenMs),
      tokensGenerated: usage.eval_count ?? Math.round(generatedText.length / 4),
      promptTokens: usage.prompt_eval_count,
      totalDurationMs: nanosecondsToMilliseconds(usage.total_duration),
      loadDurationMs: nanosecondsToMilliseconds(usage.load_duration),
      promptEvalDurationMs: nanosecondsToMilliseconds(usage.prompt_eval_duration),
      evalDurationMs: nanosecondsToMilliseconds(usage.eval_duration),
      reasoningTokens: null,
      finishReason: typeof usage.done_reason === 'string' ? usage.done_reason : null,
      isLocal: true,
      timestamp: new Date().toISOString(),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama no responde: ${response.status}`);
    }
    const data = await response.json();
    return data.models || [];
  }

  async pullModel(
    model: string,
    onProgress?: (progress: number, message: string) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Error al descargar modelo: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No se pudo leer respuesta de streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.total && event.completed) {
            const pct = Math.round((event.completed / event.total) * 100);
            onProgress?.(pct, event.status || `Descargando ${model}...`);
          } else if (event.status) {
            onProgress?.(event.status === 'success' ? 100 : 0, event.status);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async generateText(prompt: string, requestOptions?: ProviderTextRequestOptions): Promise<ProviderTextResult> {
    const startTime = performance.now();
    let fullText = '';

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          think: false,
          options: this.buildOptions(),
          ...(requestOptions?.responseSchema ? { format: requestOptions.responseSchema } : {}),
          keep_alive: this.keepAlive,
          stream: false,
        }),
        signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      });

      if (!response.ok) {
        let detail = '';
        try {
          const bodyText = await response.text();
          if (bodyText) {
            try {
              const bodyJson = JSON.parse(bodyText);
              detail = bodyJson.error || bodyJson.message || bodyText;
            } catch {
              detail = bodyText.slice(0, 200);
            }
          }
        } catch {
          detail = '';
        }
        throw new Error(`Ollama error ${response.status}${detail ? ': ' + detail : ''}`);
      }

      const data = await response.json();
      fullText = data.message?.content || '';
      const thinking = data.message?.thinking || undefined;
      const observedModel = typeof data.model === 'string' ? data.model : undefined;

      const totalTime = performance.now() - startTime;

      return {
        text: fullText,
        thinking,
        metrics: this.buildMetrics(totalTime, totalTime, fullText, { ...data, observedModel }),
      };
    } catch (error) {
      const normalized = this.aiConfig
        ? normalizeAiProviderError(error, this.aiConfig)
        : {
            title: 'Error en Ollama',
            message: (error as Error).message,
            cause: (error as Error).message,
            recommendedActions: ['Verifica que Ollama esté abierto', 'Revisa OLLAMA_ORIGINS si hay CORS'],
            technicalMessage: (error as Error).stack || (error as Error).message,
            evidenceStatus: 'attempted_failed' as const,
            category: 'generic' as const,
          };
      throw new Error(normalized.message);
    }
  }

  async generateTextWithProgress(
    prompt: string,
    onProgress: (event: ProviderProgressEvent) => void,
    requestOptions?: ProviderTextRequestOptions,
  ): Promise<ProviderTextResult> {
    onProgress({ stage: 'checking', message: 'Verificando conexión con Ollama' });

    if (!(await this.isAvailable())) {
      onProgress({ stage: 'error', message: 'Ollama no responde en ' + this.baseUrl });
      throw new Error('Ollama no disponible');
    }

    onProgress({ stage: 'loading', message: 'Enviando prompt a Ollama' });

    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let fullText = '';
    let thinking = '';
    let usage: OllamaUsageFields = {};
    let observedModel: string | undefined;

    try {
      onProgress({ stage: 'generating', message: 'Generando respuesta' });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          think: false,
          options: this.buildOptions(),
          ...(requestOptions?.responseSchema ? { format: requestOptions.responseSchema } : {}),
          keep_alive: this.keepAlive,
          stream: true,
        }),
      });

      if (!response.ok) {
        let detail = '';
        try {
          const bodyText = await response.text();
          if (bodyText) {
            try {
              const bodyJson = JSON.parse(bodyText);
              detail = bodyJson.error || bodyJson.message || bodyText;
            } catch {
              detail = bodyText.slice(0, 200);
            }
          }
        } catch {
          detail = '';
        }
        throw new Error(`Ollama error ${response.status}${detail ? ': ' + detail : ''}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo leer streaming');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const content = event.message?.content || '';
            const thinkingChunk = event.message?.thinking || '';
            if (thinkingChunk) thinking += thinkingChunk;
            usage = { ...usage, ...event };
            if (typeof event.model === 'string' && event.model.length > 0) {
              observedModel = event.model;
            }
            if (content) {
              if (firstTokenTime === 0) {
                firstTokenTime = performance.now() - startTime;
              }
              tokensGenerated += Math.round(content.length / 4);
              fullText += content;
              onProgress({ stage: 'generating', message: 'Recibiendo respuesta del modelo', chunk: content });
            }
          } catch {
            // skip malformed
          }
        }
      }

      const totalTime = performance.now() - startTime;
      onProgress({ stage: 'completed', progress: 100, message: 'Diagnóstico completado' });

      const metricsUsage = usage.eval_count === undefined
        ? { ...usage, eval_count: tokensGenerated, observedModel }
        : { ...usage, observedModel };
      return {
        text: fullText,
        thinking: thinking || undefined,
        metrics: this.buildMetrics(
          totalTime,
          firstTokenTime,
          fullText,
          metricsUsage,
        ),
      };
    } catch (error) {
      onProgress({ stage: 'error', message: (error as Error).message });
      throw error;
    }
  }

  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<ProviderMetrics> {
    if (!(await this.isAvailable())) {
      onChunk('⚠️ Ollama no disponible. Verifica que el servidor esté abierto en ' + this.baseUrl);
      return this.emptyMetrics();
    }

    const fullPrompt = buildAnalysisPrompt(report);
    const prompt = this.needsCompactPrompt(fullPrompt)
      ? buildCompactAnalysisPrompt(report)
      : fullPrompt;
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let usage: OllamaUsageFields = {};
    let observedModel: string | undefined;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          think: false,
          options: this.buildOptions(),
          keep_alive: this.keepAlive,
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No streaming available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const content = event.message?.content || '';
            usage = { ...usage, ...event };
            if (typeof event.model === 'string' && event.model.length > 0) {
              observedModel = event.model;
            }
            if (content) {
              if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;
              tokensGenerated += Math.round(content.length / 4);
              onChunk(content);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (error) {
      console.error('Ollama stream error:', error);
      onChunk(`\n\n**Error Ollama:** ${(error as Error).message}`);
    }

    const totalTime = performance.now() - startTime;
    return this.buildMetrics(
      totalTime,
      firstTokenTime,
      '',
      usage.eval_count === undefined ? { ...usage, eval_count: tokensGenerated, observedModel } : { ...usage, observedModel },
    );
  }

  async generateExecutiveReport(
    report: AuditReport,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!(await this.isAvailable())) {
      throw new Error('Ollama no disponible');
    }

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        think: false,
        options: this.buildOptions(),
        keep_alive: this.keepAlive,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const data = await response.json();
    const text = data.message?.content || '';
    const observedModel: string | undefined = typeof data.model === 'string' ? data.model : undefined;

    const totalTime = performance.now() - startTime;

    let content: ExecutiveReportContent;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      content = jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackContent(report, text);
    } catch {
      content = this.fallbackContent(report, text);
    }

    return {
      content,
      metrics: this.buildMetrics(totalTime, totalTime, text, { ...data, observedModel }),
    };
  }

  async generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void,
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!(await this.isAvailable())) {
      throw new Error('Ollama no disponible');
    }

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let fullText = '';
    let usage: OllamaUsageFields = {};
    let observedModel: string | undefined;

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          think: false,
          options: this.buildOptions(),
          keep_alive: this.keepAlive,
          stream: true,
        }),
      });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          const content = event.message?.content || '';
          usage = { ...usage, ...event };
          if (typeof event.model === 'string' && event.model.length > 0) {
            observedModel = event.model;
          }
          if (content) {
            if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;
            tokensGenerated += Math.round(content.length / 4);
            fullText += content;
            onChunk(content);
          }
        } catch {
          // skip
        }
      }
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
      metrics: this.buildMetrics(
        totalTime,
        firstTokenTime,
        fullText,
        usage.eval_count === undefined ? { ...usage, eval_count: tokensGenerated, observedModel } : { ...usage, observedModel },
      ),
    };
  }

  async preloadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      onProgress?.(0, 'Ollama no disponible');
      throw new Error('Ollama no disponible');
    }

    const models = await this.listModels();
    const installed = models.some(m => m.name === this.model || m.name.startsWith(this.model));

    if (installed) {
      onProgress?.(100, `Modelo ${this.model} disponible en Ollama`);
      return;
    }

    onProgress?.(0, `Descargando ${this.model}...`);
    await this.pullModel(this.model, onProgress);
  }

  async unloadModel(): Promise<void> {
    // Ollama manages models server-side; no client unload needed
  }

  private fallbackContent(report: AuditReport, rawText: string): ExecutiveReportContent {
    return {
      title: 'AURA - Informe Ollama',
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
      model: null,
      latencyMs: 0,
      firstTokenMs: 0,
      tokensGenerated: 0,
      isLocal: true,
      timestamp: new Date().toISOString(),
    };
  }
}
