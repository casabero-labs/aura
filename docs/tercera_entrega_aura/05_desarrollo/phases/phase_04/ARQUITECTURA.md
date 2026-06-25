# Arquitectura — Phase 4 (ScriptContractV2 + Renderer)

> **Versión:** 2.0.0 · **Fecha:** 2026-06-25 · **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`

---

## Diagrama de flujo

```
RemediationPlanV2 (Phase 3 congelada)
  │
  │  plan.plan[]  (9 acciones con approvalStatus)
  │  ctx.columns[] (ColumnRef con columnId, pythonLiteral)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptColumnResolver.ts                             │
│  resolveActionColumn(action, columns) → ColumnRef     │
│  │                                                    │
│  │  Si isAmbiguous → excluir                          │
│  │  Si isDuplicate → usar pythonLiteral + ordinal     │
│  │  Si isReservedWord → usar pythonLiteral            │
│  │  Si columnId null + requiere columna → excluir     │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ColumnRef + RemediationActionV2
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptRendererV2.ts                                 │
│  renderActionV2(action, columnRef) → string           │
│  │                                                    │
│  │  trim_whitespace       → df[col].str.strip()      │
│  │  drop_exact_duplicates → df.drop_duplicates()     │
│  │  normalize_placeholders→ df[col].replace([...])   │
│  │  normalize_casing      → df[col].str.title()      │
│  │  convert_disguised_num → pd.to_numeric(...)       │
│  │  requires_human_review → # comentario (sin código)│
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  string[] (líneas Python por acción)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptBuilderV2.ts                                  │
│  buildScriptContractV2(plan, ctx) → ScriptContractV2 │
│  │                                                    │
│  │  1. Iterar acciones:                              │
│  │     approved  → renderizar + acceptedActionIds     │
│  │     rejected  → rejectedActionIds                  │
│  │     pending   → excludedActionIds                  │
│  │  2. Concatenar header + acciones + footer         │
│  │  3. Resolver columnRefs                           │
│  │  4. Calcular scriptHash (canonicalJson)           │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ScriptContractV2
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptValidatorV2.ts                                │
│  validateScriptContractV2(contract, plan, ctx) →      │
│    ValidationResultV2                                 │
│  │                                                    │
│  │  - Integridad (campos obligatorios)               │
│  │  - Correspondencia (remediationRef, fingerprint)   │
│  │  - HITL (solo approved en accepted)               │
│  │  - Columnas (columnId, no ambiguas)               │
│  │  - Seguridad (sin eval/exec/subprocess)           │
│  │  - Cobertura (todas las acciones cubiertas)       │
│  │  - Hash (recálculo)                               │
│  │  - Sintaxis Python (best-effort)                  │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ValidationResultV2 (valid: true/false)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  UI Layer                                            │
│                                                      │
│  ScriptGenerationStepV2.tsx                          │
│  │  - Recibe remediationPlan + structuredDiagnosis   │
│  │  - Llama buildScriptContractV2()                  │
│  │  - Muestra script con syntax highlighting         │
│  │  - Muestra resumen de gobernanza                  │
│  │                                                    │
│  ReviewStep.tsx (modificado)                         │
│  │  - Acepta ScriptContractV2 opcional               │
│  │  - Muestra validación del contrato                │
│  │  - Checklist HITL con métricas v2                 │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
```

---

## Capas

| Capa | Archivos | Dependencias |
|---|---|---|
| Tipos | `types.ts` | Ninguna |
| Resolver | `scriptColumnResolver.ts` | `types.ts` |
| Renderer | `scriptRendererV2.ts` | `types.ts`, `scriptColumnResolver.ts` |
| Builder | `scriptBuilderV2.ts` | `types.ts`, `scriptColumnResolver.ts`, `scriptRendererV2.ts`, `hash.ts` |
| Validator | `scriptValidatorV2.ts` | `types.ts`, `scriptBuilderV2.ts`, `diagnosisPromptV2.ts` (canonicalJson) |
| UI | `ScriptGenerationStepV2.tsx`, `ReviewStep.tsx` | Contratos, componentes React |
| E2E | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` | Playwright, harness fixtures |

---

## Entradas y salidas

### Entrada

```typescript
interface Phase4Input {
  plan: RemediationPlanV2;        // De Phase 3 (con approve/reject/pending)
  ctx: RemediationContextV2;       // De DiagnosisExecutionResult.remediationContext
}
```

### Salida

```typescript
interface Phase4Output {
  contract: ScriptContractV2;      // Contrato firmado
  script: string;                  // Python/Pandas listo para revisión
  validation: ValidationResultV2;  // Resultado de validación
}
```

---

## Regla de seguridad

El LLM no escribe código ni cambia la política. Acciones pendientes, rechazadas, ambiguas o no autorizadas no se renderizan. El renderer es 100% determinista: mismo input → mismo script → mismo hash.
