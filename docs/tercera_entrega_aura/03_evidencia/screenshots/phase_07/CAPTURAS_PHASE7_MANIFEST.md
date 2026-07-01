# Phase 7 — Capturas de Evidencia Visual

> **Carpeta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase_07/`
> **Fecha:** 2026-07-01
> **SHA del test:** commit de Phase 7 L2B
> **Viewport:** 1440 × 900 (desktop), 375 × 667 (mobile)

> **Nota L2B:** Las capturas `healthdelta_running.png` y `healthdelta_error.png` fueron corregidas en Phase 7 L2B usando un visual testability harness opt-in con query params `?phase7Visual=running` y `?phase7Visual=error`. Estas son capturas de MOCK VISUAL — no son ejecuciones reales.

---

## Resumen

Se generaron **7 capturas** de la interfaz de Health Delta para evidencia de cuarta entrega. 5 capturas usan ejecución real con fixtures controlados. 2 capturas usan mock visual (running, error) via visual testability harness.

---

## Capturas

### 1. `healthdelta_idle.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_idle.png` |
| Tamaño | 58134 bytes |
| Estado visual | `idle` — panel esperando input |
| Escenario E2E relacionado | `E2E-NAV-004` — Health Delta abre correctamente |
| Qué demuestra | UI en estado inicial con botón "Run Improvement Flow" visible |
| Claim protegido | "AURA does NOT execute Python inside the browser" visible en aviso amarillo |
| Claim protegido | "controlled fixture copy" visible en aviso verde |
| Limitación | Captura estática — no demuestra interacción real |

---

### 2. `healthdelta_running.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_running.png` |
| Tamaño | 58348 bytes |
| Estado visual | `running` (visual harness — spinner + 6 pasos) |
| Escenario E2E relacionado | `E2E-HD-004` — Running muestra los 6 pasos |
| Qué demuestra | Spinner de running con los 6 pasos del pipeline |
| Claim protegido | "AURA is not executing Python directly" visible en aviso amarillo |
| Método | Visual testability harness: `?phase7Visual=running` fuerza estado running por 3 segundos |
| Limitación | MOCK VISUAL — no es ejecución real. No ejecuta Python, no usa dataset real. Solo demuestra el estado visual. |

---

### 3. `healthdelta_done_dashboard.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_done_dashboard.png` |
| Tamaño | 74871 bytes |
| Estado visual | `done` — HealthDeltaDashboard visible |
| Escenario E2E relacionado | `E2E-HD-006` — Done muestra HealthDeltaDashboard |
| Qué demuestra | HealthDeltaDashboard con score bar, status badge, issue counts, caveats, runId |
| Claim protegido | Score delta, issue delta y status basados en fixture controlado |
| Limitación | Fixture controlado — no refleja dataset real |

---

### 4. `healthdelta_done_logs.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_done_logs.png` |
| Tamaño | 74835 bytes |
| Estado visual | `done` — ExecutionLogsPanel visible |
| Escenario E2E relacionado | `E2E-HD-007` — Done muestra ExecutionLogsPanel |
| Qué demuestra | Logs de ejecución con 6 pasos, runtime badge, clasificación info/warn/error |
| Claim protegido | Logs reflejan ejecución del pipeline sobre fixture controlado |
| Limitación | Logs generados por pipeline real pero sobre fixture no real |

---

### 5. `healthdelta_done_export.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_done_export.png` |
| Tamaño | 74886 bytes |
| Estado visual | `done` — ImprovementRunExportCard + Run Again visible |
| Escenario E2E relacionado | `E2E-HD-008`, `E2E-HD-009`, `E2E-HD-010` — Export JSON, runId, Run Again |
| Qué demuestra | Export card con botones, runId visible, botón "Run Again" |
| Claim protegido | "Export JSON" disponible para ImprovementRunV1 serializado |
| Limitación | Export basado en fixture controlado — no es dataset real |

---

### 6. `healthdelta_error.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_error.png` |
| Tamaño | 62418 bytes |
| Estado visual | `error` (visual harness — panel de error) |
| Escenario E2E relacionado | `E2E-HD-014` — Error state debe poder simularse |
| Qué demuestra | Panel de error con mensaje de error, posibles causas, aviso de fixture, botones Retry y Reload |
| Claim protegido | "The original dataset was not modified" visible en aviso amarillo |
| Método | Visual testability harness: `?phase7Visual=error` fuerza estado error inmediatamente |
| Limitación | MOCK VISUAL — no es un error real del pipeline. No hay ejecución real de Python ni acceso a dataset real. Solo demuestra el estado visual de error. |

---

### 7. `healthdelta_mobile_nav.png`

| Atributo | Valor |
|---|---|
| Archivo | `healthdelta_mobile_nav.png` |
| Tamaño | 48787 bytes |
| Estado visual | Mobile — Health Delta abierto tras navegación desde hamburger menu |
| Escenario E2E relacionado | `E2E-NAV-008` — Mobile nav permite abrir Health Delta |
| Qué demuestra | Navegación mobile funcional, Improvement Run heading visible |
| Claim protegido | La navegación mobile no expone ninguna funcionalidad adicional |
| Limitación | Viewport reducido — algunos detalles pueden no ser visibles |

---

## Estados visuales cubiertos

| Estado | Captura | Método |
|---|---|---|
| `idle` | ✅ `healthdelta_idle.png` | Navegación real |
| `running` | ✅ `healthdelta_running.png` | Visual harness (`?phase7Visual=running`) |
| `done` | ✅ `healthdelta_done_dashboard.png`, `healthdelta_done_logs.png`, `healthdelta_done_export.png` | Flujo real completo con fixtures |
| `error` | ✅ `healthdelta_error.png` | Visual harness (`?phase7Visual=error`) |
| `mobile` | ✅ `healthdelta_mobile_nav.png` | Navegación real |

---

## Estrategia de mock

### Real execution (idle, done, mobile)

Los estados `idle` y `done` usan la **ejecución real** del `runImprovementFlow` con:
- Fixtures CSV controlados (3 filas hardcodeadas en `ImprovementRunPanel.tsx`)
- `runAudit` síncrono y determinista (sin llamadas a LLM)
- `executeControlledRun` y `importColabOutput` sobre fixtures

### Running state (L2B: visual harness)

**Problema L2:** El flujo real completaba en <10ms — imposible capturar spinner.

**Solución L2B:** Se agregó un visual testability harness opt-in en `ImprovementRunPanel.tsx`:
- Activado via `?phase7Visual=running` query param
- Fuerza estado `running` por 3 segundos, luego transiciona a `done`
- No ejecuta Python, no usa dataset real
- Documentado como mock visual en el componente

### Error state (L2B: visual harness)

**Problema L2:** `page.route` no interceptó correctamente el módulo `improvementRunService` en contexto Vite dev.

**Solución L2B:** Se agregó un visual testability harness opt-in en `ImprovementRunPanel.tsx`:
- Activado via `?phase7Visual=error` query param
- Fuerza estado `error` inmediatamente
- No ejecuta Python, no usa dataset real
- Documentado como mock visual en el componente

---

## Notas sobre claims verificados visualmente

Las capturas muestran los siguientes avisos de claims en idle/running:

- **Aviso verde (idle):** "This run executes the full improvement pipeline over a **controlled fixture copy** of the dataset. No original data is modified."
- **Aviso amarillo (idle/running):** "NOTE: AURA does **not** execute Python inside the browser. The pipeline delegates Python execution to an external Colab notebook. No real datasets are accessed."

Estos avisos son **permanentes en todos los estados** según el diseño de Phase 6.

---

## Metadata

- **Test file:** `src/tests/e2e/phase7-healthdelta-screenshots.spec.ts`
- **Carpeta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase_07/`
- **Viewport desktop:** 1440 × 900
- **Viewport mobile:** 375 × 667
- **Playwright:** `@playwright/test ^1.57.0`
- **Flujo real:** `runImprovementFlow` con `BEFORE`/`AFTER` fixtures (3 filas, 4 columnas)
- **LLM calls:** 0 (auditEngine.runAudit es síncrono y determinista)
- **Python execution:** 0 (delegated to Colab external)
- **Chrome AI / Gemini Nano:** 0 (no se usa)
- **Visual testability harness:** `?phase7Visual=running` y `?phase7Visual=error` en `ImprovementRunPanel.tsx:55-99`
