# Next steps — AURA

## Estado

**Phase 3 cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.** No modificar su evidencia.

**Phase 4 cerrada y congelada en `aa167995316962a70ff41a3970326d4824d980c0`.** Evidencia E2E completa: 8/8 escenarios contractuales demostrados en navegador. Freeze final: `05878e4a960afd11d564a60f4924bfb8f0b527e7`.

**Phase 5 Loop 0 completado.** Decisión de runtime documentada en `05_desarrollo/phases/phase_05/LOOP0_RUNTIME_DECISION.md`.

**Entrega 3 consolidada hasta Phase 4.** Documento principal: `01_borrador/TERCERA_ENTREGA_AURA_CONSOLIDADA.md`.

## Phase 4 — Resumen final

Pipeline contractual completo:

```text
RemediationPlanV2 → HITL → buildScriptCandidateV2 → validateScriptCandidateV2
→ finalizeScriptContractV2 (hash + syntax) → verifyScriptContractV2
→ revisión humana read-only → aprobación sin ejecución
```

| Métrica | Resultado |
|---|---|
| Tests unitarios | 1116 passed, 6 skipped |
| E2E | 8/8 en dos corridas consecutivas |
| Typecheck | 0 errores |
| Build | ~3s |
| Contracts v2 | 3/3 PASS |
| Capturas | 6 screenshots |
| Python | No ejecutado |
| HealthDelta | No calculado |

## Experimentos pre-Phase 5 (externos, no formales)

Los siguientes experimentos se ejecutaron fuera del pipeline formal de Phase 5 como validación de concepto. No constituyen evidencia de cierre de fase:

- `colabExporter.ts`: exportación de notebooks `.ipynb` (implementado y testeado).
- `run_colab_delta_fixture.mjs`: ejecución Python externa sobre fixture controlado (10 filas).
- Delta fixture: score 65→26, clasificado `source_debt_preserved`.
- Protocolo de validación Colab real documentado en `PROTOCOLO_VALIDACION_COLAB_REAL.md` (pendiente de ejecución manual).

## Phase 5 — Decisión de runtime (Loop 0)

**Decisión: estrategia híbrida.** Runtime primario: Colab notebook exportable. Runtime secundario (stretch goal): Pyodide como feature flag.

Documento completo: `05_desarrollo/phases/phase_05/LOOP0_RUNTIME_DECISION.md`.

## Regla

No iniciar implementación de Phase 5 hasta que el diseño esté completo y aprobado. Phase 5 ejecutará el script generado contra copia de datos, calculará HealthDelta y medirá mejora.

## Próximo paso permitido

**Phase 8 — Continuación técnica y recopilación de evidencia.**

Objetivo: continuar el desarrollo técnico y la recopilación de evidencia hasta que el usuario ordene explícitamente iniciar la cuarta entrega documental. No preparar todavía la cuarta entrega.

Constraints Phase 7:
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
- Visual testability harness (query param `?phase7Visual=`) permitido para captura de estados visuales transitorios (running, error).

### Loops completados (Phase 6 — congelada)

Phase 6 congelada en SHA `b689cce5012edf33d27e2e85bb325878ab79125a`. Freeze: `docs/.../phase_06/FREEZE_PHASE6.md`.

### Loops cerrados (Phase 6)

| Loop | SHA | Descripción |
|---|---|---|
| L0 | `b94ee00` | Diseño — PHASE6_UI_WRAPPER_DESIGN.md |
| L1 | `e612b71` | ImprovementRunPanel + wrapper React (2 tests) |
| L2 | `06d4fd9` | HealthDeltaDashboard + integración en Panel (21 tests) |
| L3 | `9a8e884` | ImprovementRunExportCard + ExecutionLogsPanel + integración Panel (31 tests) |
| L4 | `ad38bd4` | Estados visuales completos idle/running/done/error (2 tests) |
| L5 | `d07b035` | Integración con rutas — ImprovementRunPage + nav "Health Delta" (2 tests) |
| L6 | `b689cce` | Freeze Phase 6 — FREEZE_PHASE6.md + micro-fix nav Auditoria |

No ejecuta Python — siempre delega a Colab.

## Phase 7 — Production Readiness (activa)

**Phase 6 cerrada y congelada en `b689cce5012edf33d27e2e85bb325878ab79125a`.** Freeze: `docs/.../phase_06/FREEZE_PHASE6.md`.

**Phase 7 activa desde Loop 0.** Objetivo: cerrar la brecha entre "demo académica controlada" y "preparación para producción controlada".

Entregables Phase 7 L0:
- `05_desarrollo/phases/phase_07/PHASE7_PRODUCTION_READINESS_PLAN.md`
- `05_desarrollo/phases/phase_07/E2E_CONTRACT_PHASE7.md` (43 escenarios)

Cambio de enfoque:
- De demo académica controlada → preparación para producción controlada.
- De tests unitarios → evidencia E2E en navegador real.
- De claims documentados → claims verificables visualmente por stakeholder.
- De riesgos implícitos → riesgos explícitos con matriz de decisión.

### Loops planificados (Phase 7)

| Loop | Objetivo | Entregable |
|---|---|---|
| **L0** | Production readiness plan + E2E contract | `PHASE7_PRODUCTION_READINESS_PLAN.md` + `E2E_CONTRACT_PHASE7.md` |
| **L1** | E2E harness / visual QA scaffold | `phase7-nav-smoke.spec.ts` (8 tests) + bug fix `goAudit()` |
| **L2** | Capturas de evidencia visual | Screenshots de idle/done (flujo real) + running/error (visual harness) |
| L2B | Corrección running + error | Visual harness opt-in `?phase7Visual=` en ImprovementRunPanel |
| L3 | Verificación de claims en UI | Tests que validan presencia/ausencia de claims específicos |
| L4 | No-regresión suite | Tests que verifican MainPipeline, BenchmarkLab, Settings intactos |
| L5 | Documentación de entrega | Consolidación de evidencia Phase 7 para stakeholder |
| L6 | Freeze Phase 7 | FREEZE_PHASE7.md + cierre formal |

### Loops cerrados (Phase 7)

| Loop | SHA | Descripción |
|---|---|---|
| L0 | `648193f` | Production readiness plan + E2E contract |
| L1 | `68e39bd` | E2E scaffold: 8 smoke tests navegación + bug fix `goAudit()` en App.tsx |
| L2 | `202e941` | Capturas de evidencia visual: 7 screenshots (idle/done/mobile real, running+error deficientes) |
| L2B | `a651a36` | Corrección running+error: visual harness opt-in `?phase7Visual=` en ImprovementRunPanel |
| L3 | `5c131d3` | Claims visible E2E: 17/17 tests + notices added to DoneState/ErrorState |
| L4 | `6a86a79` | No-regression suite: 4/4 E2E tests + goSettings() bug fix |
| L5 | `35e5c47` | Consolidación documental: CONSOLIDACION_EVIDENCIA_PHASE7_CUARTA_ENTREGA.md |
| L6 | `58891c2` | Freeze Phase 7: FREEZE_PHASE7.md + placeholders corregidos |

### Loops cerrados (Phase 5)

| Loop | SHA | Descripción |
|---|---|---|
| L0 | `096f96d` | Decisión de runtime (Colab formal + Pyodide stretch) |
| L1 | `9be3f68` | Preflight verifier (17 tests) |
| L2 | `7fdbd89` | Runtime sandbox mínimo (42 tests) |
| L3 | `eefe9c5` | Generación notebook Colab + pipeline controlado (17 tests) |
| L4 | `8327f6a` | Reauditoría post-ejecución, ReauditSummaryV1 (39 tests) |
| L5 | `c8f1d46` | HealthDelta + ImprovementRunV1 completo (25 tests) |
| L6 | `8bc0ce0` | E2E tests + CLI wrapper + type guards + JSON export (18 tests) |
| Freeze | `40a3769` | Phase 5 cerrada y congelada |

Documentación preparada:
- `05_desarrollo/phases/phase_05/PHASE5_DESIGN.md`
- `05_desarrollo/phases/phase_05/IMPROVEMENT_RUN_CONTRACT.md`
- `05_desarrollo/phases/phase_05/PLAN_LOOPS_PHASE5.md`
- `05_desarrollo/phases/phase_05/LOOP0_RUNTIME_DECISION.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP1_PREFLIGHT.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP2_RUNTIME_SANDBOX.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP3_EXECUTION_COPY.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP4_REAUDIT.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP5_IMPROVEMENT_RUN.md`
- `05_desarrollo/phases/phase_05/CIERRE_LOOP6_E2E_WRAPPER.md`
- `05_desarrollo/phases/phase_05/FREEZE_PHASE5.md`

## Loops cerrados (Phase 4)

| Loop | SHA | Descripción |
|---|---|---|
| L1-L5 | Loops 1-5 | Contratos, renderer, builder, validator, UI |
| L5R | `7ad83d1` | Reparación integración |
| L5R.1 | `00e2e88` | Propagación plan |
| L5R.2 | `5af5d0c` | Restauración sesión |
| L6 | `aa16799` | Evidencia E2E (8 escenarios) |
| Freeze final | `05878e4` | Phase 4 cerrada y congelada |

## Claims de frontera

### Permitido en estado actual (Phase 5 L0-L6 + Phase 6 L0-L6 completos):

- Contrato de script generado, validado y firmado (L1).
- Hash contractual verificable (L1).
- Revisión humana read-only (L1).
- Bloqueo ante manipulación de hash, fingerprint y coherencia HITL (L1).
- Runtime sandbox: network, filesystem, imports validados (L2).
- AURA exporta notebooks Colab reproducibles con trazabilidad del script aprobado (L3).
- Colab notebook generado con privacidad y instrucciones de ejecución manual (L3).
- Reauditoría antes/después con `runAudit` de AURA sobre fixture controlado (L4).
- `ReauditSummaryV1` con before/after evidence refs e issue counts (L4).
- `HealthDeltaV1` calculado sobre fixture controlado usando `runAudit` de AURA (L5).
- `ImprovementRunV1` completo con ejecución, reaudit, delta, limitaciones y claims (L5).
- Mejora medida solo en fixture controlado si `HealthDeltaV1.status === 'improved'` (L5).
- Status `inconclusive` cuando score e issues se contradicen (L5 corregido en L6).
- Type guards `isHealthDeltaV1()` e `isImprovementRunV1()` (L6).
- Export JSON de `ImprovementRunV1` validado (L6).
- CLI wrapper para invocar `runImprovementFlow` (L6).

No permitido todavía:

- Ejecución Python real dentro de AURA (siempre external a Colab).
- Dataset corregido por pipeline formal de Phase 5 (solo fixture controlado).
- HealthDelta como medición formal externa (usa runAudit de AURA).
- Mejora formal sobre dataset real (solo fixture controlado).
- Validación externa independiente (mismo motor runAudit, reproducible pero no externa).
- Benchmark formal de utilidad.
- `improved` como claim sin caveats del contexto real.

Permitido en Phase 6 (UI wrapper):
- UI wrapper que invoca `runImprovementFlow` de Phase 5.
- Visualización de `HealthDeltaV1` sobre fixture controlado.
- Export de `ImprovementRunV1` como JSON.
- Logs de orquestación de AURA visibles.
- Navegación "Health Delta" integrada en AURA.
- `improvementRun` serializado en session storage.

No permitido en Phase 6:
- No afirma dataset real o validación externa independiente.
- No afirma que HealthDelta sea validación formal externa.
- No afirma mejora sobre datos productivos.
- No afirma benchmark formal de utilidad.
- No ejecuta Python dentro de AURA.
- No usa datasets de usuarios.

Decisiones Phase 7 L0:
- Health Delta se mantiene como workspace aislado (no integrado al pipeline principal).
- `ImprovementRunV1` se mantiene en session storage (no estado global).
- Navegación URL-based queda como requisito post-Phase 7.
- Modo demo vs producción queda documentado pero no implementado.
- Manejo de datasets reales queda planificado pero no implementado (Phase 8+).
- Contrato E2E formal establecido (43 escenarios en `E2E_CONTRACT_PHASE7.md`).
