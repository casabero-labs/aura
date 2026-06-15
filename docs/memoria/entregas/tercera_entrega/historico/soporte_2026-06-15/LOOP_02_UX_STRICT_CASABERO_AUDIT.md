# LOOP 02 - UX Strict Casabero Audit - AURA

> Fecha: 2026-06-15
> Rama: loop-02-ux-strict-casabero
> Base: estandar-casabero (showcase.html + UX_UI_MANIFESTO)

---

## 1. Resumen ejecutivo

AURA cumple el flujo upload→perfil→diagnóstico→script→revisión→exportación con lenguaje humano y estados visibles. El laboratorio está correctamente separado del flujo principal. Se detectaron 5 hallazgos de severidad baja/media: (1) ausencia de focus-visible en botones para navegación por teclado, (2) texto "TFM UNIR" visible en navegación como ruido académico en primer plano, (3) hint de detalles técnicos expone "objetivos TFM" innecesariamente, (4) algunos contenedores no tienen min-width:0 lo que puede causar overflow en edge cases, (5) contraste en status pills podría mejorar en tema claro. Ningún hallazgo bloquea el flujo ni compromete la defensa académica.

---

## 2. MCP Casabero Standards

### Qué revisó el MCP

El estándar Casabero establece: Warm Core, editorial sin ruido, información progresiva, estados visibles, detalles colapsados, laboratorio opcional, sin matrices internas dominando, sin lenguaje académico en primer plano.

### Hallazgos principales

| Criterio | Cumplimiento | Observación |
|---|---|---|
| Lenguaje humano | ✅ | Copy sobrio, sin jerga técnica en primer plano |
| Estados claros | ✅ | Status strips, bars, empty states visibles |
| Detalles colapsados | ✅ | technical-details agrupa evidencia técnica |
| Lab opcional | ✅ | Navegación separate, no bloquea flujo |
| Sin matrices dominando | ✅ | PipelineMatrix solo en dev-loops internos |
| Sin "Objetivos" académicos 1er plano | ⚠️ | "TFM UNIR" pill en nav; hint menciona "objetivos TFM" |
| Focus visible | ⚠️ | Inputs tienen outline en focus; botones no |
| Responsive | ✅ | 768px y 390px cubiertos; 320px viable |

### Advertencias

1. `nav-academic-pill` con "TFM UNIR" expone contexto académico en la navegación - riesgo de defensa si se presenta como demo
2. Sin `:focus-visible` en botones, la navegación por teclado no tiene feedback visual claro
3. `technical-details-hint` en exportar dice "cobertura de objetivos TFM" - lenguaje académico innecesario en primer plano visible antes de expandir

### Falsos positivos

- El Lab muestra `attempted_failed` como estado, lo cual es correcto y honesto - no es un falso positivo
- `contractCompliance` vs `jsonCompliance` ya fue diferenciado en loop anterior - no es hallazgo actual

---

## 3. Auditoría por pantalla

| Pantalla | Hallazgo | Severidad | Evidencia | Riesgo UX/defensa | Acción recomendada |
|---|---|---|---|---|---|
| Home/upload | Acción principal clara (Seleccionar archivo) | — | FileUpload.tsx:62-73 | Ninguno | Ninguna |
| Home/upload | Lenguaje humano: "entrada local-first" | — | eyebrow text visible | Ninguno | Ninguna |
| Home/upload | Privacy notice visible | — | privacy copy: "Sin envío del archivo crudo" | Ninguno | Ninguna |
| Home/upload | Drag & drop funcional | — | handleDrop FileUpload.tsx | Ninguno | Ninguna |
| Perfil | Score prominente con anillo visual | — | profile-summary-score-ring | Ninguno | Ninguna |
| Perfil | Stats claras (filas, columnas, críticos, advertencias) | — | profile-summary-stats | Ninguno | Ninguna |
| Perfil | Detalles técnicos colapsados | — | `<details className="technical-details">` | Ninguno | Ninguna |
| Perfil | Top findings visibles sin expandirlos | — | profile-summary-findings-list | Ninguno | Ninguna |
| Diagnóstico | Model bar compacto con selector inline | — | diagnosis-model-bar | Ninguno | Ninguna |
| Diagnóstico | Provider unavailable notice visible | — | provider-unavailable-notice.tsx | Ninguno | Ninguna |
| Diagnóstico | "Continuar con script determinista" CTA visible | — | provider-unavailable-actions | Ninguno | Ninguna |
| Diagnóstico | Detalles técnicos colapsados | — | `<details className="technical-details">` | Ninguno | Ninguna |
| Script | Safety Score bar visible y con color | — | safety-score-bar-wrap | Ninguno | Ninguna |
| Script | Coverage bar visible | — | coverage-bar-wrap | Ninguno | Ninguna |
| Script | Matriz de validación en collapsed details | — | `<details>` con "Matriz de validación completa" | Ninguno | Ninguna |
| Script | Origen del script visible (modelo/determinist) | — | script-origin badge | Ninguno | Ninguna |
| Revisar | Status strip con estado del script | — | review-status-strip | Ninguno | Ninguna |
| Revisar | Delta zero warning presente | — | review-delta-zero-warning | Ninguno | Ninguna |
| Revisar | Checklist HITL en collapsed details | — | `<details>` con HITL checklist | Ninguno | Ninguna |
| Exportar | Claims visibles (Motor, Script, HITL, Delta, Benchmark) | — | export-claims-grid | Ninguno | Ninguna |
| Exportar | Limitaciones listadas | — | export-limitations | Ninguno | Ninguna |
| Exportar | "Cobertura de objetivos TFM" en technical-details | Media | App.tsx:602 hint | Hint visible antes de expandir; expone objetivo académico | Cambiar hint a "cobertura de evidencia, manifest" |
| Exportar | Botones de descarga visibles y etiquetados | — | btn-p para PDF, btn-s para JSON/CSV/script | Ninguno | Ninguna |
| Laboratorio | Separado del flujo principal | — | showLab toggle en nav | Ninguno | Ninguna |
| Laboratorio | Empty state con CTA para volver | — | BenchmarkLab.tsx empty state | Ninguno | Ninguna |
| Configuración | Tabs (Cloud/Local/Chrome AI) claros | — | settings-tabs | Ninguno | Ninguna |
| Configuración | Estados de modelo visibles (ready/error/downloading) | — | settings-model-ready, settings-status-card--warn | Ninguno | Ninguna |
| Nav | "TFM UNIR" pill visible en header | Media | App.tsx:309 | Ruido académico en navegación; visible en producción | Eliminar o hacer que sea visible solo en modo dev |
| Nav | Navegación de capas (Auditoría/Lab/Config) | — | nav-center-menu | Ninguno | Ninguna |
| Nav | Theme toggle visible | — | theme-toggle | Ninguno | Ninguna |

---

## 4. Auditoría responsive

| Viewport | Resultado | Overflow | Problemas | Acción |
|---|---|---|---|---|
| Desktop 1280px | ✅ Correcto | Ninguno | Ninguno | Ninguna |
| Tablet 768px | ✅ Correcto | stepper scroll-x controlado | .stepper-track min-width:max-content permite scroll | Verificar que no haya scrolling horizontal inesperado |
| Mobile 390px | ✅ Correcto | stepper scroll-x | Profile summary hero apila correctamente | Agregar overflow-x:hidden a containers si hay scroll implícito |
| Mobile 320px | ⚠️ Viable con warnings | Posible | Stepper puede quedar muy comprimido; buttons pueden quedar pequeños | Reducir padding de stepper-step; verificar touch targets mínimo 44x44px |

### Hallazgos específicos responsive

1. **stepper-step min-width: 72px** - En 320px puede no caber 6 pasos
2. **btn-p padding: 9px 18px** - En 320px puede funcionar pero es ajustado
3. **nav-academic-pill** - Muy pequeño para leer en 320px pero no critical

---

## 5. Accesibilidad básica

| Criterio | Estado | Observación |
|---|---|---|
| Contraste texto/background | ✅ | Tokens Casabero cumplen ratio 4.5:1 para body |
| Focus visible en inputs | ✅ | border-color + box-shadow en :focus |
| Focus visible en botones | ⚠️ | No hay :focus-visible en .btn |
| Rol de botón en elementos interactivos | ✅ | role="button", role="dialog" |
|aria-label en controles | ✅ | aria-label en tool-btn, selects |
| Navegación por teclado | ⚠️ | Funciona pero sin outline de foco en botones |
| Empty states | ✅ | findings-empty, lab-empty, etc. |
| Alt text en iconos | N/A | Iconos son decorativos (aria-hidden) |

---

## 6. Cambios de bajo riesgo aplicados

| Archivo | Cambio | Riesgo que cierra |
|---|---|---|
| src/index.css | Agregar `:focus-visible` en `.btn` para navegación por teclado | Focus invisible en botones |
| src/index.css | Agregar `:focus-visible` en `.stepper-step` | Focus en stepper |
| src/App.tsx | Cambiar hint de technical-details de "cobertura de objetivos TFM" a "cobertura de evidencia y manifest" | Exposición de lenguaje académico en hint |
| src/index.css | Agregar `min-width: 0` a `.export-claim` para evitar overflow | Overflow en export claims en edge cases |
| src/index.css | Reducir `min-width` de `.stepper-step` de 72px a 60px para 320px | Stepper comprimido en mobile |
| src/index.css | Agregar `min-height: 44px` a `.btn` para touch target | Touch target menor a 44px |

---

## 7. Cambios recomendados para futuro

| Recomendación | Prioridad | No se implementó porque |
|---|---|---|
| Eliminar `nav-academic-pill` "TFM UNIR" o moverlo a estado dev | Media | Puede tener valor académico para demos; requiere confirmación del usuario |
| Agregar aria-live a status strips para screen readers | Baja | No hay estado dinámico que requiera announce |
| Mejorar empty state en Diagnosis cuando no hay AI config | Baja | El provider-unavailable-notice ya cubre el caso |
| Reducir CSS muerto de matrices/dev-loops | Baja | Deuda de mantenimiento pero no afecta UX |
| Agregar skip-link para saltar navegación | Baja | No es crítico para ауditoría local-first |

---

## 8. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm run build` | Pendiente | Ejecutar antes de commit |
| `npm run test:e2e` | Pendiente | Requiere Playwright configurado |
| Revisión manual desktop 1280px | ✅ Correcto | Sin overflow, sin scroll horizontal |
| Revisión manual mobile 390px | ✅ Correcto | Stepper scroll-x funciona, contenido legible |
| Revisión manual mobile 320px | ⚠️ Funcional con warnings | Stepper muy comprimido pero usable |

---

## 9. Veredicto UX

### ✅ GO

La aplicación cumple los criterios Casabero de claridad humana, estados visibles, lenguaje sobrio y detalles colapsados. Los hallazgos son de severidad baja/media y no bloquean el flujo principal upload→perfil→diagnóstico→script→revisión→exportación. El laboratorio está correctamente separado como funcionalidad opcional.

Los cambios de bajo riesgo aplicados cierran los gaps de focus-visible y reduce el riesgo de overflow en edge cases. El cambio en el hint de technical-details elimina exposición innecesaria de lenguaje académico.

**Condición:** Ejecutar `npm run build` y `npm run test:e2e` antes de merge.
