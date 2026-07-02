# Phase 8 L3 — Cierre Controlled Pilot Run

## Objetivo

Ejecutar un pilot run controlado de AURA usando el dataset sintético `controlled_customers_phase8.csv` (L2), generando evidencia exportable del flujo de auditoría determinista: carga, auditoría, detección de issues, comparación contra ground truth y generación de script/notebook delegable.

## Dataset Usado

- **ID:** `controlled_customers_phase8`
- **Versión:** 1.0.0
- **Tipo:** 100% sintético, sin PII
- **Rows:** 50
- **Columns:** 15
- **Fuente:** `docs/tercera_entrega_aura/03_evidencia/phase_08/datasets/controlled_customers_phase8.csv`

## Protocolo Aplicado

1. Carga del CSV con PapaParse (50 filas, 15 columnas, delimitador coma).
2. Ejecución de `runAudit(data, fields, delimiter)` del motor determinista (`auditEngine.ts`).
3. No se usaron proveedores AI (Chrome AI, Gemini, Ollama, cloud).
4. No se ejecutó Python dentro de AURA.
5. La auditoría se ejecutó vía `npx tsx phase8_pilot_audit.ts` desde `src/`.

## Artefactos Generados

| # | Artefacto | Archivo | Estado |
|---|-----------|---------|--------|
| 1 | Audit JSON | `aura_audit_controlled_customers_phase8.json` | generado |
| 2 | Issues CSV | `aura_issues_controlled_customers_phase8.csv` | generado |
| 3 | Detection Matrix | `controlled_customers_phase8_detection_matrix.md` | generado |
| 4 | Pilot Summary | `controlled_customers_phase8_pilot_summary.md` | generado |
| 5 | Script Candidate | `script_candidate_controlled_customers_phase8.py` | generado |
| 6 | Notebook Candidate | `notebook_candidate_controlled_customers_phase8.json` | generado |
| 7 | Improvement Run | — | **not_generated** |
| 8 | Manifest | `pilot_run_manifest.json` | generado |

## Métricas Observadas

| Métrica | Valor |
|---------|-------|
| Audit score | 0/100 |
| Issues detectados | 29 |
| Ground truth issues | 55 |
| True positives (grupos) | 19 (~47 individuales cubiertos) |
| False positives | 10 (6 sustantivos, 4 optional-field nulls) |
| False negatives | 36 (9 gaps sustantivos, 27 agregados ya detectados) |

## Comparación con Ground Truth

**Aciertos:**
- Nulos, placeholders, emails inválidos, casing, espacios extra, valores negativos, outliers → detectados.

**Gaps detectados:**
- Validación de fechas (5 FNs): fechas inválidas (30/02), años con 5 dígitos, fechas futuras no son validadas por el engine.
- Domain enforcement (3 FNs): valores fuera de dominio (CHL, invalid_plan, desconocido) no son chequeados.
- Duplicados (2 FNs): customer_id duplicado no detectado.
- Formato de teléfono (2 FNs): "9-1111-0020", "000-0000-000" no validados.
- Optional-field nulls (4 FPs): company/tax_id/notes son opcionales pero AURA trata sus nulos como críticos.

## Execution Method

`npx tsx phase8_pilot_audit.ts` corriendo desde `src/` con TypeScript directo. Motor determinista puro. Sin UI, sin CLI de AURA, sin Playwright, sin proveedores externos.

## Confirmaciones

- ✅ No dataset real usado
- ✅ No PII (todos los correos usan dominio `.invalid`, nombres sintéticos, teléfonos de prueba)
- ✅ No proveedores reales obligatorios (deterministic engine only)
- ✅ No Python ejecutado dentro de AURA (script/notebook generados para delegación externa)
- ✅ No se modificaron Phase 3, 4, 5, 6, ni 7
- ✅ No se tocaron contratos v2
- ✅ No se modificó scoring
- ✅ No se tocaron freezes
- ✅ No se usó Chrome AI / Gemini Nano
- ✅ No se preparó cuarta entrega
- ✅ Resultados marcados como `controlled_synthetic`
- ✅ Todo artefacto no generado está documentado con causa

## Claims Permitidos

- AURA ejecutó auditoría determinista sobre `controlled_customers_phase8.csv` (50 filas, 15 columnas, 0 PII).
- El motor detectó 29 issues agrupados por columna, cubriendo ~47 de 55 issues del ground truth.
- Los gaps identificados son: validación de fechas, domain enforcement, detección de duplicados, formato de teléfono.
- Los resultados son `preliminary_valid` — no constituyen benchmark formal.
- Script y notebook candidates fueron generados como artefactos delegables.

## Claims Prohibidos

- AURA está production-ready.
- AURA corrigió datasets reales.
- AURA tiene benchmark formal definitivo.
- Los resultados constituyen validación externa independiente.
- Python se ejecutó dentro de AURA.
- ImprovementRun fue generado.

## Riesgos Abiertos

1. **Recall aparente (~35%):** engañoso por mismatch de agregación. AURA agrupa por columna; GT registra por fila.
2. **Falsos positivos en campos opcionales:** company/tax_id/notes — AURA necesita soporte de schema para nulabilidad.
3. **Sin validación de fechas:** engine gap confirmado. No detecta fechas inválidas ni futuras.
4. **Sin domain enforcement:** engine gap confirmado. No valida contra listas de valores permitidos.
5. **Duplicados:** no detectados por engine actual.
6. **Script no ejecutado:** el candidate script nunca se corrió en Colab real. No hay ImprovementRun ni HealthDelta.

## Próximo Loop Recomendado

**Phase 8 L4 — Provider Validation Opt-in**

Validar proveedores reales (Chrome AI, Ollama, cloud) solo en modo opt-in, separados de CI, sin dependencia en E2E estándar.
