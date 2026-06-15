# LOOP 06A - WebLLM Cache Error Report - AURA

**Fecha:** 2026-06-15  
**Rama:** `loop-06a-webllm-cache-error`  
**Agente:** Frontend/AI Provider Senior

---

## 1. Resumen ejecutivo

El error `Failed to execute 'add' on 'Cache': Cache.add() encountered a network error` ocurría al intentar ejecutar Diagnóstico con proveedor local WebLLM. El mensaje crudo del navegador se mostraba directamente al usuario sin contexto, causa, ni acciones recuperables. Este LOOP normaliza todos los errores de proveedores AI en mensajes humanos y acciones accionables, sin alterar la lógica de auditoría, scoring, benchmark ni el flujo principal.

## 2. Causa probable

WebLLM utiliza la **Cache API** del navegador para almacenar artefactos compilados del modelo (tensores, WASM). Cuando la red falla durante la descarga o caché del modelo, el navegador lanza un error DOMException con el mensaje crudo `Cache.add() encountered a network error`. Este error se propagaba sin normalización hasta la UI.

Causas subyacentes:
- Conexión inestable durante descarga de modelo (~2-6 GB)
- Restricciones de almacenamiento del navegador (modo incógnito, cuota deOrigin)
- WebGPU no disponible en el navegador/dispositivo
- API key inválida para proveedores cloud

## 3. Cambios implementados

| Archivo | Cambio | Riesgo que cierra |
|---------|--------|-------------------|
| `src/services/providers/errors.ts` | **Nuevo.** Función `normalizeAiProviderError()` clasifica errores en 6 categorías: cache_network, webgpu_unsupported, model_download, quota_storage, api_key, generic. Devuelve title, message, cause, recommendedActions, technicalMessage, evidenceStatus. | Usuario ve error crudo sin acciones. Ahora recibe causa probable y pasos de recuperación. |
| `src/services/providers/webllmProvider.ts` | `ensureEngineLoaded` captura errores de `CreateMLCEngine` y los enriquece con `normalized` info. `analyzeStream`, `generateText`, `generateExecutiveReport*`, `preloadModel` usan normalización. Se preserva el error técnico para debugging. | Errores de carga/caché WebLLM se pierden o llegan crudos. Ahora se clasifican y re-lanzan enriquecidos. |
| `src/components/DiagnosisStep.tsx` | `runDiagnosis` catch usa `normalizeAiProviderError`. Nuevo componente `provider-error-notice` muestra: título, mensaje, causa, acciones sugeridas, botón Configuración, botón limpiar modelo cacheado, botón continuar con script determinista. Aclara que no hay evidencia LLM formal. | Mensaje de error confuso sin opciones de recuperación. Ahora el usuario sabe qué hacer y puede continuar. |
| `src/components/SettingsPanel.tsx` | Importa `normalizeAiProviderError`. El catch de `handleDownloadModel` normaliza el error antes de guardarlo en `modelDownloadState`. Sección de error muestra recomendaciones detalladas (eliminar modelo, verificar red, liberar espacio). | Errores de descarga de modelo en Configuración llegaban crudos. Ahora son accionables. |
| `src/services/aiProvider.ts` | `LazyWebLLMProvider` ahora recibe `aiConfig` completo y lo pasa al constructor de `WebLLMProvider`. | WebLLMProvider no tenía acceso a la configuración AI para normalizar errores contextualmente. |
| `src/components/MainPipeline.tsx` | Nuevo prop `onOpenSettings` pas DiagnosisStep. | Botón "Abrir Configuración" en error notice no tenía callback. |
| `src/App.tsx` | Pasa `onOpenSettings={() => setShowSettings(true)}` a MainPipeline. | Conexión entre error notice y panel de configuración. |
| `src/__tests__/providerErrors.test.ts` | **Nuevo.** 15 tests unitarios cubren: Cache.add() network error, WebGPU no soportado, API key inválida, quota exceeded, error genérico, objetos no-Error, estructura de salida. | Sin tests, regresiones silenciosas en normalización de errores. |

## 4. Manejo de errores

| Error detectado | Mensaje usuario | Acción sugerida |
|----------------|----------------|-----------------|
| `Cache.add() encountered a network error` | "Error de red al cachear modelo - No se pudo guardar el modelo en la caché del navegador." | Verificar conexión, liberar espacio, eliminar modelo cacheado, probar otro navegador |
| WebGPU no soportado | "WebGPU no disponible - Tu navegador o dispositivo no soporta WebGPU." | Usar Chrome 113+, activar flag, cambiar a cloud |
| `Failed to fetch` / error de descarga | "Error al descargar modelo - No se pudo descargar el modelo local." | Verificar red, intentar modelo más pequeño, cambiar a cloud |
| `QuotaExceededError` | "Almacenamiento insuficiente - No hay suficiente espacio en disco." | Liberar espacio, eliminar modelos no usados, usar cloud |
| API key inválida (401/403) | "Error de autenticación - La clave de API no es válida." | Verificar key, regenerar en panel del proveedor |
| Error desconocido | "Error del proveedor de IA - Ocurrió un error inesperado." | Intentar nuevamente, cambiar proveedor, revisar consola |

## 5. Pruebas ejecutadas

```
npm test       → 17 test files, 148 tests, ALL PASSED
npm run build  → vite build success (2.90s)
```

Tests nuevos: `providerErrors.test.ts` — 15 tests de normalización de errores.

## 6. Riesgos abiertos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Borrado de modelo cacheado puede fallar si IndexedDB está corrupta | Baja | `deleteDownloadedModel` ya maneja errores y retorna boolean |
| Mensajes de error normalizados podrían no cubrir nuevos errores de WebLLM en futuras versiones | Media | Categoría `generic` cubre cualquier error no clasificado |
| El botón "Limpiar modelo cacheado" no confirma antes de borrar | Baja | El modelo se puede re-descargar; la acción es reversible |

## 7. Commit sugerido

```
fix: normalize WebLLM cache errors in diagnosis

- Add normalizeAiProviderError() utility for 6 error categories
- Enrich WebLLMProvider errors with normalized context
- Replace raw error display in DiagnosisStep with actionable notices
- Add "clean cached model" and "continue with deterministic script" actions
- Improve SettingsPanel error messages for model downloads
- Add 15 unit tests for error normalization
- Wire onOpenSettings callback through MainPipeline
```
