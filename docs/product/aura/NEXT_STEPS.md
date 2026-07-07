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

## Estado documental

- Documento fuente de verdad: `docs/product/aura/CURRENT_STATE.md`
- Roadmap vivo: `docs/product/aura/ROADMAP.md`
- Tercera entrega: archivada en `docs/archive/academic/entrega_03_historica/`

## Frontera académica

- Tercera entrega: presentada y evaluada positivamente.
- No existe cuarta entrega.
- Objetivo académico futuro: depósito definitivo.
- No preparar entregas intermedias sin instrucción explícita.

## Claims de producto

Permitido:
- AURA tiene fases técnicas congeladas y documentadas hasta Phase 10.
- AURA soporta diagnóstico asistido por LLM bajo controles HITL.
- AURA tiene evidencia reproducible de fixtures controlados.
- Chrome AI / Gemini Nano funciona con perfil dedicado cuando Chrome se lanza de forma nativa.

No permitido:
- Declarar AURA lista para producción general.
- Decir que AURA corrige datasets reales sin revisión humana.
- Presentar comparaciones como benchmark definitivo sin protocolo formal.
- Afirmar que existe una cuarta entrega en curso.
- Declarar un modelo como ganador universal.
