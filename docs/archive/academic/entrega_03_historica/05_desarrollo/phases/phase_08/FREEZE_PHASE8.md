# FREEZE — Phase 8

> **Estado:** FROZEN
> **Fecha:** 2026-07-02
> **SHA base (L6):** `3d6d04bbc62d27d4382d1689c0d6289a8c363984`
> **SHA freeze:** pendiente de commit final L7
> **Alcance:** Evidence expansion post-Phase 7 — protocolos, pilot run, provider opt-in, benchmark classification, evidence package export

---

## A. Resumen ejecutivo

Phase 8 queda congelada. Se expandió la evidencia técnica posterior al freeze de Phase 7 sin tocar fases previas, sin declarar production-ready, sin usar datasets reales, sin ejecutar proveedores AI en modo obligatorio y sin preparar la cuarta entrega.

Phase 8 entrega:

- **Plan y ledger de evidencia** (L0) — matriz de tracking para todos los loops.
- **Blindaje demo/producción** (L1) — separación de modos demo y real con helper centralizado, tests unitarios (20/20) y specs E2E (infraestructura lista).
- **Protocolo de dataset controlado** (L2) — CSV sintético 50 filas × 15 columnas, schema JSON, 55 ground truth issues, 0 PII.
- **Pilot run controlado** (L3) — ejecución determinística completa sobre dataset sintético: audit JSON (29 issues), detection matrix (vs 55 GT), script/notebook candidates.
- **Opt-in de proveedores reales** (L4) — protocolo formal + helper programático + 30 tests unitarios + 8 specs E2E gated.
- **Clasificación de evidencia benchmark** (L5) — helper `classifyBenchRun()` con 4 estados y 12 checks formales + 26 tests + schema + register.
- **Paquete de evidencia exportable** (L6) — index, manifest JSON, claims matrix, limitations & risks, README.

**AURA NO queda declarada production-ready final.** Phase 8 no ejecutó ningún benchmark formal. No se usaron datasets reales. Ningún proveedor AI fue ejecutado en modo obligatorio.

---

## B. Tabla de loops Phase 8

| Loop | SHA | Objetivo | Entregable principal | Estado |
|------|-----|---------|---------------------|--------|
| L0 | `b69a620fa4f41b3b8b570627b429af844e0a6cb2` | Plan y ledger | `PHASE8_PLAN.md` + `PHASE8_EVIDENCE_LEDGER.md` | CERRADO |
| L1 | `48bf7972bed5d8614e85d32d8932f8180348c5a7` | Demo/prod boundary hardening | Helper `demoMode.ts` + 20 tests + banner UI + 8 E2E specs | CERRADO |
| L2 | `5fabb920468281def9ab308563ae4a92893fe74c` | Controlled dataset protocol | CSV 50×15 + schema JSON + 55 GT issues + claims doc | CERRADO |
| L3 | `43c0a02db3d6d8f3e200143d7b683c021a7731cb` | Controlled pilot run | Audit JSON (29 issues) + detection matrix + script/notebook candidates | CERRADO |
| L4 | `ac1783d4743aa62ac1c54503b82a8cf3c44d317c` | Provider validation opt-in | Protocol + `providerOptIn.ts` + 30 tests + 8 E2E specs gated | CERRADO |
| L5 | `50934532c4ce134d7356d217a0c6d4474123cc4b` | Benchmark evidence classification | `classifyBenchRun()` + 26 tests + schema + register (0 formal_valid) | CERRADO |
| L6 | `3d6d04bbc62d27d4382d1689c0d6289a8c363984` | Evidence package export | Index + manifest JSON (35 artifacts) + claims matrix + README | CERRADO |
| **L7** | **pendiente de commit final** | **Freeze Phase 8** | `FREEZE_PHASE8.md` | **EN CURSO** |

---

## C. Evidencia congelada

### Documentos de diseño y protocolos

| Documento | Loop | Contenido |
|-----------|------|-----------|
| `PHASE8_PLAN.md` | L0 | Alcance, riesgos, roadmap, reglas operativas |
| `PHASE8_EVIDENCE_LEDGER.md` | L0 | Matriz de tracking de evidencia (actualizada hasta L7) |
| `CONTROLLED_DATASET_PROTOCOL.md` | L2 | Protocolo formal de dataset controlado |
| `PROVIDER_VALIDATION_OPT_IN_PROTOCOL.md` | L4 | Protocolo formal de validación opt-in |
| `BENCHMARK_EVIDENCE_CLASSIFICATION.md` | L5 | Protocolo formal de clasificación con estados y claims |

### Artefactos técnicos (src/)

| Archivo | Loop | Descripción | Tests |
|---------|------|-------------|-------|
| `src/utils/demoMode.ts` | L1 | Helper centralizado de detección de modo demo | 20/20 |
| `src/utils/providerOptIn.ts` | L4 | Helper centralizado de detección opt-in | 30/30 |
| `src/utils/benchmarkEvidenceClassification.ts` | L5 | Helper de clasificación de evidencia benchmark | 26/26 |
| `src/phase8_pilot_audit.ts` | L3 | Script standalone de pilot run | N/A |
| `src/tests/e2e/phase8-boundary.spec.ts` | L1 | 8 specs E2E de boundary (infraestructura lista) | No ejecutado |
| `src/tests/e2e/phase8-provider-opt-in.spec.ts` | L4 | 8 specs E2E de opt-in (gated) | No ejecutado |

### Dataset y pilot run

| Artefacto | Loop | Descripción |
|-----------|------|-------------|
| `datasets/controlled_customers_phase8.csv` | L2 | CSV sintético: 50 filas, 15 columnas, 0 PII |
| `datasets/controlled_customers_phase8.schema.json` | L2 | Schema con tipos, dominios y reglas |
| `datasets/controlled_customers_phase8_ground_truth.json` | L2 | 55 ground truth issues clasificados |
| `datasets/controlled_customers_phase8_claims.md` | L2 | Claims permitidos/prohibidos del dataset |
| `pilot_run_l3/aura_audit_controlled_customers_phase8.json` | L3 | Audit JSON: 29 issues, score 0/100 |
| `pilot_run_l3/aura_issues_controlled_customers_phase8.csv` | L3 | Issues CSV: 29 rows |
| `pilot_run_l3/controlled_customers_phase8_detection_matrix.md` | L3 | TP/FP/FN matrix vs 55 GT |
| `pilot_run_l3/controlled_customers_phase8_pilot_summary.md` | L3 | Resumen ejecutivo del pilot run |
| `pilot_run_l3/script_candidate_controlled_customers_phase8.py` | L3 | Script Python candidate (no ejecutado) |
| `pilot_run_l3/notebook_candidate_controlled_customers_phase8.json` | L3 | Notebook .ipynb candidate (no ejecutado) |
| `pilot_run_l3/pilot_run_manifest.json` | L3 | Catálogo de artefactos L3 |
| `benchmark/benchmark_evidence_schema.json` | L5 | JSON Schema de benchmark evidence |
| `benchmark/benchmark_evidence_register.md` | L5 | 5 corridas registradas (0 formal_valid) |

### Paquete de evidencia L6

| Documento | Descripción |
|-----------|-------------|
| `evidence_package_l6/PHASE8_EVIDENCE_PACKAGE_INDEX.md` | Mapa completo de artefactos L0-L5 |
| `evidence_package_l6/PHASE8_EVIDENCE_PACKAGE_MANIFEST.json` | JSON machine-readable: 35 artifacts + SHAs |
| `evidence_package_l6/PHASE8_CLAIMS_MATRIX.md` | 9 allowed / 11 forbidden claims |
| `evidence_package_l6/PHASE8_LIMITATIONS_AND_RISKS.md` | Limitaciones + 10 open risks |
| `evidence_package_l6/PHASE8_EVIDENCE_README.md` | Guía rápida de lectura |

### Cierres documentales

| Documento | Loop |
|-----------|------|
| `CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md` | L1 |
| `CIERRE_LOOP3_CONTROLLED_PILOT_RUN.md` | L3 |
| `CIERRE_LOOP4_PROVIDER_VALIDATION_OPT_IN.md` | L4 |
| `CIERRE_LOOP5_BENCHMARK_EVIDENCE_CLASSIFICATION.md` | L5 |
| `CIERRE_LOOP6_EVIDENCE_PACKAGE_EXPORT.md` | L6 |

---

## D. Typecheck congelado

- **8 errores preexistentes** en `ImprovementRunPanel.tsx` (4), `ReviewStep.tsx` (1), `scriptGenerationStepV2.test.tsx` (2), `phase7-claims-visible.spec.ts` (2)
- **0 errores atribuibles a Phase 8** (L0-L6 confirmado)
- Build `vite build` exitoso (sin errores nuevos)

---

## E. Claims permitidos (congelados)

1. **Phase 8 definió un protocolo de dataset controlado.** CSV sintético 50×15, schema, ground truth, 0 PII.
2. **Phase 8 ejecutó un pilot run controlado sobre dataset sintético.** Deterministic only, 29 issues, precision 65% raw / 76% adjusted.
3. **Phase 8 separó proveedores reales mediante opt-in.** Protocolo + helper + 30 tests. Ningún provider ejecutado en modo obligatorio.
4. **Phase 8 clasificó evidencia benchmark para evitar claims inflados.** Helper `classifyBenchRun()` con 4 estados y 12 checks formales + 26 tests.
5. **Phase 8 separó modo demo/evidencia de modo normal.** Helper centralizado + banner UI + 20 unit tests.
6. **Phase 8 empaquetó evidencia exportable y trazable.** Package L6: index, manifest JSON con 35 artifacts y SHAs, claims matrix, README.
7. **AURA puede auditar datasets sintéticos en modo determinístico.** Pilot run L3 demuestra pipeline funcional.

---

## F. Claims prohibidos (congelados)

Bajo ninguna circunstancia afirmar:

- ❌ "AURA está production-ready"
- ❌ "AURA corrigió datasets reales"
- ❌ "AURA ejecuta Python internamente"
- ❌ "Chrome AI / Gemini Nano siempre está disponible"
- ❌ "Existe benchmark formal definitivo"
- ❌ "Existe validación externa independiente"
- ❌ "La cuarta entrega ya está construida"
- ❌ "AURA detectó los 55 ground truth issues" (~47/55 cubiertos)
- ❌ "El audit score (0/100) refleja calidad final"
- ❌ "Los proveedores AI fueron validados formalmente" (solo opt-in, nunca ejecutados)
- ❌ "Phase 8 constituye evidencia suficiente para producción"

---

## G. Limitaciones congeladas

1. **Dataset sintético.** 50 filas, 15 columnas, dominio único. No representa datos reales.
2. **Pilot run determinístico.** Sin proveedores AI. No refleja capacidad cognitiva de AURA.
3. **Sin benchmark formal.** 0 entradas `formal_valid` en el register. Todas las corridas AI son `planned` o `attempted_failed`.
4. **Sin validación externa.** Ningún auditor externo revisó los resultados.
5. **Sin ejecución de proveedores reales.** Opt-in gated, nunca ejecutados en modo obligatorio.
6. **Sin ejecución Python en AURA.** Script/notebook candidates son externos para Colab.
7. **8 errores TypeScript preexistentes.** Ninguno de Phase 8, pero persisten como deuda heredada.
8. **E2E specs no ejecutados.** `phase8-boundary.spec.ts` y `phase8-provider-opt-in.spec.ts` requieren Playwright dev server.
9. **Improvement run no ejecutado.** Requiere Colab real + reaudit.
10. **Detection matrix con aggregation mismatch.** Column vs row accounting produce rangos de precisión.

---

## H. Riesgos abiertos (congelados)

| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| 8 errores TypeScript preexistentes | Baja | Documentado en L1/L3/L5/L6 ledgers |
| E2E boundary no ejecutado | Media | Infraestructura lista, requiere servidor |
| Sin validación de AI provider | Media | Opt-in protocol definido (L4) |
| Sin benchmark formal | Alta | Infraestructura de clasificación lista (L5) |
| Sin validación externa | Alta | Documentado como limitación |
| Dataset sintético solamente | Media | Protocolo de dataset real diferido |
| Detection matrix aggregation mismatch | Baja | Precisión documentada con rangos |
| Line ending noise en Windows | Baja | `core.autocrlf false` aplicado |

---

## I. Confirmaciones

- ✅ Phase 8 no tocó código productivo en L6 ni L7 (solo documentación).
- ✅ Phase 8 no tocó tests existentes.
- ✅ Phase 8 no tocó servicios existentes.
- ✅ Phase 8 no tocó componentes existentes.
- ✅ Phase 8 no tocó contratos v2.
- ✅ Phase 8 no tocó freezes Phase 5, Phase 6 ni Phase 7.
- ✅ Phase 8 no preparó la cuarta entrega.
- ✅ Phase 8 no declaró production-ready.
- ✅ Phase 8 no declaró benchmark formal definitivo.
- ✅ Phase 8 no ejecutó Python dentro de AURA.
- ✅ Phase 8 no usó proveedores reales en modo obligatorio.
- ✅ Phase 8 no usó datasets reales.

---

## J. Decisión de freeze

Phase 8 queda congelada. L0-L6 completados exitosamente con evidencia documental, tests y protocolos. La cuarta entrega NO debe iniciarse hasta instrucción explícita del usuario. Phase 9 o el siguiente frente se determinará posteriormente.

---

## K. Próximo paso recomendado

**Phase 9 — Technical Debt Cleanup and Typecheck Baseline**, o **awaiting explicit user instruction** para el próximo frente.

La cuarta entrega documental queda en espera hasta que el usuario lo solicite explícitamente.
