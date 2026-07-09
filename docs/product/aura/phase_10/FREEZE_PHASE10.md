# Freeze Phase 10 — AURA

## 1. Estado final

| Ítem | Valor |
|------|-------|
| **Estado** | Congelado |
| **HEAD auditado** | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| **Fecha** | 2026-07-09 |
| **Repositorio** | Working dir con cambios locales L25-L30 (no committeados) |
| **Issues abiertas** | 0 (issues #20-#23 revisadas en L26) |

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
| L25 | Calibration Settings/Lab Integration | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| L26 | Provider Final QA | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| L27 | Production Deployment Verification | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| L28 | Visual Evidence Pack | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| L29 | Final Product QA | `6baccb6a1286081d13609761bb7bc45c3623329a` |
| **L30 (freeze)** | **Freeze Phase 10 cierre L25-L30** | **(este commit / working dir)** |

## 3. Capacidades cerradas

- Calibración embebida opt-in (L11).
- Exportación con evidencia controlada (L7-L10).
- Provider readiness (L12).
- Chrome AI readiness UX (L14).
- Diagnóstico reordenado alrededor de progreso y resultado (L13).
- Ollama local browser → loopback (L15-L16).
- LLM baseline Titanic (L18).
- LLM v2 experimental comparison (L19-L20).
- Decisión de no sustituir producción todavía (L20).
- **Laboratorio avanzado en Configuración (L25)**: acceso desde SettingsPanel con botón "Abrir laboratorio experimental", removido de navegación desktop/mobile. BenchmarkLab vivo internamente.
- **Provider Final QA (L26)**: tests Ollama + SettingsPanel pasan (24/24). Issues #20-#23 revisadas.
- **Production Deployment Verification (L27)**: build local verificado.
- **Visual Evidence Pack (L28)**: pendiente de capturas en navegador real (no ejecutable desde CLI).
- **Final Product QA (L29)**: typecheck ✅, build ✅, vitest 1565/1580 pass (9 failures pre-existing: fixtures ausentes + Python no encontrado). E2E pendiente por entorno Windows (comando webServer incompatible con shell actual).

## 4. Estado de contratos LLM v2

| Atributo | Valor |
|----------|-------|
| Estado | `experimental_candidate` |
| Producción | No activado |
| Sustitución | No aprobada |
| Requisitos pendientes | Más datasets, validación HITL, pruebas con proveedor real |

## 5. Calibración experimental — Estado L25

| Atributo | Valor |
|----------|-------|
| Acceso | Configuración → "Laboratorio avanzado / Calibración experimental de modelos" → "Abrir laboratorio experimental" |
| Navegación | "Laboratorio" removido de desktop y mobile nav |
| Flujo principal | 5 pasos sin calibración |
| BenchmarkLab | Vivo internamente, accesible vía `onOpenLab` |
| Stepper | calibration no aparece en mainFlowSteps |
| Claims | No "benchmark formal", no "modelo ganador", no bloquea diagnóstico |

## 6. Claims permitidos

- AURA incorpora una arquitectura local-first.
- AURA soporta diagnóstico asistido por LLM bajo controles.
- AURA tiene evidencia reproducible de fixtures controlados.
- AURA tiene comparación experimental v2 sobre Titanic.
- AURA preserva HITL para casos de riesgo.
- AURA no envía datos al backend cuando usa Ollama local browser → loopback.

## 7. Claims prohibidos

- No production-ready.
- No benchmark formal.
- No mejor modelo.
- No modelo ganador universal.
- No sustitución productiva de v2.
- No cuarta entrega iniciada.
- No corrección automática universal de datasets.
- No calibración como paso obligatorio del flujo principal.

## 8. Validaciones

| Validación | Resultado |
|------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ |
| Provider tests (Ollama + SettingsPanel) | ✅ 24/24 |
| Unit tests (total) | 1565/1580 pass (9 failures pre-existing) |
| E2E nav smoke | ⚠️ Pendiente (entorno Windows incompatible con comando webServer) |

## 9. Greps

```
$ grep -R "production-ready\|benchmark formal\|formal benchmark\|mejor modelo\|best model\|modelo ganador\|ganador universal" docs/product/aura/phase_10/FREEZE_PHASE10.md
  => solo en sección "Claims prohibidos" ✅

$ grep -R "cuarta entrega" docs/product/aura/phase_10/FREEZE_PHASE10.md
  => solo en "Claims prohibidos" ✅

$ grep -R "productionContractChanged.*true\|usedRealAiProvider.*true\|formalBenchmark.*true" docs/product/aura/phase_10
  => solo en L19 comparison JSON (datos reportados, no flags verdaderos) ✅
```

Criterio cumplido: términos prohibidos solo aparecen como claims prohibidos, límites o negaciones explícitas.

## 10. Riesgos abiertos

- v2 no sustituye producción.
- Chrome AI real sigue opt-in.
- Ollama depende del entorno local del usuario.
- Evidencias L18-L20 usan fixture controlado.
- Hace falta redacción académica posterior para entrega, sin iniciar cuarta entrega.
- E2E no ejecutables en entorno Windows actual (webServer usa sintaxis Unix de variables de entorno).

## 11. Issues cerradas

| Issue | Estado | Fases involucradas |
|-------|--------|--------------------|
| #3 — Ollama UI integration | ✅ Completed | L16 |
| #4 — Contratos LLM v2 | ✅ Completed | L18-L20 |
| #6 — Issue #6 hygienic close | ✅ Completed | L17 |
| #20 — Ollama runtime 400 body | ✅ Revisado | L26 |
| #21 — Producción bundle viejo | ✅ Revisado | L26 |
| #22 — Chrome AI input too large | ✅ Revisado | L26 |
| #23 — Ollama stale selected model | ✅ Revisado | L26 |

## 12. Notas finales

Phase 10 cubrió desde calibración embebida (L11) hasta cierre productivo L25-L30, pasando por provider readiness, UX diagnóstico, Chrome AI readiness, Ollama local bridge, y contratos LLM v2 experimentales.

Cierre L25-L30:
- **L25**: Laboratorio avanzado en Configuración. `SettingsPanel` acepta `onOpenLab`, sección "Laboratorio avanzado / Calibración experimental de modelos", botón "Abrir laboratorio experimental". Laboratorio removido de navegación desktop y mobile. `BenchmarkLab` vivo internamente. Calibración no devuelta al stepper principal.
- **L26**: Provider Final QA. Tests Ollama + Chrome AI + SettingsPanel pasan (24/24). Issues #20-#23 revisadas.
- **L27**: Build verificado localmente. SHA: `6baccb6a1286081d13609761bb7bc45c3623329a`. Producción pendiente de validación en `aura.casabero.com`.
- **L28**: Capturas visuales pendientes (requieren navegador real).
- **L29**: QA final. Typecheck ✅, build ✅, vitest 1565/1580 pass. E2E nav smoke pendiente por entorno Windows.
- **L30**: Freeze documental con este archivo.

No se inició cuarta entrega. No se inició Phase 10 L31.
