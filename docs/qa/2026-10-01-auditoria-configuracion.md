# Auditoría de Configuración — 1 de octubre de 2026

Alcance: las cinco páginas de Configuración (General, IA y proveedores, Evidencia, Privacidad y datos, Diagnóstico avanzado), su retorno y sus entradas desde Auditoría. Referencias: U09 y los contratos transversales de `docs/plans/2026-09-14-aura-editorial-ux-design.md`, EC-04/EC-18 del catálogo, `EDITORIAL.md` y `DESIGN_SYSTEM_EDITORIAL.md` del estándar. Revisión en navegador a 1280 px, 390 px y en modo oscuro.

## Respuestas a lo observado

**«Proveedor de diagnóstico» no presentaba soluciones.** Confirmado. La página decía qué faltaba («Gemini Nano requiere una descarga inicial») y solo ofrecía «Verificar estado». El botón «Preparar Gemini Nano» estaba en otra página, Diagnóstico avanzado. Ollama sin conexión solo remitía a esa página. Además, el diagnóstico de Chrome ya traía los pasos de solución (`ChromeAiDiagnostic.actions`) y la interfaz no los mostraba.

**«Volver a auditoría» en las páginas de Configuración.** El texto estaba fijo: abriendo Configuración desde Inicio o Laboratorio decía «Volver a auditoría» y te llevaba a otro sitio. Además, la barra marcaba dos páginas actuales a la vez (el origen y Configuración). **Decisión del 2026-10-01:** sin botón de retorno en Configuración ni en Ayuda; basta el menú. Esto sustituye el «retorno al origen» de U09. La pestaña standalone de Ollama conserva «Cerrar y volver a AURA» porque no tiene menú.

**Cloud.** Queda fuera de esta versión como implementación futura (detalle abajo).

## Cambios aplicados

| # | Cambio | Archivos |
|---|---|---|
| 1 | **Cloud es implementación futura.** Un indicador (`CLOUD_PROVIDERS_ENABLED = false`) y `enforceProviderAvailability` convierten cualquier configuración Cloud restaurada (localStorage, sincronización remota o configuración heredada) en Chrome AI. Se aplica en `loadAIConfig`, en la sincronización de App y en `createAIProvider`. Los adaptadores Gemini y OpenAI-compatible se conservan. | `services/providerAvailability.ts`, `services/aiConfigStorage.ts`, `services/aiProvider.ts`, `App.tsx` |
| 2 | Cloud desaparece de IA y proveedores, Privacidad, Diagnóstico avanzado («Usar Cloud», «API key inválida») y Ayuda. Los mensajes de recuperación ya no recomiendan «usa Cloud». Se corrige la palabra rusa «диагностика» en un mensaje de error. | `settings/*`, `HelpCenter.tsx`, `providers/errors.ts`, `providers/chromeProvider.ts`, `ChromeAiStatusPanel.tsx` |
| 3 | **Sin botón de retorno** en Configuración ni en Ayuda: se sale por el menú. Con una utilidad abierta, solo ella tiene `aria-current="page"`. | `App.tsx`, `SettingsPanel.tsx`, `HelpCenter.tsx`, `CLAUDE.md` |
| 4 | **La solución aparece donde se detecta el problema.** Radios nativos con un filete por opción y el estado en texto. Chrome AI: «Preparar Gemini Nano» con progreso `scaleX`, los pasos del diagnóstico, «Usar Ollama local» y un enlace a la guía. Ollama: «Conectar Ollama de este equipo» (el mismo verbo que el asistente) y «Volver a intentar». Se elimina el bloque «Proveedor activo», que U09 nombra como duplicado, y la lista de modelos que repetía el selector. | `settings/ProvidersSection.tsx`, `SettingsPanel.tsx` |
| 5 | **«Cambiar proveedor» desde el diagnóstico abría General**, una página sin ajustes. Ahora abre IA y proveedores. | `App.tsx` |
| 6 | Privacidad: sin tarjeta, como lista etiqueta → valor. Si hay API configurada, declara que se sincronizan las preferencias (nunca el CSV). Ayuda decía que las API keys se guardaban en `localStorage`; el código usa `sessionStorage`. Esa contradicción desaparece. | `settings/PrivacySection.tsx`, `HelpCenter.tsx` |
| 7 | Editorial en los campos de Configuración: etiquetas visibles de 14 px en sentence case. El texto corrido tenía tracking de etiqueta (0.08 em) y ahora es normal. Campos de 44 px con un solo perímetro de foco. La barra de guardado ya no desborda 16 px en horizontal. | `styles/editorial-shell.css` |
| 8 | El registro técnico mostraba un icono de nube en toda corrida que no fuera `local`, incluidas Chrome AI y Ollama. | `AuditLogViewer.tsx` |

## Hallazgos pendientes

| Prioridad | Hallazgo | Recomendación |
|---|---|---|
| P1 | El borrador se pierde sin aviso al ir a Auditoría, Laboratorio o Inicio con cambios sin guardar. «Guardar» y «Cancelar» cierran la vista. U09 exige que cerrar conserve o descarte de forma explícita. | Confirmar antes de salir con cambios. «Guardar» se queda en la página y muestra «Guardado». |
| P1 | Diagnóstico avanzado repite «Estado del sistema», que ya está en IA y proveedores, y anida tarjetas con iconos dentro de otras tarjetas. | Dejarla como referencia: guía de activación, descarga de modelos Ollama y solución de problemas, en secciones con filete. |
| P1 | General no tiene ningún ajuste; solo dice dónde está el interruptor de tema. | Poner ahí el tema como radio Claro/Oscuro, o eliminar la página. |
| P1 | Evidencia usa `role="radio"` en botones, sin navegación por flechas. «Recomendado» aparece dos veces y el resumen se repite al pie. Sus opciones están duplicadas en `DiagnosisQuickConfigModal` con textos distintos: dos fuentes de verdad. | Radios nativos, como el nuevo selector de proveedor, y una sola constante compartida. |
| Decisión | El modo oscuro usa `#161614`, que es lo que pide `CLAUDE.md`. `DESIGN_SYSTEM_EDITORIAL.md` exige negro puro `#000000` y llama Warm a `#161614`. | Decidir cuál de los dos documentos manda. |
| Decisión | `CLAUDE.md` pide Configuración en drawer. El commit `fbf1705` eliminó los drawers y quedan 9 reglas `.utility-drawer` sin uso. | Actualizar el contrato y borrar el CSS muerto. |
| P2 | El endpoint de Ollama por defecto no coincide: `localhost:11434` en `aiProvider.ts` y Ayuda, `127.0.0.1:11434` en App y Configuración. | Una constante única. |
| P2 | `diagnosis/DiagnosisProviderPanel.tsx` no se renderiza en ningún sitio y todavía ofrece Cloud. | Eliminarlo. |
| P2 | Los E2E con Ollama real (`ux-local-ollama-config`, `ux-local-qwen-walkthrough`) siguen la estructura de una sola página («Guardar configuración», evidencia en la misma vista). | Actualizarlos al recorrido de cinco páginas. |
| P2 | `.btn-s` tiene relleno de superficie en toda la app. El estándar pide filete suave o enlace. Las reglas `.settings-*` están redefinidas en 2 a 6 capas dentro de `index.css`. | Corregir en el loop de botones; consolidar en la hoja Editorial. |
| P2 | A 390 px, «Nuevo análisis» se parte en dos líneas en la barra. | Texto más corto o una sola línea en móvil. |

## Verificación

- Recorridos en el navegador sobre el servidor de desarrollo: Configuración y Ayuda sin botón de retorno, con una sola página actual en el menú; Chrome AI que requiere descarga muestra «Preparar Gemini Nano»; Ollama conectado y selección de modelo; enlace a la guía conservando el borrador; Privacidad; modo oscuro; sin desbordamiento horizontal.
- Unitarios: 1860 aprobados (en `HEAD`, 1851). Fallan las mismas 17 suites (67 tests) en los dos casos. Son fallos de entorno: la copia no incluye `experiments/` ni Python. `tsc`: 0 errores.
- E2E con Chrome del sistema: `editorial-loop01` 6/6 (J14 ahora entra y sale por el menú; estaba roto desde `8813873`). `aura-provider-readiness` 13/13. La configuración Cloud heredada se restaura como Chrome AI y la causa ya no menciona API keys.
- Entorno: iCloud desalojó 19 332 archivos de `src/node_modules` (611 de jsdom). Los tests jsdom se cuelgan al cargar. Se ejecutaron en una copia limpia en `/tmp` con `npm ci`.
