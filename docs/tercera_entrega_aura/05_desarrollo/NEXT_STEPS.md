# Next steps — AURA

## Estado

**Phase 3 cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.** No modificar su evidencia.

**Phase 4 cerrada y congelada en `05878e4a960afd11d564a60f4924bfb8f0b527e7`.** Evidencia E2E completa: 8/8 escenarios contractuales demostrados en navegador.

**Phase 5 cerrada y congelada en `40a376929fcaad13b1809bd0c8ba895011ceb8cb`.** Servicios de ejecución, reauditoría y health delta congelados. Freeze: `FREEZE_PHASE5.md`.

**Phase 6 cerrada y congelada en `b689cce5012edf33d27e2e85bb325878ab79125a`.** UI wrapper React congelado. Freeze: `FREEZE_PHASE6.md`.

**Phase 7 cerrada y congelada en `58891c215604d7a140774370d133ce06460691d5`.** Production Readiness QA + Evidence Capture congelado. Freeze: `FREEZE_PHASE7.md`.

**El siguiente frente es Phase 8 técnico.** La cuarta entrega documental queda en espera hasta instrucción explícita del usuario.

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

**Phase 8 L2 — Controlled Dataset Protocol**

Definir el dataset controlado ampliado (sin PII, con ground truth documentado) que se usará en L3 (Controlled Pilot Run). Continuar fortaleciendo AURA como producto técnico controlado. La cuarta entrega NO debe prepararse todavía. Solo se iniciará cuando el usuario lo solicite explícitamente.

### Reglas operativas Phase 8

- Trabajar en main.
- No crear ramas.
- No abrir PR.
- No modificar Phase 3, Phase 4, Phase 5, Phase 6 ni Phase 7 salvo micro-fix documental autorizado.
- No tocar `FREEZE_PHASE5.md`, `FREEZE_PHASE6.md` ni `FREEZE_PHASE7.md`.
- No modificar contratos v2.
- No afirmar production-ready.
- No afirmar mejora sobre dataset real si no existe protocolo y evidencia.
- No ejecutar Python dentro de AURA.
- Python sigue siendo externo/delegado (Colab notebook).
- No usar datos personales reales.
- No depender de Chrome AI / Gemini Nano real en E2E estándar.
- No descargar modelos en CI.
- No preparar cuarta entrega.

### Regla E2E Chrome AI / Gemini Nano

Los E2E estándar no deben depender de Gemini Nano real ni descargar modelos. Si se requiere validar Chrome AI real, crear un spec opt-in separado usando Google Chrome real con perfil persistente dedicado. No usar el perfil personal del usuario ni ejecutar estos tests en CI normal.

### Claims permitidos durante Phase 8

- AURA cuenta con fases congeladas de mejora controlada (Phase 5), UI HealthDelta (Phase 6) y QA E2E (Phase 7).
- Phase 8 busca ampliar evidencia técnica.
- Los datasets usados deben ser controlados, sintéticos o públicos sin PII.
- Las corridas con proveedores reales deben clasificarse según evidencia.
- Los resultados preliminares no equivalen a producción final.

### Claims prohibidos durante Phase 8

- No decir que AURA está production-ready.
- No decir que AURA corrigió datasets reales.
- No decir que AURA ejecuta Python internamente.
- No decir que Chrome AI / Gemini Nano siempre está disponible.
- No decir que existe benchmark formal definitivo si no hay protocolo, repeticiones y resultados exportados.
- No decir que hay validación externa independiente.
- No decir que la cuarta entrega ya está en construcción.

---

## Phase 8 — Objetivo general

Phase 8 no busca escribir la cuarta entrega. Busca ampliar evidencia técnica posterior al freeze de Phase 7. El foco será validar AURA bajo escenarios más cercanos al uso real, sin romper las fronteras ya congeladas: no afirmar producción final, no ejecutar Python dentro de AURA, no usar datasets reales sin protocolo, no depender de proveedores reales en E2E estándar y no modificar fases congeladas.

### Roadmap completo de Phase 8

| Loop | Nombre | Objetivo | Evidencia esperada | Estado |
|---|---|---|---|---|
| L0 | Phase 8 Plan + Evidence Ledger | Definir alcance, riesgos, dataset protocol y matriz de evidencia | `PHASE8_PLAN.md`, `PHASE8_EVIDENCE_LEDGER.md` | Completado |
| L1 | Demo/Prod Boundary Hardening | Blindar visual harness y separar modo demo/evidencia de modo normal | tests, documentación de flags, no-regression | Completado |
| L2 | Controlled Dataset Protocol | Definir dataset controlado ampliado, sin PII, con ground truth documentado | dataset protocol, schema, ground truth, claims | Pendiente |
| L3 | Controlled Pilot Run | Ejecutar flujo completo sobre dataset controlado ampliado | audit JSON, issues CSV, script, notebook, improvement run JSON | Pendiente |
| L4 | Provider Validation Opt-in | Validar proveedores reales solo en modo opt-in, separados de CI | Chrome AI / Ollama / cloud diagnostics, no CI dependency | Pendiente |
| L5 | Benchmark Evidence Classification | Clasificar corridas como `attempted_failed`, `preliminary_valid` o `formal_valid` | benchmark JSON, tabla comparativa, limitaciones | Pendiente |
| L6 | Evidence Package Export | Consolidar artefactos exportables para futura entrega | paquete de evidencia Phase 8 | Pendiente |
| L7 | Freeze Phase 8 | Congelar Phase 8 si la evidencia queda completa | `FREEZE_PHASE8.md` | Pendiente |

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

## Phase 7 — Production Readiness (cerrada y congelada)

**Phase 7 cerrada y congelada en `58891c215604d7a140774370d133ce06460691d5`.** Freeze: `docs/.../phase_07/FREEZE_PHASE7.md`.

Objetivo cumplido: cerrar la brecha entre "demo académica controlada" y "preparación para producción controlada".

Entregables Phase 7:
- `PHASE7_PRODUCTION_READINESS_PLAN.md` + `E2E_CONTRACT_PHASE7.md` (43 escenarios)
- `phase7-nav-smoke.spec.ts` (8 tests navegación E2E)
- 7 screenshots Health Delta (idle, running, done, error, mobile)
- `phase7-claims-visible.spec.ts` (17 tests claims verificados)
- `phase7-no-regression.spec.ts` (4 tests no-regresión)
- `CONSOLIDACION_EVIDENCIA_PHASE7_CUARTA_ENTREGA.md`
- `FREEZE_PHASE7.md`

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
