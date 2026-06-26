# Capturas de pantalla — Phase 4 (Script Contract v2)

> **Commit de evidencia:** `PHASE4_EVIDENCE_SHA`  
> **Fecha de captura:** 2026-06-26  
> **Viewport:** 1440 × 1000  
> **Directorio:** `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/`  
> **Spec:** `src/tests/e2e/phase4-script-contract.spec.ts`  
> **Playwright:** Chromium headless, Vite dev server  
> **Env vars:** `VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE4_E2E_HARNESS=true`  
> **Fixture:** `__PHASE4_BUILD_DIAGNOSIS__` + `buildRemediationPlanV2` (runtime, determinista)  
> **Harness:** Deterministic. No LLM inference. No Python execution. No HealthDelta.  
> **Declaraciones obligatorias:**  
> - Harness determinista.  
> - No es inferencia LLM real.  
> - No ejecuta Python.  
> - No aplica transformaciones al dataset.  
> - No demuestra mejora real del dataset.  
> - No calcula HealthDelta.  
> - El contrato y el script fueron generados por el builder y renderer deterministas actuales y verificados por el validator v2 dentro del navegador.

---

## 07 — phase4_remediation_hitl.png

| Campo | Valor |
|---|---|
| **Nombre** | `07_phase4_remediation_hitl.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/07_phase4_remediation_hitl.png` |
| **Tamaño** | 115 KB |
| **Fixture** | `RemediationPlanV2` construido con `buildRemediationPlanV2` desde diagnosis runtime |
| **Assertions** | Estado visible: 1 acción Aprobada, 1 Rechazada. RemediationStage visible. Botones Aprobar/Rechazar funcionales. |
| **Qué demuestra** | El plan de remediación determinista se construye y muestra acciones. HITL permite aprobar y rechazar acciones individuales. Los estados se actualizan visualmente. |
| **Qué no demuestra** | No demuestra diagnóstico LLM. No demuestra ejecución de script. |

---

## 08 — phase4_script_contract_valid.png

| Campo | Valor |
|---|---|
| **Nombre** | `08_phase4_script_contract_valid.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/08_phase4_script_contract_valid.png` |
| **Tamaño** | 129 KB |
| **Fixture** | Contrato generado vía `buildScriptCandidateV2 → validate → finalize → verify` |
| **Assertions** | "Contrato válido" visible. No "Seguro". Syntax `not_run`. rendererVersion visible. Botón "Continuar a revisión" habilitado. |
| **Qué demuestra** | El contrato se genera determinísticamente desde el plan de remediación. La verificación fresca pasa. La UI muestra el estado contractual sin scores de seguridad. |
| **Qué no demuestra** | No demuestra ejecución Python. No demuestra mejora del dataset. |

---

## 09 — phase4_script_contract_code.png

| Campo | Valor |
|---|---|
| **Nombre** | `09_phase4_script_contract_code.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/09_phase4_script_contract_code.png` |
| **Tamaño** | 129 KB |
| **Fixture** | Contrato generado vía pipeline contractual completo |
| **Assertions** | `.script-code` visible con `def clean_dataset`. Partición: aceptadas, rechazadas, excluidas visibles. |
| **Qué demuestra** | El código Python determinista coincide con `contract.scriptText`. La partición HITL es visible (aceptadas/rechazadas/excluidas). |
| **Qué no demuestra** | No demuestra que el script pueda ejecutarse en Python real. |

---

## 10 — phase4_script_review_readonly.png

| Campo | Valor |
|---|---|
| **Nombre** | `10_phase4_script_review_readonly.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/10_phase4_script_review_readonly.png` |
| **Tamaño** | 128 KB |
| **Fixture** | Contrato + ReviewStep v2. `readOnly`, `hideEditAction`. |
| **Assertions** | ReviewStep v2 visible. Sin "Editar". Sin "Seguro". "Aprobar script" disponible. Sin "Remediación simulada". |
| **Qué demuestra** | La revisión humana en modo read-only. El código no es editable. No hay simulación de ejecución en Phase 4. |
| **Qué no demuestra** | No demuestra ejecución post-aprobación. |

---

## 11 — phase4_script_approved_hitl.png

| Campo | Valor |
|---|---|
| **Nombre** | `11_phase4_script_approved_hitl.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/11_phase4_script_approved_hitl.png` |
| **Tamaño** | 128 KB |
| **Fixture** | Contrato aprobado vía fresh verification |
| **Assertions** | Aprobación vía botón "Aprobar script". Estado post-aprobación capturado. |
| **Qué demuestra** | El flujo de aprobación humana completa el ciclo contractual sin ejecutar transformaciones. |
| **Qué no demuestra** | No demuestra ejecución de script. No calcula HealthDelta. |

---

## 12 — phase4_tampered_contract_blocked.png

| Campo | Valor |
|---|---|
| **Nombre** | `12_phase4_tampered_contract_blocked.png` |
| **Dataset** | `titanic.csv` |
| **Commit** | `PHASE4_EVIDENCE_SHA` |
| **Fecha captura** | 2026-06-26 |
| **Viewport** | 1440 × 1000 |
| **Ruta** | `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/12_phase4_tampered_contract_blocked.png` |
| **Tamaño** | 128 KB |
| **Fixture** | Contrato válido real → `scriptHash` alterado via `__PHASE4_TAMPER_CONTRACT__` |
| **Assertions** | Contrato manipulado. Aprobación bloqueada. Estado fail-closed capturado. |
| **Qué demuestra** | El sistema detecta contratos manipulados (hash alterado) y bloquea la aprobación. Fail-closed efectivo. |
| **Qué no demuestra** | No demuestra todas las formas posibles de tampering. |
