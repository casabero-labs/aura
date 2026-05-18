# Asignación de Responsables por Tarea

## Criterios de asignación

| Rol | Cuándo usarlo |
|-----|--------------|
| **Casabito directo** | Cambios pequeños (1-2 archivos, < 20 líneas), types, config, docs, terminal |
| **Subagente (delegate_task)** | Servicios nuevos con lógica media (3-5 archivos), sin UI |
| **OpenCode** | Componentes UI nuevos, refactors grandes, features complejas con múltiples archivos |

---

## Fase 1 — Base de la Arquitectura

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 1.1 Agregar `temperature` a `AIConfig` | `src/types.ts` | **Casabito directo** | +1 campo en interfaz. Cambio de 3 líneas. |
| 1.2 WebLLMProvider lee temperature de AIConfig | `webllmProvider.ts` | **Casabito directo** | Leer del config en vez de hardcodear 0.1. |
| 1.3 GeminiProvider lee temperature de AIConfig | `geminiProvider.ts` | **Casabito directo** | Leer del config en vez de hardcodear 0.1. |
| 1.4 Expandir modelos locales | `aiProvider.ts` | **Casabito directo** | Agregar 4 entries al array. Datos, no lógica. |
| 1.5 Slider de temperatura en Settings | `SettingsPanel.tsx` | **OpenCode** | Requiere maquetación UI, estado, slider component. |

## Fase 2 — Generalizar Proveedores Cloud

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 2.1 Crear OpenAICompatibleProvider | `openaiProvider.ts` (nuevo) | **Subagente** | Clase nueva que implementa AIProvider con baseURL + apiKey + temp. Lógica media, cero UI. |
| 2.2 Registrar proveedores cloud | `aiProvider.ts` | **Casabito directo** | Agregar Groq, DeepSeek, OpenRouter, MiniMax al array con sus URLs base. |
| 2.3 Modificar factory `createAIProvider` | `aiProvider.ts` | **Casabito directo** | Switch case que reconozca nuevo provider type. |
| 2.4 Settings: selector de proveedor + API key dinámico | `SettingsPanel.tsx` | **OpenCode** | UI nueva: dropdown de proveedores, campo de API key contextual, lógica de selección. |

## Fase 3 — Detector de Alucinaciones

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 3.1 Crear hallucinationDetector.ts | `hallucinationDetector.ts` (nuevo) | **Subagente** | Servicio con lógica media-alta: parseo de respuesta, comparación contra AuditReport. |
| 3.2 Columnas fantasma | ídem | **Subagente** | Incluido en 3.1 |
| 3.3 Cifras inventadas | ídem | **Subagente** | Incluido en 3.1 |
| 3.4 Validación JSON | ídem | **Subagente** | Incluido en 3.1 |
| 3.5 Parseo de script Python | ídem | **Subagente** | Incluido en 3.1 |

## Fase 4 — Experiment Designer

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 4.1 Extender BenchmarkResult | `src/types.ts` | **Casabito directo** | +3 campos a la interfaz. |
| 4.2 Panel ExperimentDesigner | `ExperimentDesigner.tsx` (nuevo) | **OpenCode** | Componente UI complejo: tabla de configs, botones, matriz de resultados. |
| 4.3 Tabla de configuraciones | ídem | **OpenCode** | Incluido en 4.2 |
| 4.4 Run All | ídem | **OpenCode** | Incluido en 4.2 |
| 4.5 Matriz de resultados | ídem | **OpenCode** | Incluido en 4.2 |
| 4.6 Export JSON | ídem | **OpenCode** | Incluido en 4.2 |
| 4.7 Integrar en App.tsx | `App.tsx` | **Casabito directo** | Importar y montar el componente. |

## Fase 5 — Sistema de Evaluación

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 5.1 Implementar compositeScore() | `evaluationService.ts` (nuevo) | **Subagente** | Lógica de pesos, normalización, score compuesto. Sin UI. |
| 5.2 Exportación estructurada para TFM | ídem | **Subagente** | Incluido en 5.1 |
| 5.3 Panel de estadísticas en UI | `ExperimentDesigner.tsx` | **OpenCode** | Agregar sección de media, desviación, CV% al panel existente. |

## Fase 6 — Documentación

| Tarea | Archivos | Responsable | Justificación |
|-------|----------|-------------|---------------|
| 6.1 Actualizar docs y Notion | `docs/`, Notion | **Casabito directo** | Documentación, no código. |
| 6.2 Catálogo de reglas (24) | `docs/tablas/` | **Casabito directo** | Actualizar números. |
| 6.3 Build y tests | terminal | **Casabito directo** | `npm run build` + `npm test` |

---

## Resumen de carga

| Responsable | Tareas | Archivos nuevos | Archivos mod. |
|-------------|--------|-----------------|---------------|
| **Casabito directo** | 12 | 0 | ~8 |
| **Subagente (delegate_task)** | 3 | 3 | 0 |
| **OpenCode** (3 sesiones) | 3 sesiones | 2 | 2 |
| **Total** | ~18 tareas | 5 nuevos | ~10 modificados |

### Sesiones de OpenCode necesarias

1. `AURA-slider-temperature-settings` — slider de temperatura en SettingsPanel
2. `AURA-provider-selector-ui` — selector de proveedor cloud + API key dinámico
3. `AURA-experiment-designer` — panel completo de Experiment Designer + estadísticas

### Subagentes necesarios

1. `openai-provider` — creación de OpenAICompatibleProvider
2. `hallucination-detector` — creación de hallucinationDetector
3. `evaluation-service` — creación de evaluationService con composite score
