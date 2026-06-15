# LOOP 08B - Progress Transparency Audit Report - AURA

## 1. Resumen ejecutivo

LOOP 08B audita todos los flujos de AURA con espera prolongada y aplica barras de progreso e indicadores de avance visibles, sobrios y estilo Casabero. El componente reusable `ProgressDisclosure` centraliza la visualización de progreso con barras determinadas (0-100%), indeterminadas (animación de carga) y estados finales (éxito, advertencia, error).

Principio aplicado: **Ningún proceso largo debe ocurrir en silencio. Todo proceso visible debe comunicar qué está pasando, en qué etapa va, y qué hacer si falla.**

## 2. Problema detectado

| Problema | Gravedad | Descripción |
|----------|----------|-------------|
| Descarga de modelo WebLLM sin barra de avance | Crítica | Al pulsar "Descargar y diagnosticar" o "Generar diagnóstico", el usuario veía varios minutos sin barra de progreso visible. Solo eventos genéricos en la consola. Luego fallaba con Cache.add() sin saber qué pasó. |
| Script sin indicador de progreso | Alta | La generación de script ejecutaba 2-3 llamadas al modelo sin barra de avance visible. Solo streaming de texto crudo. |
| PDF sin indicador | Media | La exportación de PDF bloqueaba la UI sin mostrar progreso. |
| Carga de CSV sin indicador | Media | Entre la selección de archivo y la aparición del perfil, no había feedback de que AURA estaba trabajando. |

## 3. Inventario de procesos auditados

| Flujo | Proceso | Duración estimada | Tipo de progreso | Acción aplicada |
|-------|---------|-------------------|------------------|-----------------|
| Carga CSV | parseCsv + runAudit | <1-5s | Indeterminado | ProgressDisclosure durante procesamiento |
| Diagnóstico | Descarga/carga modelo WebLLM | 3-20 min (primera vez) | Determinado 0-100% | ProgressDisclosure con barra real desde WebLLM callback |
| Diagnóstico | Inferencia cloud | 1-5s | Indeterminado | ProgressDisclosure con barra indeterminada |
| Script | Resumen + generación | 2-10s | Indeterminado | ProgressDisclosure con barra y pasos |
| Revisión | Simulación sobre copia | <1s | Simple (ya adecuado) | Sin cambios (spinner existente basta) |
| Exportar | PDF | 2-8s | Indeterminado | ProgressDisclosure durante generación |
| Configuración | Descarga de modelo | 3-20 min | Determinado (ya adecuado) | Sin cambios (barra de progreso ya implementada en SettingsPanel) |
| Laboratorio | Benchmark multi-modelo | 10-300s | Indeterminado por ejecución | Sin cambios (trace log ya proporciona visibilidad; phase counter diferido) |

## 4. Componente ProgressDisclosure

**Archivo:** `src/components/ProgressDisclosure.tsx`

Props:

| Prop | Tipo | Descripción |
|------|------|-------------|
| `title` | `string` | Título visible del proceso |
| `description` | `string` | Descripción o advertencia adicional |
| `value` | `number?` | Valor de progreso 0-100 (barra determinada) |
| `indeterminate` | `boolean?` | Barra animada si no hay valor fijo |
| `status` | `'idle' \| 'running' \| 'success' \| 'warning' \| 'error'` | Estado visual |
| `currentStep` | `string?` | Texto del paso actual |
| `steps` | `string[]?` | Lista de pasos con indicador done/active |
| `details` | `ReactNode?` | Contenido colapsable de detalles |
| `compact` | `boolean?` | Modo compacto (menos padding) |

Accesibilidad: `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` cuando aplica. Tokens Casabero para colores, nunca hardcoded.

## 5. WebLLM y descarga de modelos

**Archivo:** `src/services/providers/webllmProvider.ts`

Se agregó `generateTextWithProgress(prompt, onProgress)` al WebLLMProvider:

- El `onProgress` recibe eventos `ProviderProgressEvent` con stage, progress (0-100) y message.
- El `ensureEngineLoaded` ya recibía `InitProgressReport` de MLC; ahora mapea esos reportes a eventos de progreso estructurados:
  - 0-20% → `downloading`: "Descargando pesos del modelo"
  - 20-95% → `loading`: "Cargando modelo en memoria"
  - 95-99% → `compiling`: "Compilando artefactos WebGPU"
  - 100% → `completed`: "Diagnóstico completado"
- El `LazyWebLLMProvider` en `aiProvider.ts` también expone `generateTextWithProgress`.

**No se muestra razonamiento privado del modelo; se muestra telemetría observable del proceso.**

Esto incluye:
- Porcentaje de descarga (del InitProgressReport de MLC)
- Etapa actual (descargando, cargando, compilando, generando)
- Mensaje de estado textual
- Estado final (completado o error)

## 6. Cambios por archivo

| Archivo | Cambio | Riesgo que cierra |
|---------|--------|-------------------|
| `src/types.ts` | Agregados `ProgressDisclosureStatus`, `ProviderProgressEvent`, `ProgressDisclosureProps`. Agregado `generateTextWithProgress` opcional a la interfaz `AIProvider`. | Tipos para sistema de progreso |
| `src/components/ProgressDisclosure.tsx` | Nuevo componente reusable de progreso Casabero con barra determinada/indeterminada, estados, pasos y accesibilidad. | Procesos largos invisibles |
| `src/index.css` | +150 líneas CSS para ProgressDisclosure: barra, animación indeterminada, estados, responsive, indicador de carga de archivo, indicador PDF. | Estilo consistente de progreso |
| `src/services/providers/webllmProvider.ts` | Nuevo método `generateTextWithProgress` que mapea `InitProgressReport` de MLC a `ProviderProgressEvent` con etapas (downloading, loading, compiling, generating, completed, error). | Descarga sin barra de progreso |
| `src/services/aiProvider.ts` | `LazyWebLLMProvider` ahora expone `generateTextWithProgress`. | Acceso al progreso desde capa de abstracción |
| `src/components/DiagnosisStep.tsx` | Import de ProgressDisclosure. Agregados estados de progreso. `runDiagnosis` ahora usa `generateTextWithProgress` si está disponible. Renderizado de ProgressDisclosure durante diagnóstico con barra determinada para local e indeterminada para cloud. | Diagnóstico sin feedback visual |
| `src/components/ScriptGenerationStep.tsx` | Import de ProgressDisclosure. Agregados estados de progreso. `generateScript` emite eventos de etapa (Resumiendo, Generando script, Listo). Renderizado de ProgressDisclosure con barra indeterminada. | Script sin indicador de avance |
| `src/components/MainPipeline.tsx` | Import de ProgressDisclosure. Agregados estados de progreso para `processFile`. ProgressDisclosure durante parseo CSV y auditoría determinista. | Carga de archivo sin feedback |
| `src/App.tsx` | Import de ProgressDisclosure. `handleDownloadPdf` ahora muestra ProgressDisclosure indeterminado mientras genera el PDF. | PDF sin indicador de progreso |

## 7. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm run build` | PASS | Build limpio |
| `npm test` | 17/17 archivos, 150/150 tests PASS | Sin regresiones |
| `npm run test:e2e` | No ejecutado en este loop | E2E requiere provider real; mock diferido para loop posterior |

## 8. Evidencia visual

| Captura | Ruta | Qué valida |
|---------|------|------------|
| 01-diagnosis-webllm-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Barra de progreso determinada durante descarga/carga de modelo WebLLM |
| 02-diagnosis-cache-error-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Barra en estado error tras Cache.add fallido |
| 03-settings-model-download-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Barra de progreso determinada en tarjeta de modelo en Configuración |
| 04-script-generation-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Barra indeterminada durante generación de script |
| 05-review-simulation-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Spinner de simulación (ya adecuado) |
| 06-export-pdf-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Barra indeterminada durante generación de PDF |
| 07-lab-run-progress.png | `docs/qa/progress-transparency-2026-06-15/` | Trace log durante benchmark |
| 08-mobile-progress-states.png | `docs/qa/progress-transparency-2026-06-15/` | ProgressDisclosure en viewport móvil |

*Nota: Las capturas no se generaron en este loop. El directorio `docs/qa/progress-transparency-2026-06-15/` queda creado para capturas manuales o en loop siguiente.*

## 9. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| BenchmarkLab sin contador de fase | Media | El trace log ya da visibilidad; phase counter (ej. "Modo 2/5") queda pendiente para loop futuro de laboratorio. |
| E2E sin mock de provider | Media | Los tests que requieren provider real fallan en CI. Diferido para loop de testing. |
| generateTextWithProgress solo en WebLLM | Baja | Los providers cloud no tienen progreso real de descarga. Para cloud se usa barra indeterminada. |
| MLC InitProgressReport puede cambiar formato | Baja | El mapeo de porcentaje depende del texto generado por MLC. Si cambia el formato, la barra será indeterminada (ya contemplado). |

## 10. Veredicto

**GO**

Los cambios aplicados:
- Crean un componente ProgressDisclosure reusable y accesible.
- Conectan el progreso real de WebLLM (descarga, carga, compilación) con la UI mediante `generateTextWithProgress`.
- Agregan barras de progreso visibles en diagnóstico, script, carga de CSV y exportación PDF.
- Mantienen la configuración existente de descarga de modelos (que ya tenía barra de progreso).
- No rompen ningún test existente (150/150 pasan, build limpio).

## 11. Commit

```
ux: add progress transparency across long-running flows
```
