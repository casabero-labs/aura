/**
 * WebLLMProvider — Implementación de AIProvider para WebLLM (Inferencia Local).
 * 
 * Referencia TFM: 
 * - §3.3.3 Capa 0 — Infraestructura Soberana (Local-First)
 * - §3.3.3 Capa 2 — Estabilidad Cognitiva
 * 
 * Este proveedor descarga y ejecuta modelos LLM (ej. Llama 3.2 3B) 
 * directamente en el navegador del usuario mediante WebGPU.
 * En modo local evita llamadas a APIs cloud durante la inferencia.
 */

import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';

export class WebLLMProvider implements AIProvider {
  readonly name = 'WebLLM';
  readonly type = 'local' as const;
  
  private model: string;
  private temperature: number;
  private engine: MLCEngine | null = null;
  private isLoaded: boolean = false;

  constructor(model: string = 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: number = 0.1) {
    this.model = model;
    this.temperature = temperature;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Carga el motor en memoria si no está cargado.
   * Emite el progreso de descarga de los tensores vía onProgress.
   */
  private async ensureEngineLoaded(onProgress?: (progress: string) => void): Promise<MLCEngine> {
    if (this.engine && this.isLoaded) return this.engine;

    const initProgressCallback = (report: InitProgressReport) => {
      if (onProgress) {
        // Formatear progreso como código markdown para que se vea bien en la UI
        const percentage = Math.round(report.progress * 100);
        onProgress(`\n> ⚙️ **Capa 0 (Local-First)**: Iniciando Motor WebGPU...\n> 📥 Descargando/Cargando pesos de **${this.model}** en memoria VRAM.\n> 📊 Progreso: **${percentage}%** \n> 🗄️ ${report.text}\n\n`);
      }
    };

    // Crear el motor con el modelo especificado
    this.engine = await CreateMLCEngine(
      this.model,
      { initProgressCallback }
    );
    
    this.isLoaded = true;
    return this.engine;
  }

  /**
   * Análisis streaming (Capa 2).
   * Todo se procesa en el navegador.
   */
  async analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<ProviderMetrics> {
    if (!await this.isAvailable()) {
      onChunk('⚠️ Tu navegador o dispositivo no soporta WebGPU. El motor local no puede iniciarse. Usa Gemini Cloud.');
      return this.emptyMetrics();
    }

    try {
      // 1. Asegurar que el modelo está en memoria
      let hasSentLoadMessage = false;
      const engine = await this.ensureEngineLoaded((progressText) => {
        if (!hasSentLoadMessage) {
           onChunk(progressText); // Enviamos el estado de carga inicial
           hasSentLoadMessage = true;
        } else if (progressText.includes('100%')) {
           onChunk(`\n\n---\n✅ **Modelo cargado exitosamente en VRAM.** Iniciando análisis local de datos...\n\n`);
        }
      });

      const prompt = buildAnalysisPrompt(report);
      
      const startTime = performance.now();
      let firstTokenTime = 0;
      let tokensGenerated = 0;

      // 2. Inferencia Streaming compatible con OpenAI API
      const chunks = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: this.temperature, // M1: Control de varianza estocástica
        stream: true,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          if (firstTokenTime === 0) {
            firstTokenTime = performance.now() - startTime;
          }
          tokensGenerated += Math.round(delta.length / 4);
          onChunk(delta);
        }
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

    } catch (error) {
      console.error('WebLLM Error:', error);
      onChunk(`\n\n**Error en inferencia local:** ${(error as Error).message}`);
      return this.emptyMetrics();
    }
  }

  /**
   * Reporte ejecutivo (M5).
   * Al ejecutarse localmente, JSON mode es fundamental.
   */
  async generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('WebGPU no soportado para análisis local.');
    }

    const engine = await this.ensureEngineLoaded();
    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();

    // Inferencia con modo JSON estricto
    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
      response_format: { type: 'json_object' } // M5: Output forzado
    });

    const totalTime = performance.now() - startTime;
    const text = response.choices[0]?.message?.content;

    if (!text) throw new Error('No response from WebLLM');

    // Parser JSON robusto: directo → markdown → braces → error descriptivo
    let cleanJson = text;
    try {
      JSON.parse(cleanJson);
    } catch {
      const jsonBlockMatch = text.match(/```json?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        cleanJson = jsonBlockMatch[1].trim();
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          cleanJson = text.substring(firstBrace, lastBrace + 1);
        }
      }
      JSON.parse(cleanJson);
    }

    const content = JSON.parse(cleanJson) as ExecutiveReportContent;
    const metrics: ProviderMetrics = {
      provider: this.name,
      model: this.model,
      latencyMs: Math.round(totalTime),
      firstTokenMs: Math.round(totalTime),
      tokensGenerated: response.usage?.completion_tokens || Math.round(text.length / 4),
      isLocal: true,
      timestamp: new Date().toISOString()
    };

    return { content, metrics };
  }

  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      throw new Error('WebGPU no soportado para análisis local.');
    }

    const engine = await this.ensureEngineLoaded();
    const startTime = performance.now();
    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
    });
    const totalTime = performance.now() - startTime;
    const text = response.choices[0]?.message?.content || '';

    return {
      text,
      metrics: {
        provider: this.name,
        model: this.model,
        latencyMs: Math.round(totalTime),
        firstTokenMs: Math.round(totalTime),
        tokensGenerated: response.usage?.completion_tokens || text.split(/\s+/).filter(Boolean).length,
        isLocal: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Precarga el modelo en memoria sin ejecutar análisis.
   * Permite descargar el modelo antes de subir un CSV.
   */
  async preloadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('WebGPU no soportado en este navegador.');
    }

    if (this.engine && this.isLoaded) {
      if (onProgress) onProgress(100, 'Modelo ya está cargado en memoria.');
      return;
    }

    const initProgressCallback = (report: InitProgressReport) => {
      if (onProgress) {
        const percentage = Math.round(report.progress * 100);
        onProgress(percentage, report.text);
      }
    };

    this.engine = await CreateMLCEngine(
      this.model,
      { initProgressCallback }
    );

    this.isLoaded = true;
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
