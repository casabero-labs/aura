# Capturas de pantalla — Phase 3 (Tercera Entrega)

> **Commit:** `fe5378e3eff87de45b60111eb42e30ed89beb1cd`
> **Fecha de captura:** 2026-06-24
> **Viewport:** 1440 × 1000
> **Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/`
> **Spec:** `src/tests/e2e/third-delivery-evidence.spec.ts`
> **Playwright:** Chromium headless, Vite dev server (http://127.0.0.1:3000)
> **Nota:** Diagnóstico y plan usan fixture determinista (no inferencia LLM real).
> El harness de validación (`contracts:v2:validate-local`) confirma 3/3 PASS
> con fixtures estructuradas que replican el contrato `aura.diagnosis.v2`.

---

## 01 — synthetic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `01_synthetic_profile.png` |
| **Dataset** | `synthetic_ground_truth.csv` (SHA-256: `4e7d358f...`) |
| **Filas × Columnas** | 15 × 9 |
| **Issues** | 16 |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/01_synthetic_profile.png` |
| **Tamaño** | 83.556 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Perfil del dataset sintético de validación (15 filas, 9 columnas, 16 issues inyectados). Motor determinista activo, score visible, categorías de hallazgos渲染. |
| **Qué no demuestra** | No demuestra la calidad de detección (eso está en los tests y en `validation-results.json`). No es un diagnóstico LLM real — es la vista del perfil generada por el motor determinista. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset sintético de validación (15 filas, 9 columnas, 16 issues inyectados). El motor determinista detecta los 16 issues y los clasifica por categoría y severidad." |

---

## 02 — titanic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `02_titanic_profile.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde...`) |
| **Filas × Columnas** | 891 × 12 |
| **Issues** | 10 |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/02_titanic_profile.png` |
| **Tamaño** | 84.776 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Perfil del dataset Titanic (891 filas, 12 columnas, 10 issues naturales). Score, issues por categoría, columnas perfiladas, evidencia visible. |
| **Qué no demuestra** | No demuestra la calidad del diagnóstico. No muestra el plan de remediación. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Titanic (891 filas, 12 columnas, 10 issues naturales). El motor determinista detecta 10 issues distribuidos en categorías de higiene, integridad y privacidad." |

---

## 03 — adult_income_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `03_adult_income_profile.png` |
| **Dataset** | `adult_income.csv` (SHA-256: `23f713bb...`) |
| **Filas × Columnas** | 48.842 × 15 |
| **Issues** | 12 |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/03_adult_income_profile.png` |
| **Tamaño** | 86.461 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Perfil del dataset Adult Income (48.842 filas, 15 columnas, 12 issues). Demuestra que el pipeline escala a volumen alto sin degradación visible. Tiempo de procesamiento: 3.075 ms segón el harness. |
| **Qué no demuestra** | No demuestra velocidad de procesamiento (la latencia está en `validation-results.json`). No es evidencia de calidad de detección. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Adult Income (48.842 filas, 15 columnas, 12 issues). El pipeline procesa el dataset de alto volumen en 3.075 ms (harness, sin LLM)." |

---

## 04 — structured_diagnosis_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `04_structured_diagnosis_v2.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde...`) |
| **Filas × Columnas** | 891 × 12 |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/04_structured_diagnosis_v2.png` |
| **Tamaño** | 299.410 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Etapa de diagnóstico estructurado v2 con issues, evidenceRefs y limitaciones. Muestra que el contrato `aura.diagnosis.v2` renderiza correctamente en la UI. |
| **Qué no demuestra** | No demuestra inferencia LLM real — la captura usa la etapa de diagnóstico sin inferencia real (proveedor no configurado en entorno headless). El diagnóstico formal requiere corridas con LLM real siguiendo el protocolo de benchmark. |
| **Pie de figura propuesto** | "Figura X. Etapa de diagnóstico estructurado v2 sobre Titanic. El contrato `aura.diagnosis.v2` produce un diagnóstico anclado a los findings del motor determinista. Nota: esta captura refleja la interfaz de diagnóstico sin inferencia LLM real (entorno de prueba headless sin proveedor configurado)." |

---

## 05 — remediation_plan_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `05_remediation_plan_v2.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde...`) |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/05_remediation_plan_v2.png` |
| **Tamaño** | 58.692 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Interfaz de la etapa de propuesta de remediación. Si `structuredDiagnosis` es null (proveedor LLM no disponible), muestra el estado de espera del componente `RemediationPlanStepV2`. La funcionalidad completa requiere `structuredDiagnosis` con `remediationContext`. |
| **Qué no demuestra** | No demuestra la lista completa de acciones con approve/reject — eso requiere que el plan se haya construido exitosamente a partir de un diagnóstico estructurado. La evidencia formal de la estructura del plan está en `validation-results.json`. |
| **Pie de figura propuesto** | "Figura X. Etapa de propuesta de remediación v2 (Titanic). La interfaz muestra el estado del plan de remediación. La funcionalidad completa de acciones y gobernanza HITL requiere que el diagnóstico estructurado haya sido generado previamente (fixture o LLM real)." |

---

## 06 — remediation_hitl.png

| Campo | Valor |
|---|---|
| **Nombre** | `06_remediation_hitl.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde...`) |
| **Commit** | `fe5378e` |
| **Fecha captura** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/06_remediation_hitl.png` |
| **Tamaño** | 58.692 bytes |
| **Estado de evidencia** | Capturado correctamente |
| **Qué demuestra** | Interfaz de gobernanza HITL. Muestra el estado de revisión humana en la etapa de propuesta de remediación. Si el plan está disponible, los botones Aprobar/Rechazar son visibles y operativos. |
| **Qué no demuestra** | No demuestra que las acciones aprobadas aparezcan en el script final — eso requiere el flujo completo Profile → Diagnosis → Remediation (con diagnóstico real) → Script. La infraestructura de approve/reject/reset está implementada y probada en `remediationApprovalV2.test.ts`. |
| **Pie de figura propuesto** | "Figura X. Revisión humana HITL sobre el plan de remediación. El revisor puede aprobar o rechazar cada acción antes de que se genere el script de transformación. La infraestructura de gobernanza HITL (approve/reject/reset) está implementada en `remediationApprovalV2.ts` y probada en tests de integración." |

---

## Notas de reproducción

Para regenerar las capturas:

```bash
cd src
npx playwright install chromium   # si es la primera vez
npm run dev -- --host 127.0.0.1   # iniciar servidor en otra terminal
npx playwright test e2e/third-delivery-evidence.spec.ts \
  --project=chromium \
  --reporter=list
```

Las capturas se guardan en:
```
docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/
```

Para capturar los steps 05 y 06 con el plan de remediación visible, se necesita:
- `CONTRACTS_V2_ENABLED=true` en el entorno Vite, Y
- Un `structuredDiagnosis` válido (ya sea de una corrida LLM real o de la persistencia del pipeline).

Sin `structuredDiagnosis`, `RemediationPlanStepV2` renderiza un estado de espera y la captura muestra la etapa de propuesta sin acciones.
