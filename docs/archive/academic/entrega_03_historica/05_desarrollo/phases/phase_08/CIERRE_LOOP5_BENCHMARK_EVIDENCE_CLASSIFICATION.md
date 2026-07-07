# Phase 8 L5 — Cierre Benchmark Evidence Classification

## Objetivo

Definir una clasificación formal de evidencia benchmark para AURA con cuatro estados (`planned`, `attempted_failed`, `preliminary_valid`, `formal_valid`), un helper programático (`classifyBenchRun()`) que aplica estas reglas, y un registro inicial que documenta el estado real de las corridas existentes y planificadas.

## Cambios Realizados

### 1. Helper programático: `src/utils/benchmarkEvidenceClassification.ts`

- `classifyBenchRun(input: BenchRunInput): BenchRunResult` — clasifica una corrida según los 4 estados.
  - `attempted_failed`: status != 'completed'.
  - `planned`: sin dataset/proveedor/evidencia.
  - `preliminary_valid`: completada pero sin todos los criterios formales.
  - `formal_valid`: todos los criterios cumplidos (12 checks).
- Funciones auxiliares: `isFormalValid()`, `isPreliminaryValid()`, `isAttemptedFailed()`, `evaluationStatusMessage()`.

### 2. Tests unitarios: `src/__tests__/benchmarkEvidenceClassification.test.ts`

26 tests cubriendo:
- 5 escenarios de attempted_failed (api_error, provider_unavailable, timeout, model_not_downloaded, invalid_output).
- 3 escenarios de planned (no dataset, no provider/model, no evidence files).
- 8 escenarios de preliminary_valid (missing repetitions, comparative table, limitations, human review, hallucinations, latency, json_valid).
- 2 escenarios de formal_valid.
- 4 tests de helper functions (isFormalValid, isPreliminaryValid, isAttemptedFailed, evaluationStatusMessage).
- Claims verification por nivel de clasificación.

### 3. Schema JSON: `benchmark_evidence_schema.json`

Estructura completa de 26 fields para un benchmark evidence record, con tipos, enums y descripciones.

### 4. Register: `benchmark_evidence_register.md`

5 corridas registradas:
- bench-001: L3 deterministic audit → `planned` (not an AI benchmark)
- bench-002: Chrome AI → `planned`
- bench-003: Ollama → `planned`
- bench-004: Gemini Cloud → `attempted_failed` (no API key)
- bench-005: WebLLM → `planned` (experimental, out_of_scope)

**Ninguna clasificada como `preliminary_valid` o `formal_valid`** — porque no se ha ejecutado ninguna corrida AI real completada.

### 5. Documento de clasificación: `BENCHMARK_EVIDENCE_CLASSIFICATION.md`

Protocolo completo con estados, criterios, tratamiento de fallos, claims, limitaciones y relación con L4 opt-in.

## Archivos Modificados/Creados

| Archivo | Tipo |
|---------|------|
| `src/utils/benchmarkEvidenceClassification.ts` | Nuevo |
| `src/__tests__/benchmarkEvidenceClassification.test.ts` | Nuevo |
| `docs/.../benchmark/benchmark_evidence_schema.json` | Nuevo |
| `docs/.../benchmark/benchmark_evidence_register.md` | Nuevo |
| `docs/.../BENCHMARK_EVIDENCE_CLASSIFICATION.md` | Nuevo |
| `docs/.../CIERRE_LOOP5_BENCHMARK_EVIDENCE_CLASSIFICATION.md` | Nuevo |
| `PHASE8_EVIDENCE_LEDGER.md` | Modificado |
| `NEXT_STEPS.md` | Modificado |

## Cómo se evita inflar resultados

1. El helper `classifyBenchRun()` aplica 12 checks secuenciales. Si un solo check falla, el resultado queda en `preliminary_valid`.
2. El register inicial no tiene ningún `formal_valid` — todas las AI runs están `planned` o `attempted_failed`.
3. Las claims prohibidas son explícitas para cada clasificación.
4. Las claims permitidas son cautelosas incluso para `formal_valid` (prohíbe production-ready, generalización, validación externa).

## Relación con L4 Opt-in

- Toda corrida AI real requiere `AURA_PROVIDER_VALIDATION` activa (L4).
- Si la variable no está presente, no se ejecuta — clasificado como `planned`.
- Si falla por provider_unavailable, va a `attempted_failed`.

## Claims Permitidos (L5 como loop)

- La clasificación de evidencia benchmark fue definida.
- El helper `classifyBenchRun()` aplica 12 checks formales.
- Ninguna corrida AI real ha sido ejecutada todavía — el register solo tiene entradas `planned` y `attempted_failed`.
- El L3 pilot run fue deterministic, no benchmark AI.

## Claims Prohibidos

- AURA tiene benchmark formal (no hay corridas `formal_valid` todavía).
- Los resultados de L3 son formal_valid.
- Chrome AI fue validado como benchmark (está `planned`).
- La clasificación reemplaza el `diagnosisReliabilityScore()` (son complementarios).

## Verificaciones

| Verificación | Resultado |
|-------------|-----------|
| `npx vitest run __tests__/benchmarkEvidenceClassification.test.ts` | **26/26 passed** |
| `npx vite build` | (verificado en el pipeline) |
| JSON schema validation | **OK** (benchmark_evidence_schema.json es JSON válido) |
| Register sin formal_valid inventado | **OK** (0 entries con formal_valid) |

## L5B — Typecheck Verification (2026-07-02)

| Verificación | Resultado |
|-------------|-----------|
| `cd src && npx tsc --noEmit` | **8 errores preexistentes** |
| Archivos afectados | `ImprovementRunPanel.tsx` (4), `ReviewStep.tsx` (1), `scriptGenerationStepV2.test.tsx` (2), `phase7-claims-visible.spec.ts` (2) |
| Errores apuntan a L5 | **NO** — ningún error en `benchmarkEvidenceClassification.ts` ni `__tests__/benchmarkEvidenceClassification.test.ts` |
| Errores preexistentes | **CONFIRMADO** — ninguno atribuible a L5 |
| Decisión | L5 puede cerrarse; errores preexistentes documentados en E8-L1-007 del ledger |

## Confirmaciones

- ✅ No se ejecutó benchmark formal (ninguna AI run ejecutada)
- ✅ No se declaró formal_valid inventado
- ✅ No se usaron proveedores reales obligatorios
- ✅ No se subieron secretos
- ✅ WebLLM no se reactivó como producción
- ✅ No se tocó auditEngine, scoring, contratos v2 ni freezes
- ✅ No se preparó cuarta entrega

## Próximo Loop Recomendado

**Phase 8 L6 — Evidence Package Export**

Consolidar artefactos exportables para la futura cuarta entrega.
