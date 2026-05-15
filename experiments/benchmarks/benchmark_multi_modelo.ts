import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../../src/services/auditEngine';
import { buildExecutivePrompt } from '../../src/services/providers/prompts';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Cargar variables de entorno locales
dotenv.config({ path: path.join(__dirname, '../../src/.env.local') });

interface BenchmarkResult {
  model: string;
  latencyMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  formatCompliance: boolean;
  pythonScriptIncluded: boolean;
  hallucinatedFields: boolean;
  error?: string;
}

const MODELS_TO_TEST = [
  { provider: 'gemini', id: 'gemini-2.0-flash' },
  { provider: 'gemini', id: 'gemini-1.5-pro' },
  // { provider: 'groq', id: 'llama-3.2-3b-preview' }, // Descomentar si hay API Key
  // { provider: 'groq', id: 'qwen-2.5-coder-32b' }
];

async function runBenchmark() {
  console.log('🚀 Iniciando Benchmark Multi-Modelo (AURA OE2)');
  console.log('------------------------------------------------');

  // 1. Cargar Dataset
  const datasetPath = path.join(__dirname, '../datasets/titanic.csv');
  console.log(`Cargando dataset: ${path.basename(datasetPath)}`);
  
  const csvContent = fs.readFileSync(datasetPath, 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, dynamicTyping: true, skipEmptyLines: true });
  
  const data = parsed.data as Record<string, any>[];
  const fields = parsed.meta.fields || [];
  
  // 2. Generar Reporte Determinista (Baseline)
  const auditReport = runAudit(data, fields, ',');
  console.log(`Motor Determinista: ${auditReport.issues.length} reglas rotas detectadas.`);
  
  // 3. Generar Prompt (Estricto - Mecanismo M5)
  const prompt = buildExecutivePrompt(auditReport);
  console.log(`Prompt Semántico generado: ${prompt.length} caracteres.\n`);

  const results: BenchmarkResult[] = [];
  const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  if (!geminiClient) {
    console.error('❌ CRÍTICO: No se encontró GEMINI_API_KEY en src/.env.local');
    return;
  }

  // 4. Ejecutar modelos secuencialmente
  for (const modelConfig of MODELS_TO_TEST) {
    console.log(`Evaluando modelo: [${modelConfig.id}]...`);
    const result: BenchmarkResult = {
      model: modelConfig.id,
      latencyMs: 0,
      tokensGenerated: 0,
      tokensPerSecond: 0,
      formatCompliance: false,
      pythonScriptIncluded: false,
      hallucinatedFields: false
    };

    const startTime = performance.now();

    try {
      if (modelConfig.provider === 'gemini') {
        const response = await geminiClient.models.generateContent({
          model: modelConfig.id,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2 // Baja temperatura para consistencia técnica
          }
        });

        const endTime = performance.now();
        result.latencyMs = Math.round(endTime - startTime);
        
        const content = response.text || '';
        result.tokensGenerated = content.split(' ').length * 1.3; // Estimación cruda
        result.tokensPerSecond = Number((result.tokensGenerated / (result.latencyMs / 1000)).toFixed(2));

        // 5. Evaluar Compliance (M5: JSON Schema + OE4: Script Python)
        try {
          const parsedJson = JSON.parse(content);
          result.formatCompliance = true;
          
          if (parsedJson.python_script && parsedJson.python_script.includes('import pandas')) {
            result.pythonScriptIncluded = true;
          }

          // Detección rudimentaria de alucinaciones (inventar columnas)
          const desc = parsedJson.dataset_technical_description || '';
          if (desc.includes('invented_column_xyz')) {
            result.hallucinatedFields = true;
          }

        } catch (e) {
          result.formatCompliance = false;
        }
      }
    } catch (error: any) {
      result.error = error.message;
      console.log(`❌ Error con ${modelConfig.id}: ${error.message}`);
    }

    results.push(result);
    console.log(`   ⏱️ Latencia: ${result.latencyMs}ms | 📄 Cumple Formato: ${result.formatCompliance} | 🐍 Script: ${result.pythonScriptIncluded}\n`);
  }

  // 6. Guardar Resultados
  const outputPath = path.join(__dirname, '../results/benchmark_multimodelo.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dataset: 'titanic.csv',
    results
  }, null, 2));

  console.log(`✅ Benchmark finalizado. Resultados guardados en: experiments/results/benchmark_multimodelo.json`);
}

runBenchmark();
