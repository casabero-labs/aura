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

**Phase 5 — Cierre y Freeze.**

Con L0-L6 cerrados y 158 tests pasando, Phase 5 está funcionalmente completo. El cierre debe:

- Freezear Phase 5 como cerrada.
- Preparar documentación de uso del flujo `runImprovementFlow`.
- Validar `ImprovementRunV1` contra schema JSON formal.
- Iniciar Phase 6 (UI wrapper y dashboard de health delta) con base en Phase 5 freezed.

### Loops cerrados (Phase 5)

| Loop | SHA | Descripción |
|---|---|---|
| L0 | `096f96d` | Decisión de runtime (Colab formal + Pyodide stretch) |
| L1 | `9be3f68` | Preflight verifier (17 tests) |
| L2 | `7fdbd89` | Runtime sandbox mínimo (42 tests) |
| L3 | `eefe9c5` | Generación notebook Colab + pipeline controlado (17 tests) |
| L4 | `8327f6a` | Reauditoría post-ejecución, ReauditSummaryV1 (39 tests) |
| L5 | `c8f1d46` | HealthDelta + ImprovementRunV1 completo (25 tests) |
| L6 | este commit | E2E tests + CLI wrapper + type guards + JSON export (18 tests) |

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

Permitido en estado actual (Phase 5 L0-L6 completos):

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
