# LOOP 04 - Visual Regression Fix Report - AURA

## 1. Resumen ejecutivo

En desktop aparecía una segunda fila de navegación sin estilos con botones nativos y un checkbox nativo "Modo oscuro". La causa raíz fue que las clases `.nav-links`, `.nav-link` y `.mobile-nav-toggle` estaban definidas exclusivamente dentro de `@media (max-width: 768px)`, sin reglas base globales que las ocultaran en desktop. El navegador las renderizaba con estilos por defecto. La corrección consistió en agregar `display: none` global para los elementos móviles y reemplazar el checkbox nativo por un botón estilizado Casabero. Todas las pruebas unitarias (133/133) y E2E (6/6) pasan. Se generaron 3 capturas de evidencia.

## 2. Causa raíz

**Archivo:** `src/index.css:6214` y `src/App.tsx:410`

La cascada CSS presentaba un vacío de especificidad en desktop:

- `.nav-links` (línea 6214) y `.mobile-nav-toggle` (línea 6200) estaban definidas SOLO dentro del bloque `@media (max-width: 768px)` en la línea 6160.
- `.nav-link` (línea 6238) también exclusivamente dentro del media query.
- Fuera del media query no existía regla que ocultara estos elementos en viewports mayores a 768px.
- En desktop, el navegador aplicaba los estilos por defecto: `.nav-links` como `div` visible, botones `<button>` con apariencia nativa de sistema operativo, y `<input type="checkbox">` sin ningún estilo Casabero.

El checkbox "Modo oscuro" (App.tsx:423-431) usaba un `<input type="checkbox">` crudo sin clase de toggle, visible dentro del menú móvil pero renderizado también en desktop por la falta de ocultamiento del contenedor `.nav-links`.

## 3. Cambios implementados

| Archivo | Cambio | Riesgo que cierra |
|---|---|---|
| `src/index.css:6079` | Agregadas reglas base `.mobile-nav-toggle { display: none }` y `.nav-links { display: none }` fuera del media query | Desktop: elementos móviles visibles como controles nativos |
| `src/App.tsx:2` | Agregados iconos `Sun`, `Moon` a imports de lucide-react | Mobile: sin iconos para toggle de tema |
| `src/App.tsx:423-431` | Reemplazado `<label>` con checkbox nativo por `<button className="nav-link">` con icono lucide | Mobile: checkbox nativo "Modo oscuro" sin estilo |
| `src/tests/e2e/aura-qa-audit.spec.ts` | Agregadas verificaciones visuales desktop/mobile para Loop 04 | Regresión: navegación duplicada vuelve sin detección |
| `src/tests/e2e/aura-qa-screenshots.spec.ts` | Agregado test de screenshots para evidencia visual | Sin capturas de verificación post-fix |
| `docs/qa/ui-regression-2026-06-15/` | 3 capturas generadas (desktop-home-after, mobile-home-after, mobile-nav-open-after) | Sin evidencia visual del estado corregido |

## 4. Correcciones por criterio Casabero

| Criterio Casabero | Problema observado | Corrección aplicada |
|---|---|---|
| Sin ruido visual | Segunda fila de navegación con botones nativos en desktop | `.nav-links` oculto globalmente, visible solo en mobile vía media query |
| Sin controles nativos sin estilo | Checkbox HTML crudo "Modo oscuro" | Reemplazado por `<button className="nav-link">` con icono Sun/Moon |
| Navegación única | Dos barras de navegación visibles simultáneamente en desktop | `.nav-links` solo visible en mobile con `display: flex` condicional |
| Responsive limpio | Elementos móviles visibles en desktop, elementos desktop ocultos | Reglas base ocultan mobile; media query muestra mobile y oculta desktop |
| Lenguaje no académico en primer plano | Verificado: "TFM UNIR" ya estaba eliminado de la UI | Sin acción necesaria — ya corregido en loop anterior |
| Lab opcional | Lab funciona correctamente en desktop y mobile | Sin acción necesaria |

## 5. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm run build` | PASS | Build Vite exitoso, 0 errores |
| `npm test` | PASS | 133/133 tests Vitest pasados (16 archivos) |
| `npm run test:e2e` | PASS | 6/6 tests Playwright pasados |

Detalle de verificaciones visuales E2E (todas PASS):

**Desktop 1280x900:**
- `.nav-links` hidden in desktop: PASS
- `.mobile-nav-toggle` hidden in desktop: PASS
- "Modo oscuro" text hidden in desktop: PASS
- No native checkbox in desktop nav: PASS
- `.nav-center-menu` visible in desktop: PASS

**Mobile 390x844:**
- Mobile hamburger visible: PASS
- `.nav-links-open` hidden when closed: PASS
- Horizontal overflow on mobile home: PASS
- Mobile nav open after hamburger click: PASS
- No native checkbox in mobile nav: PASS
- Theme toggle as styled button in mobile: PASS
- Laboratorio in mobile menu: PASS

## 6. Evidencia visual generada

| Captura | Ruta | Qué valida |
|---|---|---|
| Desktop home post-fix | `docs/qa/ui-regression-2026-06-15/desktop-home-after.png` | Sin nav duplicada, sin botones nativos, nav-center-menu único visible |
| Mobile home cerrado | `docs/qa/ui-regression-2026-06-15/mobile-home-after.png` | Solo hamburger visible, sin nav-links ni overflow |
| Mobile nav abierto | `docs/qa/ui-regression-2026-06-15/mobile-nav-open-after.png` | Menú estilizado con botones, toggle de tema como botón, sin checkbox nativo |

## 7. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|---|---|---|
| Ninguno bloqueante | — | No quedan bloqueantes visuales conocidos. |

## 8. Claims actualizados

Los claims permitidos/no permitidos del Loop 03 se mantienen sin cambios:

- `r.contractCompliance ?? r.formatCompliance` en ExperimentDesigner.tsx:259 mantiene `contractCompliance` como discurso principal.
- Label "Diagnóstico LLM y laboratorio" en evidenceManifest.ts:53 mantiene el lenguaje corregido.
- `formal_valid` no se declara — sin corridas de benchmark formal completadas.

## 9. Commit sugerido

```
fix: remove duplicate mobile nav visual regression

- Add global display:none for .nav-links and .mobile-nav-toggle
- Replace native checkbox with styled Casabero button for dark mode toggle
- Add E2E visual regression checks for desktop 1280px and mobile 390px
- Generate post-fix screenshots in docs/qa/ui-regression-2026-06-15/
