# Corrección OE2 — Benchmark Multi-Proveedor Cloud

**Documento:** Primera Entrega TFM — Joseph Gari  
**Fecha de corrección:** Mayo 2026  
**Sección afectada:** §3.2 Objetivos Específicos — OE2  
**Tipo:** Corrección de alcance técnico

---

## OE2 Original (Primera Entrega)

> **OE2.** Implementar un módulo de comparación de LLM: Evaluar el rendimiento de modelos como Gemini 2.0 Flash frente a alternativas locales (p. ej., Llama 4) en términos de precisión diagnóstica, latencia y tasa de alucinaciones.

---

## Problema Detectado

La redacción original del OE2 limita implícitamente el benchmark a una comparación binaria **Gemini 2.0 Flash vs. Llama 4 (local)**, lo cual no refleja:

1. **La arquitectura real implementada:** El sistema soporta múltiples proveedores cloud (Google, Groq, DeepSeek, OpenRouter, MiniMax) además de modelos locales WebLLM.
2. **El alcance experimental necesario:** Un benchmark científico riguroso requiere evaluar un espectro amplio de modelos, no solo dos puntos de comparación.
3. **La generalización del OE2:** El objetivo debe ser independiente de marcas específicas y centrarse en la capacidad del sistema de evaluar cualquier modelo configurable.

---

## OE2 Corregido

> **OE2.** Implementar un módulo de benchmark multi-modelo que evalúe el rendimiento de diversos proveedores de LLM (cloud y local) en términos de precisión diagnóstica, latencia, eficiencia de tokens y tasa de alucinaciones, mediante un sistema de score compuesto y mecanismos formales de detección de alucinaciones.

### Alcance técnico del OE2 corregido

| Dimensión | Detalle |
|-----------|---------|
| **Proveedores cloud** | Google (Gemini), Groq (Llama, Mixtral), DeepSeek (V3, R1), OpenRouter (multi-modelo), MiniMax |
| **Modelos locales** | WebLLM con WebGPU: Llama 3.2 (1B, 3B), Qwen 2.5 (0.5B, 1.5B, 3B), Phi-3.5, Gemma 2 |
| **Métricas evaluadas** | Latencia (ms), tokens/segundo, compliance JSON, columnas alucinadas, afirmaciones sin soporte, score compuesto |
| **Mecanismos anti-alucinación** | M1–M5: detección de columnas fantasma, cifras inventadas, validación JSON, parseo de scripts Python, anclaje semántico |
| **Modos de entrada** | `smart_sample` (datos estructurados del audit engine) vs. `prompt_libre` (solo esquema de columnas) |
| **Score compuesto** | Ponderación configurable: JSON compliance (25%), alucinación (25%), latencia (15%), eficiencia tokens (10%), script calidad (10%), precisión claims (15%) |

---

## Evidencia de Implementación en Código

| Artefacto | Archivo | Funcionalidad |
|-----------|---------|---------------|
| Factory multi-proveedor | `src/services/aiProvider.ts` | Crea proveedores cloud (Google, Groq, DeepSeek, OpenRouter, MiniMax) y local (WebLLM) |
| Catálogo de modelos | `src/services/aiProvider.ts:103-124` | `AVAILABLE_MODELS` con 9 modelos cloud + 7 locales |
| Proveedor OpenAI-compatible | `src/services/providers/openaiProvider.ts` | Abstrae Groq, DeepSeek, OpenRouter, MiniMax vía API estándar |
| Benchmark runner | `src/services/benchmarkService.ts` | Ejecuta benchmark por configuración con trazabilidad |
| Detector de alucinaciones | `src/services/benchmark/hallucinationDetector.ts` | 5 mecanismos: columnas fantasma, cifras, JSON, scripts, anclaje |
| Score compuesto | `src/services/benchmark/evaluationService.ts` | `compositeScore()` con pesos configurables |
| Panel de benchmark | `src/components/BenchmarkPanel.tsx` | UI para ejecutar suites comparativas |
| Diseñador de experimentos | `src/components/ExperimentDesigner.tsx` | Configurar y ejecutar múltiples experimentos |

---

## Impacto en la Memoria del TFM

### Secciones a modificar en la primera entrega

1. **§3.2 Objetivos Específicos** — Reemplazar texto del OE2 con la versión corregida.
2. **§5.4 Capa Cognitiva** — Actualizar para reflejar que el benchmark no se limita a Gemini vs. Llama, sino que es un framework multi-proveedor.
3. **§5.7 Benchmarking** — Describir la metodología con los 5 proveedores cloud + WebLLM local, no solo dos modelos.

### Secciones a añadir en la segunda entrega

1. **Tabla comparativa de resultados** — Métricas por modelo (latencia, tokens/s, alucinaciones, score compuesto).
2. **Gráficos D3.js** — Visualizaciones de: barras de score compuesto, radar de métricas multi-dimensionales, dispersión latencia vs. score.
3. **Análisis estadístico** — Media, desviación estándar, coeficiente de variación por proveedor.

---

## Justificación Académica

La corrección del OE2 responde a tres principios metodológicos:

1. **Reproducibilidad:** El benchmark debe poder ejecutarse con cualquier modelo nuevo que se registre en `AVAILABLE_MODELS`, sin modificar la lógica de evaluación.
2. **Validez externa:** Limitar la comparación a dos modelos reduce la generalización de las conclusiones. Un espectro de 16+ modelos (cloud + local) permite identificar patrones por familia (open-source vs. propietario, grande vs. pequeño).
3. **Rigor métrico:** El score compuesto con 6 dimensiones ponderadas ofrece una evaluación más robusta que una comparación ad-hoc de "precisión, latencia y alucinaciones".

---

## Estado de Cumplimiento Post-Corrección

| Dimensión | Estado | Evidencia |
|-----------|--------|-----------|
| Multi-proveedor cloud | ✅ Implementado | 5 proveedores en `AVAILABLE_MODELS.cloud` |
| Modelos locales WebLLM | ✅ Implementado | 7 modelos en `AVAILABLE_MODELS.local` |
| Detector de alucinaciones | ✅ Implementado | `hallucinationDetector.ts` con M1–M5 |
| Score compuesto | ✅ Implementado | `evaluationService.ts` con pesos configurables |
| Ejecución de experimentos | ✅ Implementado | `ExperimentDesigner.tsx` + `BenchmarkPanel.tsx` |
| Visualización estadística | 🔶 En desarrollo | Gráficos D3.js por implementar |
| Resultados tabulados | ⬜ Pendiente | Ejecución real con datasets de referencia |
