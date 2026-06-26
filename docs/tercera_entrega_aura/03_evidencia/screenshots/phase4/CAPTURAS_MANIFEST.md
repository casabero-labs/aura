# Capturas de pantalla — Phase 4 (Script Contract v2)

> **Evidencia vigente:** `aa167995316962a70ff41a3970326d4824d980c0`  
> **SHA de reparación:** `PHASE4_REPAIR_SHA`  
> **Fecha de captura:** 2026-06-26  
> **Viewport:** 1440 × 1000  
> **Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/`  
> **Spec:** `src/tests/e2e/phase4-script-contract.spec.ts`  
> **Playwright:** Chromium headless, servidor fresco (CI=1)  
> **Env vars:** `VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE4_E2E_HARNESS=true`  
> **Fixture:** `buildPhase4TitanicFixture(runtimeFingerprint)` desde `Phase4EvidenceHarness.ts`  
> **Pipeline contractual:** `buildScriptCandidateV2 → validateScriptCandidateV2 → finalizeScriptContractV2 → verifyScriptContractV2`  
>
> **Declaraciones obligatorias para todas las capturas:**  
> - Harness determinista.  
> - No es inferencia LLM real.  
> - No ejecuta Python.  
> - No aplica transformaciones al dataset.  
> - No demuestra mejora real del dataset.  
> - No calcula HealthDelta.  
> - El contrato y el script fueron generados por el builder y renderer deterministas actuales y verificados por el validator v2 dentro del navegador.  
> - Contrato válido conforme a las reglas contractuales v2.

---

## 07 — phase4_remediation_hitl.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/07_phase4_remediation_hitl.png` |
| **Tamaño** | 134234 bytes |
| **SHA-256** | `1130898a716a65e6226ab8ffe514ebea370d6638581516d1730a291260950ba3` |
| **Fixture** | `buildPhase4TitanicFixture(runtimeFingerprint)` |
| **Assertions** | Plan visible con acciones. 1 aprobada, 1 rechazada. planId preservado entre HITL. Estados "Aprobado" y "Rechazado" visibles. |
| **Qué demuestra** | El plan de remediación determinista se construye con `buildRemediationPlanV2` y permite decisión humana (HITL). Las acciones se aprueban y rechazan individualmente. El planId no cambia. |
| **Qué no demuestra** | No demuestra diagnóstico LLM. No demuestra ejecución de script. |
| **Pie de figura** | "Plan de remediación determinista v2. Una acción aprobada, otra rechazada. El planId se preserva tras la decisión humana." |

---

## 08 — phase4_script_contract_valid.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/08_phase4_script_contract_valid.png` |
| **Tamaño** | 126152 bytes |
| **SHA-256** | `51da43d56c8e189d082f13f194a3a4d219b2b52a10c0e02dffe478d2453461a3` |
| **Fixture** | Contrato generado vía `buildScriptCandidateV2 → validateScriptCandidateV2 → finalizeScriptContractV2 → verifyScriptContractV2` |
| **Assertions** | "Contrato válido" visible. Hash completo de 64 caracteres expuesto en `data-contract-hash`. Syntax `not_run` visible. Botón "Continuar a revisión" habilitado. Ausencia de "Seguro", "safetyScore", "Remediación simulada". |
| **Qué demuestra** | El contrato se genera determinísticamente desde el plan de remediación. La verificación fresca pasa. El hash SHA-256 completo de 64 caracteres está disponible. La UI muestra el estado contractual sin scores de seguridad. No hay simulación de ejecución. |
| **Qué no demuestra** | No demuestra ejecución Python. No demuestra mejora del dataset. |
| **Pie de figura** | "Contrato de script v2 válido. Hash de 64 caracteres, syntax `not_run`, verificación fresca aprobada. Sin indicadores de seguridad ni simulación." |

---

## 09 — phase4_script_contract_code.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/09_phase4_script_contract_code.png` |
| **Tamaño** | 126142 bytes |
| **SHA-256** | `7c260a5dce34cbe170dabda96ff3c53d897e63f2957afcef429d0552847df422` |
| **Fixture** | Contrato generado vía pipeline contractual completo |
| **Assertions** | `.script-line code` extraído y comparado exactamente con `expectedContract.scriptText`. Partición: accepted/rejected/excluded visibles con testid. accepted + rejected + excluded === plan.plan.length. |
| **Qué demuestra** | El código Python determinista coincide exactamente con `expectedContract.scriptText`. La partición HITL visible con conteos exactos. |
| **Qué no demuestra** | No demuestra que el script pueda ejecutarse en Python real. |
| **Pie de figura** | "Código de script determinista renderizado línea por línea. Partición HITL: accepted, rejected, excluded. Conteos exactos verificados contra el plan." |

---

## 10 — phase4_script_review_readonly.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/10_phase4_script_review_readonly.png` |
| **Tamaño** | 123137 bytes |
| **SHA-256** | `06791453863748c796221ed9c617181e5c4de0986db5e8c9602d996805e3c970` |
| **Fixture** | Contrato + navegación real a ReviewStep vía botón "Continuar a revisión" |
| **Assertions** | ReviewStep visible. Sin "Editar". Sin "Seguro". Sin "Remediación simulada". pageErrors vacío. consoleErrors vacío. |
| **Qué demuestra** | La revisión humana en modo read-only. Sin edición del código. Sin simulación. Sin errores de página. |
| **Qué no demuestra** | No demuestra ejecución post-aprobación. |
| **Pie de figura** | "Revisión humana read-only. Sin botón Editar, sin simulación, sin errores de consola." |

---

## 11 — phase4_script_approved_hitl.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/11_phase4_script_approved_hitl.png` |
| **Tamaño** | 118665 bytes |
| **SHA-256** | `2499c1e7929f00dfcbbb4872c1d514471ed807f2ecf8e5f1adb96536bde905d3` |
| **Fixture** | Contrato aprobado vía fresh verification real |
| **Assertions** | "Contrato aprobado por revisión humana" visible. "Preparar exportación" visible. "Remediación simulada" ausente. pageErrors vacío. |
| **Qué demuestra** | El flujo de aprobación humana completa el ciclo contractual sin ejecutar transformaciones. Sin simulación. Sin errores. |
| **Qué no demuestra** | No demuestra ejecución de script. No calcula HealthDelta. |
| **Pie de figura** | "Contrato aprobado por revisión humana. Preparar exportación disponible. Sin simulación." |

---

## 12 — phase4_tampered_contract_blocked.png

| Campo | Valor |
|---|---|
| **Evidencia vigente** | `aa167995316962a70ff41a3970326d4824d980c0` |
| **Dataset** | `titanic.csv` |
| **Fingerprint runtime** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/12_phase4_tampered_contract_blocked.png` |
| **Tamaño** | 120614 bytes |
| **SHA-256** | `5791015e21c7d26a259bdca53808d355669e153cf1980a44c26dc803856fa012` |
| **Fixture** | Contrato válido real → `scriptHash` alterado vía `__PHASE4_TAMPER_CONTRACT__` |
| **Assertions** | Contrato manipulado con hash alterado. Intento de aprobación bloqueado. ".provider-error-notice" detectado con mensaje de verificación. "Contrato aprobado por revisión humana" ausente. "Preparar exportación" ausente. |
| **Qué demuestra** | El sistema detecta contratos manipulados (hash alterado) y bloquea la aprobación. El bloqueo es visible en la UI. |
| **Qué no demuestra** | No demuestra todas las formas posibles de tampering. |
| **Pie de figura** | "Intento de aprobación de contrato con hash manipulado. Bloqueado. Sin aprobación." |
