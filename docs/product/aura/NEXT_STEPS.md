# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica quedó presentada, evaluada y archivada como histórica. No hay tercera entrega viva.

## Estado actual

| Fase | Estado | Referencia |
|---|---|---|
| Phase 5–9 | Cerradas y congeladas | Ver `FREEZE_PHASE10.md` |
| Phase 10 | Congelada | `7f970d6f6dab46fe2c30b7e522811b8174aac385` |

Phase 10 cubrió calibración embebida, provider readiness, UX diagnóstico, Chrome AI readiness, Ollama local bridge, contratos LLM v2 experimentales y decisión de no sustitución productiva.

## Foco técnico actual

1. **E2E real con Chrome AI / Gemini Nano** usando perfil dedicado (`$HOME/.aura/chrome-ai-profile`).
   - Auditoría: `docs/product/aura/e2e/CHROME_AI_REAL_E2E_AUDIT.md`
   - Modelo descargado y funcional cuando Chrome se lanza de forma nativa.
   - Pendiente: corregir spec E2E para usar `connectOverCDP` en lugar de `launchPersistentContext`.

2. **Corregir bloqueadores detectados en la auditoría E2E.**

## Phase 10 L13 — Diagnostic Report Pipeline

Decision de producto: el flujo principal de AURA debe cerrar en un perfil definitivo / informe diagnostico, con PDF como salida principal. El perfil tecnico base sigue ejecutandose antes del diagnostico y alimenta al LLM, pero la generacion de script, revision HITL y reauditoria pasan a una rama opcional de remediacion.

Plan base: `docs/product/aura/phase_10/L13_DIAGNOSTIC_REPORT_PIPELINE_PLAN.md`

Loops:

| Loop | Foco | Estado |
|---|---|---|
| L13A Architecture | Documentar decision, flujo observado, flujo propuesto, riesgos y criterios | Cerrado |
| L13B Report data model | Definir modelo interno de `DiagnosticReport` desde `AuditReport`, `auditEvidence` y diagnostico asistido | Cerrado |
| L13C Pipeline state refactor | Agregar `diagnostic_report` y separar camino principal de remediacion | Cerrado |
| L13D DiagnosticReportStep UI | Crear pantalla de perfil definitivo con acciones de exportacion principal | Cerrado |
| L13E Professional PDF generator | Generar PDF diagnostico profesional con graficos reproducibles desde `DiagnosticReport.chartSpecs` | Cerrado |
| L13F Optional remediation branch | Convertir script, HITL y reauditoria en rama opcional | Siguiente |
| L13G Titanic E2E | Validar el flujo humano completo con fixture Titanic y exportes principales | Pendiente |

## Estado documental

- Documento fuente de verdad: `docs/product/aura/CURRENT_STATE.md`
- Roadmap vivo: `docs/product/aura/ROADMAP.md`
- Tercera entrega: archivada en `docs/archive/academic/entrega_03_historica/`

## Frontera académica

- Tercera entrega: presentada y evaluada positivamente.
- No existe una nueva entrega academica numerada.
- Objetivo académico futuro: depósito definitivo.
- No preparar entregas intermedias sin instrucción explícita.

## Claims de producto

Permitido:
- AURA tiene fases técnicas congeladas y documentadas hasta Phase 10.
- AURA soporta diagnóstico asistido por LLM bajo controles HITL.
- AURA tiene evidencia reproducible de fixtures controlados.
- Chrome AI / Gemini Nano funciona con perfil dedicado cuando Chrome se lanza de forma nativa.

No permitido:
- Declarar AURA lista para uso general en entornos productivos.
- Decir que AURA corrige datasets reales sin control humano.
- Presentar comparaciones como conclusion universal sin protocolo formal.
- Afirmar que existe una nueva entrega academica en curso.
- Declarar un modelo como ganador para todos los casos.
