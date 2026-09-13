# AURA — Casabero Editorial completo Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Convertir toda la experiencia web y los artefactos visuales de AURA a Casabero Editorial 1.2 sin alterar contratos de datos, decisiones humanas, evidencias, ejecución ni resultados del pipeline.

**Architecture:** Aplicar un tema Editorial global y explícito, con tokens normativos separados de los estilos heredados; migrar por superficies funcionales con TDD; cerrar con recorridos humanos completos, accesibilidad WCAG 2.2 AA, responsive real y limpieza de los rastros Ink/Warm.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, Vitest, Testing Library, Playwright, `@axe-core/playwright`, jsPDF, jspdf-autotable, SVG y Graphify.

---

## 1. Decisión de diseño

Casabero Editorial será el único tema visual activo de AURA. La implementación parte del tema claro normativo: canvas blanco, serif dominante para lectura y títulos, sans funcional para navegación, formularios y tablas, y mono solo para hashes, código e identificadores técnicos.

El modo oscuro actual no se conservará dentro de esta migración porque los tokens presentes son Ink y el estándar no define una paleta oscura Editorial canónica. Mantener el toggle con una inversión automática produciría una falsa conformidad. Si en el futuro se requiere modo oscuro, debe abrirse un trabajo independiente con tokens aprobados y una validación completa de contraste.

No se copiará `examples/frontend/showcase.html`: ese catálogo es Warm. La referencia normativa es `standards/design/themes/EDITORIAL.md`; `examples/frontend/showcase-editorial.html` sirve solo como ejemplo visual. Cuando existan diferencias, gobierna el documento normativo.

## 2. Autoridad fijada para la ejecución

Orden de precedencia:

1. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/themes/EDITORIAL.md`
2. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/CORE.md`
3. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/media/WEB.md`
4. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/components/RECORD_DETAIL.md`
5. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/components/TABLE.md`
6. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/frontend/ACCESSIBILITY.md`
7. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/frontend/HUMAN_FIRST_UX.md`
8. `/Users/casabero/Documents/GitHub/estandar-casabero/examples/frontend/showcase-editorial.html`

Snapshot consultado para este plan: `estandar-casabero origin/main` en `1ac2d4d`. El checkout local del estándar está en `869e38e` y no se modificó. Antes de ejecutar, hacer `git fetch origin`, comprobar el nuevo SHA y revisar cambios en los ocho archivos anteriores. Si cambió una regla normativa, actualizar primero este plan.

## 3. Línea base verificada

- AURA: `main` y `origin/main` en `e4d7ed2`.
- Pruebas: 146 archivos pasan; 2022 pruebas pasan; 6 omitidas.
- `npm run typecheck`: pasa.
- `npm run build`: pasa, con advertencias no bloqueantes de chunking ya existentes.
- `DESIGN.md` todavía declara Warm / Terminal + Archive.
- `src/index.css` todavía declara “Ink interface system”; `--font-serif` apunta a Inter y existe una variante dark Ink.
- `src/index.html` carga simultáneamente Inter, JetBrains Mono, Playfair Display, Source Serif 4 y Source Sans 3.
- El piloto Editorial solo aparece en `ProfileStep.tsx`, `DiagnosticReportStep.tsx` y la sección de exportación de `App.tsx` mediante `.editorial-pilot`.
- PDF, SVG y reportes experimentales conservan paletas y tipografías Ink/Warm o genéricas.
- Deben preservarse sin tocar: `.DS_Store` y los tres archivos duplicados terminados en ` 2.ts` ya presentes en el árbol de trabajo.

## 4. Alcance funcional completo

| Superficie | Estado actual | Cierre requerido |
| --- | --- | --- |
| Shell, marca, Home, navegación, footer | Ink; toggle dark; CTA aislado | Editorial global, navegación estable, una acción primaria, móvil recompuesto |
| Carga y orientación del pipeline | Ink | Secciones numeradas, entrada clara, estados y recuperación Editorial |
| Perfil | Piloto Editorial | Quitar scope temporal y absorberlo en el tema global |
| Diagnóstico asistido | Ink / estilos mixtos | Lectura Editorial, proveedor/contrato como metadata, progreso verificable |
| Informe diagnóstico | Piloto Editorial | Quitar scope temporal, normalizar tablas/callouts/acciones |
| Plan, script y revisión HITL | Alta densidad Ink | Editorial Mobile Workbench, decisión antes del detalle técnico |
| Ejecución, reingreso y reauditoría | Ink / inline colors | Secuencia operativa legible, estados no cromáticos, comparación verificable |
| Exportación y cierre | Piloto Editorial | Tema global, jerarquía de descarga, riesgo PII y destrucción claramente separados |
| Configuración y Ollama | Cards y scroll interno | Workbench vertical móvil, formularios y progreso accesibles |
| Ayuda, historial, audit log, errores | Patrones distintos | Diálogo/drawer común, foco, headings y recuperación consistentes |
| Laboratorio experimental | Tema técnico propio | Editorial de densidad compacta, tablas semánticas y gráficos con alternativa textual |
| PDF, SVG, informes experimentales | Paletas/fuentes antiguas | Continuidad Editorial entre Web, PDF, impresión y paquete de evidencia |

## 5. Invariantes y no-objetivos

- No cambiar `PipelineState`, contratos V2, schemas, hashes, receipts, score, reglas, resultados, persistencia ni formato de los archivos exportados salvo propiedades puramente visuales del PDF/SVG.
- No introducir TanStack Query, Zustand, router ni un refactor general de estado como parte del tema.
- No reescribir `MainPipeline` por estética; separar presentación solo cuando una prueba demuestre que el cambio preserva comportamiento.
- No sustituir tablas por cards si se pierden relaciones entre filas y columnas.
- No ocultar detalle técnico: usar progressive disclosure, medida de lectura y scroll local.
- No llamar “completo” a un cierre basado únicamente en DOM, screenshots, unit tests o build.
- Mantener `AuraMark`: tres elipses, `currentColor`, `strokeWidth="1.55"`, sin glifo interno.
- Trabajar en `main`; no crear rama sin autorización. Cada commit debe incluir solo la fase verde y nunca los archivos ajenos preexistentes.

## 6. Arquitectura CSS objetivo

Se conserva `src/index.css` durante la migración para evitar una reescritura simultánea de 16.400 líneas. Las nuevas capas se importan después y reciben la responsabilidad normativa:

```text
src/index.css                         estilos heredados, reducidos fase a fase
src/styles/editorial-tokens.css       valores normativos y alias semánticos AURA
src/styles/editorial-foundation.css   reset, roles tipográficos, shell, foco, motion, print
src/styles/editorial-components.css   botones, forms, tablas, callouts, dialogs, progress
src/styles/editorial-surfaces.css     composición de Home, pipeline, workbench, lab y soporte
```

El scope estable será `[data-casabero-theme="editorial"]`. No se redefinirán tokens globales Warm para que “signifiquen” Editorial y no se usará `:has(.editorial-pilot)` para cambiar el canvas.

## 7. Estrategia de ejecución

Orden obligatorio: contrato → foundation → shell/primitivas → pipeline → workbenches → superficies secundarias → artefactos → QA integral → limpieza. No paralelizar escrituras sobre `App.tsx`, `MainPipeline.tsx` o `index.css`. Una verificación independiente puede ejecutarse en paralelo después de terminar una fase, pero no debe editar los mismos archivos.

Cada tarea sigue Red → Green → Refactor → verificación focalizada → commit. Ejecutar la suite completa al final de cada ola, no después de cada regla CSS.

---

### Task 1: Fijar el contrato Editorial de AURA

**Files:**
- Create: `src/__tests__/editorialThemeContract.test.tsx`
- Modify: `DESIGN.md`
- Modify: `src/index.html`
- Modify: `src/App.tsx`
- Test: `src/__tests__/App.brand.test.tsx`

**Step 1: Write failing test**

Crear una prueba que lea los artefactos de diseño y monte `App`:

```tsx
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from '../App';

it('declares Editorial 1.2 as the single AURA theme', () => {
  const design = readFileSync(join(process.cwd(), '..', 'DESIGN.md'), 'utf8');
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  render(<App />);

  expect(design).toContain('theme: "Casabero Editorial"');
  expect(design).toContain('standard_version: "1.2.0"');
  expect(document.querySelector('.aura-system')?.getAttribute('data-casabero-theme')).toBe('editorial');
  expect(html).toContain('family=Source+Serif+4');
  expect(html).toContain('family=Source+Sans+3');
  expect(html).not.toMatch(/Playfair|JetBrains|family=Inter/);
});
```

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/editorialThemeContract.test.tsx`

Expected: FAIL porque `DESIGN.md` declara Warm, el root no tiene el scope Editorial y `index.html` carga familias antiguas.

**Step 3: Implement the contract**

- Reescribir `DESIGN.md` para Editorial 1.2 y registrar el SHA exacto del estándar consultado.
- Declarar preset web `Source Serif 4 + Source Sans 3 + system mono`.
- Mantener en el documento los roles Lectura, Estructura, Operación, Datos y Metadatos.
- Eliminar del HTML Playfair, Inter y JetBrains Mono; conservar solo las dos familias del preset con fallbacks.
- Añadir `data-casabero-theme="editorial"` al root `.aura-system`.
- Mantener intacta la prueba de las tres elipses.

**Step 4: Verify success**

Command: `cd src && npm test -- --run __tests__/editorialThemeContract.test.tsx __tests__/App.brand.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add DESIGN.md src/index.html src/App.tsx src/__tests__/editorialThemeContract.test.tsx src/__tests__/App.brand.test.tsx
git commit -m "docs(ui): define Aura Editorial theme contract"
```

---

### Task 2: Crear tokens y foundation global

**Files:**
- Create: `src/styles/editorial-tokens.css`
- Create: `src/styles/editorial-foundation.css`
- Create: `src/styles/editorial-components.css`
- Create: `src/styles/editorial-surfaces.css`
- Modify: `src/index.tsx`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Test: `src/__tests__/editorialThemeContract.test.tsx`

**Step 1: Extend the failing contract test**

```tsx
const tokens = readFileSync(join(process.cwd(), 'styles/editorial-tokens.css'), 'utf8');
expect(tokens).toContain('--editorial-canvas: #FFFFFF');
expect(tokens).toContain('--editorial-ink: #191919');
expect(tokens).toContain('--editorial-line: #D9D9D4');
expect(tokens).toContain('--font-reading: "Source Serif 4"');
expect(tokens).toContain('--font-operation: "Source Sans 3"');
expect(tokens).not.toContain('[data-theme="dark"]');
```

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/editorialThemeContract.test.tsx`

Expected: FAIL porque las cuatro capas no existen.

**Step 3: Add normative tokens**

El bloque base debe empezar así; los alias de compatibilidad se resuelven dentro del scope:

```css
[data-casabero-theme="editorial"] {
  --editorial-canvas: #FFFFFF;
  --editorial-ink: #191919;
  --editorial-ink-secondary: #4D4D4A;
  --editorial-ink-muted: #6B6B67;
  --editorial-line: #D9D9D4;
  --editorial-line-strong: #A7A7A0;
  --editorial-surface: #F7F7F4;
  --editorial-surface-quiet: #FBFBF9;
  --font-reading: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-operation: "Source Sans 3", Arial, Helvetica, sans-serif;
  --font-data: SFMono-Regular, Consolas, "Liberation Mono", monospace;

  --bg: var(--editorial-canvas);
  --surface: var(--editorial-canvas);
  --surface-raised: var(--editorial-surface);
  --surface-hover: var(--editorial-surface-quiet);
  --ink: var(--editorial-ink);
  --ink2: var(--editorial-ink-secondary);
  --ink3: var(--editorial-ink-muted);
  --border: var(--editorial-line);
  --border-strong: var(--editorial-line-strong);
  --font-serif: var(--font-reading);
  --font-sans: var(--font-operation);
  --font-mono: var(--font-data);
}
```

**Step 4: Add foundation behavior**

- Body, narrativa, headings y conclusiones usan serif.
- Navegación, controles, captions, tablas y ayudas usan sans.
- Código, hashes e IDs usan mono.
- Shell máximo 1280 px; medida narrativa 58–72 ch.
- Breakpoints por comportamiento: `640px`, `960px`, `1280px`.
- Foco global `2px solid var(--editorial-ink)` con offset `2px`.
- `prefers-reduced-motion` elimina movimiento no esencial sin quitar foco.
- Añadir estilos de impresión base.

**Step 5: Remove automatic dark behavior**

- Eliminar estado `theme`, escritura en `localStorage`, `data-theme` y toggle de `App.tsx`.
- No borrar otras preferencias o datos de sesión.
- Actualizar pruebas que hoy recorren escenarios dark para que comprueben Editorial con fuente remota disponible y bloqueada.

**Step 6: Import the layers**

```tsx
import './index.css';
import './styles/editorial-tokens.css';
import './styles/editorial-foundation.css';
import './styles/editorial-components.css';
import './styles/editorial-surfaces.css';
```

**Step 7: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/editorialThemeContract.test.tsx __tests__/App.brand.test.tsx
npm run typecheck
npm run build
```

Expected: PASS; el app queda legible aunque fallen las fuentes remotas.

---

### Task 3: Migrar shell, Home, navegación y footer

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles/editorial-foundation.css`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/App.navigation.test.tsx`
- Modify: `src/tests/e2e/aura-qa-screenshots.spec.ts`
- Create: `src/tests/e2e/aura-editorial-shell.spec.ts`

**Step 1: Write failing shell E2E**

```ts
for (const width of [320, 390, 1280]) {
  test(`Editorial shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.aura-system')).toHaveAttribute('data-casabero-theme', 'editorial');
    await expect(page.getByRole('button', { name: 'Cambiar tema' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'AURA' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
```

**Step 2: Verify failure**

Command: `cd src && npx playwright test tests/e2e/aura-editorial-shell.spec.ts --project=chromium`

Expected: FAIL por el toggle y el layout móvil heredado.

**Step 3: Implement shell composition**

- Añadir skip link como primer control: `Saltar al contenido principal` → `#main-content`.
- Convertir `main` en el único `#main-content` y permitir foco programático.
- Desktop: nav de 52 px, marca estable, ubicación actual por filete/tinta, controles secundarios subordinados.
- Móvil: marca en primera línea y destinos en segunda línea con scroll horizontal local si no caben; no hamburguesa si la fila completa puede mantenerse visible. Si se conserva disclosure, debe mantener Escape, retorno de foco y todos los destinos.
- Home: un solo H1, serif 44–64 px, lectura breve 17–19 px, una acción primaria; estado de reanudación como metadata, no card promocional.
- Footer: ayuda en posición estable y firma Casabero discreta una sola vez.
- Conservar el `AuraMark` exacto sin repetirlo como decoración.

**Step 4: Update navigation tests**

- Mantener Home, Auditoría, Laboratorio y Configuración en orden estable.
- Probar `aria-current`, teclado, foco no oculto y navegación móvil.
- Sustituir los cuatro escenarios light/dark de Issue #40 por Editorial desktop/mobile y fuente bloqueada.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/App.navigation.test.tsx __tests__/App.brand.test.tsx
npx playwright test tests/e2e/aura-editorial-shell.spec.ts --project=chromium
```

Expected: PASS en 320/390/1280, sin overflow global ni errores de consola.

---

### Task 4: Unificar controles, formularios, estados y diálogos

**Files:**
- Create: `src/components/EditorialDialog.tsx`
- Create: `src/__tests__/EditorialDialog.test.tsx`
- Modify: `src/components/DestructiveSessionDialog.tsx`
- Modify: `src/components/ChangelogModal.tsx`
- Modify: `src/components/ProgressDisclosure.tsx`
- Modify: `src/components/SyntaxDisplay.tsx`
- Modify: `src/components/FileUpload.tsx`
- Modify: `src/styles/editorial-components.css`
- Modify: `src/__tests__/DestructiveSessionDialog.test.tsx`
- Modify: `src/__tests__/SyntaxDisplay.test.tsx`

**Step 1: Write failing dialog and primitive tests**

```tsx
it('traps focus, closes with Escape and restores the trigger', async () => {
  const user = userEvent.setup();
  render(<DialogHarness />);
  const trigger = screen.getByRole('button', { name: 'Abrir' });
  await user.click(trigger);
  expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
```

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/EditorialDialog.test.tsx`

Expected: FAIL porque el componente común no existe.

**Step 3: Implement primitives**

- `EditorialDialog`: `<dialog>`, `aria-labelledby`, `aria-describedby`, foco inicial explícito, ciclo Tab/Shift+Tab, Escape, retorno de foco y cierre de backdrop solo cuando no se pierda trabajo.
- Botones: outline/text por defecto; solo un relleno oscuro para la acción primaria de cada bloque; `44px` en móvil; no pills generales.
- Campos: label visible, hint/error con `aria-describedby`, estado mediante texto + icono + borde.
- Progreso: operación >800 ms muestra texto humano; `role="progressbar"` con valores cuando sean reales; indeterminado sin porcentaje ficticio; reduced motion conserva el texto.
- Syntax/código: mono solo en contenido técnico, botón Copiar en sans, foco y feedback `role="status"`.
- FileUpload: input nativo como alternativa al drag, error contiguo, recuperar mediante “Elegir otro archivo”.

**Step 4: Replace style props that encode design**

Mover color, tamaño tipográfico, fondo, radio, borde y espaciado estático de los componentes tocados a clases. Mantener inline solo valores verdaderamente dinámicos, por ejemplo `width: ${progress}%`.

**Step 5: Verify success**

Command: `cd src && npm test -- --run __tests__/EditorialDialog.test.tsx __tests__/DestructiveSessionDialog.test.tsx __tests__/SyntaxDisplay.test.tsx __tests__/csvValidation.test.ts`

Expected: PASS.

---

### Task 5: Editorializar orientación, carga y progreso del pipeline

**Files:**
- Modify: `src/components/MainPipeline.tsx`
- Modify: `src/components/PipelineProgress.tsx`
- Modify: `src/components/FileUpload.tsx`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/MainPipelineR4.test.tsx`
- Create: `src/__tests__/PipelineProgress.editorial.test.tsx`
- Create: `src/tests/e2e/aura-editorial-upload.spec.ts`

**Step 1: Write failing tests**

Probar que la etapa actual expone `aria-current="step"`, que las completadas son navegables solo cuando el contrato lo permite y que carga tiene heading `01 · Cargar dataset`.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/PipelineProgress.editorial.test.tsx __tests__/MainPipelineR4.test.tsx`

Expected: FAIL por la jerarquía y numeración heredadas.

**Step 3: Implement the orientation pattern**

- Numerar el recorrido visible: `01 Carga`, `02 Perfil`, `03 Diagnóstico`, `04 Informe`, `05 Corrección opcional`, `06 Revisión`, `07 Ejecución`, `08 Exportación`.
- No presentar ramas opcionales como obligaciones.
- No permitir que el stepper parezca habilitar destinos bloqueados.
- En móvil, convertir el stepper en ubicación actual + siguiente paso; el historial puede ser un disclosure accesible, no una fila comprimida.
- Mantener carga → error → otro archivo sin reload y sin score falso.

**Step 4: Verify human error recovery**

En `aura-editorial-upload.spec.ts`: vacío → error específico → elegir CSV válido → Perfil; comprobar mensaje, foco, persistencia del nuevo archivo y cero errores JS.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/PipelineProgress.editorial.test.tsx __tests__/MainPipelineR4.test.tsx __tests__/csvService.test.ts
npx playwright test tests/e2e/aura-editorial-upload.spec.ts --project=chromium
```

Expected: PASS.

---

### Task 6: Integrar Perfil, Diagnóstico e Informe en el tema global

**Files:**
- Modify: `src/components/ProfileStep.tsx`
- Modify: `src/components/ProfileStageHeader.tsx`
- Modify: `src/components/DatasetProfile.tsx`
- Modify: `src/components/ColumnStatsPanel.tsx`
- Modify: `src/components/DiagnosisStep.tsx`
- Modify: `src/components/diagnosis/DiagnosisHeroPanel.tsx`
- Modify: `src/components/diagnosis/DiagnosisProviderPanel.tsx`
- Modify: `src/components/diagnosis/DiagnosisContractPanel.tsx`
- Modify: `src/components/diagnosis/DiagnosisCognitiveContractCanvas.tsx`
- Modify: `src/components/diagnosis/TechnicalEvidencePanel.tsx`
- Modify: `src/components/DiagnosticReportStep.tsx`
- Modify: `src/components/diagnosticReport/DiagnosticFindingGroup.tsx`
- Modify: `src/components/diagnosticReport/DiagnosticRecommendationsPanel.tsx`
- Modify: `src/components/diagnosticReport/DiagnosticReportChartPreview.tsx`
- Modify: `src/components/diagnosticReport/DiagnosticReportSummaryCards.tsx`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/DiagnosisHeroPanel.test.tsx`
- Modify: `src/__tests__/diagnosticReportStep.test.tsx`
- Create: `src/tests/e2e/aura-editorial-diagnosis-report.spec.ts`

**Step 1: Write failing hierarchy tests**

- Perfil tiene un solo heading principal y metadata filename/filas/columnas en sans tabular.
- Diagnóstico muestra propósito y estado antes de proveedor/contrato.
- Informe conserva riesgo confirmado, señales contextuales, límites y siguiente acción sin depender del color.
- Ninguno de los tres componentes contiene la clase `editorial-pilot`.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/DiagnosisHeroPanel.test.tsx __tests__/diagnosticReportStep.test.tsx`

Expected: FAIL al exigir el scope global y la nueva jerarquía.

**Step 3: Implement composition**

- Eliminar `.editorial-pilot`; no cambiar los datos presentados.
- Perfil: tratar cada columna expandida como `Record Detail`: identidad, tipo/ID, metadata en `dl`, evidencia y acciones al final.
- Diagnóstico: separar lectura principal serif de configuración/contrato sans; no convertir cada métrica en card.
- Informe: lectura ejecutiva en 58–72 ch; tablas en ancho completo; callouts con superficie o borde izquierdo; una primaria “Exportar resultados” y secundaria “Preparar corrección”.
- Mantener “No medido” y estados reales; no elevar confianza del modelo a probabilidad calibrada.

**Step 4: Test source-font failure**

Bloquear `fonts.googleapis.com` y `fonts.gstatic.com`; comprobar que headings usan Georgia y controles Arial/Helvetica y siguen legibles.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/DiagnosisHeroPanel.test.tsx __tests__/DiagnosisCancellation.test.tsx __tests__/diagnosticReportStep.test.tsx __tests__/pipelineDiagnosticReportState.test.tsx
npx playwright test tests/e2e/aura-editorial-diagnosis-report.spec.ts --project=chromium
```

Expected: PASS en 320/390/1280, incluyendo proveedor ausente, cancelar/reintentar e informe determinista.

---

### Task 7: Reorganizar Plan, Script y Revisión como Editorial Mobile Workbench

**Files:**
- Modify: `src/components/ScriptGenerationStepV2.tsx`
- Modify: `src/components/RemediationPlanStepV2.tsx`
- Modify: `src/components/ReviewStep.tsx`
- Modify: `src/components/ScriptReview.tsx`
- Modify: `src/components/remediation/OptionalRemediationNotice.tsx`
- Modify: `src/components/remediation/RemediationBranchActions.tsx`
- Modify: `src/components/remediation/index.ts`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/scriptGenerationStepV2.test.tsx`
- Modify: `src/__tests__/optionalRemediationBranch.test.tsx`
- Create: `src/__tests__/EditorialRemediationWorkbench.test.tsx`
- Create: `src/tests/e2e/aura-editorial-remediation.spec.ts`

**Step 1: Write failing workbench tests**

Verificar en orden DOM:

```text
Objeto/dataset → decisiones propuestas → salida/alcance → vista previa técnica → acciones
```

Verificar además una sola primaria, “Conservar como válido”, cerrar sin cambios y retorno al informe.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/EditorialRemediationWorkbench.test.tsx __tests__/optionalRemediationBranch.test.tsx`

Expected: FAIL por el orden visual/DOM y la igualdad de peso entre acciones.

**Step 3: Implement desktop composition**

- Dataset y alcance forman el encabezado del workbench.
- Decisiones humanas preceden al script generado.
- Muestras antes/después, columna y alcance se muestran cerca de cada decisión.
- Código y hashes permanecen mono; narrativa permanece serif; controles son sans.
- Solo “Continuar a revisión” o equivalente es primaria en su bloque.

**Step 4: Implement mobile recomposition**

- Flujo vertical natural; sin sidebar alto ni doble scroll.
- Código puede tener scroll horizontal local; el documento no.
- Acciones sticky solo si no ocultan contenido y dejan safe spacing.
- Primaria de ancho disponible; secundarias debajo y visualmente subordinadas.

**Step 5: Verify both branches**

En E2E: aprobar acciones → script → revisión; y rechazar/cerrar sin cambios → exportación. Confirmar que la segunda no fabrica contrato, recibo ni evidencia de ejecución.

**Step 6: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/scriptGenerationStepV2.test.tsx __tests__/optionalRemediationBranch.test.tsx __tests__/EditorialRemediationWorkbench.test.tsx
npx playwright test tests/e2e/aura-editorial-remediation.spec.ts --project=chromium
```

Expected: PASS.

---

### Task 8: Editorializar Ejecución, reingreso, reauditoría y delta

**Files:**
- Modify: `src/components/ApplyVerifyStep.tsx`
- Modify: `src/components/HealthDeltaDashboard.tsx`
- Modify: `src/components/ExecutionLogsPanel.tsx`
- Modify: `src/components/ImprovementRunPanel.tsx`
- Modify: `src/components/ImprovementRunPage.tsx`
- Modify: `src/components/ImprovementRunExportCard.tsx`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/ApplyVerifyStep.test.tsx`
- Modify: `src/__tests__/HealthDeltaDashboard.test.tsx`
- Modify: `src/__tests__/ExecutionLogsPanel.test.tsx`
- Create: `src/tests/e2e/aura-editorial-execution.spec.ts`

**Step 1: Write failing semantic tests**

- Cada estado `ready`, `awaiting_external_output`, `validating`, `verified`, `invalid` tiene heading, explicación, siguiente acción y señal no cromática.
- El delta expone `antes`, `después`, unidad y límites; no comunica éxito solo con verde.
- Logs usan tabla/lista semántica y labels en español.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/ApplyVerifyStep.test.tsx __tests__/HealthDeltaDashboard.test.tsx __tests__/ExecutionLogsPanel.test.tsx`

Expected: FAIL por hardcodes e información cromática/inglesa heredada.

**Step 3: Implement the operational sequence**

- Sección `07 · Ejecutar y verificar` con objeto, archivos requeridos, progreso, resultado y acciones.
- Sustituir estilos inline de `HealthDeltaDashboard` y `ExecutionLogsPanel` por tokens.
- Usar `dl` para recibos/hashes y tabla para eventos comparables.
- Reauditoría: score antes/después no sustituye lista de cambios ni límites.
- Conservar íntegramente la validación de `001`, `120.00`, hashes y archivos.

**Step 4: Verify real external execution path**

Reutilizar el runner real y fixtures de `apply-verify-e2e.spec.ts`; verificar preparar bundle → Python → cargar `corrected.csv` + receipt → reauditar → continuar a exportación.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/ApplyVerifyStep.test.tsx __tests__/HealthDeltaDashboard.test.tsx __tests__/ExecutionLogsPanel.test.tsx __tests__/valuePreservation.test.ts
npx playwright test tests/e2e/aura-editorial-execution.spec.ts --project=chromium
```

Expected: PASS y conservación exacta de representaciones no autorizadas.

---

### Task 9: Migrar Configuración, ayuda, historial, audit log y errores

**Files:**
- Modify: `src/components/SettingsPanel.tsx`
- Modify: `src/components/OllamaSetupWizard.tsx`
- Modify: `src/components/OllamaSetupStandalone.tsx`
- Modify: `src/public/ollama-setup.html`
- Modify: `src/components/HelpCenter.tsx`
- Modify: `src/components/ChangelogModal.tsx`
- Modify: `src/components/AuditLogViewer.tsx`
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/SettingsPanel.test.tsx`
- Modify: `src/__tests__/OllamaSetupWizard.test.tsx`
- Modify: `src/__tests__/HelpCenter.test.tsx`
- Modify: `src/__tests__/ollamaWizardHtml.test.ts`
- Create: `src/tests/e2e/aura-editorial-support.spec.ts`

**Step 1: Write failing support-surface tests**

- Configuración conserva valores al cambiar provider/modelo y al re-renderizar.
- Cada field tiene label; cada error referencia su control.
- Ayuda está en posición consistente.
- Changelog y wizard usan `EditorialDialog` o un patrón equivalente probado.
- ErrorBoundary ofrece recuperación y usa tokens existentes, no `--serif`/`--mono` indefinidos.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/SettingsPanel.test.tsx __tests__/OllamaSetupWizard.test.tsx __tests__/HelpCenter.test.tsx __tests__/ollamaWizardHtml.test.ts`

Expected: FAIL en las nuevas exigencias de tema y semántica.

**Step 3: Implement Editorial Mobile Workbench for settings**

Orden móvil: proveedor seleccionado → modelo/salida → opciones agrupadas → estado/progreso → acciones. Eliminar sidebars con scroll interno largo y cards repetitivas; usar headings, `fieldset/legend`, filetes y flujo natural.

**Step 4: Migrate standalone HTML**

Aplicar los mismos tokens, fuentes con fallback, foco, reduced motion y jerarquía; no depender del CSS de React.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/SettingsPanel.test.tsx __tests__/OllamaSetupWizard.test.tsx __tests__/HelpCenter.test.tsx __tests__/ollamaWizardHtml.test.ts
npx playwright test tests/e2e/aura-editorial-support.spec.ts --project=chromium
```

Expected: PASS en proveedor disponible, ausente, descarga, error, guardar y volver.

---

### Task 10: Migrar Laboratorio, tablas y visualizaciones

**Files:**
- Modify: `src/components/benchmark/BenchmarkCampaignLab.tsx`
- Modify: `src/components/benchmark/BenchmarkGlossary.tsx`
- Modify: `src/components/benchmark/CampaignConfigurationPanel.tsx`
- Modify: `src/components/benchmark/CampaignMatrix.tsx`
- Modify: `src/components/benchmark/CampaignReportPanel.tsx`
- Modify: `src/components/benchmark/CampaignResultsExplorer.tsx`
- Modify: `src/components/benchmark/CampaignSetupPanel.tsx`
- Modify: `src/components/benchmark/ExperimentRunDetail.tsx`
- Modify: `src/components/benchmark/ExecutionEvidencePanel.tsx`
- Modify: `src/components/benchmark/HumanRubricPanel.tsx`
- Modify: `src/components/BoxPlot.tsx`
- Modify: `src/components/SeverityDistributionChart.tsx`
- Modify: `src/styles/editorial-surfaces.css`
- Modify: `src/__tests__/BenchmarkCampaignLab.test.tsx`
- Modify: `src/__tests__/CampaignResultsExplorer.test.tsx`
- Create: `src/__tests__/EditorialTables.test.tsx`
- Create: `src/tests/e2e/aura-editorial-lab.spec.ts`

**Step 1: Write failing table/chart tests**

- Tablas tienen `caption`, `thead`, `tbody`, `th scope`, unidad y estado de sort si aplica.
- Números comparables están alineados a la derecha y usan cifras tabulares.
- Gráficos tienen nombre y descripción textual equivalente mediante `aria-describedby`.
- Estado/selección no dependen de color ni hover.

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/CampaignResultsExplorer.test.tsx __tests__/EditorialTables.test.tsx`

Expected: FAIL por captions, scopes o alternativas textuales faltantes.

**Step 3: Implement compact Editorial density**

- Sans funcional en tablas, mono solo para IDs/hashes.
- Encabezado con fondo blanco o `#F7F7F4`, borde inferior fuerte y separadores horizontales finos.
- Evitar rejilla completa, pills y cards por cada métrica.
- En móvil: resumen lineal antes de la tabla; scroll horizontal solo en wrapper local; no truncar precisión.
- Paleta de charts monocromática por defecto; patrones, labels o símbolos distinguen series. Colores semánticos solo refuerzan.

**Step 4: Verify at realistic density**

El fixture debe producir más de cuatro filas y columnas suficientes para probar scroll, sticky headers, teclado y lectura; no aceptar una muestra mínima como validación de revisión masiva.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/BenchmarkCampaignLab.test.tsx __tests__/CampaignResultsExplorer.test.tsx __tests__/EditorialTables.test.tsx
npx playwright test tests/e2e/aura-editorial-lab.spec.ts --project=chromium
```

Expected: PASS en configuración, corrida, resultados, detalle y exportación del laboratorio.

---

### Task 11: Unificar PDF, SVG, impresión y evidencia exportada

**Files:**
- Create: `src/services/editorialArtifactTheme.ts`
- Create: `src/__tests__/editorialArtifactTheme.test.ts`
- Modify: `src/services/diagnosticReport/pdfLayout.ts`
- Modify: `src/services/diagnosticReport/pdfTables.ts`
- Modify: `src/services/diagnosticReport/pdfCharts.ts`
- Modify: `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- Modify: `src/services/pdfGenerator.ts`
- Modify: `src/services/evidenceArchive.ts`
- Modify: `src/services/benchmark/experimentPdfReport.ts`
- Modify: `src/__tests__/diagnosticPdfGenerator.test.ts`
- Modify: `src/__tests__/pdfGenerator.test.ts`
- Modify: `src/__tests__/pdfCharts.test.ts`
- Modify: `src/__tests__/evidenceArchive.test.ts`
- Modify: `src/__tests__/experimentArtifactExporter.test.ts`

**Step 1: Write failing artifact theme test**

```ts
expect(EDITORIAL_ARTIFACT_THEME.colors).toEqual(expect.objectContaining({
  canvas: '#FFFFFF',
  ink: '#191919',
  muted: '#6B6B67',
  line: '#D9D9D4',
  surface: '#F7F7F4',
}));
expect(EDITORIAL_ARTIFACT_THEME.fonts.reading).toBe('times');
expect(EDITORIAL_ARTIFACT_THEME.fonts.operation).toBe('helvetica');
```

**Step 2: Verify failure**

Command: `cd src && npm test -- --run __tests__/editorialArtifactTheme.test.ts`

Expected: FAIL porque el tema compartido no existe.

**Step 3: Implement a single artifact theme**

- Usar fuentes integradas `times`, `helvetica`, `courier` para portabilidad si no se embeben Source Serif/Source Sans.
- Aplicar canvas blanco, tinta, líneas y surfaces normativas.
- Mantener rojos/ámbar/verde solo en estados y acompañados por texto/símbolo.
- Tablas: sans, encabezado con línea fuerte, sin relleno oscuro, números alineados.
- SVG del archivo de evidencia: reemplazar Warm/Playfair/JetBrains; texto seleccionable y valores sin alteración.
- PDF diagnóstico debe seguir declarando que corresponde al diagnóstico inicial cuando no incluye reauditoría.

**Step 4: Add render assertions**

- Generar PDF real; comprobar páginas, texto, tamaño no vacío y ausencia de recorte.
- Extraer texto para asegurar headings, tablas y limitaciones.
- Renderizar cada página a imagen para revisión humana de portada, tabla densa, salto y pie.
- Probar impresión web sin nav, controles ni tablas cortadas.

**Step 5: Verify success**

Commands:

```bash
cd src
npm test -- --run __tests__/editorialArtifactTheme.test.ts __tests__/diagnosticPdfGenerator.test.ts __tests__/pdfGenerator.test.ts __tests__/pdfCharts.test.ts __tests__/evidenceArchive.test.ts __tests__/experimentArtifactExporter.test.ts
npx playwright test tests/e2e/aura-export-contract.spec.ts tests/e2e/aura-remediation-export.spec.ts --project=chromium
```

Expected: PASS; hashes y contenido contractual no cambian salvo que el contrato incluya bytes visuales y la prueba actualice explícitamente la expectativa.

---

### Task 12: Añadir gates automáticos de accesibilidad y responsive

**Files:**
- Modify: `src/package.json`
- Modify: `src/package-lock.json`
- Create: `src/tests/e2e/aura-editorial-accessibility.spec.ts`
- Create: `src/tests/e2e/helpers/assertNoGlobalOverflow.ts`
- Modify: `src/styles/editorial-foundation.css`
- Modify: `src/styles/editorial-components.css`
- Modify: `src/styles/editorial-surfaces.css`

**Step 1: Install the audit dependency**

Command: `cd src && npm install --save-dev @axe-core/playwright`

Expected: package files actualizados sin dependencias de runtime nuevas.

**Step 2: Write failing accessibility E2E**

```ts
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  .analyze();
expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
```

Cubrir Home, carga, perfil, diagnóstico, informe, corrección, revisión, ejecución, exportación, configuración, ayuda y laboratorio.

**Step 3: Add viewport and motion matrix**

- `320×800`, `390×844`, `768×1024`, `1280×900`.
- Zoom/escala de texto equivalente a 200% en una pasada.
- `prefers-reduced-motion: reduce`.
- Fuentes remotas bloqueadas.
- Comprobar `scrollWidth <= clientWidth`; permitir overflow únicamente en wrappers declarados.

**Step 4: Add keyboard assertions**

Tab/Shift+Tab completos, skip link, focus visible/no oculto, Escape/retorno para overlays, Enter/Space en controles, flechas en tabs si existen y anuncios de progreso/error/éxito.

**Step 5: Verify success**

Command: `cd src && npx playwright test tests/e2e/aura-editorial-accessibility.spec.ts --project=chromium`

Expected: 0 violaciones Critical/Serious de axe, cero overflow global, cero traps y cero errores JS críticos. Lighthouse ≥90 y un lector de pantalla siguen siendo gates humanos, no resultados inferidos de axe.

---

### Task 13: Probar los recorridos humanos completos

**Files:**
- Create: `src/tests/e2e/aura-editorial-full-flow.spec.ts`
- Create: `src/tests/e2e/aura-editorial-errors.spec.ts`
- Reuse: `src/tests/e2e/fixtures/aura_l10_full_flow_issues.csv`
- Reuse: `src/tests/e2e/fixtures/titanic-diagnosis-v2.fixture.ts`
- Modify: `docs/plans/2026-09-12-aura-casabero-editorial-implementacion-completa.md`

**Step 1: Implement the happy-path gate**

```text
abrir → entender → cargar CSV → perfilar → diagnosticar → leer informe
→ aprobar/rechazar acciones → revisar script → ejecutar en copia
→ cargar salida/recibo → reauditar → exportar → volver al informe
→ volver a exportación → destruir sesión
```

Comprobar feedback, persistencia, `001`, `120.00`, descargas y cero errores JS.

**Step 2: Implement alternate/error gates**

- CSV vacío/ilegible → recuperación.
- Proveedor ausente → configurar o continuar determinísticamente.
- Diagnóstico cancelado A + intento B → solo B publica.
- Sin acciones aprobadas → exportación sin evidencia falsa.
- Receipt o CSV alterado → rechazo específico.
- Reload tras perfil/informe/exportación → estado restaurado; archivo se vuelve a solicitar solo donde sea necesario.
- Descarga fallida o preflight inválido → error anunciado y reintento.

**Step 3: Execute the deterministic full flow**

Command: `cd src && npx playwright test tests/e2e/aura-editorial-full-flow.spec.ts tests/e2e/aura-editorial-errors.spec.ts --project=chromium`

Expected: PASS con fixtures controlados.

**Step 4: Execute the real local-provider flow**

Usar el opt-in del recorrido Qwen/Ollama solo si el proveedor está disponible. Registrar modelo solicitado/observado, duración, contrato, cancelación y resultado. Si no está disponible, marcar esta evidencia `BLOQUEADO` o `NO EJECUTADO`; no sustituirla con mocks.

**Step 5: Perform human review**

Revisar manualmente 320, 390 y 1280; teclado; VoiceOver o NVDA; PDF renderizado; descarga real; fuente bloqueada y reduced motion. Registrar por recorrido:

```text
Flujo probado:
Datos/fixture:
Resultado:
Errores JS:
Estado persistente:
E2E/screenshot:
Pendiente:
```

Expected: toda fila crítica tiene evidencia humana/runtime o conserva estado explícito pendiente/bloqueado.

---

### Task 14: Eliminar legado visual y cerrar la migración

**Files:**
- Create: `src/scripts/audit-editorial-ui.mjs`
- Create: `src/__tests__/editorialSourceAudit.test.ts`
- Modify: `src/package.json`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `docs/plans/2026-09-12-aura-casabero-editorial-implementacion-completa.md`
- Generated by command: `graphify-out/graph.json`
- Generated by command: `graphify-out/GRAPH_REPORT.md`

**Step 1: Write failing source audit**

El script debe revisar archivos UI y fallar si encuentra:

```js
const forbidden = [
  /editorial-pilot/,
  /showcase-ink/i,
  /Playfair Display/,
  /JetBrains Mono/,
  /--font-serif:\s*"?Inter/i,
  /\[data-theme=["']dark["']\]/,
];
```

También debe reportar colores y `style={{...}}` nuevos en archivos UI, con allowlist explícita solo para valores dinámicos o colores semánticos documentados. No debe escanear fixtures, datasets, hashes ni contratos.

**Step 2: Verify failure**

Command: `cd src && npm run audit:editorial`

Expected: FAIL mientras existan `editorial-pilot`, cabecera Ink, fuentes antiguas o dark Ink.

**Step 3: Remove obsolete rules**

- Borrar el bloque `.editorial-pilot` y `:has(...)` solo después de que todas las superficies usen el scope global.
- Eliminar tokens Ink/Warm y reglas duplicadas que ya tengan reemplazo.
- Eliminar hardcodes visuales sin borrar colores semánticos aprobados.
- Confirmar que no quedan selectores muertos introducidos por la migración.

**Step 4: Run all gates**

```bash
cd src
npm run audit:editorial
npm test -- --run
npm run typecheck
npm run build
npx playwright test tests/e2e/aura-editorial-*.spec.ts --project=chromium
```

Expected: audit PASS; al menos la línea base de 146 archivos/2022 pruebas se conserva o aumenta; cualquier omisión nueva requiere justificación explícita.

**Step 5: Refresh the project graph**

Command desde la raíz: `graphify update .`

Expected: actualización AST exitosa. Un resultado vacío o truncado no prueba ausencia de impacto.

**Step 6: Record closeout**

Actualizar este documento con SHA del estándar, commits, comandos, conteos, evidencia por viewport, lector de pantalla, PDF y límites. Separar `IMPLEMENTADO`, `VERIFICADO`, `BLOQUEADO`, `NO EJECUTADO` y `PUBLICADO`.

**Step 7: Commit and publish only the authorized migration**

```bash
git status --short
git diff --name-only
git add -- DESIGN.md docs/plans/2026-09-12-aura-casabero-editorial-implementacion-completa.md
# Añadir después, uno por uno, únicamente los paths de implementación revisados en `git diff --name-only`.
git diff --cached --check
git commit -m "feat(ui): complete Aura Casabero Editorial migration"
git push origin main
```

Antes de `git add`, excluir explícitamente `.DS_Store` y los tres archivos duplicados ` 2.ts`. Si el remoto avanzó, detenerse y resolver la integración sin sobrescribir trabajo ajeno.

---

## 8. Olas y puertas de cierre

| Ola | Tareas | Gate para continuar |
| --- | --- | --- |
| 0 · Contrato | 1–2 | Autoridad, tokens, fuentes y baseline verdes |
| 1 · Sistema | 3–5 | Shell, primitives, upload y orientación 320/390/1280 |
| 2 · Flujo principal | 6–8 | Diagnóstico → informe → remediación → ejecución completos |
| 3 · Cobertura | 9–11 | Soporte, laboratorio y artefactos en Editorial |
| 4 · Cierre | 12–14 | AA automatizada, recorridos humanos, limpieza y publicación |

No iniciar una ola si la anterior dejó una regresión funcional o una pantalla crítica sin recuperación. Se permite documentar un bloqueo de proveedor real, pero no omitir el camino determinista, la rama sin remediación ni la validación de archivos.

## 9. Definition of Done

La migración puede llamarse completa solo si:

- `DESIGN.md`, Web, PDF, SVG y HTML standalone declaran el mismo tema y roles.
- Todas las superficies usan el scope Editorial global; `editorial-pilot`, Ink y Warm no gobiernan ninguna vista alcanzable.
- Solo se cargan Source Serif 4 y Source Sans 3; fallbacks funcionan sin red.
- Canvas, tinta, líneas, superficies, tipografía, radios, sombras y botones cumplen Editorial 1.2.
- Existe una primaria clara por bloque; destructive permanece separado y explícito.
- Tablas y gráficos conservan relaciones, unidades, alternativa textual y densidad útil.
- No hay scroll horizontal global a 320 px; workbenches se recomponen y no generan doble scroll vertical.
- Teclado, foco, live regions, modales, targets, reduced motion, zoom y lector de pantalla tienen evidencia.
- Los recorridos feliz, sin proveedor, error de CSV, sin remediación, remediación verificada, reanudación, exportación y destrucción fueron ejecutados.
- Se preservan contratos, hashes, receipts, `001`, `120.00`, score y archivos.
- Unit/integration, typecheck, build, E2E Editorial y audit de legado pasan.
- Graphify se actualiza después del código.
- El cierre diferencia implementación, verificación, bloqueo y publicación; no hay afirmaciones universales basadas en una muestra pequeña.

## 10. Resultado esperado por usuario

Una persona debe poder abrir AURA y reconocer un solo sistema: sereno, blanco, legible y técnicamente preciso. Debe entender dónde está, qué evidencia ve, qué decide, qué se ejecutará, qué sigue pendiente y qué puede descargar. La densidad técnica permanece disponible, pero subordinada al orden de lectura y a la decisión humana.

## 11. Cierre de ejecución — 2026-09-12

### IMPLEMENTADO

- `DESIGN.md`, Web, PDF, SVG, impresión y HTML standalone quedaron alineados con Casabero Editorial 1.2. El estándar canónico verificado es `estandar-casabero@1ac2d4d0e49a5f393c30c26f5c7d2bbe163e3383`.
- Se incorporaron tokens, foundation, componentes, superficies, `EditorialDialog`, navegación de ocho etapas, skip link, focus/reduced-motion, tablas/gráficos semánticos y recuperación explícita.
- Se retiraron `editorial-pilot`, el selector dark y las referencias visuales antiguas de las superficies gobernadas. PDF/SVG usan el tema compartido y mantienen la semántica del diagnóstico inicial.
- Se añadieron `audit:editorial`, la auditoría de fuente y los recorridos E2E Editorial de accesibilidad, happy path y errores.
- Se preservaron contratos, hashes, receipts, score, reglas y valores de control `001` y `120.00`. Los archivos preexistentes ajenos (`.DS_Store` y los tres ` 2.ts`) no forman parte de la migración.

### VERIFICADO

- `npm run audit:editorial`: PASS; 182 archivos de UI revisados.
- `npm test -- --run`: PASS; 152 archivos, 2031 tests, 6 skipped.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; solo conserva warnings de chunking dinámico/tamaño ya existentes.
- `npx playwright test tests/e2e/aura-editorial-accessibility.spec.ts --project=chromium`: PASS en `1280×900`, `768×1024`, `320×800` y `390×844`; axe sin Critical/Serious, sin overflow global, fuentes bloqueadas y reduced motion cubiertos.
- `npx playwright test tests/e2e/aura-editorial-full-flow.spec.ts tests/e2e/aura-editorial-errors.spec.ts --project=chromium`: PASS, 5/5; incluye runner real, reauditoría, ZIP descargado, reingreso, destrucción, recuperación de CSV/proveedor, sin remediación y receipt alterado.
- PDF diagnóstico Editorial generado y revisado página por página: 6 páginas A4, texto extraíble, sin recorte ni solapamientos; el SVG de evidencia conserva texto seleccionable y valores.
- `graphify update .`: ejecutado correctamente; índice AST actualizado localmente. `graphify-out/` permanece ignorado por el repositorio.

### BLOQUEADO

- El recorrido con proveedor local real Qwen/Ollama no se ejecutó: el endpoint local no estaba disponible para el navegador y produjo el estado de recuperación esperado. La ruta determinista fue ejecutada y verificada; no se presenta como inferencia real del proveedor.

### NO EJECUTADO

- No se ejecutó revisión manual con VoiceOver/NVDA ni Lighthouse ≥90. La matriz de teclado, foco, axe, zoom 200%, reduced motion y overflow sí quedó automatizada; la revisión humana de lector de pantalla y Lighthouse conserva estado pendiente.
- La descarga ZIP fue capturada y validada por Playwright; no se hizo una inspección manual independiente del archivo desde Finder.

### PUBLICADO

- Pendiente del commit y push autorizados de esta migración. Se confirmará aquí el hash de cierre y el resultado del push antes de declarar la publicación.
