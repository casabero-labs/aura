# Arquitectura — Phase 4 (ScriptContractV2 + Renderer)

> **Versión:** 3.0.0 · **Fecha:** 2026-06-25 · **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`

---

## Diagrama de flujo

```
RemediationPlanV2 (Phase 3 congelada) + ColumnRef[] (del envelope)
  │
  │  plan.plan[]  (9 acciones con approvalStatus)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptBuildContext.ts                               │
│  buildScriptContext(ctx, columnRefs)                  │
│  → ScriptBuildContextV2                               │
│  │                                                    │
│  │  ColumnRegistryV2:                                 │
│  │    byColumnId: Map<columnId, ColumnRef>            │
│  │    byName: Map<name, ColumnRef[]>                  │
│  │  CorrespondenceEvidenceV2                          │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ScriptBuildContextV2
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptColumnResolver.ts                             │
│  readColumn(id, registry) → ColumnRef | null          │
│  writeColumn(col) → pythonLiteral                     │
│  accessColumn(col) → df_clean[pythonLiteral]          │
│  │                                                    │
│  │  Si isAmbiguous → excluir (no renderizar)          │
│  │  Si isDuplicate → pythonLiteral con ordinal        │
│  │  Si isReservedWord → df['name']                    │
│  │  Si columnId null → solo drop_exact_duplicates     │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ColumnRef + RemediationActionV2
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptRendererV2.ts + placeholderVocabulary.ts      │
│  renderActionV2(action, columnRef) → string           │
│  │                                                    │
│  │  trim_whitespace       → df[col].str.strip()      │
│  │  drop_exact_duplicates → df.drop_duplicates()     │
│  │    (acepta columnRef null)                         │
│  │  normalize_placeholders→ df[col].replace(VOCAB)   │
│  │    (usa PLACEHOLDER_VOCABULARY_V2)                 │
│  │  normalize_casing      → df[col].str.title()      │
│  │  convert_disguised_num → pd.to_numeric(...)       │
│  │  requires_human_review → # comentario (sin código)│
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  string[] (líneas Python por acción) + scriptText completo
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  scriptBuilderV2.ts                                  │
│                                                      │
│  FASE 1: buildScriptCandidateV2(plan, ctx)            │
│    → ScriptContractCandidateV2                        │
│  │                                                    │
│  │  Partición única:                                  │
│  │    rejected  → rejectedActionIds                   │
│  │    approved + renderizable → acceptedActionIds     │
│  │    pending O approved no renderizable              │
│  │              → excludedActionIds                   │
│  │  rejected NUNCA en excludedActionIds               │
│  │  Si 0 accepted → función clean_dataset(df) válida  │
│  │                                                    │
│  FASE 2: validateScriptCandidateV2(candidate, ...)    │
│    → ValidationResultV2  (35 validaciones)            │
│  │                                                    │
│  │  Integridad, correspondencia, HITL, partición      │
│  │  Columnas (pythonLiteral, duplicadas)              │
│  │  Seguridad (sin eval/exec/subprocess)              │
│  │  Sintaxis Python (tri-state)                       │
│  │  Reconstrucción exacta (SCRIPT_RENDER_MISMATCH)    │
│  │                                                    │
│  FASE 3: finalizeScriptContractV2(candidate, result)  │
│    → ScriptContractV2  (solo si valid.valid)          │
│  │                                                    │
│  │  Añade scriptHash (sin generatedAt)                │
│  │  Añade validationResult                            │
│  ▼                                                    │
└─────────────────────────────────────────────────────┘
  │
  │  ScriptContractV2
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  UI Layer                                            │
│                                                      │
│  ScriptGenerationStepV2.tsx                          │
│  │  - Recibe remediationPlan + structuredDiagnosis   │
│  │  - buildScriptContext → candidate → validate      │
│  │    → finalize                                     │
│  │  - Muestra script con syntax highlighting         │
│  │  - Badge: "Contrato válido" / "Validación fallida"│
│  │  - Muestra resumen de gobernanza (partición única)│
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
| Contexto | `scriptBuildContext.ts` | `types.ts` |
| Vocabulario | `placeholderVocabulary.ts` | Ninguna |
| Resolver | `scriptColumnResolver.ts` | `types.ts` |
| Renderer | `scriptRendererV2.ts` | `types.ts`, `scriptColumnResolver.ts`, `placeholderVocabulary.ts` |
| Builder | `scriptBuilderV2.ts` | `types.ts`, `scriptBuildContext.ts`, `scriptColumnResolver.ts`, `scriptRendererV2.ts`, `hash.ts` |
| Validator | `scriptValidatorV2.ts` | `types.ts`, `scriptBuilderV2.ts`, `scriptErrorCodes.ts` |
| UI | `ScriptGenerationStepV2.tsx`, `ReviewStep.tsx` | Contratos, componentes React |
| E2E | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` | Playwright, harness fixtures |

---

## Entradas y salidas

### Entrada

```typescript
interface Phase4Input {
  plan: RemediationPlanV2;        // De Phase 3 (con approve/reject/pending)
  ctx: RemediationContextV2;      // De DiagnosisExecutionResult.remediationContext
  columnRefs: ColumnRef[];        // Del envelope de evidencia (con pythonLiteral)
}
```

### Salida

```typescript
interface Phase4Output {
  candidate: ScriptContractCandidateV2;  // Candidato sin hash ni validación
  validation: ValidationResultV2;        // Resultado de validación (35 checks)
  contract: ScriptContractV2;            // Contrato final (solo si valid.valid)
}
```

---

## Regla de seguridad

El LLM no escribe código ni cambia la política. Acciones pendientes, rechazadas, ambiguas o no autorizadas no se renderizan. El renderer es 100% determinista: mismo input → mismo script → mismo hash. `generatedAt` no forma parte del hash.
