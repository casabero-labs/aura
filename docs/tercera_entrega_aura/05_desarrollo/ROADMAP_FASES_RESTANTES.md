# Roadmap restante del TFM AURA

> **Actualizado:** 2026-07-01 — Phase 5 Loop 0

## Estado actual

| Fase | Estado | Último SHA |
|---|---|---|
| Phase 1: EvidenceEnvelopeV2 | Cerrada | código y tests |
| Phase 2: DiagnosisResponseV2 | Cerrada | código y tests |
| Phase 3: RemediationPlanV2 + HITL | Congelada | `d3774dd5ac98d89ca4454c693b1b0a30856cd191` |
| Phase 4: ScriptContractV2 + renderer | Cerrada y congelada | `05878e4a960afd11d564a60f4924bfb8f0b527e7` |
| Phase 5 Loop 0: Decisión de runtime | **Completado** | este commit |
| Phase 5 Loop 1: Preflight verifier | **Siguiente** | pendiente |
| Phase 5 Loop 2-8: Ejecución, reauditoría, HealthDelta, cierre | Pendiente | — |
| Phase 6: Experimento y memoria final | Pendiente | — |

## Phase 5 — Loops pendientes

| Loop | Nombre | Objetivo |
|---|---|---|
| L1 | Preflight verifier | Validar contrato aprobado antes de ejecutar |
| L2 | Runtime sandbox mínimo | Ejecutar fixture controlado sin dataset real |
| L3 | Ejecución de `clean_dataset` | Ejecutar función aprobada sobre copia |
| L4 | Reauditoría post-ejecución | EvidenceEnvelopeV2 sobre dataset limpio |
| L5 | HealthDelta | Calcular delta de issues/salud |
| L6 | Exportación | CSV limpio + reporte |
| L7 | E2E + capturas | Evidenciar flujo completo |
| L8 | Cierre Phase 5 | Congelar evidencia |

## Runtime decidido

**Híbrido: Colab formal inmediato + Pyodide experimental como stretch goal.**

Ver `docs/tercera_entrega_aura/05_desarrollo/phases/phase_05/LOOP0_RUNTIME_DECISION.md` para detalles completos.

## Phase 6 — Trabajo futuro

- Experimento formal con datasets diversos
- Benchmark LLM multi-modelo
- Memoria académica final
- Publicación de resultados
