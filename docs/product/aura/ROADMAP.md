# Roadmap — AURA producto

## Naturaleza documental

Este roadmap pertenece al desarrollo continuo de producto. No representa una entrega académica cerrada.

## Frontera académica

La tercera entrega académica fue presentada y evaluada positivamente. Está archivada como histórica en `docs/archive/academic/entrega_03_historica/`.

No existe cuarta entrega. El objetivo académico futuro es el depósito definitivo.

## Estado por fases

| Fase | Estado | Observación |
|---|---|---|
| Phase 1–4 | Cerradas y congeladas | Núcleo de arquitectura |
| Phase 5–9 | Cerradas y congeladas | Expansión de producto |
| Phase 10 | Congelada | `7f970d6f6dab46fe2c30b7e522811b8174aac385` |

## Foco técnico actual

### 1. Validar app mediante E2E real

- E2E estándar con Playwright (78 tests, 65 pasan).
- E2E opt-in con Chrome AI / Gemini Nano real usando perfil dedicado.
- Auditoría: `docs/product/aura/e2e/CHROME_AI_REAL_E2E_AUDIT.md`.

### 2. Corregir bloqueadores

- Spec `aura-chrome-ai-real.optin.spec.ts` debe migrar de `launchPersistentContext` a `connectOverCDP`.
- Timeouts en QA/Layout tests (no bloquean diagnóstico core).

### 3. Contratos LLM v2

- Estado: `experimental_candidate`.
- No sustituye producción.
- Pendiente: más datasets, validación HITL, pruebas con proveedor real.

## Regla de organización

- Entregas académicas cerradas: `docs/archive/academic/`.
- Producto vivo: `docs/product/aura/`.
- Evidencia experimental: `docs/product/aura/evidence/`.
- Fases de producto: `docs/product/aura/phase_10/` o `docs/product/aura/phases/`.

## No iniciar sin instrucción explícita

- No crear nuevas fases numeradas (Phase 11+).
- No preparar entregas académicas intermedias.
- No declarar production-ready ni benchmark formal definitivo.
