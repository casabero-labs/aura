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
import { AuditReport, AIProvider, ProviderMetrics, ExecutiveReportContent, AIConfig } from '../../types';
import { buildAnalysisPrompt, buildExecutivePrompt } from './prompts';
import { normalizeAiProviderError, NormalizedProviderError } from './errors';

export class WebLLMProvider implements AIProvider {
  readonly name = 'WebLLM';
  readonly type = 'local' as const;
  
  private model: string;
  private temperature: number;
  private aiConfig?: AIConfig;
  private engine: MLCEngine | null = null;
  private isLoaded: boolean = false;

  constructor(model: string = 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: number = 0.1, aiConfig?: AIConfig) {
    this.model = model;
    this.temperature = temperature;
    this.aiConfig = aiConfig;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!(navigator as any).gpu) return false;
      const adapter = await (navigator as any).gpu.requestAdapter();
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
        const percentage = Math.round(report.progress * 100);
        onProgress(`\n> WebGPU local: cargando ${this.model}\n> Progreso: ${percentage}%\n> Estado: ${report.text}\n\n`);
      }
    };

    try {
      // Crear el motor con el modelo especificado
      this.engine = await CreateMLCEngine(
        this.model,
        { initProgressCallback }
      );
      
      this.isLoaded = true;
      return this.engine;
    } catch (error) {
      // Normalizar errores conocidos de WebLLM
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(error, this.aiConfig)
        : {
            title: 'Error al cargar modelo local',
            message: (error as Error).message,
            cause: (error as Error).message,
            recommendedActions: ['Verifica tu conexión a internet', 'Intenta con otro modelo'],
            technicalMessage: (error as Error).stack || (error as Error).message,
            evidenceStatus: 'attempted_failed' as const,
            category: 'generic' as const,
          };
      
      // Lanzar error enriquecido con información normalizada
      const enrichedError = new Error(normalized.message);
      (enrichedError as any).normalized = normalized;
      throw enrichedError;
    }
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
      let hasSentReadyMessage = false;
      const engine = await this.ensureEngineLoaded((progressText) => {
        if (!hasSentLoadMessage) {
           onChunk(progressText); // Enviamos el estado de carga inicial
           hasSentLoadMessage = true;
        } else if (!hasSentReadyMessage && progressText.includes('100%')) {
           onChunk(`\n\n---\n**Modelo local cargado en VRAM. Iniciando analisis anclado a evidencia determinista.**\n\n`);
           hasSentReadyMessage = true;
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
      
      // Usar error normalizado si está disponible
      const normalized = (error as any).normalized || (this.aiConfig 
        ? normalizeAiProviderError(error, this.aiConfig)
        : {
            title: 'Error en inferencia local',
            message: (error as Error).message,
            cause: (error as Error).message,
            recommendedActions: ['Intenta nuevamente', 'Cambia de proveedor'],
            technicalMessage: (error as Error).stack || (error as Error).message,
            evidenceStatus: 'attempted_failed' as const,
            category: 'generic' as const,
          });
      
      onChunk(`\n\n**${normalized.title}:** ${normalized.message}\n\n*${normalized.cause}*`);
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
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(new Error('WebGPU no soportado'), this.aiConfig)
        : {
            title: 'WebGPU no disponible',
            message: 'Tu navegador no soporta WebGPU para análisis local.',
            cause: 'WebGPU no está habilitado',
            recommendedActions: ['Usa Chrome 113+', 'Cambia a proveedor cloud'],
            technicalMessage: 'WebGPU not supported',
            evidenceStatus: 'attempted_failed' as const,
            category: 'webgpu_unsupported' as const,
          };
      throw new Error(normalized.message);
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

    const content = this.parseExecutiveJson(text);
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

  /**
   * Reporte ejecutivo streaming con razonamiento visible.
   * Streamea texto crudo (incluyendo razonamiento) y parsea JSON al final.
   */
  async generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(new Error('WebGPU no soportado'), this.aiConfig)
        : {
            title: 'WebGPU no disponible',
            message: 'Tu navegador no soporta WebGPU para análisis local.',
            cause: 'WebGPU no está habilitado',
            recommendedActions: ['Usa Chrome 113+', 'Cambia a proveedor cloud'],
            technicalMessage: 'WebGPU not supported',
            evidenceStatus: 'attempted_failed' as const,
            category: 'webgpu_unsupported' as const,
          };
      throw new Error(normalized.message);
    }

    const engine = await this.ensureEngineLoaded();
    const prompt = buildExecutivePrompt(report);
    const startTime = performance.now();
    let firstTokenTime = 0;
    let tokensGenerated = 0;
    let fullText = '';

    const chunks = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
      stream: true,
    });

    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        if (firstTokenTime === 0) firstTokenTime = performance.now() - startTime;
        tokensGenerated += Math.round(delta.length / 4);
        fullText += delta;
        onChunk(delta);
      }
    }

    const totalTime = performance.now() - startTime;
    const content = this.parseExecutiveJson(fullText);

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

  private parseExecutiveJson(text: string): ExecutiveReportContent {
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
    return JSON.parse(cleanJson) as ExecutiveReportContent;
  }

  async generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }> {
    if (!await this.isAvailable()) {
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(new Error('WebGPU no soportado'), this.aiConfig)
        : {
            title: 'WebGPU no disponible',
            message: 'Tu navegador no soporta WebGPU para análisis local.',
            cause: 'WebGPU no está habilitado',
            recommendedActions: ['Usa Chrome 113+', 'Cambia a proveedor cloud'],
            technicalMessage: 'WebGPU not supported',
            evidenceStatus: 'attempted_failed' as const,
            category: 'webgpu_unsupported' as const,
          };
      throw new Error(normalized.message);
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
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(new Error('WebGPU no soportado'), this.aiConfig)
        : {
            title: 'WebGPU no disponible',
            message: 'Tu navegador no soporta WebGPU para modelos locales.',
            cause: 'WebGPU no está habilitado',
            recommendedActions: ['Usa Chrome 113+', 'Cambia a proveedor cloud'],
            technicalMessage: 'WebGPU not supported',
            evidenceStatus: 'attempted_failed' as const,
            category: 'webgpu_unsupported' as const,
          };
      throw new Error(normalized.message);
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

    try {
      this.engine = await CreateMLCEngine(
        this.model,
        { initProgressCallback }
      );

      this.isLoaded = true;
    } catch (error) {
      // Normalizar errores conocidos de WebLLM
      const normalized = this.aiConfig 
        ? normalizeAiProviderError(error, this.aiConfig)
        : {
            title: 'Error al descargar modelo',
            message: (error as Error).message,
            cause: (error as Error).message,
            recommendedActions: ['Verifica tu conexión a internet', 'Libera espacio en disco'],
            technicalMessage: (error as Error).stack || (error as Error).message,
            evidenceStatus: 'attempted_failed' as const,
            category: 'model_download' as const,
          };
      
      // Lanzar error enriquecido
      const enrichedError = new Error(normalized.message);
      (enrichedError as any).normalized = normalized;
      throw enrichedError;
    }
  }

  /**
   * Descarga el modelo de la VRAM y destruye la instancia del motor de MLC.
   */
  async unloadModel(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (error) {
        console.error('Error al descargar el modelo de WebGPU VRAM:', error);
      } finally {
        this.engine = null;
        this.isLoaded = false;
      }
    }
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
