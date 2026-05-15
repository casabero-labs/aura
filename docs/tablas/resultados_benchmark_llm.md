# Resultados del Benchmark Multi-Modelo (Capa Cognitiva)

**Objetivo Específico 2 (OE2):** Evaluar el comportamiento empírico de modelos de lenguaje grandes (LLMs) bajo condiciones idénticas de anclaje semántico (M2) y cadena de razonamiento forzada (M4).

## Contexto Experimental
- **Dataset de Prueba**: `titanic.csv` (891 filas, 12 columnas)
- **Motor Determinista (Baseline)**: 7 reglas violadas detectadas.
- **Tamaño del Prompt (Context Window)**: ~2400 caracteres (Inyección de metadatos + JSON estricto).

## Métricas de Rendimiento y Compliance

| Modelo | Arquitectura | Inferencia | Latencia Promedio (ms) | Tokens / Segundo | Format Compliance (JSON) | Python Script (HITL) | Alucinaciones (Detección básica) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini 2.0 Flash** | MoE Mixto | Nube (API) | *[Ejecutar Script]* | *[Ejecutar Script]* | ✅/❌ | ✅/❌ | ✅/❌ |
| **Gemini 1.5 Pro** | Denso | Nube (API) | *[Ejecutar Script]* | *[Ejecutar Script]* | ✅/❌ | ✅/❌ | ✅/❌ |
| **Llama 3.2 3B (q4f16_1)** | Denso (3B) | Local (WebGPU) | *[Prueba Manual UI]* | *[Prueba Manual UI]* | ✅/❌ | ✅/❌ | ✅/❌ |
| **Qwen 2.5 3B (q4f16_1)** | Denso (3B) | Local (WebGPU) | *[Prueba Manual UI]* | *[Prueba Manual UI]* | ✅/❌ | ✅/❌ | ✅/❌ |

## Discusión Preliminar (A Completar por el Autor)
*(Espacio reservado para discutir en el Capítulo 5 por qué un modelo superó a otro, especialmente comparando la velocidad de la API en la nube vs. la soberanía de los datos garantizada por la inferencia WebGPU local)*.
