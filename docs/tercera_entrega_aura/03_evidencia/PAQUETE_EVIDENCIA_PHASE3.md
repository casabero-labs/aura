# Paquete de Evidencia — Phase 3 (Tercera Entrega AURA)

> **Estado:** CONGELADO
> **Commit:** `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12`
> **Fecha:** 2026-06-25
> **Árbol:** `sourceTreeDirty=false` (verificado)

---

## A. Identificación

| Campo | Valor |
|---|---|
| **Commit SHA** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Fecha de congelamiento** | 2026-06-25 |
| **Comandos ejecutados** | `npm test`, `npm run build`, `npx playwright test`, `npm run contracts:v2:validate-local` |
| **Entorno** | macOS darwin · Node.js v22 · Chromium headless · Vite dev server |
| **Env vars** | `VITE_CONTRACTS_V2_ENABLED=true` · `VITE_PHASE3_E2E_HARNESS=true` |
| **sourceTreeDirty** | `false` (verificado con `git status --porcelain`) |
| **Árbol limpio** | Sí — todos los archivos de prueba y docs no追踪files removidos |

---

## B. Pruebas

### Unit Tests

| Métrica | Valor |
|---|---|
| **Test Files** | 44 |
| **Tests Totales** | 698 |
| **Tests Saltados** | 6 |
| **Tests Fallidos** | 0 |
| **Resultado** | **PASS** |

### Build

| Métrica | Valor |
|---|---|
| **Resultado** | **PASS** |
| **_WARNINGS** | Chunk size warnings (webllm ~6MB) — no afecta funcionalidad |

### Playwright E2E

| Test | Nombre | Resultado |
|---|---|---|
| 01 | `01_synthetic_profile.png` | **PASS** |
| 02 | `02_titanic_profile.png` | **PASS** |
| 03 | `03_adult_income_profile.png` | **PASS** |
| 04 | `04_structured_diagnosis_v2.png` | **PASS** |
| 05 | `05_remediation_plan_v2.png` | **PASS** |
| 06 | `06_remediation_hitl.png` | **PASS** |
| **Total** | **6/6 PASS** | |

### Contracts v2 (Local Validation)

| Campo | Valor |
|---|---|
| **sourceTreeDirty** | `false` |
| **commitSha** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **Datasets PASS** | 3/3 |
| **adult_income.csv** | PASS (48.842r × 15c, 12 issues) |
| **synthetic_ground_truth.csv** | PASS (15r × 9c, 16 issues) |
| **titanic.csv** | PASS (891r × 12c, 10 issues) |
| **plansBuilt** | 3 |
| **plansValid** | 3 |
| **planHashStable** | `true` |
| **unsafeUpgrades** | 0 |
| **invalidReferences** | 0 |

---

## C. Capturas

### Capturas 01–03: Perfilamiento Real del Motor Determinista

| Archivo | Dataset | Descripción | Sección TFM |
|---|---|---|---|
| `01_synthetic_profile.png` | `synthetic_ground_truth.csv` | Perfil dataset sintético (15r × 9c, 16 issues) | Metodología / Pipeline |
| `02_titanic_profile.png` | `titanic.csv` | Perfil dataset Titanic (891r × 12c, 10 issues) | Metodología / Pipeline |
| `03_adult_income_profile.png` | `adult_income.csv` | Perfil dataset Adult Income (48.842r × 15c, 12 issues) | Metodología / Pipeline |

### Capturas 04–06: Harness Determinista (NO LLM Real)

| Archivo | Dataset | Descripción | Sección TFM |
|---|---|---|---|
| `04_structured_diagnosis_v2.png` | `titanic.csv` | Diagnosis v2 con diagnosis blocks, issues y badge REVISIÓN HUMANA | Resultados / Phase 3 |
| `05_remediation_plan_v2.png` | `titanic.csv` | 9 acciones review_only, botones Aprobar/Rechazar, exclusión semantic-long-tail-Name | Resultados / Phase 3 |
| `06_remediation_hitl.png` | `titanic.csv` | HITL: 1 aprobada, 1 rechazada, 7 pendientes | Resultados / Phase 3 |

**Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/`

**Rutas absolutas:**
```
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/01_synthetic_profile.png
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/02_titanic_profile.png
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/03_adult_income_profile.png
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/04_structured_diagnosis_v2.png
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/05_remediation_plan_v2.png
/Users/casabero/Documents/GitHub/aura/docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/06_remediation_hitl.png
```

---

## D. Artefactos JSON

### Validation Results

| Campo | Valor |
|---|---|
| **Archivo** | `experiments/contracts-v2/local-validation-results/validation-results.json` |
| **Ruta absoluta** | `/Users/casabero/Documents/GitHub/aura/experiments/contracts-v2/local-validation-results/validation-results.json` |
| **sourceTreeDirty** | `false` |
| **commitSha** | `12e39bd1a108c1e69ce3ebfe6a7691dc23782d12` |
| **plansBuilt** | 3 |
| **plansValid** | 3 |
| **planHashStable** | `true` |

### Baseline Summary

| Campo | Valor |
|---|---|
| **Archivo** | `experiments/contracts-v2/baseline/baseline-summary.json` |
| **Ruta absoluta** | `/Users/casabero/Documents/GitHub/aura/experiments/contracts-v2/baseline/baseline-summary.json` |

### Ollama Quick Benchmark

| Campo | Valor |
|---|---|
| **Archivo** | `experiments/contracts-v2/ollama_quick_benchmark.json` |
| **Ruta absoluta** | `/Users/casabero/Documents/GitHub/aura/experiments/contracts-v2/ollama_quick_benchmark.json` |
| **Uso** | Smoke test del proveedor Ollama |

### Datasets

| Dataset | SHA-256 | Filas | Columnas | Issues |
|---|---|---|---|---|
| `synthetic_ground_truth.csv` | `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49` | 15 | 9 | 16 |
| `titanic.csv` | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` | 891 | 12 | 10 |
| `adult_income.csv` | `23f713bb0be77e6b98690e1b91795e237686a71ee3ca72f5c9890214e011d21f` | 48.842 | 15 | 12 |

---

## E. Claims Permitidos

- ✓ Planes deterministas (construidos desde fixtures pre-computadas)
- ✓ Referencias válidas (`invalidReferences: 0`)
- ✓ Cero upgrades inseguros (`unsafeUpgrades: 0`)
- ✓ HITL operativo en harness (aprobado/rechazado/pendiente visibles en UI)
- ✓ Proveedor Ollama probado como smoke test (no como benchmark formal)
- ✓ Contrato `aura.diagnosis.v2` renderizado correctamente en UI
- ✓ Contrato `aura.remediation.v2` con 9 acciones `review_only` y 1 exclusión

---

## F. Claims NO Permitidos

- ✗ **NO** afirmar inferencia LLM real en capturas 04–06 (usan harness determinista)
- ✗ **NO** afirmar ejecución real de scripts de transformación
- ✗ **NO** afirmar benchmark comparativo formal (Ollama solo es smoke test)
- ✗ **NO** afirmar mejora real del dataset sin `improvementDelta` ejecutado
- ✗ **NO** usar capturas 04–06 como evidencia de calidad de detección LLM

---

## G. Reproducción

Para regenerar este paquete desde árbol limpio:

```bash
# 1. Verificar árbol limpio
cd /Users/casabero/Documents/GitHub/aura
git status --porcelain    # debe estar vacío
git checkout <commit>      # asegurar commit correcto

# 2. Si hay .env.development, moverlo temporalmente
mv src/.env.development /tmp/

# 3. Ejecutar suite completa
cd src
npm install
npm test                   # 698 unit tests
npm run build              # production build
npx playwright install chromium
VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE3_E2E_HARNESS=true \
  npx playwright test third-delivery-evidence.spec.ts \
  --project=chromium --reporter=list   # 6/6

# 4. Validar contracts
npm run contracts:v2:validate-local   # sourceTreeDirty=false · 3/3

# 5. Verificar artefactos
#    - docs/tercera_entrega_aura/03_evidencia/screenshots/phase3/*.png (6 archivos)
#    - experiments/contracts-v2/local-validation-results/validation-results.json
```

---

## H. Frozen Evidence Checklist

- [x] `sourceTreeDirty: false` verificado
- [x] `commitSha: 12e39bd1a108c1e69ce3ebfe6a7691dc23782d12`
- [x] Unit tests: 698/698 PASS
- [x] Build: PASS
- [x] Playwright E2E: 6/6 PASS
- [x] Contracts v2: 3/3 PASS
- [x] 6 capturas PNG en directorio correcto
- [x] CAPTURAS_MANIFEST.md actualizado con SHA real
- [x] PAQUETE_EVIDENCIA_PHASE3.md creado
- [x] Claims permitidos documentados
- [x] Claims NO permitidos documentados
