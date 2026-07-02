# Phase 8 — Evidence Ledger

## Tabla de Control de Evidencia

| ID Evidencia | Loop | Artefacto Esperado | Archivo/Ruta | Qué Demuestra | Limitación | Estado | SHA Asociado | Uso Futuro en Cuarta Entrega | Observaciones |
|-------------|------|-------------------|--------------|---------------|------------|--------|--------------|------------------------------|---------------|
| E8-L0-001 | L0 | PHASE8_PLAN.md | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/PHASE8_PLAN.md | Definición de alcance, riesgos, roadmap y reglas de Phase 8 | Documento base sin ejecución aún | Completo | - | Marco de referencia para cuarta entrega | Creado en L0 |
| E8-L0-002 | L0 | PHASE8_EVIDENCE_LEDGER.md | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/PHASE8_EVIDENCE_LEDGER.md | Matriz de tracking de evidencia Phase 8 | Sin datos de ejecución | Completo | - | Tracking de evidencia acumulada | Creado en L0 |
| E8-L1-001 | L1 | Tests unitarios de boundary | src/__tests__/demoMode.test.ts | Separation de modo demo/evidencia vs modo normal | 20 unit tests | **Completo** | `d37b11e` | Validación de boundary | 20/20 passed |
| E8-L1-002 | L1 | Tests E2E boundary | src/tests/e2e/phase8-boundary.spec.ts | No-leak de banner demo a otros tabs | 8 E2E specs | **Deuda heredada** (ambiental) | `d37b11e` | Regresión de boundary | 8 specs listos pero no ejecutados (servidor no disponible en entorno actual). Requiere `npx playwright test` con dev server activo |
| E8-L1-003 | L1 | Helper centralizado | src/utils/demoMode.ts | Detección única de modo demo/evidencia | Solo query params, sin env vars | **Completo** | `d37b11e` | Reutilizable en futuras features | Exporta PROHIBITED_CLAIMS, DEMO_MODE_NOTICE, detectDemoMode |
| E8-L1-004 | L1 | Banner demo UI | src/components/ImprovementRunPanel.tsx | Banner ámbar visible solo con flag | Solo cubre panel de Health Delta | **Completo** | `d37b11e` | Señal visual de modo demo | data-testid="demo-mode-banner" |
| E8-L1-005 | L1 | Documentación de flags | docs/ | Flags de configuración de modo demo | Documental | **Completo** | `d37b11e` | Guía de configuración | Helper centralizado `demoMode.ts` + CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md |
| E8-L1-006 | L1 | Cierre documental | docs/.../phase_08/CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md | Resumen de cambios, claims, riesgos abiertos | Documental + addendum L1B | **Completo** | `d37b11e` | Cierre formal de L1 | Incluye verificación addendum L1B con deuda E2E ambiental documentada |
| E8-L1-007 | L1 | Typecheck | src/ (global) | Verificación de tipos TypeScript | 8 errores preexistentes (no L1) | **Completo** | `d37b11e` | Verificación de compilación | Todos preexistentes: `ImprovementRunPanel.tsx` mock incompleto vs tipos, `ReviewStep.tsx`, `scriptGenerationStepV2.test.tsx`, `phase7-claims-visible.spec.ts`. Ninguno apunta a archivos L1 |
| E8-L1-008 | L1 | Build verification | src/ (global) | `npx vite build` pasa | Build succeeds en 16.33s | **Completo** | `d37b11e` | Verificación de compilación prod | Build artefact en dist/ |
| E8-L2-001 | L2 | Dataset protocol | docs/.../phase_08/CONTROLLED_DATASET_PROTOCOL.md | Definición de dataset controlado ampliado, propósito, reglas, claims | Documento, sin ejecución | **Completo** | por completar al cierre | Contexto de datasets usados | 50 filas, 15 columnas, 55 ground truth issues |
| E8-L2-002 | L2 | CSV sintético | docs/.../datasets/controlled_customers_phase8.csv | Dataset controlado listo para pilot run | Sintético, un solo dominio, 50 filas | **Completo** | por completar al cierre | Dataset para L3 pilot run | 0 PII confirmado por validación |
| E8-L2-003 | L2 | Schema de dataset | docs/.../datasets/controlled_customers_phase8.schema.json | Estructura de datos controlada: 15 columnas con tipo, dominio, regla | Schema documentado | **Completo** | por completar al cierre | Referencia técnica | Validado contra CSV (columnas coinciden) |
| E8-L2-004 | L2 | Ground truth | docs/.../datasets/controlled_customers_phase8_ground_truth.json | 55 issues esperados clasificados por tipo y severidad | Diseñado con conocimiento de reglas de AURA | **Completo** | por completar al cierre | Baseline de comparación para L3 | 50 deterministic, 3 cognitive, 2 human_review |
| E8-L2-005 | L2 | Claims del dataset | docs/.../datasets/controlled_customers_phase8_claims.md | Claims permitidos, prohibidos, limitaciones, advertencias | Documental | **Completo** | por completar al cierre | Contexto de uso para cuarta entrega | Incluye advertencia de no validación externa |
| E8-L2-006 | L2 | Cross-validation | Script Python externo | Verificación de coherencia schema/CSV/ground truth/PII | Script manual externo | **Completo** | por completar al cierre | Verificación de integridad de dataset | Schema cubre todas las columnas, ground truth referencia filas existentes, 0 PII |
| E8-L3-001 | L3 | Audit JSON | docs/.../pilot_run_l3/aura_audit_controlled_customers_phase8.json | Ejecución completa de audit engine sobre dataset controlado | Deterministic only, no AI providers | **Completo** | por completar al cierre | Evidencia de ejecución | 29 issues, score 0/100, 50 rows |
| E8-L3-002 | L3 | Issues CSV | docs/.../pilot_run_l3/aura_issues_controlled_customers_phase8.csv | Lista de issues detectados en CSV | Deterministic only | **Completo** | por completar al cierre | Detalle de problemas | 29 rows with severity/category/description |
| E8-L3-003 | L3 | Detection Matrix | docs/.../pilot_run_l3/controlled_customers_phase8_detection_matrix.md | Matriz TP/FP/FN vs ground truth 55 issues | Aggregation mismatch (column vs row) | **Completo** | por completar al cierre | Comparativa de detección | ~47/55 GT covered, 6 substantive FPs, 9 substantive FNs |
| E8-L3-004 | L3 | Pilot Summary | docs/.../pilot_run_l3/controlled_customers_phase8_pilot_summary.md | Resumen ejecutivo: métricas, hallazgos, claims, limitaciones | — | **Completo** | por completar al cierre | Resumen de pilot run | precision 65% raw, 76% adjusted |
| E8-L3-005 | L3 | Script Candidate | docs/.../pilot_run_l3/script_candidate_controlled_customers_phase8.py | Script de limpieza generado con advertencia | No ejecutado (Colab externo) | **Completo** | por completar al cierre | Respaldo delegable | buildDeterministicCleaningScript(report) |
| E8-L3-006 | L3 | Notebook Candidate | docs/.../pilot_run_l3/notebook_candidate_controlled_customers_phase8.json | Notebook Colab .ipynb generado | No ejecutado (Colab externo) | **Completo** | por completar al cierre | Notebook delegable | buildColabNotebookJSON |
| E8-L3-007 | L3 | Improvement Run | — | Mejora pre/post con HealthDelta | Requiere Colab real + reaudit | **not_generated** | — | N/A | Documentado en manifest con causa exacta |
| E8-L3-008 | L3 | Pilot Manifest | docs/.../pilot_run_l3/pilot_run_manifest.json | Catálogo de artefactos L3 con status y limitaciones | — | **Completo** | por completar al cierre | Tracking de artefactos | 8 entries, 7 generated, 1 not_generated |
| E8-L3-009 | L3 | Cierre documental | docs/.../phase_08/CIERRE_LOOP3_CONTROLLED_PILOT_RUN.md | Resumen completo del cierre de L3 | — | **Completo** | por completar al cierre | Cierre formal de L3 | Claims, gaps, riesgos documentados |
| E8-L3-010 | L3B | Build verification | src/ (build) | `npm run build` succeed | Build succeed 9.88s | **Completo** | `b08a189` | Verificación de compilación prod | Solo warnings preexistentes de chunk size |
| E8-L3-011 | L3B | Typecheck | src/ (tsc) | `npx tsc --noEmit` — 8 errores | Todos preexistentes (0 atribuibles a L3) | **Completo** | `b08a189` | Verificación de tipos | Ningún error apunta a `phase8_pilot_audit.ts` |
| E8-L3-012 | L3B | Standalone script | src/phase8_pilot_audit.ts | Script standalone para pilot run | No importado en runtime normal | **Completo** | `b08a189` | Ejecución manual controlada | `grep -R phase8_pilot_audit` = 0 imports |
| E8-L4-001 | L4 | Chrome AI diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de Chrome AI real | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
| E8-L4-002 | L4 | Ollama diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de Ollama local | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
| E8-L4-003 | L4 | Cloud diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de proveedores cloud | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
| E8-L4-001 | L4 | Provider validation protocol | docs/.../phase_08/PROVIDER_VALIDATION_OPT_IN_PROTOCOL.md | Protocolo formal de validación opt-in de proveedores reales | Documental | **Completo** | por completar al cierre | Guía de validación opt-in | Cubre Chrome AI, Ollama, Gemini Cloud, WebLLM experimental |
| E8-L4-002 | L4 | Provider opt-in helper | src/utils/providerOptIn.ts | Helper centralizado de detección de modo opt-in | Solo env/query params, no llama proveedores | **Completo** | por completar al cierre | Reutilizable en UI y specs | detectProviderOptIn(), isProviderValidationClaimProhibited() |
| E8-L4-003 | L4 | Tests unitarios provider opt-in | src/__tests__/providerOptIn.test.ts | Tests del helper de opt-in | 30 unit tests | **Completo** | por completar al cierre | Validación del helper | 30/30 passed |
| E8-L4-004 | L4 | E2E specs opt-in | src/tests/e2e/phase8-provider-opt-in.spec.ts | Specs E2E para validación de proveedores reales | Saltados por defecto (AURA_PROVIDER_VALIDATION requerida) | **Completo** (infraestructura) | por completar al cierre | Validación manual futura | 8 specs, saltados en CI |
| E8-L4-005 | L4 | Cierre documental | docs/.../phase_08/CIERRE_LOOP4_PROVIDER_VALIDATION_OPT_IN.md | Resumen completo del cierre de L4 | Documental | **Completo** | por completar al cierre | Cierre formal de L4 | Claims, limitaciones, activación documentados |
| E8-L5-001 | L5 | Benchmark JSON | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Resultados de benchmark | Clasificación aún no aplicada | Pendiente | - | Comparativa de rendimiento | Pendiente L5 |
| E8-L5-002 | L5 | Tabla comparativa | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Clasificación de corridas | Tabla aún no creada | Pendiente | - | Resumen de clasificación | Pendiente L5 |
| E8-L6-001 | L6 | Paquete de evidencia | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Consolidação de artefactos | Paquete aún no consolidado | Pendiente | - | Entrega final Phase 8 | Pendiente L6 |
| E8-L7-001 | L7 | FREEZE_PHASE8.md | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/FREEZE_PHASE8.md | Documento de freeze | Freeze aún no aplicado | Pendiente | - | Cierre de Phase 8 | Pendiente L7 |

## Clasificación de Evidencia

### attempted_failed
La corrida no pudo completarse por razones técnicas o de entorno. No cuenta como evidencia de validación.

### preliminary_valid
La corrida se completó pero con limitaciones conocidas:
- Entorno de test no production
- Dataset sintético o controlado
- Sin repeticiones estadísticas
- Proveedores en modo opt-in

### formal_valid
La corrida cumple con:
- Protocolo documentado y repeatable
- Múltiples repeticiones
- Ground truth establecido
- Resultados exportables y auditables
- Clasificación explícita de limitaciones

## Notas de Uso

- Todos los SHA deben ser capturados al momento de generar cada artefacto
- El campo "Uso futuro" indica cómo se integrará la evidencia en la cuarta entrega
- Las limitaciones deben documentarse explícitamente para evitar claims inflados
