# Loop 6: E2E — Evidencia contractual navegable

**SHA base:** `aa167995316962a70ff41a3970326d4824d980c0`  
**Fecha:** 2026-06-26  
**Estado:** Cerrado

## Objetivo

Demostrar end-to-end en navegador el flujo contractual completo:

```
RemediationPlanV2
→ decisiones HITL
→ ScriptContractCandidateV2
→ validación
→ finalización
→ hash
→ verificación fresca
→ revisión humana read-only
→ aprobación sin ejecución
```

## SHAs supersedidos

| SHA | Motivo |
|---|---|
| `e1b07641` | Evidencia inicial con assertions insuficientes |
| `a55da8b` | Freeze inicial supersedido |
| `47d7d1d` | Harness con BUILD_DIAGNOSIS |
| `92d331c` | Fingerprint sync incorrecto |
| `cef7a2f` | Assertions parciales |
| `8414200` | Freeze intermedio |
| `9e9ce27` | Script comparison no exacta |
| `28f03c9` | Freeze intermedio |
| `c017604` | Freeze previo a reparación final |

## Evidencia vigente

`aa167995316962a70ff41a3970326d4824d980c0`

## 8 escenarios E2E

| Escenario | Nombre | Assertiones clave |
|---|---|---|
| E2E-01 | Plan HITL | planId preservado, aprobar/rechazar/pending visibles |
| E2E-02 | Contrato válido | Hash 64 hex, syntax not_run, sin Seguro/safetyScore |
| E2E-03 | Partición exacta | accepted/rejected/excluded testid, suma = plan.length |
| E2E-04 | Script determinista | Líneas vía .script-line code, comparación exacta con expectedContract |
| E2E-05 | Revisión + aprobación | Navegación real, pageErrors vacío, aprobación visible |
| E2E-06 | Hash manipulado | Bloqueo, .provider-error-notice, sin aprobación |
| E2E-07 | Invalidación HITL | Volver al plan, planId preservado, oldHash ≠ newHash |
| E2E-08 | Contrato no-op | accepted=0 testid, script exacto, df.copy(), return df_clean |

## Resultados E2E

| Corrida | Resultado |
|---|---|
| 1 | 8 passed (13.6s) |
| 2 | 8 passed (13.2s) |

Ambas con servidor fresco (`CI=1`).

## Capturas

| Captura | Archivo |
|---|---|
| 07 | `07_phase4_remediation_hitl.png` |
| 08 | `08_phase4_script_contract_valid.png` |
| 09 | `09_phase4_script_contract_code.png` |
| 10 | `10_phase4_script_review_readonly.png` |
| 11 | `11_phase4_script_approved_hitl.png` |
| 12 | `12_phase4_tampered_contract_blocked.png` |

## Límites

- Las capturas se tomaron con Chromium headless.
- El fingerprint runtime se obtiene de `auditEvidence.datasetFingerprint` tras cargar el dataset.
- El fixture se construye con `buildPhase4TitanicFixture(runtimeFingerprint)`.
- No se inyectaron contratos fabricados. Todo el pipeline contractual se ejecutó en el navegador.

## No ejecución

- Python no ejecutado.
- HealthDelta no calculado.
- Phase 3 no modificada.
- Transformaciones no aplicadas.
