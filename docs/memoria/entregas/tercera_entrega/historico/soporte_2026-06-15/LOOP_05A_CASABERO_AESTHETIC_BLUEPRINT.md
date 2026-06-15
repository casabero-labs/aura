# LOOP 05A - Casabero Aesthetic Blueprint - AURA

> Fecha: 2026-06-15
> Rama: `loop-05a-casabero-aesthetic-blueprint`
> Base: `loop-04-micro-cleanup` (760ebe9)
> Objetivo: Diagnosticar ruido visual, inventariar inconsistencias estéticas y definir el estándar Casabero editorial para AURA

---

## 1. Veredicto visual actual

La interfaz actual de AURA funciona estructuralmente, pero transmite la sensación de una herramienta de dashboard técnico de segunda generación: exceso de iconos por pantalla, tarjetas anidadas con bordes simultáneos, métricascompactas que compiten entre sí por atención, y una densidad visual que contradice el objetivo editorial y warm minimalism que exige el estándar Casabero. Las pantallas de Diagnóstico, Script y Lab son las más saturadas. El Stepper y la navegación son correctos en su concepto pero demasiado densos en iconografía. Los estados técnicos están bien colapsados, pero cuando se expanden revelan paneles que también compiten visualmente. La paleta de tokens actual es funcional pero la implementación de estilos no sigue el sistema de tokens del showcase.

---

## 2. Principios Casabero aplicados

| Principio | Aplicación en AURA | Riesgo que corrige |
|-----------|-------------------|-------------------|
| Editorial antes que dashboard | Títulos en Playfair Display (sec-title con serif), jerarquía clara por etapa | Títulos que compiten con métricas, sensación de dashboard genérico |
| Aire antes que densidad | Espaciado generoso entre secciones, menos elementos por viewport | Tarjetas apiladas sin respiración, scroll largo sin pausas visuales |
| Texto antes que icon clutter | Iconos solo donde aportan significado funcional real, no decorativo | 4+ iconos simultáneos en filas de constraints, hallazgos, métricas |
| Una acción principal por etapa | CTA principal visible (btn-p), acciones secundarias en collapsed details | Múltiples botones visibles simultáneamente, decisión visual bloqueada |
| Detalles técnicos colapsados | `<details className="technical-details">` por defecto cerrado | Exposición de evidencia técnica en primer plano |
| Lab opcional | Navegación separada, estado vacío claro, no bloquea flujo | Lab como pantalla protagonista, competencia visual con flujo principal |
| Jerarquía visual clara | Eyebrow → título → cuerpo → CTA → collapsed details | Múltiples niveles mezclados sin jerarquía establecida |
| Warm minimalism | Tokens Casabero: `--bg: #FAF8F4`, `--surface: #F5F1E8`, `--ink: #1E1E1C` | Superficies grises frías, bordes duros, fondos blancos clínicos |
| No ruido académico | Sin "TFM UNIR" en nav, sin "objetivos TFM" en hint, evidencia en technical details | Contexto académico visible en primer plano durante demos |

---

## 3. Inventario de ruido visual

| Pantalla | Ruido detectado | Severidad | Acción recomendada |
|----------|-----------------|-----------|---------------------|
| **Home/Upload** | 4 iconos `CheckCircle2` en fila de constraints + icono `FileUp` + `FileSpreadsheet` + `ShieldCheck` — 7 iconos en zona de drop | Alta | Reducir constraints a texto con bullets, no iconos. Mantener solo `FileUp` como icono funcional del dropzone |
| **Stepper** | 6 iconos (Upload, Search, Brain, FileCode2, ClipboardCheck, FileText) — cada paso tiene su icono | Media | Reducir a 3 iconos máximo: upload, diagnosis, script/review. O usar solo el icono del paso activo |
| **Profile** | Score ring + 4 stats con iconos + hallazgos con iconos por fila + columnas afectadas con chips + `profile-block-index` (00, 01, 02, 03) رقمي | Alta | Reducir stats a 2-3 valores máximo. Findings como lista textual, no con icono por fila. Eliminar `profile-block-index` رقمي |
| **Diagnóstico** | 3 cards de problema con iconos + privacy notice con icono + model bar con icono + loading dot + export buttons con iconos | Alta | Cards de problema como texto con color, no cards con icono. Privacy notice minimal. Eliminar iconos de export buttons |
| **Script** | Safety bar + coverage bar + 4+ risk indicators con iconos inline + validation matrix cards | Alta | Bars son correctas (sin icono). Risk indicators como texto con color, no con icono. Validation matrix como tabla simple, no como cards |
| **Revisar** | Status strip con 4+ items + HITL checklist con iconos por item + delta grid cards + script review con line numbers | Media | Status strip compacta, sin icono por item. Checklist como lista textual. Delta grid como 2-3 valores clave |
| **Exportación** | Claims grid con muchos items + limitations list + download buttons con iconos | Media | Claims como lista jerárquica, no grid de cards. Botones con solo texto o con un icono máximo |
| **Lab** | Tabla densa con 10+ columnas + charts stacked + config bar con muchos controles + status badges | Alta | Tabla con menos columnas en vista principal, expandir en collapsed. Charts como toggle, no visibles por defecto. Config bar simplificada |
| **Configuración** | 3 tabs con iconos (Cloud, Local, Chrome AI) + múltiples inputs + status cards | Media | Tabs sin icono o con icono único. Inputs en layout simple, no en cards |
| **Navegación** | Logo + texto + theme toggle + 3 botones + estado activo — correcto pero denso | Baja | Reducir a logo + 3 botones limpios, sin iconos en botones de nav |
| **Technical details** | Múltiples `<details>` anidados, algunos con borde, tabla dentro de details | Media | Un solo `<details>` por pantalla, no anidados. Tablas con estilo simple |
| **Mobile 390px** | Steeper scroll-x + stats comprimidas + hallazgos cortos pero competitivos | Alta | Steeper minimal (números o texto), stats en 2 columnas, hallazgos como lista |
| **Desktop 1280px** | Overflow horizontal en profile hero (resuelto), pero densidad de elementos sigue alta | Media | Mayor espaciado, menos elementos simultáneos, scroll más largo con secciones claras |
| **Empty states** | `findings-empty`, `lab-empty`, `audit-log-empty` — correctos en concepto pero con iconos grandes | Baja | Empty states como texto + acción, sin icono grande decorativo |
| **Errores** | `context-guide` con icono `ArrowRight` en todos los CTAs — repetitivo | Baja | CTA con texto + flecha textual, no icono de flecha |

---

## 4. Decisiones de estética global

### Header
- **Estado actual:** Nav sticky con logo "AURA", 3 botones de navegación con iconos (Layers, FlaskConical, Settings), theme toggle. Borde inferior sutil.
- **Nuevo criterio:** Logo "AURA" en texto serif bold (Playfair Display o similar), navegación como texto con hover underline, sin iconos en botones de nav. Theme toggle minimal. Un único borde inferior de 1px `--border`. Fondo `--bg`.

### Stepper
- **Estado actual:** 6 pasos con iconos + línea divisoria + número + label. Scroll horizontal en mobile.
- **Nuevo criterio:** Solo texto + número, sin iconos por paso. Máximo 3-4 caracteres por label. Línea de progreso sutil entre pasos. Ocultar labels en mobile, solo mostrar número del paso activo.

### Cards
- **Estado actual:** `border: 1px solid var(--border)` + `border-radius` + `padding` generoso + fondo `--surface`. Múltiples cards anidadas.
- **Nuevo criterio:** Cards con `background: var(--surface)`, borde `1px solid var(--border)`, `border-radius: var(--radius-md)`, padding `var(--space-md)`. NO bordes simultáneos (no poner borde a cards dentro de cards que ya tienen borde). Máximo 1 nivel de anidación.

### Botones
- **Estado actual:** `btn-p` con icono + texto, `btn-s` con icono + texto, bordes duros.
- **Nuevo criterio:** Botón primario: outline, texto en `--ink`, sin icono o con icono funcional mínimo. Botón secundario: ghost, texto `--ink2`. Sin gradientes, sin sombras exageradas. Radio `var(--radius-sm)`. Altura fija `var(--btn-h-md)`.

### Métricas
- **Estado actual:** Grids de 4 stats con icono + valor + label por item.
- **Nuevo criterio:** Valor grande (serif o mono), label pequeño debajo. Sin icono. Agrupar en parejas como máximo. Color del valor según estado (success/warning/error).

### Tablas
- **Estado actual:** `border-collapse`, bordes de celda, filas con hover.
- **Nuevo criterio:** Sin bordes de celda, solo borde inferior de fila. Header con `--ink2` small caps. Filas con hover `--surface-hover`. Sin bordes de tabla externos.

### Technical details
- **Estado actual:** `<details className="technical-details">` con chevron + hint visible. Cuerpo con múltiples secciones, algunas con borde propio.
- **Nuevo criterio:** Un solo `<details>` por pantalla. Hint como texto pequeño. Cuerpo sin bordes adicionales, solo separación de secciones con `--space-lg`. Sin secciones anidadas dentro de details.

### Estados vacíos
- **Estado actual:** Icono grande decorativo + título + descripción + acción.
- **Nuevo criterio:** Título serif + descripción breve + acción como link-texto. Sin icono decorativo. Máximo 3 líneas.

### Warnings/notices
- **Estado actual:** `provider-unavailable-notice`, `review-delta-zero-warning`, `lab-unavailable-notice` — todos con icono + borde lateral + lista de razones.
- **Nuevo criterio:** Estilo alert:left-border (3px `--ink` o `--orange`), padding `var(--space-md)`, texto sin icono o con icono funcional mínimo. Sin lista de bullets, usar texto running.

### Lab
- **Estado actual:** Pantalla completa con tabla densa, charts, config bar, run button — protagonista.
- **Nuevo criterio:** Pantalla secundaria. Tabla con columnas prioritarias, resto en collapsed. Charts como toggle explícito. Config bar compacta. Run button prominente pero único.

### Responsive
- **Estado actual:** `@media (max-width: 768px)` con overflow-x control, `@media (max-width: 390px)` adicional.
- **Nuevo criterio:** Mobile-first con espaciado reducido proporcionalmente. Sin scroll horizontal implícito. Elementos en columna única. Steeper minimal.

---

## 5. Sistema visual propuesto

| Elemento | Estado actual | Nuevo criterio Casabero |
|----------|--------------|------------------------|
| **Header** | Nav con logo + 3 botones iconizados + theme toggle | Logo serif "AURA" + nav como texto + theme toggle minimal. Sin iconos en nav. |
| **Hero** | `hero` con headline serif + tagline + CTA | Headline editorial serif + tagline sans + CTA outline único. Sin icono de hero. |
| **Stepper** | 6 pasos con iconos, número, label, línea | Solo número + texto breve, sin icono, línea sutil entre pasos |
| **Section headers** | `sec-eye` (uppercase small) + `sec-title` (serif) | Mantener `sec-eye` + `sec-title` pero con más espacio vertical. Eyebrow en `--ink3`, título en `--ink` |
| **Primary CTA** | `btn-p` con icono + texto | `btn-p` outline, texto + flecha mínima o sin icono, un único CTA por pantalla |
| **Secondary CTA** | `btn-s` con icono + texto | `btn-s` ghost, solo texto o texto + flecha |
| **Cards** | Borde + fondo surface + padding + título + cuerpo | Borde sutil 1px + fondo surface + padding generoso. Sin borde en cards internas |
| **Metric cards** | Grid de stats con icono + valor + label | Valor grande serif/mono + label small sans. Sin icono. 2-3 stats máximo |
| **Pills/badges** | `badge` con background surface + texto | Chip minimal: texto + borde sutil, sin background sólido |
| **Tables** | `border-collapse` + bordes de celda + hover | Líneas solo entre filas, header small caps, hover con surface-hover |
| **Alerts** | Borde lateral 3-4px + icono + lista | Borde lateral 3px + texto running, sin icono o icono funcional único |
| **Technical details** | `<details>` con chevron + hint + cuerpo denso | Un único `<details>` por pantalla, hint small, cuerpo sin bordes internos |
| **Lab panels** | Cards densas + charts visibles + tabla completa | Cards simples, charts en collapsed, tabla con columnas colapsables |
| **Settings panel** | Tabs con icono + inputs en cards | Tabs sin icono, inputs en layout simple vertical |
| **Mobile nav** | Hamburger + menú overlay | Menú como drawer lateral, sin hamburger si hay 3 items visibles |
| **Empty states** | Icono grande + título + descripción + acción | Título serif + descripción 2-3 líneas + acción como link. Sin icono decorativo |
| **Loading states** | Spinner animado + texto | Dot pulsante pequeño + texto. Sin spinner circular |
| **Error states** | `context-guide` con icono rojo/amarillo + acción | Alert con borde lateral + texto + acción. Sin icono grande |

---

## 6. Lista de cambios permitidos para implementación

### 6.1 Cambios globales CSS

- Adoptar tokens Casabero del showcase: `--bg: #FAF8F4`, `--surface: #F5F1E8`, `--ink: #1E1E1C`, `--ink2: #4A4540`, `--ink3: #9A9490`, `--border: rgba(30,30,28,0.1)`, `--border-strong: rgba(30,30,28,0.18)`
- Agregar `--font-serif: "Playfair Display", Georgia, serif` y `--font-sans: "Inter", sans-serif`
- Redefinir `.btn-p`: outline only, sin icono obligatorio, `--btn-primary-border` como único borde
- Redefinir `.card`: un único borde exterior, sin borde en elementos internos
- Consolidar `@media (max-width: 768px)` y `@media (max-width: 390px)` en un solo bloque responsive
- Agregar `.section` con `margin-bottom: var(--space-xl)` para espaciado vertical generoso
- Redefinir `.technical-details` para que sea un único bloque sin anidación de sections internas con borde
- Agregar `.alert` con estilo left-border (3px) sin icono decorativo
- Limpiar `.nav-center-menu`: botones de nav como texto, sin icono, hover con underline

### 6.2 Cambios por componente

- **FileUpload.tsx**: Eliminar `CheckCircle2` icons de constraints. Constraints como texto con bullets. Mantener solo `FileUp` en dropzone. Eliminar `ShieldCheck` del status.
- **PipelineProgress.tsx**: Eliminar iconos de los 6 pasos. Solo número + texto breve. Línea divisoria sutil.
- **ProfileStep.tsx**: Reducir stats a 2-3 valores. Findings como lista textual sin icono por fila. Eliminar `profile-block-index` (00, 01...). Agregar más espacio vertical entre secciones.
- **DiagnosisStep.tsx**: Cards de problema como texto con color, no cards con icono. Privacy notice minimal (solo texto). Eliminar iconos de export buttons. Loading como dot pulsante + texto.
- **ScriptGenerationStep.tsx**: Safety/coverage bars correctas — mantener. Risk indicators como texto con color, sin icono. Validation matrix como tabla simple, no como cards con icono.
- **ReviewStep.tsx**: Status strip compacta, sin icono por item. Checklist HITL como lista textual. Delta grid con 2-3 valores clave.
- **BenchmarkLab.tsx**: Tabla con columnas colapsables (mostrar 4-5, resto en expanded). Charts como toggle explícito "Mostrar gráficos". Config bar compacta.
- **SettingsPanel.tsx**: Tabs sin icono. Inputs en layout vertical simple.
- **App.tsx**: Nav buttons como texto, sin icono. Theme toggle minimal.

### 6.3 Cambios de copy visual

- Reducir `file-drop-checks` de 4 items con icono a 2-3 bullets textuales
- Eliminar `eyebrow` tipo badge para secciones — usar texto running
- `sec-eye` como label small en `--ink3`, no como badge con background
- Claims y limitaciones en Export como lista running, no como grid de cards
- Empty states: título serif + 1-2 líneas + acción. Sin icono decorativo

### 6.4 Cambios responsive

- `@media (max-width: 390px)`: Steeper solo números, stats en 2 columnas, findings como lista compacta
- `@media (max-width: 768px)`: Eliminar scroll horizontal residual, cards en columna única
- Mobile nav: drawer lateral con 3 items limpios, sin hamburger si el espacio lo permite

---

## 7. Cambios prohibidos

- **No tocar lógica**: No modificar `auditEngine`, scoring, `benchmarkService`, `evaluationService`, `scriptValidationService`
- **No tocar auditEngine**: El motor determinista no se modifica
- **No tocar scoring**: Los scores, weights, y fórmulas no se alteran
- **No cambiar benchmark**: La lógica de benchmark runs, `evidenceStatus`, composite score permanece intacta
- **No inventar resultados**: No agregar datos, métricas o estados que no existan
- **No alterar evidenceStatus**: Los estados `attempted_failed`, `preliminary_valid`, `formal_valid` se mantienen según su lógica
- **No cambiar flujo principal**: El flujo upload → perfil → diagnóstico → script → revisión → exportación permanece igual
- **No esconder información crítica**: Toda la información existe; solo se colapsa, jerarquiza o simplifica visualmente. No se elimina contenido funcional.
- **No modificar tests**: Los tests unitarios y E2E no se alteran en este loop
- **No alterar tipos ni contratos**: Types, interfaces y contratos de datos no cambian

---

## 8. Criterios de aceptación visual

| Criterio | Cómo se valida |
|----------|---------------|
| Desktop sin saturación | A 1280px, cada pantalla tiene máximo 3-4 elementos visuales primarios visibles |
| Mobile sin overflow | A 390px, scroll vertical, cero scroll horizontal residual |
| Una acción principal por etapa | Cada pantalla tiene un único `btn-p` visible como CTA principal |
| No icon clutter | Máxima densidad de iconos: 1 por pantalla en zona de contenido (dropzone, hero o CTA) |
| No navegación duplicada | Nav consistente: texto o icono, no ambos |
| No lenguaje académico visible | Sin "TFM", "objetivos", "OE" en UI principal — solo en technical details collapsed |
| Technical details colapsados | Todos los `<details>` cerrados por defecto; máximo 1 por pantalla |
| Lab claramente secundario | Lab accesible por nav pero no protagonista; estado vacío visible y sobrio |
| Estados vacíos sobrios | Empty state: título serif + 2 líneas + acción. Sin icono decorativo |
| Warm minimalism | Fondo `--bg: #FAF8F4`, texto `--ink: #1E1E1C`, superficie `--surface: #F5F1E8` — sin fondos blancos puros ni grises fríos |
| Editorial typography | Títulos en serif, UI en sans. Jerarquía clara eyebrow → título → body |
| Capturas antes/después | Generar screenshots de cada pantalla antes y después de la implementación |

---

## 9. Recomendación de implementación

**GO para implementar Loop 05B.**

Se recomienda un loop de implementación estética en 3 fases:

**Loop 05B-1 — Global CSS y tokens (archivos críticos)**
- `src/index.css`: adoptar tokens Casabero, redefinir `.btn-p`, `.card`, `.section`, `.technical-details`, `.alert`
- `src/App.tsx`: limpiar navegación (texto sin icono)
- `src/components/PipelineProgress.tsx`: stepper minimal

**Loop 05B-2 — Pantallas principales (impacto UX mayor)**
- `FileUpload.tsx`: reducir iconos de constraints
- `ProfileStep.tsx`: reducir stats, eliminar iconos por finding
- `DiagnosisStep.tsx`: cards de problema como texto, eliminar iconos de export
- `ScriptGenerationStep.tsx`: risk indicators sin icono

**Loop 05B-3 — Pantallas secundarias y refinamiento**
- `ReviewStep.tsx`: status strip compacta
- `BenchmarkLab.tsx`: tabla con columnas colapsables
- `SettingsPanel.tsx`: tabs sin icono
- Validación responsive 390px y 320px
- Screenshots antes/después de cada pantalla

**Archivos a tocar en Loop 05B:**
1. `src/index.css` (tokens globales + botones + cards + alerts)
2. `src/App.tsx` (nav limpia)
3. `src/components/PipelineProgress.tsx` (stepper minimal)
4. `src/components/FileUpload.tsx` (menos iconos)
5. `src/components/ProfileStep.tsx` (stats + findings simplificados)
6. `src/components/DiagnosisStep.tsx` (cards → texto, export sin icono)
7. `src/components/ScriptGenerationStep.tsx` (risk indicators sin icono)
8. `src/components/ReviewStep.tsx` (status strip compacta)
9. `src/components/BenchmarkLab.tsx` (tabla colapsable)
10. `src/components/SettingsPanel.tsx` (tabs sin icono)

**No tocar en Loop 05B:**
- `src/services/*` (lógica completa)
- `src/types.ts` (contratos de datos)
- `src/__tests__/*` (tests)
- `src/components/ExperimentDesigner.tsx` (componente interno de dev)
- `src/components/PipelineDevelopmentMatrix.tsx` (componente interno de dev)
