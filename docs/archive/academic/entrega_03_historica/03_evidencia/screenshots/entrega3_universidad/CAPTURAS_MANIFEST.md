# Capturas Entrega 3 Universidad — AURA

> **Fecha:** 2026-06-27  
> **Commit:** `9e663225f2b6d9a90fbea2e7203e110e85aad0e3`  
> **Spec:** `src/tests/e2e/third-delivery-university-evidence.spec.ts`  
> **Evidencia Phase 4:** `aa167995316962a70ff41a3970326d4824d980c0`  
> **Viewport:** 1440 × 1000  
> **Dataset principal:** `titanic.csv`  
> **Playwright:** Chromium headless, servidor fresco (CI=1)  
> **Env vars:** `VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE4_E2E_HARNESS=true`  
> **Fixture:** `buildPhase4TitanicFixture(runtimeFingerprint)` (capturas 03–10)  
> **Nota:** estas capturas no demuestran ejecución Python, reauditoría ni HealthDelta.  
> **Declaración:** El contrato y el script fueron generados por el builder y renderer deterministas actuales dentro del navegador.

## Tabla resumen

| # | Archivo | SHA-256 | Bytes | Demuestra | No demuestra |
|---|---|---|---:|---|---|
| 01 | `01_local_first_upload_profile.png` | `e3981fd8...` | 90,159 | Carga local y perfilamiento inicial | Diagnóstico LLM real |
| 02 | `02_deterministic_audit_findings.png` | `0e71112a...` | 90,164 | Motor determinista y hallazgos | Que todos los hallazgos sean TP |
| 03 | `03_diagnosis_evidence_contract.png` | `86076fb7...` | 498,356 | LLM restringido por evidencia | Inferencia LLM real (harness) |
| 04 | `04_remediation_plan_hitl.png` | `1130898a...` | 134,234 | Decisión humana (HITL) | Ejecución de transformaciones |
| 05 | `05_script_contract_valid.png` | `0159c9bd...` | 126,185 | Contrato de script validado | Ejecución Python |
| 06 | `06_script_rendered_code.png` | `07712e8b...` | 126,193 | Script determinista | Ejecución del script |
| 07 | `07_human_review_readonly.png` | `197c48b2...` | 123,146 | Revisión HITL sin edición libre | Mejora del dataset |
| 08 | `08_human_approved_contract.png` | `4fe9b511...` | 118,651 | Aprobación del contrato | Ejecución ni HealthDelta |
| 09 | `09_tampered_contract_blocked.png` | `5791015e...` | 120,614 | Fail-closed ante manipulación | Seguridad absoluta |
| 10 | `10_phase5_boundary_next_step.png` | `456db645...` | 121,790 | Frontera Phase 5 | Phase 5 implementada |

---

### 01 — local_first_upload_profile.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/01_local_first_upload_profile.png`
- **Dataset:** titanic.csv (891 filas × 12 columnas)
- **SHA-256:** `e3981fd88fde9e68e98ba4de206f19a6cf1229f0d10d284ee4e26909ab6aaa23`
- **Tamaño:** 90,159 bytes
- **Flujo:** carga real del CSV → perfilamiento determinista (sin harness, sin LLM)
- **Qué demuestra:** AURA procesa datasets locales en el navegador y genera un perfil determinista con columnas, filas y score de salud.
- **Qué no demuestra:** No es un diagnóstico LLM real. No demuestra corrección del dataset.
- **Pie de figura:** "Perfil del dataset Titanic generado localmente en el navegador. AURA muestra columnas, filas, score y resumen de salud sin enviar datos a ningún servidor."

### 02 — deterministic_audit_findings.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/02_deterministic_audit_findings.png`
- **Dataset:** titanic.csv (891 filas × 12 columnas)
- **SHA-256:** `0e71112aa265b8fff006a53c470a0186839de53b9563c960a5ac1b2eb2d15f36`
- **Tamaño:** 90,164 bytes
- **Flujo:** motor determinista → hallazgos visibles con severidad, columnas afectadas y conteos
- **Qué demuestra:** El motor determinista detecta issues reproducibles (nulls, outliers, ghost spaces).
- **Qué no demuestra:** No demuestra que todos los hallazgos sean verdaderos positivos. No es inferencia LLM.
- **Pie de figura:** "Hallazgos del motor determinista de AURA sobre Titanic: issues con severidad, columnas afectadas y conteos. Reproducible sin LLM."

### 03 — diagnosis_evidence_contract.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/03_diagnosis_evidence_contract.png`
- **Dataset:** titanic.csv
- **SHA-256:** `86076fb76a7cd2507392f1d684524a4fe70c6e13413af09c7e10b5a30ad0f864`
- **Tamaño:** 498,356 bytes
- **Flujo:** inyección de DiagnosisExecutionResult vía harness determinista (`buildPhase4TitanicFixture`) → visualización del contrato de diagnóstico
- **Qué demuestra:** La capa cognitiva recibe evidencia estructurada y restringida. El LLM opera sobre un contrato de diagnóstico con límites explícitos.
- **Qué no demuestra:** No demuestra inferencia LLM real (se usa harness determinista). El harness sustituye al LLM para reproducibilidad.
- **Pie de figura:** "Contrato de diagnóstico v2. Evidencia estructurada enviada a la capa cognitiva. El LLM opera restringido por el contrato de evidencia."

### 04 — remediation_plan_hitl.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/04_remediation_plan_hitl.png`
- **Dataset:** titanic.csv
- **SHA-256:** `1130898a716a65e6226ab8ffe514ebea370d6638581516d1730a291260950ba3`
- **Tamaño:** 134,234 bytes
- **Flujo:** inyección de plan vía harness → construcción con `buildRemediationPlanV2` → HITL (1 aprobada, 1 rechazada)
- **Qué demuestra:** AURA separa diagnóstico (LLM) de decisión de remediación (humana). Las acciones se aprueban y rechazan individualmente.
- **Qué no demuestra:** No demuestra ejecución de transformaciones. El script no se ha generado aún.
- **Pie de figura:** "Plan de remediación determinista v2 con decisión humana (HITL). Una acción aprobada, otra rechazada. La decisión humana es explícita y trazable."

### 05 — script_contract_valid.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/05_script_contract_valid.png`
- **Dataset:** titanic.csv
- **SHA-256:** `0159c9bdbdb63180a541832d97a01c33bc9ecbc6e22384ed3c5718ffa783cee2`
- **Tamaño:** 126,185 bytes
- **Flujo:** contrato generado vía `buildScriptCandidateV2 → validate → finalize → verify` en navegador
- **Qué demuestra:** AURA genera un ScriptContractV2 validado con hash, partición HITL y verificación fresca.
- **Qué no demuestra:** No demuestra ejecución Python. No demuestra mejora del dataset.
- **Pie de figura:** "ScriptContractV2 válido generado en el navegador. Hash, partición accepted/rejected/excluded y verificación fresca completada."

### 06 — script_rendered_code.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/06_script_rendered_code.png`
- **Dataset:** titanic.csv
- **SHA-256:** `07712e8b21271c78d76f244d2bca11a3f1ca405fdf3dd6567939ed410a5c4e7a`
- **Tamaño:** 126,193 bytes
- **Flujo:** script Python/Pandas renderizado desde el contrato vía renderer determinista
- **Qué demuestra:** El código es determinista: deriva exclusivamente de las acciones aprobadas. Contiene `def clean_dataset` y usa Pandas.
- **Qué no demuestra:** No demuestra que el script haya sido ejecutado. El código proviene del renderer determinista.
- **Pie de figura:** "Código Python/Pandas generado determinísticamente desde las acciones aprobadas. Contiene `def clean_dataset(df)` y transformaciones de las acciones HITL aceptadas."

### 07 — human_review_readonly.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/07_human_review_readonly.png`
- **Dataset:** titanic.csv
- **SHA-256:** `197c48b2f4acee3817af676f0a2a0de9daf1210108ae651fb9c84bf4cc3333e6`
- **Tamaño:** 123,146 bytes
- **Flujo:** navegación real a ReviewStep vía botón "Continuar a revisión" → revisión read-only
- **Qué demuestra:** La revisión humana se realiza en modo read-only. Sin edición del código. Sin ejecución ni simulación.
- **Qué no demuestra:** No demuestra que el resultado de la revisión mejore el dataset.
- **Pie de figura:** "Revisión humana read-only del contrato de script. El código no es editable. Sin ejecución ni simulación."

### 08 — human_approved_contract.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/08_human_approved_contract.png`
- **Dataset:** titanic.csv
- **SHA-256:** `4fe9b511eaec24faf926b6720861fa229a29eaf76198709e170a398dead45624`
- **Tamaño:** 118,651 bytes
- **Flujo:** revisión → scroll → click "Aprobar script" → fresh verification → aprobación visible
- **Qué demuestra:** El ciclo contractual se completa con aprobación humana. La verificación fresca pasa antes de aprobar. Sin HealthDelta.
- **Qué no demuestra:** No demuestra ejecución del script. No calcula mejora del dataset.
- **Pie de figura:** "Contrato aprobado por revisión humana. Verificación fresca completada. Preparar exportación disponible. Sin simulación."

### 09 — tampered_contract_blocked.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/09_tampered_contract_blocked.png`
- **Dataset:** titanic.csv
- **SHA-256:** `5791015e21c7d26a259bdca53808d355669e153cf1980a44c26dc803856fa012`
- **Tamaño:** 120,614 bytes
- **Flujo:** contrato válido → alteración de scriptHash vía `__PHASE4_TAMPER_CONTRACT__` → intento de aprobación bloqueado
- **Qué demuestra:** El sistema detecta contratos manipulados y bloquea la aprobación. Fail-closed efectivo.
- **Qué no demuestra:** No demuestra seguridad absoluta del sistema. No demuestra todas las formas de tampering.
- **Pie de figura:** "Intento de aprobación de contrato con hash manipulado. AURA bloquea la aprobación. El sistema es fail-closed ante manipulación contractual."

### 10 — phase5_boundary_next_step.png

- **Ruta:** `docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad/10_phase5_boundary_next_step.png`
- **Dataset:** titanic.csv
- **SHA-256:** `456db645c3b6dc234563a8edff72b4605d64ff1426d792c71f81bc855b1c0ac5`
- **Tamaño:** 121,790 bytes
- **Flujo:** contrato aprobado → clic en "Preparar exportación" → paso de exportación/resumen
- **Qué demuestra:** La frontera metodológica de la Entrega 3. El contrato está aprobado pero no ejecutado. Phase 5 (ejecución, reauditoría y HealthDelta) queda pendiente.
- **Qué no demuestra:** No demuestra Phase 5 implementada. No hay ejecución Python ni cálculo de mejora.
- **Pie de figura:** "Frontera Phase 5. El contrato está aprobado y listo para exportación. La ejecución, reauditoría y HealthDelta corresponden a la siguiente fase."
