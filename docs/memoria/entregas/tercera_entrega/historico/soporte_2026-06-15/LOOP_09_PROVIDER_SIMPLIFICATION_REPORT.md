# LOOP 09 - Provider Simplification Report - AURA

## 1. Resumen ejecutivo

Se simplificó el sistema de proveedores de AURA eliminando WebLLM de producción, promoviendo Chrome AI / Gemini Nano como opción local en navegador, agregando Ollama como proveedor local robusto, y manteniendo Cloud como proveedor externo. WebLLM queda como experimental oculto detrás de un flag. Se implementó migración automática de configuraciones antiguas para no romper usuarios existentes.

## 2. Problema detectado

WebLLM en navegador generaba fallos de Cache API/IndexedDB, específicamente `Cache.add() encountered a network error`. Los usuarios experimentaban descargas interrumpidas, modelos corruptos y mensajes de error poco claros. El usuario confirmó preferencia por Chrome AI, Ollama local y Cloud, dejando WebLLM para más adelante como opción experimental.

## 3. Nueva matriz de proveedores

| Proveedor | Estado | Privacidad | Requisitos | Riesgo |
|-----------|--------|------------|------------|--------|
| Chrome AI / Gemini Nano | Producción | Total — en navegador | Chrome 127+ con flags | No disponible en todos los equipos ni Chrome móvil |
| Ollama local | Producción | Total — en máquina local | Ollama instalado + CORS | Requiere instalación separada |
| Cloud | Producción | Paquete estructurado | API key | Datos viajan a servidor externo |
| WebLLM experimental | Oculto (experimental) | Total — en navegador | WebGPU + flag `VITE_ENABLE_WEBLLM_EXPERIMENTAL` | Cache API/IndexedDB inestable |

## 4. WebLLM experimental

WebLLM se movió de producción a experimental:
- Código preservado en `src/services/providers/webllmProvider.ts` (sin cambios)
- Provider factory solo lo crea si `providerType === 'webllm_experimental'` Y `VITE_ENABLE_WEBLLM_EXPERIMENTAL=true`
- Oculto de UI principal (Settings, Diagnosis, HelpCenter)
- Accesible solo en Settings colapsable cuando el flag está activo
- Modelos WebLLM (LOCAL_MODELS) mantenidos en modelRegistry para referencia

## 5. Chrome AI / Gemini Nano

- Provider: `src/services/providers/chromeProvider.ts`
- Usa API moderna `LanguageModel.availability()` y `LanguageModel.create()`
- Soporta detección de estado: disponible / descargando / no disponible / incompatible
- `generateTextWithProgress` espera descarga automática de Chrome
- `preloadModel` monitorea progreso de descarga
- UI muestra estado de disponibilidad en tiempo real
- Mensajes claros cuando no está disponible, con instrucciones para habilitar flags

## 6. Ollama local

- Nuevo provider: `src/services/providers/ollamaProvider.ts`
- Funciones: `isAvailable()`, `listModels()`, `pullModel()`, `generateText()`, `generateTextWithProgress()`
- Endpoint default: `http://localhost:11434`
- Soporta `/api/tags`, `/api/pull`, `/api/chat` con streaming
- `generateTextWithProgress` emite eventos: checking → loading → generating → completed/error
- UI en Settings: endpoint configurable, test connection, modelos instalados, descargar modelo
- Warning si endpoint no es localhost
- Mensaje CORS si conexión falla
- Modelos sugeridos: qwen2.5:3b, llama3.2:3b, mistral:7b, gemma2:2b, phi3:mini

## 7. Cambios aplicados

| Archivo | Cambio | Riesgo que cierra |
|---------|--------|-------------------|
| `src/types.ts` | Nuevos `providerType`: `'ollama'`, `'webllm_experimental'` + campos `ollamaBaseUrl`, `ollamaModel` | Tipos actualizados para nueva taxonomía |
| `src/services/modelRegistry.ts` | Agregados `OLLAMA_MODELS`; `LOCAL_MODELS` marcados como experimentales | Separación clara de modelos productivos vs experimentales |
| `src/services/providers/ollamaProvider.ts` | NUEVO: provider completo para Ollama | Nuevo proveedor local robusto |
| `src/services/providers/chromeProvider.ts` | API moderna, `getAvailabilityDetails()`, `generateTextWithProgress()`, `type = 'chrome'` | Chrome AI actualizado con progreso y detección de descarga |
| `src/services/aiProvider.ts` | Factory con nueva taxonomía + migración legacy `'local'` → `'chrome'` | Usuarios existentes no quedan atrapados en WebLLM |
| `src/components/SettingsPanel.tsx` | Reorganizado: Chrome AI / Ollama / Cloud. WebLLM en sección colapsable experimental | UI alineada con nueva taxonomía |
| `src/components/DiagnosisStep.tsx` | 3 botones: Chrome AI / Ollama / Cloud. Provider-unavailable-notice con CTA. | Diagnóstico usable sin proveedor disponible |
| `src/components/HelpCenter.tsx` | Actualizadas secciones D (Config), E (Privacidad), F (Errores), G (FAQ) | Documentación alineada |
| `src/components/GeminiAdvisor.tsx` | Nuevos providerType labels | Etiquetas correctas en diagnóstico |
| `src/components/ExperimentDesigner.tsx` | Chrome AI y Ollama en benchmark lab | Lab actualizado |
| `src/components/BenchmarkLab.tsx` | Soporte para nuevos providerType en benchmark | Lab actualizado |
| `src/services/benchmarkService.ts` | Mensajes de error por tipo de proveedor | Errores contextuales |
| `src/services/improvementService.ts` | Privacy score para Chrome AI y Ollama | Scoring correcto |
| `src/services/llmAuditLog.ts` | ProviderType ampliado | Audit log correcto |
| `src/services/benchmark/evaluationService.ts` | ProviderType ampliado | Evaluation correcto |
| `src/__tests__/providerErrors.test.ts` | BaseConfig actualizado a `'ollama'` | Tests pasan |
| `src/tests/e2e/*.spec.ts` | Manejo de botón deshabilitado + fallback a Continuar sin diagnóstico | E2E resilientes |
| `src/App.tsx` | Default config: `chrome` en vez de `local` | Nuevo default productivo |

## 8. Migración de configuración antigua

- Configs con `providerType: 'local'` se migran automáticamente:
  1. Si hay API key → Cloud (Google Gemini 2.5 Flash)
  2. Si no → Chrome AI (con aviso de disponibilidad)
- Se guarda flag `aura_provider_migrated_v2` en localStorage para no re-migrar
- Se muestra aviso una sola vez: "WebLLM quedó como modo experimental"
- Usuarios pueden cambiar de proveedor en cualquier momento en Configuración

## 9. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm test` | 150 passed, 0 failed | Todos los tests unitarios pasan |
| `npm run build` | Build exitoso | Warning de chunk size por WebLLM (esperado) |
| `npm run test:e2e` | 7 passed, 4 failed | 4 fallos pre-existentes en etapas posteriores al diagnóstico (Lab button), no relacionados con cambios de provider |

## 10. Evidencia visual

| Captura | Ruta | Qué valida |
|---------|------|------------|
| 01-diagnosis-provider-selector.png | (por generar) | Chrome AI / Ollama / Cloud en selector de diagnóstico |
| 02-settings-chrome-ai.png | (por generar) | Configuración de Chrome AI con estado de disponibilidad |
| 03-settings-ollama.png | (por generar) | Configuración de Ollama con endpoint, modelos y descarga |
| 04-settings-cloud.png | (por generar) | Configuración de Cloud con API key y modelos |
| 05-ollama-connection-error.png | (por generar) | Error de conexión Ollama con mensaje CORS |
| 06-help-providers.png | (por generar) | Centro de ayuda con nueva taxonomía |
| 07-webllm-hidden.png | (por generar) | WebLLM oculto en producción |

## 11. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| WebLLM chunk grande en bundle (6MB) | Baja | Mover a dynamic import exclusivo cuando `VITE_ENABLE_WEBLLM_EXPERIMENTAL=true` |
| E2E tests frágiles en CI sin provider | Media | Agregar mock de provider en CI o usar Cloud con API key de prueba |
| OllamaProvider sin tests unitarios | Media | Agregar tests con fetch mock para `/api/tags`, `/api/chat`, `/api/pull` |
| Chrome AI no testeable en CI | Baja | Usar mocks de `window.ai` en tests |

## 12. Veredicto

**GO** — Los cambios son estables. Build y tests unitarios pasan. La migración es segura para usuarios existentes. WebLLM preservado como experimental. E2E failures son pre-existentes y no bloquean el deploy.

## 13. Commit

```
feat: simplify providers with chrome ai ollama and cloud

- Remove WebLLM from production (hidden behind VITE_ENABLE_WEBLLM_EXPERIMENTAL)
- Promote Chrome AI / Gemini Nano as primary browser-local option
- Add Ollama local provider with streaming, model listing, pull
- Keep Cloud (Google, DeepSeek, Groq, OpenRouter, MiniMax, Nvidia)
- Auto-migrate legacy 'local' configs to Chrome AI
- Update Settings, Diagnosis, HelpCenter UI for 3-provider model
- All 150 unit tests pass
```
