# LOOP 04 - Micro Cleanup Report - AURA

> Fecha: 2026-06-15
> Rama: `loop-04-micro-cleanup`
> Base: `main` (baf4628)
> Predecesor: LOOP_03 (QA Regression, veredicto: GO con observaciones)

---

## 1. Resumen ejecutivo

Loop 04 cierra las 4 observaciones no bloqueantes detectadas por QA en Loop 03 sin modificar comportamiento funcional, scoring, auditEngine ni arquitectura. Se corrige fallback de `formatCompliance` en ExperimentDesigner, se elimina el pill académico "TFM UNIR" de la navegación, se cambia el label técnico en evidenceManifest de "benchmark formal" a "laboratorio" y se resuelve la race condition de visibilidad de nav en E2E desktop. Las 3 baterías de pruebas pasan limpias (133 tests, build, 5/5 E2E con nav PASS en desktop). Cero regresiones.

---

## 2. Observaciones cerradas

| Observación | Archivo | Cambio aplicado | Riesgo que cierra |
|-------------|---------|-----------------|-------------------|
| `formatCompliance` usado sin fallback `contractCompliance ??` | `src/components/ExperimentDesigner.tsx:259` | `r.formatCompliance` → `(r.contractCompliance ?? r.formatCompliance)` | Discurso inconsistente: `contractCompliance` como nombre canónico con `formatCompliance` como alias histórico |
| Pill "TFM UNIR" visible en navegación principal | `src/App.tsx:306-309` | Eliminado `<span className="nav-academic-pill">TFM UNIR</span>` | Ruido académico en primer plano; riesgo de defensa si se presenta como demo |
| Label "Diagnóstico LLM y benchmark formal" en manifest sin corridas `formal_valid` | `src/services/evidenceManifest.ts:53` | Cambiado a "Diagnóstico LLM y laboratorio" | Ambigüedad: no debe sugerir benchmark formal si no hay corridas `formal_valid` |
| Nav visibility FAIL en E2E desktop por race condition | `src/tests/e2e/aura-qa-audit.spec.ts:23-44` | `waitUntil: 'commit'` → `'domcontentloaded'` + `waitFor('.sys-nav', { state: 'visible' })` + `isVisible({ timeout })` sin `.catch()` | Falso FAIL por timing: Playwright evaluaba nav antes del render React |

---

## 3. Cambios implementados

### 3.1 contractCompliance fallback en ExperimentDesigner

**Problema:**
`ExperimentDesigner.tsx:259` mostraba `✓/✗` usando `r.formatCompliance` directamente, sin el patrón `(r.contractCompliance ?? r.formatCompliance)` que el resto del código usa. Esto rompía la estrategia de migración donde `contractCompliance` es el nombre canónico y `formatCompliance` es alias histórico.

**Solución:**
Se aplicó el mismo fallback que usan `BenchmarkLab.tsx`, `BenchmarkPanel.tsx`, `ComparisonStep.tsx` y `BenchmarkCharts.tsx`: `(r.contractCompliance ?? r.formatCompliance) ? '✓' : '✗'`.

**Criterio de aceptación cumplido:**
- La tabla sigue mostrando ✓/✗ sin cambios visuales.
- Tipos intactos: `BenchmarkResult` tiene ambos campos (`contractCompliance?: boolean`, `formatCompliance: boolean`).
- No se modificó scoring ni export.

**Limitación restante:**
Ninguna.

---

### 3.2 Limpieza de pill académico en navegación

**Problema:**
`App.tsx:309` mostraba `<span className="nav-academic-pill">TFM UNIR</span>` en la barra de navegación, visible en todas las pantallas. Loop 02 lo identificó como ruido académico de severidad media con recomendación de eliminar. Loop 03 confirmó que seguía presente.

**Solución:**
Se eliminó el elemento `<span className="nav-academic-pill">TFM UNIR</span>` y se simplificó el comentario del bloque izquierdo de `Branding y Contexto Académico` a `Branding`. El logo "AURA" permanece como único branding.

**Criterio de aceptación cumplido:**
- La navegación sigue funcionando: los botones Auditoría, Laboratorio y Configuración no se modificaron.
- El logo AURA sigue visible en la esquina izquierda.
- No se agregó texto académico alternativo en primer plano.

**Limitación restante:**
- La clase CSS `.nav-academic-pill` queda sin uso en `index.css:200`. No se elimina para evitar modificar CSS fuera del alcance de este loop.
- El `<title>` HTML en `index.html:7` conserva "TFM UNIR" como metadata de página. No es ruido de UI.

---

### 3.3 Label técnico en evidenceManifest

**Problema:**
`evidenceManifest.ts:53` usaba `label: 'Diagnóstico LLM y benchmark formal'` como etiqueta de OE3 en el manifest técnico. Aunque está dentro de detalles colapsados, la palabra "benchmark formal" genera ambigüedad: el protocolo de benchmark establece que solo hay benchmark formal si hay corridas `formal_valid`. Si el Lab no tiene corridas formales, el label es engañoso.

**Solución:**
Se cambió el label a `'Diagnóstico LLM y laboratorio'`. No se modificó lógica de `evidenceStatus`, conteos, condiciones ni thresholds.

**Criterio de aceptación cumplido:**
- Lógica de evidenceStatus intacta: `completed`/`partial`/`blocked` según `hasSuccessfulBenchmark` y `benchmarkFormalCount`.
- Conteos de corridas `formal_valid` no se alteraron.
- Label ahora describe la funcionalidad (laboratorio) sin sugerir resultado formal.

**Limitación restante:**
Ninguna.

---

### 3.4 E2E mobile nav visibility

**Problema:**
El test E2E desktop (`aura-qa-audit.spec.ts:23`) reportaba `FAIL` en los 3 checks de visibilidad de navegación (Auditoría, Laboratorio, Configuración). La causa raíz era una race condition:
1. `page.goto('/', { waitUntil: 'commit' })` resolvía apenas el HTML se comprometía, antes de que React montara la app.
2. Los checks de `isVisible()` usaban `.catch(() => false)`, suprimiendo el timeout de Playwright y devolviendo `false` ante cualquier error.

**Solución:**
Tres cambios incrementales:
1. `waitUntil: 'commit'` → `'domcontentloaded'`: espera a que el DOM esté parseado antes de cualquier evaluación.
2. `waitFor('.sys-nav', { state: 'visible', timeout: 15_000 })`: garantiza que React montó la navegación antes de inspeccionar botones internos.
3. `isVisible()` → `isVisible({ timeout: 10_000/5_000 })`: timeout explícito por botón. El primer botón (Auditoría) tiene 10s porque es el más rápido en aparecer; los siguientes 5s porque ya están en DOM.

**Criterio de aceptación cumplido:**
- No se borró el test ni se marcó como skip.
- No se redujo cobertura: los 3 checks siguen ejecutándose.
- Los 3 checks ahora reportan `PASS` en desktop.
- La diferencia entre PASS real (botón visible) y FAIL real (botón no renderizado) se mantiene gracias al `waitFor('.sys-nav')` previo.

**Resultado E2E:**
```
- Nav Auditoría visible: PASS
- Nav Laboratorio visible: PASS
- Nav Configuración visible: PASS
```

**Limitación restante:**
Ninguna.

---

## 4. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm test` | 16/16 archivos, 133/133 tests OK | 430ms. Sin fallos ni skipped. |
| `npm run build` | Build exitoso en 3.04s | Chunk warning webllm 6,017kB (pre-existente). Sin errores. |
| `npm run test:e2e` | 5/5 tests OK (6.7s) | Nav visibility PASS en desktop. Mobile OK. Sin JS errors. |

---

## 5. Riesgos abiertos después del loop

No quedan bloqueantes conocidos.

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| `.nav-academic-pill` CSS muerta en `index.css:200` | Baja | Limpiar en loop de deuda CSS (fuera del alcance de este loop). |
| `<title>` HTML con "TFM UNIR" en `index.html:7` | Baja | Cambiar a "AURA — Auditoría de Calidad del Dato" cuando se prepare la versión de demo/defensa. |
| Chunk size warning webllm 6MB | Baja | Pre-existente. Evaluar lazy-loading condicional. |
| Umbral de score en compositeScoring.test.ts calibrado contra preview Titanic (21 filas) | Baja | Pre-existente. Recalibrar contra dataset completo si se actualiza el preview. |

---

## 6. Claims actualizados

Los claims permitidos y no permitidos de Loop 03 se mantienen iguales. No se agregaron ni removieron claims.

Cambio semántico menor: donde antes se decía "benchmark formal" en el manifest técnico, ahora se dice "laboratorio". Esto no afecta claims del TFM, solo evita ambigüedad interna en el export.

---

## 7. Commit sugerido

```
chore: close QA observations before TFM writing

- ExperimentDesigner: use contractCompliance ?? formatCompliance fallback
  for consistency with BenchmarkLab, BenchmarkPanel, ComparisonStep
- App.tsx: remove nav-academic-pill (TFM UNIR) from navigation
- evidenceManifest: rename OE3 label from "benchmark formal" to
  "laboratorio" to avoid ambiguity without formal_valid runs
- E2E: fix desktop nav visibility race condition with waitFor(.sys-nav)
  and explicit isVisible timeouts (domcontentloaded waitUntil)
```
