# Plan de loops — Phase 5

> **Estado:** planificación preparada, ejecución pendiente  
> **Regla:** no ejecutar scripts generados hasta aprobar el diseño de runtime y sandbox.

## Objetivo de Phase 5

Ejecutar de forma controlada un `ScriptContractV2` aprobado, reauditar el dataset resultante y calcular HealthDelta con evidencia reproducible.

## Loops propuestos

| Loop | Nombre | Objetivo | Entregables | Criterio de cierre |
|---|---|---|---|---|
| L0 | Diseño de runtime y contratos | Definir runtime, sandbox, bloqueos y contrato `ImprovementRunV1` | `PHASE5_DESIGN.md`, `IMPROVEMENT_RUN_CONTRACT.md`, matriz de riesgos | Diseño aprobado, sin ejecución |
| L1 | Verificador pre-ejecución | Validar contrato aprobado, hash, fingerprint y acciones aceptadas | helper de preflight + tests | Fail-closed ante inconsistencias |
| L2 | Runtime sandbox mínimo | Ejecutar fixture controlado sin dataset real del usuario | runtime aislado + tests | Timeout, sin red, sin filesystem libre |
| L3 | Ejecución de `clean_dataset` | Ejecutar solo función aprobada sobre copia | execution summary + logs | Dataset original intacto |
| L4 | Reauditoría post-ejecución | Reusar EvidenceEnvelopeV2 sobre dataset limpio | before/after evidence refs | Auditoría reproducible |
| L5 | HealthDelta | Calcular delta de issues/salud | `HealthDeltaV1` + tests | improved/unchanged/worsened/inconclusive |
| L6 | Exportación | Exportar CSV limpio y reporte | CSV, JSON, manifest | Artefactos trazables |
| L7 | E2E + capturas | Evidenciar flujo completo | capturas, manifest, spec E2E | 2 corridas limpias |
| L8 | Cierre Phase 5 | Congelar evidencia | `CIERRE_PHASE5.md` | claims y límites actualizados |

## Reglas transversales

1. No modificar Phase 3 ni Phase 4 congeladas.
2. No aceptar contratos fabricados manualmente.
3. No ejecutar si `verifyScriptContractV2` falla.
4. No afirmar mejora sin reauditoría.
5. No calcular HealthDelta con datos incompletos.
6. No exponer datos originales fuera del runtime definido.
7. Registrar errores como evidencia, no ocultarlos.

## Primer prompt recomendado

`Phase 5 Loop 0 — Design only`.

Modelo recomendado: DeepSeek Pro V4.

Alcance del prompt:

- revisar Phase 4 cerrada;
- diseñar runtime y sandbox;
- cerrar contrato `ImprovementRunV1`;
- definir pruebas de preflight;
- definir fixtures;
- no implementar ejecución todavía.
