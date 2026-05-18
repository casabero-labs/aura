/**
 * OpenAIProvider — Implementación genérica de AIProvider para APIs OpenAI-compatibles.
 * 
 * Soporta cualquier proveedor que implemente la especificación OpenAI Chat Completions:
 * - Groq (api.groq.com/openai/v1)
 * - DeepSeek (api.deepseek.com/v1)
 * - OpenRouter (openrouter.ai/api/v1)
 * - MiniMax (api.minimax.io/v1)
 * - Azure OpenAI (con el formato correcto de baseURL)
 * 
 * Referencia TFM: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * 
 * Mecanismos anti-alucinación:
 * - M1: Temperatura configurable (baja varianza estocástica)
 * - M2: Anclaje semántico via Smart Sample JSON
 * - M3: Paradigma Copy-Paste (bad_samples textuales)
 * - M4: Cadena de razonamiento forzada (5 pasos)
 * - M5: Structured JSON output (reporte ejecutivo)
 */

import {
  AuditReport,
  AIProvider,
  ProviderMetrics,
  ExecutiveReportContent
} from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';

/** Configuración para el proveedor OpenAI-compatible */
export interface OpenAIProviderConfig {
  /** URL base del proveedor (ej: https://api.groq.com/openai/v1) */
  baseURL: string;
  /** Clave API del proveedor */
  apiKey: string;
  /** Modelo a utilizar (ej: mixtral-8x7b-32768, deepseek-chat, etc.) */
  model: string;
  /** Temperatura para control de varianza estocástica (0.0 - 1.0) */
  temperature?: number;
  /** Nombre identificable del proveedor (ej: "Groq", "DeepSeek"). Si no se pasa, se infiere de la baseURL */
  providerName?: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name: string;
  readonly type: 'cloud' = 'cloud';

  private baseURL: string;
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor(config: OpenAIProviderConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Normalizar: quitar trailing slash
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.1;
    
    // Si no se pasa nombre, inferir de la baseURL
    this.name = config.providerName ?? this.inferProviderName(config.baseURL);
  }

  /**
   * Infiere el nombre del proveedor desde la baseURL.
   * Útil cuando no se especifica providerName manualmente.
   */
  private inferProviderName(baseURL: string): string {
    const url = baseURL.toLowerCase();
    if (url.includes('groq')) return 'Groq';
    if (url.includes('deepseek')) return 'DeepSeek';
    if (url.includes('openrouter')) return 'OpenRouter';
    if (url.includes('minimax')) return 'MiniMax';
    if (url.includes('azure')) return 'Azure OpenAI';
    if (url.includes('openai')) return 'OpenAI';
    return 'OpenAI-Compatible';
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0 && this.baseURL.trim().length > 0;
  }

  /**
   * Wrapper interno para hacer requests al endpoint de Chat Completions.
   */
  private async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: {
      stream?: boolean;
      temperature?: number;
      response_format?: { type: 'json_object' };
    } = {}
  ): Promise<Response> {
    const { stream = false, temperature, response_format } = options;

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(stream ? { 'Accept': 'text/event-stream' } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream,
        temperature: temperature ?? this.temperature,
        ...(response_format ? { response_format } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI API Error ${response.status}: ${errorBody}`);
    }

    return response;
  }

  /**
   * Análisis streaming con mecanismos M1-M4.
   * Retorna métricas de rendimiento para el benchmark (OE2).
   */
  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<ProviderMetrics> {
    if (!await this.isAvailable()) {
      onChunk('⚠️ Configuración incompleta. Por favor, verifica baseURL y API key.');
      return this.emptyMetrics();
    }

    const prompt = buildAnalysisPrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;

    try {
      const response = await this.chatCompletion(
        [{ role: 'user', content: prompt }],
        { stream: true }
      );

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              if (firstTokenTime === 0) {
                firstTokenTime = performance.now() - startTime;
              }
              tokensGenerated += content.split(/\s+/).filter(Boolean).length;
              onChunk(content);
            }
          } catch {
            // Ignorar líneas JSON inválidas (error messages en streaming)
          }
        }
      }
    } catch (error) {
      console.error('OpenAI Provider Error:', error);
      onChunk(`\n\n**Error analyzing data with AI:** ${(error as Error).message}`);
    }

    const totalTime = performance.now() - startTime;

    return {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(totalTime),
      firstTokenMs: Math.round(firstTokenTime),
      tokensGenerated,
      isLocal: false,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reporte ejecutivo con mecanismo M5 (Structured JSON Output).
   * Hace una llamada regular (no streaming) y parsea el JSON de respuesta.
   */
  async generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('Configuración incompleta: baseURL o API key no proporcionadas');
    }

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    // Many OpenAI-compatible APIs don't support response_format with json_object
    // in non-tool-calling mode, so we parse the response text as JSON
    const response = await this.chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: this.temperature }
    );

    const responseText = await response.text();
    const totalTime = performance.now() - startTime;
    const apiPayload = JSON.parse(responseText);
    const messageText = apiPayload.choices?.[0]?.message?.content || responseText;

    let content: ExecutiveReportContent;
    try {
      content = JSON.parse(messageText);
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = messageText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se pudo parsear la respuesta como JSON');
      }
    }

    const metrics: ProviderMetrics = {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(totalTime),
      firstTokenMs: Math.round(totalTime),
      tokensGenerated: messageText.split(/\s+/).filter(Boolean).length,
      isLocal: false,
      timestamp: new Date().toISOString()
    };

    return { content, metrics };
  }

  /**
   * Respuesta libre para benchmarks de prompt no controlado.
   */
  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('Configuración incompleta: baseURL o API key no proporcionadas');
    }

    const startTime = performance.now();
    const response = await this.chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: this.temperature }
    );

    const responseText = await response.text();
    const totalTime = performance.now() - startTime;
    const apiPayload = JSON.parse(responseText);
    const text = apiPayload.choices?.[0]?.message?.content || responseText;

    return {
      text,
      metrics: {
        provider: this.name,
        model: this.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: text.split(/\s+/).filter(Boolean).length,
        isLocal: false,
        timestamp: new Date().toISOString()
      }
    };
  }

  async preloadModel(_onProgress?: (progress: number, message: string) => void): Promise<void> {
    // Cloud providers don't need model preloading
    return;
  }

  private emptyMetrics(): ProviderMetrics {
    return {
      provider: this.name,
      model: this.model,
      latencyMs: 0,
      firstTokenMs: 0,
      tokensGenerated: 0,
      isLocal: false,
      timestamp: new Date().toISOString()
    };
  }
}
