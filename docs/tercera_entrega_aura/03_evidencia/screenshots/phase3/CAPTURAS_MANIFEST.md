# Capturas de pantalla — Phase 3 (Tercera Entrega)

> **Commit:** `fe5378e3eff87de45b60111eb42e30ed89beb1cd`
> **Fecha:** 2026-06-24
> **Viewport:** 1440 × 1000
> **Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/`
> **Spec:** `src/tests/e2e/third-delivery-evidence.spec.ts`

---

## 01 — synthetic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `01_synthetic_profile.png` |
| **Dataset** | `synthetic_ground_truth.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/01_synthetic_profile.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Perfil del dataset sintético de 15 filas × 9 columnas con 16 issues. Muestra score, categorías de hallazgos y estructura del perfil. |
| **Qué no demuestra** | No demuestra la calidad de la detección (eso está en los tests unitarios y en `validation-results.json`). No es un diagnóstico LLM real. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset sintético de validación (15 filas, 9 columnas, 16 issues inyectados). El motor determinista detecta los 16 issues y los clasifica por categoría y severidad." |

---

## 02 — titanic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `02_titanic_profile.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/02_titanic_profile.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Perfil del dataset Titanic (891 filas, 12 columnas, 10 issues naturales). Visible: score, issues por categoría, columnas perfiladas. |
| **Qué no demuestra** | No demuestra calidad del diagnóstico. No muestra el plan de remediación. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Titanic (891 filas, 12 columnas). El motor determinista detecta 10 issues distribuidos en las categorías de higiene, integridad y privacidad." |

---

## 03 — adult_income_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `03_adult_income_profile.png` |
| **Dataset** | `adult_income.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/03_adult_income_profile.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Perfil del dataset Adult Income (48.842 filas, 15 columnas, 12 issues). Demuestra que el pipeline escala a volumen alto sin degradación visible. |
| **Qué no demuestra** | No demuestra que el pipeline sea rápido (la latencia está en `validation-results.json`). No es evidencia de calidad de detección. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Adult Income (48.842 filas, 15 columnas). El pipeline de ingestion procesa el dataset de alto volumen en 3.075 ms (Figura Z: resultados de latencia del harness)." |

---

## 04 — structured_diagnosis_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `04_structured_diagnosis_v2.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/04_structured_diagnosis_v2.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Diagnóstico estructurado v2 con issues, evidenceRefs y limitaciones. Muestra que el contrato `aura.diagnosis.v2` renderiza correctamente en la UI. Si el harness usa fixture determinista, lo indica el manifest. |
| **Qué no demuestra** | No demuestra inferencia LLM real (usa fixture si no hay proveedor). No demuestra que el diagnóstico sea correcto fuera del harness. |
| **Pie de figura propuesto** | "Figura X. Diagnóstico estructurado v2 sobre Titanic. El contrato `aura.diagnosis.v2` produce un diagnóstico anclado a los findings del motor determinista, con referencias a la evidencia original. Nota: este diagnóstico usa fixture determinista; corridas con LLM real requieren el protocolo de benchmark formal." |

---

## 05 — remediation_plan_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `05_remediation_plan_v2.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/05_remediation_plan_v2.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Plan de remediación v2 con acciones, actionability, exclusiones y botones de approve/reject. Muestra la interfaz HITL: acciones pendientes (pending), tipo de acción, ruleId, columna y actionability. |
| **Qué no demuestra** | No demuestra que el plan sea ejecutable (el harness no ejecuta scripts). No demuestra que todas las acciones sean correctas (la validación formal está en los tests). |
| **Pie de figura propuesto** | "Figura X. Plan de remediación v2 para Titanic (9 acciones, 1 exclusión not_actionable). Todas las acciones están en estado `pending`; el revisor humano debe aprobar o rechazar cada una antes de generar el script de transformación." |

---

## 06 — remediation_hitl.png

| Campo | Valor |
|---|---|
| **Nombre** | `06_remediation_hitl.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `fe5378e` |
| **Fecha** | 2026-06-24 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/06_remediation_hitl.png` |
| **Estado de evidencia** | Listo para captura |
| **Qué demuestra** | Interfaz HITL con al menos una acción aprobada y una rechazada. Visible: estado `approved` y `rejected` en los botones. Demuestra que la gobernanza humana es operativa. |
| **Qué no demuestra** | No demuestra el script generado (eso corresponde a la fase de script). No demuestra que la aprobación sea irreversible (el reset existe y está probado en tests). |
| **Pie de figura propuesto** | "Figura X. Revisión humana HITL sobre el plan de remediación de Titanic. Primera acción aprobada (verde), segunda rechazada (rojo). El script de transformación solo incluirá las acciones marcadas como `approved`." |

---

## Notas de reproducción

Para regenerar las capturas:

```bash
cd src
npx playwright test e2e/third-delivery-evidence.spec.ts \
  --project=chromium \
  --reporter=list
```

Las capturas se guardan en:
```
docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/
```

Para regenerar con un proveedor LLM real (Ollama o API key configurada), asegurar que `VITE_OLLAMA_URL` o `VITE_OPENAI_API_KEY` esté disponible en el entorno.
