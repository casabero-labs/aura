# Phase 4 — ScriptContractV2 y Renderer Determinista

> **Estado:** Diseñada — esperando aprobación para implementación
> **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191` (congelada)
> **Documentos de diseño:**
> - `DISENO_SCRIPT_CONTRACT_V2.md` — contrato, invariantes, códigos de error, renderer
> - `PLAN_LOOPS_PHASE4.md` — 6 loops, archivos, tests, métricas, dependencias
> - `DECISIONES.md` — 10 decisiones arquitectónicas
> - `ARQUITECTURA.md` — flujo de datos y capas

## Objetivo

Construir un contrato de script determinista (`ScriptContractV2`) y un renderer que convierta acciones de `RemediationPlanV2` en código Python/Pandas ejecutable, sin intervención del LLM.

## Alcance

- Completar el tipo `ScriptContractV2` con todos los campos necesarios
- Crear resolver de columnas por `columnId` (no por nombre)
- Construir renderer determinista con plantillas por `actionType`
- Construir builder que genere `ScriptContractV2` desde `RemediationPlanV2`
- Construir validador exhaustivo del contrato
- Adaptar ScriptGenerationStep y ReviewStep para contrato v2
- Crear harness E2E y capturas de evidencia

## Fuera de alcance

- Ejecución real del script (Phase 5)
- Pyodide, Colab, reauditoría (Phase 5)
- Delta de salud y mejora del dataset (Phase 5)
- Benchmark comparativo formal (Phase 6)

## Loops de implementación

| Loop | Título | Archivos | Tests |
|---|---|---|---|
| L1 | Base types + column resolver | 3 | 20+ |
| L2 | Renderer determinista | 2 | 15+ |
| L3 | Script contract builder | 2 | 20+ |
| L4 | Script contract validator | 3 | 25+ |
| L5 | UI — Script generation + review | 4 | 10+ |
| L6 | E2E harness + capturas | 3 | 3 E2E |

## Dependencias

```
L1 (types + resolver) → L2 (renderer) → L3 (builder) → L4 (validator) → L5 (UI) → L6 (E2E)
```

## Regla de oro

El LLM no escribe, corrige ni completa código en ningún punto del pipeline.

## Claims que Phase 4 permitirá

- Script determinista generado a partir de plan de remediación validado
- Trazabilidad completa: RemediationPlanV2 → ScriptContractV2 → columnRefs → pythonLiteral
- Hash estable y verificable del script
- Validación de seguridad: sin eval, exec, subprocess, imports no autorizados
- Gobernanza HITL reflejada en el contrato

## Claims que Phase 4 NO permitirá

- NO afirmar ejecución real del script
- NO afirmar mejora del dataset
- NO afirmar que el LLM escribió el código
- NO afirmar benchmark comparativo formal
