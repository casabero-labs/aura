# E2E Contract — Phase 7

> **Estado:** contrato formal (Loop 0)
> **Fecha:** 2026-07-01
> **Versión:** 1.0.0
> **Scope:** navegador real (Playwright o Cypress), sin mocks de red

Este documento define el contrato E2E que guiará la verificación de Phase 7 en navegador real. Cada escenario es trazable a un test automatizado. Los escenarios marcados con `[MOCK]` requieren simulación controlada.

---

## A. Navegación

### A.1 Home carga correctamente

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-001` |
| Precondición | App cargada en `/` |
| Pasos | Navegar a URL base de AURA |
| Resultado esperado | La página Home se renderiza. Sidebar visible con enlaces: Home, Auditoría, Laboratorio, Health Delta, Configuración. |
| Notas | Verificar que los 5 items de navegación son visibles. |

### A.2 Auditoría abre correctamente

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-002` |
| Precondición | App cargada en cualquier vista |
| Pasos | Click en "Auditoría" en sidebar |
| Resultado esperado | Vista de Auditoría (`MainPipeline`) se renderiza. El ítem "Auditoría" en sidebar queda activo/highlighted. |
| Notas | Verificar que MainPipeline carga sin errores de consola. |

### A.3 Laboratorio abre correctamente

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-003` |
| Precondición | App cargada en cualquier vista |
| Pasos | Click en "Laboratorio" en sidebar |
| Resultado esperado | Vista de Laboratorio (`BenchmarkLab`) se renderiza. El ítem "Laboratorio" en sidebar queda activo/highlighted. |
| Notas | Verificar que BenchmarkLab carga sin errores de consola. |

### A.4 Health Delta abre correctamente

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-004` |
| Precondición | App cargada en cualquier vista |
| Pasos | Click en "Health Delta" en sidebar |
| Resultado esperado | Vista de Health Delta (`ImprovementRunPage`) se renderiza. El panel está en estado **idle**. El ítem "Health Delta" en sidebar queda activo/highlighted. |
| Notas | Verificar que el botón "Run Improvement Flow" es visible. |

### A.5 Configuración abre correctamente

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-005` |
| Precondición | App cargada en cualquier vista |
| Pasos | Click en "Configuración" en sidebar |
| Resultado esperado | Vista de Configuración (`Settings`) se renderiza. El ítem "Configuración" en sidebar queda activo/highlighted. |
| Notas | Verificar que Settings carga sin errores de consola. |

### A.6 Health Delta no deja Auditoría activa

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-006` |
| Precondición | Vista activa: Auditoría |
| Pasos | 1. Click en "Auditoría" — verificar activo. 2. Click en "Health Delta" |
| Resultado esperado | "Auditoría" deja de estar activo. "Health Delta" queda activo. Solo se renderiza el workspace de Health Delta. |
| Notas | Verificar que no hay dos vistas activas simultáneamente. |

### A.7 Back desde Health Delta vuelve a Auditoría

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-007` |
| Precondición | Vista activa: Health Delta |
| Pasos | 1. Click en "← Back" o botón de retorno en `ImprovementRunPage`. |
| Resultado esperado | Vista vuelve a Auditoría. "Auditoría" queda activo en sidebar. |
| Notas | Si existe botón "Back", verificar que funciona. Si no, verificar que navegar manualmente a Auditoría funciona. |

### A.8 Mobile nav permite abrir Health Delta

| Atributo | Valor |
|---|---|
| ID | `E2E-NAV-008` |
| Precondición | Viewport < 768px (mobile) |
| Pasos | 1. Abrir menú mobile (hamburger o toggle). 2. Click en "Health Delta". |
| Resultado esperado | Vista Health Delta se renderiza. Menú mobile se cierra (o permanece abierto según diseño). |
| Notas | Verificar que la navegación mobile no rompe el layout. |

---

## B. Health Delta Workspace

### B.1 Estado idle visible

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-001` |
| Precondición | Health Delta cargado, sin run previo |
| Pasos | Observar el panel en estado inicial |
| Resultado esperado | Panel muestra: título "Improvement Run", botón "Run Improvement Flow" visible y enabled, sin dashboard ni logs ni export card. |

### B.2 Aviso de fixture controlado visible

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-002` |
| Precondición | Estado idle |
| Pasos | Leer texto visible en el panel |
| Resultado esperado | El texto debe incluir "controlled fixture" o "fixture copy". No debe incluir "real dataset", "production data" ni frases equivalentes. |

### B.3 Aviso de no Python en AURA visible

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-003` |
| Precondición | Cualquier estado (idle, running, done, error) |
| Pasos | Leer texto visible en el panel |
| Resultado esperado | El texto debe incluir "does not execute Python" o "AURA does NOT execute Python". No debe incluir "Python executed", "AURA executed" ni frases equivalentes. |

### B.4 Click en Run Improvement Flow cambia a running

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-004` |
| Precondición | Estado idle |
| Pasos | Click en "Run Improvement Flow" |
| Resultado esperado | Panel cambia a estado **running**: spinner visible, botón disabled o reemplazado por indicador de progreso. |
| Notas | `[MOCK]` opcional si el flujo real tarda mucho. Se puede mockear `runImprovementFlow` para respuesta instantánea. |

### B.5 Running muestra los 6 pasos

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-005` |
| Precondición | Estado running |
| Pasos | Observar el panel durante ejecución |
| Resultado esperado | Se muestran 6 pasos del pipeline: (1) preflight check, (2) sandbox validation, (3) Colab notebook generation, (4) Colab output import, (5) reaudit, (6) health delta computation. |
| Notas | Los nombres exactos pueden variar. Lo importante es que se muestren 6 pasos secuenciales. |

### B.6 Done muestra HealthDeltaDashboard

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-006` |
| Precondición | Flujo completado → estado done |
| Pasos | Observar el panel |
| Resultado esperado | `HealthDeltaDashboard` visible con: score bar (before → after), status badge, issue counts, caveats section. |

### B.7 Done muestra ExecutionLogsPanel

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-007` |
| Precondición | Estado done |
| Pasos | Observar el panel |
| Resultado esperado | `ExecutionLogsPanel` visible con logs clasificados, runtime badge, opción expand/collapse. |

### B.8 Done muestra ImprovementRunExportCard

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-008` |
| Precondición | Estado done |
| Pasos | Observar el panel |
| Resultado esperado | `ImprovementRunExportCard` visible con botones "Export JSON" y "Copy JSON" (o equivalente). |

### B.9 Done muestra runId

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-009` |
| Precondición | Estado done |
| Pasos | Buscar identificador de run en el panel |
| Resultado esperado | Un `runId` (UUID o string) es visible en el panel o en el JSON exportado. |

### B.10 Done muestra Run Again

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-010` |
| Precondición | Estado done |
| Pasos | Buscar botón "Run Again" |
| Resultado esperado | Botón "Run Again" visible y enabled. |

### B.11 Export JSON funciona

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-011` |
| Precondición | Estado done |
| Pasos | Click en "Export JSON" o botón de descarga |
| Resultado esperado | Se inicia descarga de archivo `.json`. El contenido es un `ImprovementRunV1` válido con campos: `runId`, `execution`, `reaudit`, `healthDelta`, `claims`, `limitations`. |
| Notas | `[MOCK]` — en navegador headless, verificar que el evento de download se dispara. Validar contenido del blob. |

### B.12 Copy JSON funciona si clipboard está disponible

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-012` |
| Precondición | Estado done, clipboard API disponible en el browser |
| Pasos | Click en "Copy JSON" o botón de copia |
| Resultado esperado | JSON copiado al portapapeles. Confirmación visual (toast o texto "Copied"). |
| Notas | `[MOCK]` — mockear `navigator.clipboard.writeText` y verificar que recibe el string correcto. |

### B.13 Run Again vuelve a idle

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-013` |
| Precondición | Estado done |
| Pasos | Click en "Run Again" |
| Resultado esperado | Panel vuelve a estado **idle**: dashboard desaparece, logs desaparecen, export card desaparece. Botón "Run Improvement Flow" visible. |
| Notas | `[MOCK]` si el flujo se mockea. |

### B.14 Error state debe poder simularse

| Atributo | Valor |
|---|---|
| ID | `E2E-HD-014` |
| Precondición | `[MOCK]` — `runImprovementFlow` configurado para reject |
| Pasos | Click en "Run Improvement Flow" con mock de error |
| Resultado esperado | Panel muestra estado **error**: mensaje de error visible, botón "Retry" o "Run Again" visible, aviso "original dataset was **not** modified" visible. |

---

## C. Claims visibles

### C.1 Claims prohibidos — ausencia verificada

| Atributo | Valor |
|---|---|
| ID | `E2E-CLM-001` |
| Precondición | Cualquier vista de Health Delta (idle, running, done, error) |
| Pasos | Inspeccionar todo el texto renderizado en el panel |
| Resultado esperado | **NO** debe aparecer ninguna de estas frases (case-insensitive): "Python ejecutado por AURA", "AURA executed Python", "validación externa independiente", "independent external validation", "mejora sobre dataset real", "improvement on real dataset", "benchmark formal", "formal benchmark", "corrección productiva", "production correction", "datos reales corregidos", "real data corrected". |

### C.2 Claims requeridos — presencia verificada

| Atributo | Valor |
|---|---|
| ID | `E2E-CLM-002` |
| Precondición | Estado idle |
| Pasos | Inspeccionar texto renderizado |
| Resultado esperado | **SÍ** debe aparecer al menos uno de: "controlled fixture", "fixture controlado". |

| Atributo | Valor |
|---|---|
| ID | `E2E-CLM-003` |
| Precondición | Cualquier estado |
| Pasos | Inspeccionar texto renderizado |
| Resultado esperado | **SÍ** debe aparecer al menos uno de: "Colab external", "Google Colab", "external runtime", "Colab notebook". |

| Atributo | Valor |
|---|---|
| ID | `E2E-CLM-004` |
| Precondición | Cualquier estado |
| Pasos | Inspeccionar texto renderizado |
| Resultado esperado | **SÍ** debe aparecer al menos uno de: "no real datasets", "not real data", "fixture only", "controlled fixture". |

| Atributo | Valor |
|---|---|
| ID | `E2E-CLM-005` |
| Precondición | Cualquier estado |
| Pasos | Inspeccionar texto renderizado |
| Resultado esperado | **SÍ** debe aparecer al menos uno de: "not independent", "not external validation", "reproducible", "same audit engine". |

---

## D. No regresión

### D.1 MainPipeline no se rompe

| Atributo | Valor |
|---|---|
| ID | `E2E-REG-001` |
| Precondición | App cargada |
| Pasos | 1. Navegar a Health Delta. 2. Ejecutar improvement flow (mock). 3. Navegar a Auditoría. 4. Cargar un CSV fixture. 5. Ejecutar auditoría. |
| Resultado esperado | Auditoría se ejecuta sin errores. El reporte de auditoría se genera correctamente. Sin errores de consola. |

### D.2 BenchmarkLab no se rompe

| Atributo | Valor |
|---|---|
| ID | `E2E-REG-002` |
| Precondición | App cargada |
| Pasos | 1. Navegar a Health Delta. 2. Navegar a Laboratorio. 3. Verificar que el laboratorio carga sus componentes. |
| Resultado esperado | BenchmarkLab carga sin errores. Sin errores de consola. |

### D.3 Settings no se rompe

| Atributo | Valor |
|---|---|
| ID | `E2E-REG-003` |
| Precondición | App cargada |
| Pasos | 1. Navegar a Health Delta. 2. Navegar a Configuración. 3. Verificar que settings carga. |
| Resultado esperado | Settings carga sin errores. Sin errores de consola. |

### D.4 Footer se oculta correctamente en workspaces

| Atributo | Valor |
|---|---|
| ID | `E2E-REG-004` |
| Precondición | App cargada |
| Pasos | 1. Verificar footer en Home. 2. Navegar a Health Delta. 3. Verificar footer. |
| Resultado esperado | Footer visible en Home. Footer oculto o mínimo en Health Delta (workspace mode). |
| Notas | Verificar que el footer no interfiere con el panel de Health Delta. |

---

## E. Producción futura

### E.1 Pruebas faltantes antes de aceptar dataset real

| ID | Prueba | Bloqueante | Descripción |
|---|---|---|---|
| `FUT-TEST-001` | Upload CSV real | Sí | El usuario debe poder cargar un CSV real en AURA sin que AURA lo ejecute. |
| `FUT-TEST-002` | Auditoría sobre CSV real | Sí | `runAudit` debe funcionar sobre un CSV real (no fixture). |
| `FUT-TEST-003` | Notebook con CSV real | Sí | El notebook exportado debe contener el CSV real embebido (o referencia). |
| `FUT-TEST-004` | Import CSV corregido | Sí | El usuario debe poder importar el CSV de vuelta post-Colab. |
| `FUT-TEST-005` | Reauditoría post-Colab real | Sí | `runReaudit` debe comparar before/after sobre datos reales. |
| `FUT-TEST-006` | HealthDelta sobre datos reales | Sí | `computeHealthDelta` debe funcionar con datos reales. |

### E.2 Validaciones faltantes antes de persistir ImprovementRunV1

| ID | Validación | Descripción |
|---|---|---|
| `FUT-VAL-001` | Schema validation | `ImprovementRunV1` debe validarse contra un schema antes de persistir. |
| `FUT-VAL-002` | Uniqueness | `runId` debe ser único en BD. |
| `FUT-VAL-003` | Immutability | Una vez persistido, `ImprovementRunV1` no debe modificarse. |
| `FUT-VAL-004` | Audit trail | Debe existir registro de quién ejecutó el run y cuándo. |
| `FUT-VAL-005` | Soft delete | Runs antiguos deben poder archivarse sin perder trazabilidad. |

### E.3 Criterios de aceptación para Phase 7 final

- [ ] 100% de escenarios E2E del contrato implementados y pasando.
- [ ] Capturas de pantalla de idle, running, done, error en navegador real.
- [ ] Capturas de pantalla de HealthDeltaDashboard, ExecutionLogsPanel, ImprovementRunExportCard.
- [ ] Verificación visual de que ningún claim prohibido aparece en la UI.
- [ ] Verificación visual de que todos los claims requeridos aparecen en la UI.
- [ ] No-regresión confirmada: MainPipeline, BenchmarkLab, Settings intactos.
- [ ] Documento de entrega consolidado con toda la evidencia.
- [ ] FREEZE_PHASE7.md firmado.

---

## Resumen de escenarios

| Grupo | Cantidad | IDs |
|---|---|---|
| A. Navegación | 8 | `E2E-NAV-001` a `E2E-NAV-008` |
| B. Health Delta | 14 | `E2E-HD-001` a `E2E-HD-014` |
| C. Claims | 6 | `E2E-CLM-001` a `E2E-CLM-005` |
| D. No regresión | 4 | `E2E-REG-001` a `E2E-REG-004` |
| E. Producción futura | 11 | `FUT-TEST-001` a `FUT-TEST-006`, `FUT-VAL-001` a `FUT-VAL-005` |
| **Total** | **43** | |

---

## Notas de implementación

- Los escenarios `[MOCK]` requieren que el harness E2E intercepte `runImprovementFlow` para evitar ejecución real durante tests.
- Los escenarios de claims (grupo C) pueden implementarse como tests de snapshot o assertions de texto.
- Los escenarios de no regresión (grupo D) deben correr en CI como parte de la suite de pre-merge.
- Los escenarios de producción futura (grupo E) son documentales — no se implementan en Phase 7.
