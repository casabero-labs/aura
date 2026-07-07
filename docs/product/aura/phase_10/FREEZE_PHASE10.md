# Freeze Phase 10 — AURA

## 1. Estado final

| Ítem | Valor |
|------|-------|
| **Estado** | Congelado |
| **HEAD auditado** | `b55069fd6cb310fef1ff29402e2ae023a4e322d0` |
| **Fecha** | 2026-07-07 |
| **Repositorio** | Limpio |
| **Issues abiertas** | 0 |

## 2. SHAs principales

| Fase | Descripción | SHA |
|------|-------------|-----|
| L11 | Embedded calibration | `4fb3e4ac321193da072e7646ca00c46878707497` |
| L12 | Provider readiness | `92905736e19703480275242a50ee80554420bc92` |
| L12 doc-fix | Provider readiness doc fix | `d33d172d417a6dec92076c1c7ebdb9d3140fcdce` |
| L13 | Diagnosis UX | `db2f5bc0283fed90f753d2a8897fd8301c3761d2` |
| L13 doc-fix | Diagnosis UX doc fix | `be4b1ece88507be0b057cf4db340fa1d2e29d486` |
| L14 | Chrome AI readiness | `71f814b7829427061f570883d1082b34c0441ee3` |
| L14 doc-fix | Chrome AI readiness doc fix | `c76e1899f19e99e31fc30d346f49832aaee00b2a` |
| L15 | Ollama local bridge | `58af89cf703e0a09ae9f4487dc4971cd3e4e0f44` |
| L16 | Ollama UI integration | `e7bf3742d0b9ad9c547872f2066be4478cf1ac83` |
| L16 doc-fix | Ollama UI integration doc fix | `ddeb6e229f8d7701565644cb706f13e64909ed04` |
| L18 | LLM contract baseline (Titanic) | `0c9635360c3329bfd42791e768092c767f84074c` |
| L18 doc-fix | LLM contract baseline doc fix | `2d8aa4f050ad76a0e21392b9d3ec34b23d4f4d87` |
| L19 | LLM v2 experimental comparison | `9d25cf4db5095c735c0e57e5aed161b8cc1c2081` |
| L19 doc-fix | LLM v2 comparison doc fix | `059e780aea8365cd633017c7d867c3f279e6de42` |
| L20 | LLM contract v2 decision | `b55069fd6cb310fef1ff29402e2ae023a4e322d0` |
| **L21 (freeze)** | **Freeze Phase 10** | **(este commit)** |

## 3. Capacidades cerradas

- Calibración embebida opt-in.
- Exportación con evidencia controlada.
- Provider readiness.
- Chrome AI readiness UX.
- Diagnóstico reordenado alrededor de progreso y resultado.
- Ollama local browser → loopback.
- LLM baseline Titanic.
- LLM v2 experimental comparison.
- Decisión de no sustituir producción todavía.

## 4. Estado de contratos LLM v2

| Atributo | Valor |
|----------|-------|
| Estado | `experimental_candidate` |
| Producción | No activado |
| Sustitución | No aprobada |
| Requisitos pendientes | Más datasets, validación HITL, pruebas con proveedor real |

## 5. Claims permitidos

- AURA incorpora una arquitectura local-first.
- AURA soporta diagnóstico asistido por LLM bajo controles.
- AURA tiene evidencia reproducible de fixtures controlados.
- AURA tiene comparación experimental v2 sobre Titanic.
- AURA preserva HITL para casos de riesgo.
- AURA no envía datos al backend cuando usa Ollama local browser → loopback.

## 6. Claims prohibidos

- No production-ready.
- No benchmark formal.
- No mejor modelo.
- No modelo ganador universal.
- No sustitución productiva de v2.
- No cuarta entrega iniciada.
- No corrección automática universal de datasets.

## 7. Validaciones

| Validación | Resultado |
|------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ |

## 8. Greps

```
$ grep -R "production-ready\|benchmark formal\|formal benchmark\|mejor modelo\|best model\|modelo ganador\|ganador universal" docs/product/aura/phase_10/FREEZE_PHASE10.md
  => solo en sección "Claims prohibidos" ✅

$ grep -R "cuarta entrega" docs/product/aura/phase_10/FREEZE_PHASE10.md
  => solo en "Claims prohibidos" ✅

$ grep -R "productionContractChanged.*true\|usedRealAiProvider.*true\|formalBenchmark.*true" docs/product/aura/phase_10
  => solo en L19 comparison JSON (datos reportados, no flags verdaderos) ✅
```

Criterio cumplido: términos prohibidos solo aparecen como claims prohibidos, límites o negaciones explícitas.

## 9. Riesgos abiertos

- v2 no sustituye producción.
- Chrome AI real sigue opt-in.
- Ollama depende del entorno local del usuario.
- Evidencias L18-L20 usan fixture controlado.
- Hace falta redacción académica posterior para entrega, sin iniciar cuarta entrega.

## 10. Issues cerradas

| Issue | Estado | Fases involucradas |
|-------|--------|--------------------|
| #3 — Ollama UI integration | ✅ Completed | L16 |
| #4 — Contratos LLM v2 | ✅ Completed | L18-L20 |
| #6 — Issue #6 hygienic close | ✅ Completed | L17 |

## 11. Notas finales

Phase 10 cubrió desde calibración embebida (L11) hasta contratos LLM v2 experimentales (L19-L20), pasando por provider readiness, UX diagnóstico, Chrome AI readiness y Ollama local bridge. No se inició cuarta entrega. No se inició Phase 10 L22.

El repositorio queda en estado limpio, con 0 issues abiertas, listo para el próximo hito que se defina.
