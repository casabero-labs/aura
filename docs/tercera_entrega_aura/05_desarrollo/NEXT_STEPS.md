# Next steps — AURA

## Estado

**Phase 3 cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.** No modificar su evidencia.

**Phase 4 cerrada y congelada en `aa167995316962a70ff41a3970326d4824d980c0`.** Evidencia E2E completa: 8/8 escenarios contractuales demostrados en navegador.

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

## Regla

No iniciar implementación de Phase 5 hasta que el diseño esté completo y aprobado. Phase 5 ejecutará el script generado contra copia de datos, calculará HealthDelta y medirá mejora.

## Próximo paso permitido

**Phase 5 Loop 0 — Design only.**

Objetivo: diseñar runtime, sandbox, contratos, fixtures y plan de pruebas. No ejecutar scripts generados.

Documentación preparada:

- `05_desarrollo/phases/phase_05/PHASE5_DESIGN.md`
- `05_desarrollo/phases/phase_05/IMPROVEMENT_RUN_CONTRACT.md`
- `05_desarrollo/phases/phase_05/PLAN_LOOPS_PHASE5.md`

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

Permitido en Entrega 3:

- contrato de script generado y validado;
- hash contractual verificable;
- revisión humana read-only;
- bloqueo ante manipulación;
- no ejecución en Phase 4.

No permitido todavía:

- ejecución Python real;
- dataset corregido;
- HealthDelta real;
- mejora medida.