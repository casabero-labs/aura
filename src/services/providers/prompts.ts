/**
 * Prompt compartido para todos los proveedores de IA.
 * 
 * Centralizar el prompt garantiza que el benchmark (OE2) compare
 * modelos bajo condiciones idénticas — mismo input, mismo criterio.
 * 
 * Referencia: §3.3.3 Capa 2 — Estabilidad Cognitiva
 * Mecanismos: M2 (Anclaje Semántico), M3 (Copy-Paste), M4 (Cadena Forzada)
 */

import { AuditReport } from '../../types';

/**
 * Construye el "Smart Sample" — el registro de datos mejorado
 * que se inyecta en el prompt del LLM.
 * 
 * Mecanismo M2 (Anclaje Semántico): El modelo SOLO puede razonar
 * sobre datos presentes en este JSON. No tiene acceso al dataset crudo.
 */
export const buildSmartSample = (report: AuditReport) => ({
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
    sample_values: c.sampleValues
  })),
  // Mecanismo M3 (Copy-Paste): Los bad_samples son valores reales
  // del dataset que el modelo DEBE citar textualmente.
  detected_issues: report.issues.map(i => ({
    rule: i.ruleName,
    category: i.category,
    column: i.column,
    details: i.description,
    bad_samples: i.sampleValues.slice(0, 3)
  }))
});

/**
 * Prompt de análisis streaming.
 * Mecanismo M4 (Cadena de Razonamiento Forzada):
 * 5 pasos obligatorios en orden estricto.
 */
export const buildAnalysisPrompt = (report: AuditReport): string => {
  const jsonSummary = buildSmartSample(report);
  const json_data = JSON.stringify(jsonSummary, null, 2);

  return `
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
};

/**
 * Prompt para reporte ejecutivo JSON (PDF).
 * Mecanismo M5 (Structured Output): Schema JSON estricto.
 */
export const buildExecutivePrompt = (report: AuditReport): string => {
  const summaryContext = {
    score: report.score,
    total_issues: report.issues.length,
    critical_issues: report.issues.filter(i => i.severity === 'critical').length,
    dataset_structure: Object.values(report.columnStats).map(c => ({ name: c.name, type: c.inferredType })),
    top_issues: report.issues.slice(0, 5).map(i => `${i.ruleName} en columna ${i.column}: ${i.description}`)
  };

  return `
    Actúa como un Consultor de Estrategia de Datos Senior preparando un informe profesional PDF (Estilo LaTeX/Científico).
    
    Analiza este resumen de calidad de datos y estructura:
    ${JSON.stringify(summaryContext)}

    Genera un informe ejecutivo en JSON estricto. 
    
    1. "dataset_technical_description": Redacta un párrafo técnico (aprox 80 palabras) describiendo la composición del dataset basándote en la lista de columnas y tipos. NO inventes cifras. Describe si es transaccional, demográfico, series de tiempo, etc.
    2. "executive_summary": Un resumen de alto nivel sobre la salud de los datos.
    3. "business_impact": Riesgos de negocio reales.
    4. "python_script": Genera un script en Python (con Pandas) que resuelva los problemas prioritarios detectados. El código debe estar listo para ejecutarse y usar la variable 'df'.
    5. "remediation_actions": Genera acciones estructuradas para simulacion segura. Usa solo estos tipos: trim_whitespace, normalize_placeholders, drop_exact_duplicates, normalize_casing, convert_disguised_numbers, requires_human_review. Marca safeToSimulate=false cuando sea ambiguo, destructivo o requiera criterio de dominio.
    
    La estructura JSON requerida es:
    {
      "title": "Un título formal y descriptivo (ej. Informe de Auditoría Técnica: [Dominio Inferido])",
      "domain_inferred": "Una frase corta del dominio",
      "dataset_technical_description": "Párrafo descriptivo de la estructura...",
      "executive_summary": "Resumen ejecutivo...",
      "business_impact": "Impacto en negocio...",
      "key_findings": ["Hallazgo 1", "Hallazgo 2", "Hallazgo 3"],
      "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
      "python_script": "import pandas as pd\\nimport numpy as np\\n\\n# Código de limpieza aquí...",
      "remediation_actions": [
        {
          "id": "accion-1",
          "type": "trim_whitespace",
          "column": "nombre_columna",
          "description": "Descripcion breve de la accion",
          "safeToSimulate": true,
          "requiresHumanReview": false
        }
      ]
    }
  `;
};
