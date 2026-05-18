# AURA — Plan de Implementación

## Priorización: por dependencia técnica y valor para el TFM

### Fase 1 — Base de la Arquitectura (día 1-2)
**Valor: desbloquea todo lo demás**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 1.1 Agregar `temperature` a `AIConfig` | `src/types.ts` | Nada |
| 1.2 `WebLLMProvider` recibe y pasa temperatura al `create()` | `src/services/providers/webllmProvider.ts` | 1.1 |
| 1.3 `GeminiProvider` recibe y pasa temperatura | `src/services/providers/geminiProvider.ts` | 1.1 |
| 1.4 Expandir `AVAILABLE_MODELS.local`: Qwen1.5B, Qwen0.5B, Phi-3.5, Gemma-2-2B | `src/services/aiProvider.ts` | Nada |
| 1.5 Slider de temperatura en SettingsPanel | `src/components/SettingsPanel.tsx` | 1.1 |

### Fase 2 — Generalizar Proveedores Cloud (día 3-5)
**Valor: OE2 (benchmark multi-modelo real)**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 2.1 Crear `OpenAICompatibleProvider` | `src/services/providers/openaiProvider.ts` | 1.1 |
| 2.2 Registrar proveedores en `AVAILABLE_MODELS.cloud`: Groq, DeepSeek, OpenRouter, MiniMax | `src/services/aiProvider.ts` | 2.1 |
| 2.3 Modificar factory `createAIProvider` para aceptar cualquier proveedor | `src/services/aiProvider.ts` | 2.1 |
| 2.4 SettingsPanel: selector de proveedor cloud + campo API key dinámico | `src/components/SettingsPanel.tsx` | 2.2 |

### Fase 3 — Detector de Alucinaciones (día 5-6)
**Valor: métricas objetivas para el benchmark**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 3.1 Crear `hallucinationDetector.ts` | `src/services/benchmark/hallucinationDetector.ts` | Nada (usa AuditReport como referencia) |
| 3.2 Detectar columnas fantasma en respuesta del LLM | ídem | 3.1 |
| 3.3 Detectar cifras inventadas vs reales | ídem | 3.1 |
| 3.4 Verificar formato JSON y campos requeridos | ídem | 3.1 |
| 3.5 Parsear script Python y validar columnas | ídem | 3.1 |

### Fase 4 — Experiment Designer (día 6-9)
**Valor: el corazón de la experimentación científica**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 4.1 Extender `BenchmarkResult` con campos de hallucination y composite score | `src/types.ts` | 3.1 |
| 4.2 Nuevo panel `ExperimentDesigner.tsx` | `src/components/ExperimentDesigner.tsx` | 4.3 |
| 4.3 Tabla de configuraciones donde cada fila es (modelo + temperatura + input mode) | ídem | 4.2 |
| 4.4 Botón "Run All" que ejecuta secuencialmente | ídem | 4.2 |
| 4.5 Matriz de resultados con heatmap de score compuesto | ídem | 4.2 |
| 4.6 Exportar resultados a JSON | ídem | 4.2 |
| 4.7 Integrar Experiment Designer en App.tsx | `src/App.tsx` | 4.2 |

### Fase 5 — Sistema de Evaluación (día 9-10)
**Valor: rigor académico**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 5.1 Implementar `compositeScore()` con pesos configurables | `src/services/benchmark/evaluationService.ts` | 4.1 |
| 5.2 Exportación estructurada para TFM (JSON con timestamp, config completa) | ídem | 5.1 |
| 5.3 Panel de estadísticas: media, desviación, CV% por experimento | `src/components/ExperimentDesigner.tsx` | 5.1 |

### Fase 6 — Documentación (día 10-11)
**Valor: cierre del ciclo**

| Tarea | Archivos | Depende de |
|-------|----------|-----------|
| 6.1 Actualizar marco experimental en Notion y `docs/` | Notion + `docs/experimental-framework.md` | Todo lo anterior |
| 6.2 Catálogo de reglas actualizado (24 reglas) | `docs/tablas/catalogo_reglas_motor_determinista.md` | Nada |
| 6.3 Build y verificación final | `npm run build` + `npm test` | Todo |

## Resumen de esfuerzo

| Fase | Días | Archivos nuevos | Archivos modificados |
|------|------|----------------|---------------------|
| 1 — Base | 2 | 0 | 4 |
| 2 — Proveedores | 3 | 1 | 3 |
| 3 — Alucinaciones | 2 | 1 | 1 |
| 4 — Experiment Designer | 4 | 1 | 2 |
| 5 — Evaluación | 2 | 1 | 1 |
| 6 — Documentación | 1 | 1 | 1 |
| **Total** | **~11 días** | **4 nuevos** | **~12 modificados** |

## Notas técnicas importantes

- Todos los proveedores cloud (Groq, DeepSeek, OpenRouter, MiniMax) usan API compatible con OpenAI. Solo cambia `baseURL` y `model`.
- OpenRouter permite acceso a Claude, GPT-4o, Llama y más desde un solo API key.
- El detector de alucinaciones no requiere otro LLM: compara contra `AuditReport` que ya existe.
- El Experiment Designer ejecuta secuencialmente porque WebLLM solo carga un modelo a la vez en VRAM.
- El composite score es configurable por el usuario (pesos ajustables).

## Lo que NO incluye este plan (para no sobreingenierizar)

- Interfaz gráfica de heatmaps (se exporta JSON y se visualiza en Python/Excel para el TFM)
- Evaluación humana automatizada (se hace manual con escala Likert)
- Corrección automática de alucinaciones (solo detección y métricas)
- Soporte para modelos locales mayores a 3B parámetros (límite de VRAM de navegador)
