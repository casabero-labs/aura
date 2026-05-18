/**
 * GeminiProvider — Implementación de AIProvider para Google Gemini (Cloud).
 * 
 * Referencia TFM: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Este proveedor conecta con la API de Google Gemini para
 * análisis cognitivo de los resultados del motor determinista.
 * 
 * Mecanismos anti-alucinación aplicados:
 * - M1: Temperatura 0.1 (baja varianza estocástica)
 * - M2: Anclaje semántico via Smart Sample JSON
 * - M3: Paradigma Copy-Paste (bad_samples textuales)
 * - M4: Cadena de razonamiento forzada (5 pasos)
 * - M5: Structured JSON output (reporte ejecutivo)
 */

import { GoogleGenAI, Type } from '@google/genai';
import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';

export class GeminiProvider implements AIProvider {
  readonly name = 'Gemini';
  readonly type = 'cloud' as const;
  
  private apiKey: string;
  private model: string;
  private temperature: number;
  private _client: GoogleGenAI | null = null;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash', temperature: number = 0.1) {
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
  }

  private get client(): GoogleGenAI {
    if (!this._client) {
      this._client = new GoogleGenAI({ apiKey: this.apiKey || 'empty' });
    }
    return this._client;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0;
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
      onChunk('⚠️ API_KEY no configurada. Por favor, configúrala en el panel de ajustes.');
      return this.emptyMetrics();
    }

    const prompt = buildAnalysisPrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;

    try {
      const responseStream = await this.client.models.generateContentStream({
        model: this.model,
        contents: prompt,
        config: {
          temperature: this.temperature, // M1: Control de varianza estocástica
        },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          if (firstTokenTime === 0) {
            firstTokenTime = performance.now() - startTime;
          }
          tokensGenerated += Math.round(chunk.text.length / 4);
          onChunk(chunk.text);
        }
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
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
   * Usa responseSchema para forzar formato exacto.
   */
  async generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('API_KEY no encontrada');
    }

    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            domain_inferred: { type: Type.STRING },
            dataset_technical_description: { type: Type.STRING },
            executive_summary: { type: Type.STRING },
            business_impact: { type: Type.STRING },
            key_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['title', 'domain_inferred', 'dataset_technical_description', 'executive_summary', 'business_impact', 'key_findings', 'recommendations']
        }
      }
    });

    const totalTime = performance.now() - startTime;

    if (!response.text) throw new Error('No response from AI');

    const content = JSON.parse(response.text) as ExecutiveReportContent;
    const metrics: ProviderMetrics = {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(totalTime),
      firstTokenMs: Math.round(totalTime), // No streaming, single response
      tokensGenerated: Math.round(response.text.length / 4),
      isLocal: false,
      timestamp: new Date().toISOString()
    };

    return { content, metrics };
  }

  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('API_KEY no encontrada');
    }

    const startTime = performance.now();
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        temperature: this.temperature,
      }
    });
    const totalTime = performance.now() - startTime;
    const text = response.text || '';

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
