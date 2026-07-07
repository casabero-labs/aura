# Phase 4 — ScriptContractV2 y Renderer Determinista

> **Estado:** Diseñada (v2.0.0) — esperando aprobación para implementación
> **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191` (congelada)
> **Documentos de diseño:**
> - `DISENO_SCRIPT_CONTRACT_V2.md` — contrato, invariantes, ScriptBuildContextV2, candidate→validate→finalize, renderer, PLACEHOLDER_VOCABULARY_V2
> - `PLAN_LOOPS_PHASE4.md` — 6 loops, archivos, tests, métricas, dependencias
> - `DECISIONES.md` — 14 decisiones arquitectónicas
> - `ARQUITECTURA.md` — flujo de datos y capas

## Objetivo

Construir un contrato de script determinista (`ScriptContractV2`) mediante el flujo `buildScriptCandidateV2 → validateScriptCandidateV2 → finalizeScriptContractV2`, y un renderer que convierte acciones aprobadas de `RemediationPlanV2` en código Python/Pandas ejecutable, sin intervención del LLM.

## Alcance

- Definir `ScriptBuildContextV2` con `columnRegistry` (sin modificar `RemediationContextV2`)
- Definir `ScriptContractCandidateV2` y `ScriptContractV2` con partición única (rejected nunca en excluded)
- Crear `PLACEHOLDER_VOCABULARY_V2` (constante cerrada, versionada, sin valores LLM)
- Crear resolver de columnas con helpers `readColumn`/`writeColumn`/`accessColumn`
- `pythonLiteral` en `ColumnRef`, no en `RemediationContextColumnV2`
- Columnas duplicadas operadas por posición (`duplicateOrdinal`)
- `drop_exact_duplicates` acepta `columnRef === null`
- Flujo candidate → validate → finalize
- Validación por reconstrucción exacta (`SCRIPT_RENDER_MISMATCH`)
- Validación de sintaxis Python tri-state (`passed`/`failed`/`not_run`)
- Script con cero acciones: función `clean_dataset(df)` completa
- Badge UI: "Contrato válido" (no "Seguro")
- E2E harness en `src/tests/e2e/harness/Phase4ScriptHarness.ts` y `src/tests/e2e/fourth-delivery-evidence.spec.ts`

## Fuera de alcance

- Ejecución real del script (Phase 5)
- Pyodide, Colab, reauditoría (Phase 5)
- Delta de salud y mejora del dataset (Phase 5)
- Benchmark comparativo formal (Phase 6)

## Loops de implementación

| Loop | Título | Archivos | Tests |
|---|---|---|---|
| L1 | Types + BuildContext + column resolver + vocabulary | 5 | 25+ |
| L2 | Renderer determinista | 2 | 20+ |
| L3 | Script contract builder + finalizer | 2 | 25+ |
| L4 | Script contract validator (con reconstrucción) | 3 | 30+ |
| L5 | UI — Script generation + review | 4 | 10+ |
| L6 | E2E harness + capturas | 3 | 3 E2E |

## Dependencias

```
L1 (types + context + resolver + vocabulary) → L2 (renderer) → L3 (builder + finalizer) → L4 (validator) → L5 (UI) → L6 (E2E)
```

## Regla de oro

El LLM no escribe, corrige ni completa código en ningún punto del pipeline.

## Claims que Phase 4 permitirá

- Script determinista generado a partir de plan de remediación validado
- Trazabilidad completa: RemediationPlanV2 → ScriptContractV2 → columnRefs → pythonLiteral
- Hash estable (sin `generatedAt`, con `placeholderVocabularyVersion`)
- Validación por reconstrucción exacta
- Validación de seguridad: sin eval, exec, subprocess, imports no autorizados
- Gobernanza HITL con partición única sin solapamiento

## Claims que Phase 4 NO permitirá

- NO afirmar ejecución real del script
- NO afirmar mejora del dataset
- NO afirmar que el LLM escribió el código
- NO afirmar validación de sintaxis Python si el estado es `not_run`
- NO afirmar benchmark comparativo formal
