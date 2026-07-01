# Phase 7 — Production Readiness Plan

> **Estado:** activa (Loop 0 — plan documental)
> **Fecha:** 2026-07-01
> **Base:** Phase 6 freeze (`b689cce5012edf33d27e2e85bb325878ab79125a`)
> **Micro-fix previo:** `ea17491d6d6d9a86c33f90fccbd953e192728b0d` (fix placeholder SHA en FREEZE_PHASE6.md)

---

## 1. Propósito de Phase 7

Phase 7 tiene un solo objetivo: **cerrar la brecha entre "demo académica controlada" y "preparación para producción controlada"**.

No significa que AURA esté lista para producción real. Significa que AURA tendrá:

- Evidencia capturable de todos los estados visuales y flujos.
- Un contrato E2E formal que guíe QA en navegador real.
- Riesgos productivos identificados y documentados.
- Decisiones de arquitectura resueltas antes de aceptar datasets reales.
- Un camino claro hacia producción futura sin romper claims existentes.

---

## 2. Cambio de enfoque

| Antes (Phase 5–6) | Ahora (Phase 7) |
|---|---|
| Demo académica controlada | Preparación para producción controlada |
| Tests unitarios y de integración | Evidencia E2E en navegador real |
| Claims documentados en código | Claims verificables visualmente por stakeholder |
| Arquitectura funcional | Arquitectura evaluada para producción |
| Riesgos implícitos | Riesgos explícitos con matriz de decisión |
| Sin contrato E2E formal | Contrato E2E formal como guía de QA |

---

## 3. Arquitectura actual heredada

### 3.1 Phase 5 — Motor congelado

SHA: `40a376929fcaad13b1809bd0c8ba895011ceb8cb`

Servicios de ejecución, reauditoría y health delta. No se modifica.

```
preflightCheck → runtimeSandbox → colabExporter
                                      ↓
                                executeControlledRun
                                      ↓
                         importColabOutput → runReaudit
                                      ↓
                        computeHealthDelta → buildImprovementRunV1
                                      ↓
                           exportImprovementRunJSON
```

### 3.2 Phase 6 — UI wrapper congelado

SHA: `b689cce5012edf33d27e2e85bb325878ab79125a`

Componentes React que consumen Phase 5 como black box. No se modifica.

```
ImprovementRunPage
  └── ImprovementRunPanel (idle/running/done/error)
        ├── HealthDeltaDashboard (score bar, status, caveats)
        ├── ExecutionLogsPanel (logs, runtime badge, expand/collapse)
        └── ImprovementRunExportCard (download/copy JSON)
```

### 3.3 Health Delta — Workspace aislado

- No comparte estado con `MainPipeline` ni `BenchmarkLab`.
- `improvementRun` se serializa en session storage del navegador.
- Navegación "Health Delta" en sidebar — ruta lógica sin URL propia.
- Back desde Health Delta vuelve a Auditoría.

---

## 4. Riesgos productivos actuales

| Riesgo | Severidad | Descripción | Mitigación Phase 7 |
|---|---|---|---|
| R1 — Confusión de claims | **Alta** | Stakeholder puede interpretar HealthDelta como validación productiva. | E2E verifica que todos los avisos de fixture controlado y no-Python son visibles. |
| R2 — Sin validación externa | **Alta** | El mismo motor `runAudit` mide before y after. No es independiente. | Documentado explícitamente. E2E verifica que no aparece claim de validación externa. |
| R3 — Fixture-only | **Alta** | Todo el flujo usa fixtures hardcodeados (3 filas). Dataset real nunca fue tocado. | Matriz de claims define qué está permitido en cada modo. |
| R4 — Sin persistencia formal | **Media** | `ImprovementRunV1` no persiste en BD ni pipeline principal. Solo session storage. | Decisión pendiente (ver sección 6.2). |
| R5 — Sin navegación URL-based | **Media** | Health Delta no tiene ruta URL. No es bookmarkeable ni shareable. | Decisión pendiente (ver sección 6.3). |
| R6 — Sin modo demo vs producción | **Media** | No hay distinción de entorno. Un usuario podría interpretar el fixture como dataset real. | Decisión pendiente (ver sección 6.4). |
| R7 — Sin integración de dataset real | **Alta** | No existe path para que un dataset real entre al pipeline sin romper la frontera de claims. | Decisión pendiente (ver sección 6.5). |
| R8 — Sin cobertura E2E | **Media** | No existen tests E2E en navegador real para el flujo completo de Health Delta. | Phase 7 L1: E2E harness. |
| R9 — Regresión no monitoreada | **Baja** | No hay suite que verifique que MainPipeline, BenchmarkLab y Settings no se rompen al tocar Health Delta. | E2E contract incluye escenarios de no regresión. |

---

## 5. Requisitos mínimos para considerar AURA "production-ready"

Una vez que Phase 7 esté cerrada, AURA cumplirá estos requisitos:

- [x] Arquitectura de capas documentada (Phase 5 services + Phase 6 UI).
- [x] Contratos v2 firmados y verificables.
- [x] Pipeline de mejora funcional sobre fixtures (Phase 5).
- [x] UI wrapper con estados visuales completos (Phase 6).
- [ ] Contrato E2E formal documentado (Phase 7 L0 — este loop).
- [ ] Suite E2E ejecutable en navegador real (Phase 7 L1+).
- [ ] Evidencia visual capturable de todos los estados (Phase 7 L1+).
- [ ] Claims verificables visualmente por stakeholder no técnico (Phase 7 L1+).
- [ ] Matriz de decisión para producción futura (Phase 7 L0 — este loop).
- [ ] Plan de integración de dataset real sin romper claims (Phase 7 L0 — este loop).

**No es production-ready todavía.** Phase 7 es el camino hacia ese estado.

---

## 6. Decisiones pendientes

### 6.1 ¿Health Delta debe seguir como workspace aislado o integrarse al pipeline principal?

**Estado actual:** workspace aislado. No comparte estado con `MainPipeline`.

**Opción A — Mantener aislado (recomendado para Phase 7):**
- Ventaja: sin riesgo de romper el pipeline principal.
- Ventaja: el contrato de "no modifica datos reales" se mantiene trivialmente.
- Desventaja: el usuario no puede arrastrar un `ImprovementRunV1` al flujo de auditoría.

**Opción B — Integrar al pipeline principal (post-Phase 7):**
- Ventaja: flujo continuo auditoría → mejora → verificación.
- Riesgo: HealthDelta podría confundirse con validación productiva.
- Requiere: `ImprovementRunV1` persistido, URL-based navigation, modo producción explícito.

**Decisión Phase 7:** mantener aislado. Post-Phase 7: evaluar integración cuando exista validación sobre dataset real.

### 6.2 ¿ImprovementRunV1 debe persistirse en session storage o estado global?

**Estado actual:** session storage (per-session, no persiste entre recargas forzadas).

**Opción A — Session storage (recomendado para Phase 7):**
- Ventaja: sin dependencia de backend.
- Ventaja: sin riesgo de leaks entre sesiones.
- Desventaja: no sobrevive a hard refresh.

**Opción B — Estado global (localStorage o Zustand, post-Phase 7):**
- Ventaja: persiste entre recargas.
- Riesgo: requiere invalidación, limpieza, y manejo de stale state.

**Decisión Phase 7:** mantener session storage. Post-Phase 7: migrar a estado global cuando exista modo producción y persistencia en BD.

### 6.3 ¿Debe existir navegación URL-based en el futuro?

**Estado actual:** Health Delta usa `goImprovementRun()` — ruta lógica sin URL.

**Recomendación:** sí, post-Phase 7.
- `/#/health-delta` permitiría bookmarking, sharing y deep linking.
- Requiere: React Router o hash-based routing.
- Bloqueante para: integración con pipeline principal, CI/CD E2E tests.

**Decisión Phase 7:** no implementar. Dejar documentado como requisito post-Phase 7.

### 6.4 ¿Debe existir modo demo vs modo producción?

**Estado actual:** no hay distinción. Todo es modo demo implícito.

**Recomendación:** sí, antes de aceptar dataset real.
- Modo demo: fixtures, avisos visibles, sin persistencia.
- Modo producción: dataset real, validación adicional, persistencia en BD, claims restringidos.

**Decisión Phase 7:** documentar la necesidad pero no implementar. El contrato E2E incluye verificación de que el modo actual (demo implícito) muestra todos los avisos requeridos.

### 6.5 ¿Cómo se manejarán datasets reales sin romper la frontera de claims?

**Estado actual:** solo fixtures controlados. No hay path para dataset real.

**Plan propuesto (post-Phase 7):**
1. El usuario sube CSV real a AURA (futuro).
2. AURA ejecuta `runAudit` sobre el CSV real → `AuditReport`.
3. AURA genera `ScriptContractV2` + `RemediationPlanV2` basado en ese reporte.
4. El usuario exporta el notebook Colab con el CSV real embebido (NO en AURA).
5. El usuario ejecuta Colab externamente → CSV corregido.
6. El usuario importa el CSV corregido de vuelta a AURA.
7. AURA ejecuta `runReaudit` → `HealthDeltaV1`.
8. `ImprovementRunV1` se construye con `datasetReal = true`, `externalValidation = 'colab_manual'`.

**Frontera de claims mantenida:**
- AURA nunca toca el CSV real durante la ejecución del script.
- La ejecución Python sigue siendo externa (Colab).
- La validación sigue siendo `runAudit` (mismo motor, reproducible, no independiente).
- El claim "no ejecución Python en AURA" se mantiene.

**Decisión Phase 7:** documentar el plan. No implementar. Requiere Phase 8+.

---

## 7. Matriz de claims

| Claim | Permitido en demo (actual) | Permitido en pre-producción | Prohibido hasta validación real |
|---|---|---|---|
| "Controlled fixture" | Sí | Sí | — |
| "Colab external execution" | Sí | Sí | — |
| "No real datasets used" | Sí | Sí (si aplica) | — |
| "Not independent external validation" | Sí | Sí | — |
| "AURA does NOT execute Python" | Sí | Sí | — |
| "Reaudit uses same runAudit engine" | Sí | Sí | — |
| "Score improved on fixture" | Sí | Sí | — |
| "Score improved on real data" | **No** | **No** | Sí (requiere dataset real + validación) |
| "Validación externa independiente" | **No** | **No** | Sí (requiere auditor externo) |
| "Dataset corregido listo para producción" | **No** | **No** | Sí (requiere review humana + dominio) |
| "Benchmark formal de utilidad" | **No** | **No** | Sí (requiere estudio controlado) |
| "Output automáticamente confiable" | **No** | **No** | — (nunca permitido sin review) |

---

## 8. Plan de loops Phase 7

| Loop | Objetivo | Entregable | Tipo |
|---|---|---|---|
| **L0** | Production readiness plan + E2E contract | `PHASE7_PRODUCTION_READINESS_PLAN.md` + `E2E_CONTRACT_PHASE7.md` | Documental |
| **L1** | E2E harness / visual QA scaffold | Configuración Playwright/Cypress + smoke tests de navegación | Código + tests |
| **L2** | Capturas de evidencia visual | Screenshots de idle/running/done/error + HealthDeltaDashboard | Evidencia |
| **L3** | Verificación de claims en UI | Tests que validan presencia/ausencia de claims específicos | Tests E2E |
| **L4** | No-regresión suite | Tests que verifican MainPipeline, BenchmarkLab, Settings intactos | Tests E2E |
| **L5** | Documentación de entrega | Consolidación de evidencia Phase 7 para stakeholder | Documental |
| **L6** | Freeze Phase 7 | FREEZE_PHASE7.md + cierre formal | Documental |

---

## 9. Constraints de Phase 7

- No modificar código fuente Phase 5.
- No modificar componentes Phase 6.
- No modificar contratos v2.
- No tocar `FREEZE_PHASE5.md` ni `FREEZE_PHASE6.md`.
- No tocar Phase 3 ni Phase 4.
- No agregar dependencias.
- No afirmar production-ready todavía.
- No afirmar dataset real.
- No afirmar validación externa independiente.
- Python nunca se ejecuta dentro de AURA.

---

## 10. Próximo loop

**Phase 7 L1 — E2E harness / visual QA scaffold.**

- Configurar herramienta E2E (Playwright o Cypress).
- Implementar smoke tests de navegación según `E2E_CONTRACT_PHASE7.md`.
- Verificar que los avisos de "no Python", "fixture controlado" y "Colab externo" son visibles.
- Capturar primera ronda de screenshots automatizados.
