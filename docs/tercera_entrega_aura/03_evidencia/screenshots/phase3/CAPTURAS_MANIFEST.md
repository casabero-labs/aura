# Capturas de pantalla — Phase 3 (Tercera Entrega)

> **Commit:** `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12`
> **Fecha de captura:** 2026-06-25
> **Viewport:** 1440 × 1000
> **Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/`
> **Spec:** `src/tests/e2e/third-delivery-evidence.spec.ts`
> **Playwright:** Chromium headless, Vite dev server (http://127.0.0.1:3000)
> **Env vars:** `VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE3_E2E_HARNESS=true`
> **Fixture:** `src/tests/e2e/harness/Phase3EvidenceHarness.ts` (Titanic audit report, no Ollama)
> **Harness:** Deterministic — `window.__PHASE3_INJECT__` + `window.__PHASE3_SET_STATE__`
> **Assertions:** 04 (diagnosis-v2 visible + REVISIÓN HUMANA), 05 (9 actions + approve/reject + exclusion), 06 (HITL approve/reject + pending)
> **Contracts:** `contracts:v2:validate-local` sourceTreeDirty=false · 3/3 PASS

---

## 01 — synthetic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `01_synthetic_profile.png` |
| **Dataset** | `synthetic_ground_truth.csv` (SHA-256: `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`) |
| **Filas × Columnas** | 15 × 9 |
| **Issues** | 16 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/01_synthetic_profile.png` |
| **Tamaño** | 83.556 bytes |
| **Estado de evidencia** | Capturado correctamente — NO congelado |
| **Qué demuestra** | Perfil del dataset sintético de validación (15 filas, 9 columnas, 16 issues inyectados). Motor determinista activo, score visible, categorías de hallazgos renderizadas. Captura 01–03 muestran perfilamiento real del motor determinista. |
| **Qué no demuestra** | No es un diagnóstico LLM real — es la vista del perfil generada por el motor determinista. No demuestra calidad de detección (eso está en `validation-results.json`). |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset sintético de validación (15 filas, 9 columnas, 16 issues inyectados). El motor determinista detecta los 16 issues y los clasifica por categoría y severidad." |

---

## 02 — titanic_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `02_titanic_profile.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`) |
| **Filas × Columnas** | 891 × 12 |
| **Issues** | 10 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/02_titanic_profile.png` |
| **Tamaño** | 84.776 bytes |
| **Estado de evidencia** | Capturado correctamente — NO congelado |
| **Qué demuestra** | Perfil del dataset Titanic (891 filas, 12 columnas, 10 issues naturales). Score, issues por categoría, columnas perfiladas, evidencia visible. Capturas 01–03 muestran perfilamiento real del motor determinista. |
| **Qué no demuestra** | No demuestra la calidad del diagnóstico. No muestra el plan de remediación. No es inferencia LLM real. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Titanic (891 filas, 12 columnas, 10 issues naturales). El motor determinista detecta 10 issues distribuidos en categorías de higiene, integridad y privacidad." |

---

## 03 — adult_income_profile.png

| Campo | Valor |
|---|---|
| **Nombre** | `03_adult_income_profile.png` |
| **Dataset** | `adult_income.csv` (SHA-256: `23f713bb0be77e6b98690e1b91795e237686a71ee3ca72f5c9890214e011d21f`) |
| **Filas × Columnas** | 48.842 × 15 |
| **Issues** | 12 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/03_adult_income_profile.png` |
| **Tamaño** | 86.449 bytes |
| **Estado de evidencia** | Capturado correctamente — NO congelado |
| **Qué demuestra** | Perfil del dataset Adult Income (48.842 filas, 15 columnas, 12 issues). Demuestra que el pipeline escala a volumen alto sin degradación visible. Capturas 01–03 muestran perfilamiento real del motor determinista. |
| **Qué no demuestra** | No demuestra velocidad de procesamiento (la latencia está en `validation-results.json`). No es evidencia de calidad de detección. No es inferencia LLM real. |
| **Pie de figura propuesto** | "Figura X. Perfil del dataset Adult Income (48.842 filas, 15 columnas, 12 issues). El pipeline procesa el dataset de alto volumen sin degradación visible." |

---

## 04 — structured_diagnosis_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `04_structured_diagnosis_v2.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`) |
| **Filas × Columnas** | 891 × 12 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/04_structured_diagnosis_v2.png` |
| **Tamaño** | 493.177 bytes |
| **Estado de evidencia** | **CONGELADO** — Harness determinista (NO inferencia LLM real) |
| **Qué demuestra** | Etapa de diagnóstico estructurado v2 con diagnosis blocks, diagnosis issues y badge "REVISIÓN HUMANA" visible. Renderizado del contrato `aura.diagnosis.v2` en la UI vía harness determinista. Capturas 04–06 utilizan harness determinista (NO inferencia LLM real). |
| **Qué no demuestra** | **NO es inferencia LLM real.** La captura usa harness de prueba que inyecta fixtures pre-computadas. El diagnóstico formal requiere corridas con LLM real siguiendo el protocolo de benchmark. |
| **Pie de figura propuesto** | "Figura X. Etapa de diagnóstico estructurado v2 sobre Titanic vía harness determinista. El contrato `aura.diagnosis.v2` renderiza diagnosis blocks, issues y el badge REVISIÓN HUMANA. Nota: esta captura usa harness de prueba, no inferencia LLM real." |

---

## 05 — remediation_plan_v2.png

| Campo | Valor |
|---|---|
| **Nombre** | `05_remediation_plan_v2.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`) |
| **Filas × Columnas** | 891 × 12 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/05_remediation_plan_v2.png` |
| **Tamaño** | 183.793 bytes |
| **Estado de evidencia** | **CONGELADO** — Harness determinista (NO inferencia LLM real) |
| **Qué demuestra** | Muestra **9 acciones remediation** con estado "Revisión requerida", botones "Aprobar" y "Rechazar" visibles, y la exclusión `semantic-long-tail-Name` (issue no accionable). Las 9 acciones son de tipo `review_only`. Capturas 04–06 utilizan harness determinista (NO inferencia LLM real). |
| **Qué no demuestra** | **NO es inferencia LLM real.** **NO es ejecución real de scripts.** **NO demuestra mejora real del dataset.** La captura usa harness de prueba que inyecta fixtures pre-computadas. |
| **Pie de figura propuesto** | "Figura X. Etapa de propuesta de remediación v2 sobre Titanic vía harness determinista. Se observan 9 acciones de tipo review_only, botones Aprobar/Rechazar operativos, y la exclusión de `semantic-long-tail-Name`. Nota: esta captura usa harness de prueba, no inferencia LLM real." |

---

## 06 — remediation_hitl.png

| Campo | Valor |
|---|---|
| **Nombre** | `06_remediation_hitl.png` |
| **Dataset** | `titanic.csv` (SHA-256: `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7`) |
| **Filas × Columnas** | 891 × 12 |
| **Commit** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha captura** | 2026-06-25 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/06_remediation_hitl.png` |
| **Tamaño** | 183.400 bytes |
| **Estado de evidencia** | **CONGELADO** — Harness determinista (NO inferencia LLM real) |
| **Qué demuestra** | Interfaz HITL con **1 acción aprobada** (badge "Aprobado"), **1 acción rechazada** (badge "Rechazado"), y **7 acciones pendientes** (badge "Pendiente"). Gobernanza HITL operativa en harness. Capturas 04–06 utilizan harness determinista (NO inferencia LLM real). |
| **Qué no demuestra** | **NO es inferencia LLM real.** **NO es ejecución real de scripts.** **NO demuestra benchmark comparativo formal.** **NO demuestra mejora real del dataset sin delta ejecutado.** La captura usa harness de prueba que inyecta fixtures pre-computadas. |
| **Pie de figura propuesto** | "Figura X. Revisión humana HITL sobre el plan de remediación vía harness determinista. Se observa una acción aprobada, una rechazada y 7 acciones pendientes. La infraestructura HITL (approve/reject/pending) está operativa. Nota: esta captura usa harness de prueba, no inferencia LLM real." |

---

## Notas de reproducción

Para regenerar las capturas (desde árbol limpio):

```bash
cd src
mv .env.development /tmp/  # si existe
git status --porcelain      # debe estar vacío
npm test                              # 698 unit tests
npm run build                         # production build
npx playwright install chromium        # si es la primera vez
VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE3_E2E_HARNESS=true \
  npx playwright test third-delivery-evidence.spec.ts \
  --project=chromium --reporter=list  # 6/6 tests
npm run contracts:v2:validate-local   # sourceTreeDirty=false · 3/3 PASS
git add -A && git commit --amend -m "docs: freeze and index final Phase 3 evidence"
```

Las capturas se guardan en:
```
docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/
```

**Fixtures deterministas (sin Ollama, sin inferencia LLM real):**
- `PHASE3_TITANIC_DIAGNOSIS` — DiagnosisExecutionResult derivado de `titanic-audit-report.json`
- `PHASE3_TITANIC_PLAN` — RemediationPlanV2 con 9 acciones `review_only`, 1 exclusión (`semantic-long-tail-Name`)

**Harness API:**
- `window.__PHASE3_INJECT__(diagnosis, plan, opts?)` — inyecta diagnóstico y plan
- `window.__PHASE3_SET_STATE__(state)` — establece estado del pipeline ('diagnosis')

**Estado de congelamiento:**
- Capturas 01–03: Perfilamiento real del motor determinista — NO congeladas
- Capturas 04–06: Harness determinista — **CONGELADAS** (no modificar ni reemplazar)
