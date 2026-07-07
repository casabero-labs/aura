# Current State — AURA

## Estado del producto

AURA es una arquitectura local-first para auditoría inteligente de calidad del dato con soporte de modelos de lenguaje. La app está en desarrollo activo con fases congeladas hasta Phase 10.

**HEAD del freeze:** `7f970d6f6dab46fe2c30b7e522811b8174aac385`

## Estado documental

| Documento | Propósito |
|-----------|-----------|
| `NEXT_STEPS.md` | Bitácora viva de próximos pasos |
| `ROADMAP.md` | Roadmap mínimo de producto |
| `CURRENT_STATE.md` | Este documento — fuente de verdad |
| `e2e/CHROME_AI_REAL_E2E_AUDIT.md` | Auditoría E2E Chrome AI real |
| `phase_10/FREEZE_PHASE10.md` | Freeze documental de Phase 10 |

## Estado académico

- **Tercera entrega:** presentada y evaluada. Retroalimentación positiva del profesor. Archivada en `docs/archive/academic/entrega_03_historica/`.
- **Cuarta entrega:** no existe ni se planea.
- **Meta futura:** depósito definitivo del TFM.
- **No hay entregas intermedias vivas.**

## Estado técnico

| Componente | Estado |
|-----------|--------|
| Phase 1–9 | Congeladas |
| Phase 10 | Congelada |
| Contratos LLM v2 | `experimental_candidate` — no sustituye producción |
| Chrome AI / Gemini Nano | Modelo descargado (4.0G). Funcional con Chrome nativo. E2E spec requiere fix. |
| Ollama local bridge | Integrado en UI. Depende del entorno del usuario. |
| E2E estándar | 65/78 tests pasan. Timeouts en QA/Layout no bloquean core. |

## Acción técnica activa

- Corregir spec `aura-chrome-ai-real.optin.spec.ts`: migrar `launchPersistentContext` → `connectOverCDP`.
- Ejecutar flujo E2E completo con Chrome AI real una vez corregido el spec.

## Claims prohibidos

- Production-ready.
- Benchmark formal definitivo.
- Mejor modelo universal.
- Cuarta entrega.
- Tercera entrega viva.
