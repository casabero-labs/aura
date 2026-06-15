# LOOP 05B - Casabero Aesthetic Implementation Report - AURA

## 1. Resumen ejecutivo

AURA presentaba una estética de dashboard técnico saturado: header con racimo de iconos, status-pill ruidoso, stepper con cajas pesadas, hero con texto largo, cards con bordes densos, y duplicación de controles. Se aplicó un reset estético global siguiendo el patrón Casabero (referencia `estandar-casabero/examples/frontend/showcase.html`). El resultado es una interfaz editorial minimalista: header textual limpio, stepper ligero, hero conciso, file-upload simplificado, y controles secundarios movidos a footer. Sin cambios en lógica funcional, auditEngine, scoring, benchmark, ni providers.

## 2. Problema visual corregido

La UI anterior acumulaba ruido visual de desarrollador: 4 iconos de herramientas en el header duplicando navegación, status-pill `LOCAL-FIRST / MODO CLOUD` con pulse-dot, stepper con cajas y círculos de iconos, file-upload con checklist de constraints, y texto hero excesivamente descriptivo. Esto producía una sensación de panel de control técnico, no de interfaz editorial Casabero.

## 3. Referencia Casabero aplicada

| Patrón Casabero | Archivo/línea de referencia | Aplicación en AURA |
|---|---|---|
| Header 52px con borde suave | `showcase.html` nav pattern | `index.css` `.sys-nav` — heading limpio, solo brand + texto nav + theme toggle |
| Navegación textual sobria | `showcase.html` `.nav-items a` | `index.css` `.nav-menu-item` — sin iconos, sin underline, solo color |
| Toggle estándar | `showcase.html` theme toggle | `index.css` `.theme-toggle` — capsule switch Casabero |
| Tipografía serif para títulos | `showcase.html` `.section-label` | `index.css` `.hero-sub` — Playfair Display, clamp size |
| Sans para UI | `showcase.html` body | `index.css` body — Inter en toda la interfaz |
| Cards con menos borde | `showcase.html` card pattern | `index.css` stepper steps — sin border/background, solo color |
| Empty states limpios | `showcase.html` balance visual | `FileUpload.tsx` — carga simplificada sin checklist |
| Menos iconos | `showcase.html` minimal icon use | Header, stepper, file-upload — eliminados iconos decorativos |
| Mono solo para evidencia colapsada | `showcase.html` code blocks | Evidencia técnica en `<details>` colapsados |

## 4. Cambios globales

| Área | Cambio | Riesgo visual que cierra |
|---|---|---|
| CSS duplicación | Eliminado `.sec-eye` duplicado (lines 1495→override) y `.hero` duplicado (line 1545→eliminado) | Propiedades CSS en conflicto causando estilos inconsistentes |
| CSS stepper | Rediseñado sin cajas, sin iconos, solo texto con color condicional | Stepper visualmente abrumador con 6 cajas + círculos |
| CSS nav-menu-item | Simplificado a texto sin `gap`, sin `text-decoration`, sin background | Items de nav con aspecto de botón-pill |
| CSS footer | Agregados `.footer-links` y `.footer-link` para controles secundarios | Sin ubicación para help/history/trazabilidad |

## 5. Cambios por pantalla

| Pantalla | Antes | Después | Riesgo que cierra |
|---|---|---|---|
| Home/upload | Hero con 2 párrafos largos, file-upload con checklist de 4 constraints y 2 iconos decorativos | Hero 1 frase, file-upload simplificado a 2 líneas + botón | Saturación informativa en entrada |
| Header/nav | 4 iconos en tools (trazabilidad, settings, help, history), status-pill LOCAL-FIRST, icons en nav items | Solo nav textual (Auditoría, Laboratorio, Configuración), theme toggle, reset CTA | Racimo de iconos, duplicación (Settings en nav + tools) |
| Footer | Solo brand + copy | Brand + links (Trazabilidad, Ayuda, Historial) + copy | Help/history inaccesibles tras remover iconos |
| Stepper | 6 steps con cajas, bordes, backgrounds, iconos en círculos | 6 labels textuales con línea divisora, color condicional | Exceso de cajas y elementos visuales |
| Mobile nav | Íconos en cada item | Solo texto, mismo patrón que desktop | Consistencia mobile/desktop |
| File upload | Título "Cargar CSV local", subtítulo largo, checklist 4 items | "Cargar CSV", 1 línea de privacidad | Ruido textual en acción principal |

## 6. Componentes modificados

| Archivo | Tipo de cambio | Lógica tocada sí/no |
|---|---|---|
| `src/App.tsx` | JSX: header tools removidos, status-pill removido, nav items sin iconos, hero texto simplificado, footer con links, mobile nav sin iconos | No |
| `src/index.css` | CSS: deduplicación, stepper rediseño, nav-menu-item simplificado, footer-links agregado | No |
| `src/components/PipelineProgress.tsx` | JSX: steps sin iconos, labels simplificados, imports limpiados | No |
| `src/components/FileUpload.tsx` | JSX: texto simplificado, imports limpiados, constraints removidos del UI | No (uploadCopy estructura reducida pero compatible) |
| `src/__tests__/uiFlowContracts.test.ts` | Test: assertions actualizadas a nuevo texto de uploadCopy | No |
| `src/tests/e2e/aura-qa-audit.spec.ts` | Test: +5 assertions aesthetic reset | No |
| `src/tests/e2e/aura-qa-screenshots.spec.ts` | Test: +1 spec de 10 screenshots aesthetic | No |

## 7. Decisiones visuales

**Iconos eliminados:**
- Del header tools: ClipboardList (trazabilidad), Settings (duplicado del nav), HelpCircle, History — movidos a footer como texto
- Del nav-center-menu: Layers, FlaskConical, Settings — nav ahora puramente textual
- Del stepper: Upload, Search, Brain, FileCode2, ClipboardCheck, FileText, Check — eliminados todos los iconos
- Del file-upload: CheckCircle2 (×4 en checklist), FileSpreadsheet — checklist completo removido

**Información colapsada:**
- Help/History/Trazabilidad → footer links (siempre accesibles, no dominan)
- Technical evidence → `<details>` colapsados (ya existía, sin cambios)

**Cards simplificadas:**
- Stepper steps: de cajas con border + background + box-shadow → texto con color
- File upload: de checklist 4-items → 1 línea de privacidad

**Acciones priorizadas:**
- Una sola acción principal por etapa (CTA grande)
- Controles secundarios relegados a footer

**Dejado igual por riesgo funcional:**
- Profile summary (score ring, findings, affected columns) — buen balance visual
- Diagnosis compact (problem grid, model selector, privacy notice) — funcional y claro
- Script review, HITL review, export closure — sin cambios en lógica
- BenchmarkLab, SettingsPanel, AuditLogViewer — componentes internos complejos, solo limpieza CSS aplicada
- Theme toggle — mantenido en header, es el único control visual imprescindible

## 8. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm run build` | PASS | Build Vite exitoso, 0 errores |
| `npm test` | PASS | 133/133 tests Vitest pasados (16 archivos) |
| `npm run test:e2e` | PASS | 7/7 tests Playwright pasados |

Detalle assertions aesthetic reset (todas PASS):

**Desktop 1280x900:**
- Status pill hidden: PASS
- Icon tool buttons removed from header: PASS
- Footer links visible (help/history moved): PASS
- No icons inside nav menu items: PASS

**Mobile 390x844:**
- Mobile hamburger visible: PASS
- .nav-links-open hidden when closed: PASS
- No native checkbox in mobile nav: PASS
- Theme toggle as styled button: PASS

## 9. Evidencia visual

| Captura | Ruta | Qué valida |
|---|---|---|
| Home desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/01-home-desktop.png` | Header limpio, hero breve, file-upload simple |
| Profile desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/02-profile-desktop.png` | Profile summary, stepper textual |
| Diagnosis desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/03-diagnosis-desktop.png` | Diagnosis compact, model bar sin icon clutter |
| Script desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/04-script-desktop.png` | Script review con código |
| Review desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/05-review-desktop.png` | HITL review, delta |
| Export desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/06-export-desktop.png` | Claims, limitaciones, descargas |
| Lab desktop | `docs/qa/casabero-aesthetic-reset-2026-06-15/07-lab-desktop.png` | Laboratorio secundario |
| Home mobile | `docs/qa/casabero-aesthetic-reset-2026-06-15/08-home-mobile.png` | Mobile limpio, hamburger |
| Profile mobile | `docs/qa/casabero-aesthetic-reset-2026-06-15/09-profile-mobile.png` | Perfil responsive |
| Nav open mobile | `docs/qa/casabero-aesthetic-reset-2026-06-15/10-mobile-nav-open.png` | Menú móvil textual |

## 10. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|---|---|---|
| Ninguno bloqueante | — | No quedan bloqueantes visuales conocidos. |

## 11. Claims del TFM

Sin cambios. Los claims permitidos/no permitidos de loops anteriores siguen iguales. No se declara `formal_valid`. `contractCompliance` y `Diagnóstico LLM y laboratorio` se mantienen del Loop 03.

## 12. Commit sugerido

```
ux: apply casabero aesthetic reset across AURA

- Remove icon clutter from header (status-pill, tool-btn duplicates)
- Simplify nav to text-only (center menu + mobile nav)
- Redesign stepper as minimal text progress (no boxes/icons)
- Deduplicate CSS (.sec-eye, .hero) and clean stepper styles
- Move help/history/trazabilidad to footer links
- Simplify hero text and file-upload copy
- Generate 10 visual evidence screenshots
- Add E2E aesthetic assertions
```
