import { GoogleGenAI, Schema, Type } from "@google/genai";
import { AuditReport, ExecutiveReportContent, AIConfig } from "../types";

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
};

export const getGeminiAnalysisStream = async (report: AuditReport, config: AIConfig, onChunk: (text: string) => void) => {
  const apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    onChunk("⚠️ API_KEY no configurada. Por favor, configúrala en el panel de ajustes.");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // Construct a "Smart Sample" for the AI
  const jsonSummary = {
    context: {
      total_rows: report.rowCount,
      total_columns: report.colCount,
      detected_delimiter: report.delimiterDetected,
      quality_score: report.score
    },
    columns: Object.values(report.columnStats).map(c => ({
      name: c.name,
      type: c.inferredType,
      nulls: c.nullCount,
      unique: c.uniqueCount,
      top_values: c.topFreq?.map(t => t.value),
      sample_values: c.sampleValues // 3 random values (start, middle, end)
    })),
    detected_issues: report.issues.map(i => ({
      rule: i.ruleName,
      category: i.category,
      column: i.column,
      details: i.description,
      bad_samples: i.sampleValues.slice(0, 3)
    }))
  };

  const json_data = JSON.stringify(jsonSummary, null, 2);

  const prompt = `
        Actúa como Ingeniero de Datos Senior + Arquitecto de Datos con más de 15 años de experiencia en data governance y modelado. Tu misión es ser extremadamente crítico y exhaustivo.

        Te voy a pasar un resumen JSON con: nombres de columnas, tipos inferidos, nulls, unique, top_values y issues detectados.

        Tu objetivo es encontrar **todos los defectos posibles de diseño, nombrado, redundancia, normalización y calidad semántica**. No te limites a lo obvio: busca errores sutiles y sistémicos que normalmente pasan desapercibidos.

        Este es el JSON del dataset:
        ${json_data}

        ### Pasos obligatorios (sigue este orden exacto):

        1. **Inferir el dominio real del dataset**  
           Una sola frase precisa (ej. "Registro de ventas retail en México 2024-2025", "Base de clientes de telecomunicaciones Perú").

        2. **Análisis exhaustivo de defectos**  
           Detecta y enumera con viñetas **todos** los problemas que encuentres de los siguientes tipos (incluye aunque sean sutiles):

           **Nombres de columnas**
           - Nombre engañoso, ambiguo o directamente falso respecto al contenido real
           - Falta convención snake_case (o camelCase si aplica en tu org)
           - Uso de espacios, acentos, ñ, mayúsculas mixtas, caracteres especiales
           - Nombres demasiado genéricos: "campo1", "dato", "valor", "columna_a"
           - Nombres en otro idioma mezclado (ej. "email" + "correo_electronico")

           **Redundancia y derivación**
           - Columnas 100% derivables de otras (edad + fecha_nacimiento, total + precio*cantidad)
           - Información repetida en diferentes formatos (código postal + ciudad + estado)
           - Columna que es copia exacta o casi exacta de otra
           - Columnas "flag" que se pueden calcular con una condición simple

           **Problemas de normalización y consistencia**
           - Mismo concepto con múltiples representaciones ("M", "Masculino", "Hombre", "male", 1)
           - País/estado/ciudad con ISO, nombre completo, abreviatura mezclados
           - Moneda con y sin símbolo, con y sin separador de miles
           - Teléfonos con/sin lada, con/sin +52, con guiones/espacios
           - Fechas en diferentes formatos dentro de la misma columna

           **Problemas semánticos y de dominio**
           - Valores imposibles o extremadamente improbables (edad 150, peso 500kg, fecha futura en fecha_nacimiento)
           - Columna de ID que contiene descripciones o está duplicada como texto
           - Categorías que deberían ser tabla dimensión pero están como texto libre
           - PII o datos sensibles expuestos (CURP, RFC, INE, tarjeta, dirección completa)
           - Columna que mezcla conceptos (ej. "producto_categoria" con "Camisa - Ropa Hombre")

           **Otros defectos comunes de diseño**
           - Columnas con más del 90% de valores nulos o únicos → candidatas a eliminar
           - Columna con un solo valor repetido (constante) en todo el dataset
           - Uso innecesario de texto cuando debería ser booleano, categoría o fecha
           - Nombres que incluyen tipo de dato o formato ("fecha_str", "monto_float")

        3. **Recomendaciones de refactorización**  
           Para cada problema encontrado, usa este formato exacto:

           *   **Prioridad:** Alta / Media / Baja  
           *   **Columna(s):** lista_de_columnas  
           *   **Problema:** descripción breve y directa  
           *   **Acción recomendada:** (Renombrar / Eliminar / Normalizar / Crear nueva columna / Mover a tabla dimensión)

        4. **Tabla resumen final obligatoria**

           | Métrica | Evaluación |
           |---|---|
           | Dominio inferido | ... |
           | Hallazgos críticos (Prioridad Alta) | X |
           | Columnas a renombrar | X |
           | Columnas a eliminar | X |
           | Nuevas columnas sugeridas | X |
           | Tablas dimensión faltantes | país, estado, categoría, etc. |
           | Calidad de diseño actual | Excelente / Buena / Regular / Mala / Crítica |
           | Impacto si no se corrige          | [una frase fuerte y realista]     |

        5. **Scripts de Limpieza (Python)**
           Genera un script de Python usando Pandas que resuelva los problemas de **Prioridad Alta y Media**. El código debe estar listo para copiar y pegar.
           
           \`\`\`python
           import pandas as pd
           import numpy as np

           # Asumiendo carga del df
           # df = pd.read_csv('dataset.csv')

           # 1. Renombrado de columnas (Convención Snake Case)
           # ...

           # 2. Manejo de Nulos y Tipos
           # ...
           \`\`\`

        Responde **exclusivamente en español**, con tono técnico, directo y sin piedad. Usa negritas y Markdown estructurado.
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: config.model || 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.1, // Very low temp for strict, analytical output
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk(`\n\n**Error analyzing data with AI:** ${(error as Error).message}`);
  }
};

export const generateExecutiveReport = async (report: AuditReport, config: AIConfig): Promise<ExecutiveReportContent> => {
  const apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) throw new Error("API_KEY no encontrada");

  const ai = new GoogleGenAI({ apiKey });

  // Minimal context for the "Executive Report" writer
  // We provide the column list and types so the AI can describe the dataset structure
  const summaryContext = {
    score: report.score,
    total_issues: report.issues.length,
    critical_issues: report.issues.filter(i => i.severity === 'critical').length,
    dataset_structure: Object.values(report.columnStats).map(c => ({ name: c.name, type: c.inferredType })),
    top_issues: report.issues.slice(0, 5).map(i => `${i.ruleName} en columna ${i.column}: ${i.description}`)
  };

  const prompt = `
    Actúa como un Consultor de Estrategia de Datos Senior preparando un informe profesional PDF (Estilo LaTeX/Científico).
    
    Analiza este resumen de calidad de datos y estructura:
    ${JSON.stringify(summaryContext)}

    Genera un informe ejecutivo en JSON estricto. 
    
    1. "dataset_technical_description": Redacta un párrafo técnico (aprox 80 palabras) describiendo la composición del dataset basándote en la lista de columnas y tipos. NO inventes cifras. Describe si es transaccional, demográfico, series de tiempo, etc.
    2. "executive_summary": Un resumen de alto nivel sobre la salud de los datos.
    3. "business_impact": Riesgos de negocio reales.
    
    La estructura JSON requerida es:
    {
      "title": "Un título formal y descriptivo (ej. Informe de Auditoría Técnica: [Dominio Inferido])",
      "domain_inferred": "Una frase corta del dominio",
      "dataset_technical_description": "Párrafo descriptivo de la estructura...",
      "executive_summary": "Resumen ejecutivo...",
      "business_impact": "Impacto en negocio...",
      "key_findings": ["Hallazgo 1", "Hallazgo 2", "Hallazgo 3"],
      "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"]
    }
  `;

  const response = await ai.models.generateContent({
    model: config.model || 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
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
        required: ["title", "domain_inferred", "dataset_technical_description", "executive_summary", "business_impact", "key_findings", "recommendations"]
      }
    }
  });

  if (!response.text) throw new Error("No response from AI");
  return JSON.parse(response.text) as ExecutiveReportContent;
}