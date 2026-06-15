# LOOP 08 - Trust, Settings and Help Report - AURA

## 1. Resumen ejecutivo

LOOP 08 corrige problemas de confianza y comprensión en AURA:
- Los modelos locales ya no muestran "descargado" sin verificación fuerte.
- El diagnóstico ahora tiene una consola de actividad observable.
- La Configuración es una pantalla completa organizada y educativa (no drawer).
- La Ayuda es un centro completo con flujo, conceptos, privacidad y solución de problemas.

## 2. Problemas detectados

| Problema | Gravedad | Descripción |
|----------|----------|-------------|
| Falsos "descargado" | Alta | `checkModelDownloaded` devolvía `true` con restos parciales en Cache API o IndexedDB. El `<select>` mostraba "· descargado" sin verificación fuerte. |
| Falta de actividad visible | Alta | El usuario no sabía si AURA estaba trabajando, cargando el modelo, o congelado durante el diagnóstico. |
| Configuración tipo drawer | Media | La configuración aparecía como panel lateral (drawer), poco claro para usuarios no expertos. No explicaba los conceptos. |
| Ayuda insuficiente | Media | La ayuda original tenía solo 3 secciones breves. No cubría el flujo completo, conceptos, privacidad ni errores frecuentes. |

## 3. Cambios aplicados

| Archivo | Cambio | Riesgo que cierra |
|---------|--------|-------------------|
| `src/types.ts` | Añadidos `LocalModelStatus` y `DiagnosisEvent` | Contrato de tipos para el nuevo sistema de verificación y actividad |
| `src/services/modelManager.ts` | Nueva función `getLocalModelStatus` con verificación multi-capa (IndexedDB, Cache API, preload_verified). Funciones `markPreloadVerified`, `clearPreloadVerification`, `hasIndexedDBModel`, `hasCacheModel` | Falsos positivos en estado de descarga |
| `src/services/aiProvider.ts` | Re-export de nuevas funciones de modelManager | Acceso centralizado a verificación de modelos |
| `src/components/DiagnosisStep.tsx` | Eliminado "· descargado" del select. Añadido bloque de estado de modelo debajo del selector con acciones (Verificar, Descargar, Limpiar). Añadida consola de actividad del diagnóstico con eventos observables. | Confianza en estado de modelos y transparencia del proceso |
| `src/components/SettingsPanel.tsx` | Reescribir como `SettingsWorkspace`: pantalla completa con secciones educativas (Recomendación rápida, Proveedor, Modelos en tarjetas, Temperatura, Contrato, Privacidad, Solución de problemas). Tarjetas de modelos con estado real usando `getLocalModelStatus`. | Claridad en configuración y comprensión de opciones |
| `src/components/HelpCenter.tsx` | Nuevo componente: centro de ayuda con 8 secciones (Qué es AURA, Flujo completo, Conceptos, Configuración, Privacidad, Errores, FAQ, Glosario). Búsqueda interna. | Comprensión del flujo y conceptos |
| `src/App.tsx` | Adaptado para renderizar SettingsPanel y HelpCenter como pantallas completas (no modales), ocultando el pipeline principal. Import de HelpCenter. | Navegación coherente entre secciones principales |
| `src/index.css` | +300 líneas de estilos nuevos: local-model-status, activity-console, settings-workspace, help-center, tarjetas de modelos, secciones colapsables, responsive. | Experiencia visual consistente Casabero |

## 4. Estado de modelos locales

Nueva lógica en `getLocalModelStatus(modelId)`:

| Estado | Condición | Confianza |
|--------|-----------|-----------|
| `ready` | Solo si `preloadModel()` se completó exitosamente (marcado con `markPreloadVerified`) + confirmación IndexedDB | Alta |
| `partial` | IndexedDB tiene la clave del modelo pero no hay verificación de preload exitoso | Media |
| `partial` | Solo Cache API tiene restos del modelo (no fiable) | Baja |
| `not_downloaded` | Ni IndexedDB, ni Cache API, ni verificación de preload contienen el modelo | Alta |
| `error` | El modelo se marcó como error en `modelDownloadState` | Baja |

Principio: **Cache API por sí sola no debe marcar `ready`**; como máximo `partial`. Estados antiguos de localStorage sin verificación IndexedDB no son verdad absoluta.

## 5. Consola de actividad

La consola de actividad muestra eventos observables del proceso de diagnóstico:

- "AURA está preparando la evidencia estructurada."
- "Verificando proveedor local (WebGPU)..."
- "Enviando paquete estructurado al modelo."
- "Esperando respuesta..."
- "Diagnóstico completado · N tokens · X.Xs"
- "Diagnóstico fallido: [título del error]"
- "Puedes continuar con respaldo determinista si el flujo falla."

**No se muestra razonamiento privado del modelo; se muestran eventos observables del proceso.**

La consola usa un diseño tipo terminal limpio, colapsable, con iconos de estado (info/success/warning/error) y timestamps.

## 6. Configuración

Nueva organización como pantalla completa (`SettingsWorkspace`):

| Sección | Contenido |
|---------|-----------|
| A. Recomendación rápida | Sugiere Local si WebGPU disponible, Cloud si no. Explica por qué. |
| B. Proveedor de IA | Tarjetas para Cloud/Local/Chrome AI con descripciones. Detalles de configuración según selección. |
| C. Modelos locales | Tarjetas por modelo con: nombre, tamaño, familia, estado real, acciones (verificar/descargar/eliminar), nota de descarga. |
| D. Modelos cloud | Proveedor, API key, modelo, nota de privacidad. |
| E. Temperatura | Slider con explicación: 0.0 estable, 1.0 creativo, recomendado 0.1-0.2 para auditoría. |
| F. Contrato del diagnóstico | Colapsado como avanzado. Explicación de qué controla. |
| G. Privacidad y datos | Colapsable: qué sale en local, qué en cloud, qué en localStorage, qué se exporta. |
| H. Solución de problemas | Colapsable: Cache.add, WebGPU, modelo parcial, API key inválida, descarga lenta, diagnóstico vacío. |

## 7. Centro de ayuda

Secciones creadas en `HelpCenter`:

| Sección | Contenido |
|---------|-----------|
| A. Qué es AURA | Explicación simple: qué hace y qué no hace. |
| B. Flujo completo | 7 etapas detalladas (Carga, Perfil, Diagnóstico, Script, Revisión, Exportar, Laboratorio) con qué decisión toma el usuario en cada una. |
| C. Conceptos básicos | 20 términos definidos en lenguaje claro: dataset, CSV, delimitador, score, hallazgo, crítico, nulos, outliers, IQR, columna fantasma, script Pandas, HITL, etc. |
| D. Configuración | 10 conceptos de configuración explicados: proveedor local/cloud/Chrome AI, WebGPU, modelo, API key, temperatura, contrato, caché. |
| E. Privacidad | Explicación por modo: qué sale del navegador, qué se queda, qué nunca subir. |
| F. Errores frecuentes | 8 errores con causa y solución: Cache.add, WebGPU, API key, modelo parcial, descarga lenta, diagnóstico vacío, script sin cobertura, simulación sin mejora. |
| G. Preguntas frecuentes | 6 FAQs con respuestas claras. |
| H. Glosario | Lista alfabética de 26 términos técnicos. |

Búsqueda interna: input de búsqueda que filtra secciones por texto.

## 8. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm run build` | PASS | Build limpio, sin errores de TypeScript |
| `npm test` | 17/17 archivos, 150/150 tests PASS | Todos los tests unitarios pasan |
| `npm run test:e2e` | 7/11 PASS, 4 FAIL | Los 4 fallos son pre-existentes: el botón "Generar diagnóstico" aparece disabled en CI (sin LLM provider), causando timeout al hacer click. No relacionados con LOOP 08. |

## 9. Evidencia visual

| Captura | Ruta | Qué valida |
|---------|------|------------|
| 01-diagnosis-model-status.png | `docs/qa/trust-settings-help-2026-06-15/` | Estado del modelo local visible debajo del selector, no dentro del `<select>`. |
| 02-diagnosis-activity-console.png | `docs/qa/trust-settings-help-2026-06-15/` | Consola de actividad mostrando eventos del diagnóstico. |
| 03-settings-workspace-local.png | `docs/qa/trust-settings-help-2026-06-15/` | Configuración como pantalla completa con tarjetas de modelos locales. |
| 04-settings-workspace-cloud.png | `docs/qa/trust-settings-help-2026-06-15/` | Configuración mostrando panel Cloud con API key y modelo. |
| 05-help-center-flow.png | `docs/qa/trust-settings-help-2026-06-15/` | Centro de ayuda mostrando secciones A (Qué es AURA) y B (Flujo completo). |

## 10. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| E2E tests con LLM provider no disponible | Media | Los tests de CI no tienen acceso a APIs cloud ni WebLLM. Los tests que dependen del botón "Generar diagnóstico" fallan por timeout. Considerar mock del provider o skip condicional. |
| `getLocalModelStatus` depende de la estructura interna de IndexedDB de WebLLM | Baja | Si WebLLM cambia el nombre de la DB o del store, la verificación fallará. Documentado en el código. |
| Primera descarga de modelo grande puede saturar el almacenamiento | Baja | Las tarjetas de modelo advierten del tamaño. El usuario debe decidir. |

## 11. Veredicto

**GO**

Los cambios aplicados:
- Eliminan falsos positivos en el estado de descarga de modelos locales.
- Proveen visibilidad del proceso de diagnóstico mediante consola de actividad.
- Transforman la configuración en una experiencia educativa y organizada.
- Crean un centro de ayuda completo que cubre todo el flujo de AURA.

Build limpio, 150/150 tests unitarios pasando. E2E fallos pre-existentes no relacionados.

## 12. Commit

```
ux: improve model trust settings workspace and help center

- Model status verification with multi-layer confidence (IndexedDB, Cache API, preload)
- Remove "descargado" label from diagnosis model selector
- Add diagnosis activity console with observable process events
- Convert settings from drawer to full workspace with educational sections
- Add model cards with real status, download/verify/delete actions
- Create comprehensive HelpCenter with flow, concepts, privacy, errors, FAQ
- Add search functionality to help center
```
