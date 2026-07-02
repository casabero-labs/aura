# Phase 8 — Evidence Ledger

## Tabla de Control de Evidencia

| ID Evidencia | Loop | Artefacto Esperado | Archivo/Ruta | Qué Demuestra | Limitación | Estado | SHA Asociado | Uso Futuro en Cuarta Entrega | Observaciones |
|-------------|------|-------------------|--------------|---------------|------------|--------|--------------|------------------------------|---------------|
| E8-L0-001 | L0 | PHASE8_PLAN.md | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/PHASE8_PLAN.md | Definición de alcance, riesgos, roadmap y reglas de Phase 8 | Documento base sin ejecución aún | Completo | - | Marco de referencia para cuarta entrega | Creado en L0 |
| E8-L0-002 | L0 | PHASE8_EVIDENCE_LEDGER.md | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/PHASE8_EVIDENCE_LEDGER.md | Matriz de tracking de evidencia Phase 8 | Sin datos de ejecución | Completo | - | Tracking de evidencia acumulada | Creado en L0 |
| E8-L1-001 | L1 | Tests de boundary | tests/ | Separation de modo demo/evidencia vs modo normal | Tests aún no ejecutados | Completo | por completar al cierre | Validación de boundary | 20 unit tests + 8 E2E tests creados |
| E8-L1-002 | L1 | Documentación de flags | docs/ | Flags de configuración de modo demo | Documentación aún no creada | Completo | por completar al cierre | Guía de configuración | Helper centralizado `demoMode.ts` + CIERRE_LOOP1 |
| E8-L1-003 | L1 | Helper centralizado | src/utils/demoMode.ts | Detección única de modo demo/evidencia | Solo query params, sin env vars | Completo | por completar al cierre | Reutilizable en futuras features | Exporta PROHIBITED_CLAIMS, DEMO_MODE_NOTICE, detectDemoMode |
| E8-L1-004 | L1 | Banner demo UI | src/components/ImprovementRunPanel.tsx | Banner ámbar visible solo con flag | Solo cubre panel de Health Delta | Completo | por completar al cierre | Señal visual de modo demo | data-testid="demo-mode-banner" |
| E8-L1-005 | L1 | Tests E2E boundary | src/tests/e2e/phase8-boundary.spec.ts | No-leak de banner demo a otros tabs | No ejecutados en este commit | Completo (código) | por completar al cierre | Regresión de boundary | 8 specs Playwright listos |
| E8-L1-006 | L1 | Cierre documental | docs/.../phase_08/CIERRE_LOOP1_DEMO_PROD_BOUNDARY.md | Resumen de cambios y claims | Documental | Completo | por completar al cierre | Cierre formal de L1 | Incluye riesgos abiertos |
| E8-L2-001 | L2 | Dataset protocol | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Definición de dataset controlado ampliado | Protocolo aún no definido | Pendiente | - | Contexto de datasets usados | Pendiente L2 |
| E8-L2-002 | L2 | Schema de dataset | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Estructura de datos controlada | Schema aún no creado | Pendiente | - | Referencia técnica | Pendiente L2 |
| E8-L2-003 | L2 | Ground truth documentado | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Datos de referencia para validación | Ground truth aún no creado | Pendiente | - | Baseline de comparación | Pendiente L2 |
| E8-L3-001 | L3 | Audit JSON | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Registro de ejecución completa | Corrida aún no ejecutada | Pendiente | - | Evidencia de ejecución | Pendiente L3 |
| E8-L3-002 | L3 | Issues CSV | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Lista de issues encontrados | CSV aún no generado | Pendiente | - | Detalle de problemas | Pendiente L3 |
| E8-L3-003 | L3 | Script de ejecución | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Script reproducible | Script aún no creado | Pendiente | - | Reproducibilidad | Pendiente L3 |
| E8-L3-004 | L3 | Notebook de análisis | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Análisis de resultados | Notebook aún no creado | Pendiente | - | Análisis exploratorio | Pendiente L3 |
| E8-L3-005 | L3 | Improvement run JSON | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Comparativa pre/post mejora | JSON aún no generado | Pendiente | - | Métricas de mejora | Pendiente L3 |
| E8-L4-001 | L4 | Chrome AI diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de Chrome AI real | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
| E8-L4-002 | L4 | Ollama diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de Ollama local | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
| E8-L4-003 | L4 | Cloud diagnostics | docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/ | Validación de proveedores cloud | Solo en modo opt-in, no CI | Pendiente | - | Evidencia de proveedor | Pendiente L4 |
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
