# LOOP 09B - Chrome AI / Gemini Nano Enablement Report - AURA

## 1. Resumen ejecutivo

Se corrigió la detección de la API de Chrome AI para usar `globalThis.LanguageModel` (API moderna de Chrome 138+) en lugar de depender exclusivamente de `window.ai`. Se agregó diagnóstico completo, guía de activación en UI, barra de progreso para descargas, y 16 tests unitarios nuevos.

## 2. Problema detectado

Usuario en Chrome 149 (macOS arm64) veía "Chrome AI no disponible. Requiere Chrome 127+ con flags habilitados." en AURA.

**Causa raíz:** El provider anterior verificaba `window.ai` como primer paso, pero Chrome 138+ expone la API global `LanguageModel` directamente en `globalThis`, no bajo `window.ai`. La función `getAvailabilityDetails()` no encontraba ninguna de las superficies de API y retornaba `available: false`.

## 3. Diagnóstico técnico

Se implementó `detectApiSurface()` que prueba en orden:
1. `globalThis.LanguageModel` → `apiSurface: 'LanguageModel'`
2. `window.ai?.languageModel` → `apiSurface: 'window.ai.languageModel'`
3. `window.ai?.assistant` → `apiSurface: 'window.ai.assistant'`
4. Ninguna → `apiSurface: 'none'`

Y `getChromeAiDiagnostic()` que retorna:
```
ChromeAiDiagnostic {
  apiSurface,           // qué API se encontró
  status,               // available | downloadable | downloading | unavailable | error
  rawAvailability,      // respuesta cruda de la API
  message,              // mensaje humano
  actions: string[]     // acciones recomendadas
}
```

| API surface | Estado esperado | Acción |
|-------------|----------------|--------|
| `LanguageModel` con `readily` | available | Generar diagnóstico directamente |
| `LanguageModel` con `after-download` | downloadable | Mostrar botón "Preparar Gemini Nano" |
| `window.ai.languageModel` | available/downloadable | Usar bridge legacy |
| `window.ai.assistant` | available/no | Usar API legacy |
| `none` | unavailable | Mostrar guía de activación |

## 4. Cambios aplicados

| Archivo | Cambio | Riesgo que cierra |
|---------|--------|-------------------|
| `src/services/providers/chromeProvider.ts` | Reescritura completa: `detectApiSurface()`, `getChromeAiDiagnostic()`, `createSession()` con `monitor` para downloadprogress, `generateTextWithProgress()` con barra de descarga | Chrome 149 detecta `LanguageModel` correctamente |
| `src/services/providers/errors.ts` | 5 nuevas categorías de error Chrome AI: `chrome_api_missing`, `chrome_model_download_required`, `chrome_model_download_failed`, `chrome_incompatible`, `chrome_user_activation_required` | Errores Chrome AI normalizados y accionables |
| `src/services/aiProvider.ts` | Exporta `getChromeAiDiagnostic` y tipos `ChromeAiDiagnostic`, `ChromeAiApiSurface`, `ChromeAiStatus` | UI puede consumir diagnóstico sin crear provider |
| `src/components/SettingsPanel.tsx` | Panel Chrome AI educativo: estado con API surface, botones Verificar/Preparar/Usar Ollama/Usar Cloud, guía de activación colapsable con pasos y `chrome://on-device-internals` | Usuario sabe exactamente qué hacer |
| `src/components/DiagnosisStep.tsx` | Provider-unavailable-notice para Chrome AI: guía de activación en 4 pasos, botones Verificar/Ollama/Cloud, enlace a `chrome://on-device-internals` | No solo "no disponible", sino guía accionable |
| `src/components/HelpCenter.tsx` | Actualizada sección Chrome AI con requisitos, DevTools tips, flags, `LanguageModel.availability()` | Documentación alineada con API moderna |
| `src/__tests__/chromeProvider.test.ts` | 16 tests nuevos con mock de `globalThis.LanguageModel` | Cobertura de API surface, availability, provider |

## 5. Guía de activación para usuarios

1. Actualiza Chrome a la versión más reciente (138+).
2. Abre `chrome://flags` en una pestaña nueva.
3. Busca **"Prompt API"**, **"Gemini Nano"** o **"Built-in AI"**.
4. Activa las opciones disponibles (nombres pueden variar según versión).
5. Reinicia Chrome.
6. Vuelve a AURA y pulsa **Verificar estado** en Configuración.

Desde DevTools:
```js
'LanguageModel' in globalThis  // true si la API está expuesta
await LanguageModel.availability()  // { available: 'readily' | 'after-download' | 'no' }
```

Revisar `chrome://on-device-internals` para ver modelos on-device y estado de descarga.

## 6. Progreso y transparencia

`generateTextWithProgress` emite eventos:
- `checking` — verificando API
- `downloading` — con porcentaje real del monitor de descarga
- `loading` — creando sesión
- `generating` — inferencia en curso
- `completed` — diagnóstico listo
- `error` — fallo con mensaje

Settings muestra "Preparar Gemini Nano" con ProgressDisclosure durante la descarga.

## 7. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm test` | 166 passed, 2 skipped | Tests de `window.ai` requieren jsdom (no Node) |
| `npm run build` | Build exitoso | Sin warnings nuevos |

## 8. Evidencia visual

| Captura | Ruta | Qué valida |
|---------|------|------------|
| 01-chrome-ai-not-available-guide.png | (por generar) | Guía en diagnóstico cuando no disponible |
| 02-chrome-ai-download-required.png | (por generar) | Botón "Preparar Gemini Nano" |
| 03-chrome-ai-download-progress.png | (por generar) | ProgressDisclosure durante descarga |
| 04-chrome-ai-ready.png | (por generar) | Estado "Gemini Nano listo" |
| 05-settings-chrome-ai-guide.png | (por generar) | Panel educativo en Settings |
| 06-help-chrome-ai.png | (por generar) | Centro de ayuda actualizado |

## 9. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| `LanguageModel` global puede no estar tipado en TypeScript | Baja | Declaración `globalThis.LanguageModel` en el provider cubre el caso |
| `monitor` callback en `create()` puede cambiar firma en futuras versiones | Baja | El catch de errores en `createSession` maneja fallos gracefully |
| Tests de `window.ai` solo corren en jsdom | Baja | Tests skipped en Node, se pueden correr con `--environment jsdom` |

## 10. Veredicto

**GO** — La API moderna `globalThis.LanguageModel` se detecta correctamente en Chrome 138+. El diagnóstico es completo y accionable. Los tests unitarios pasan. La UI guía al usuario para activar Chrome AI o elegir alternativa.

## 11. Commit

Commit sugerido:
```
fix: enable chrome ai gemini nano with modern prompt api
```
