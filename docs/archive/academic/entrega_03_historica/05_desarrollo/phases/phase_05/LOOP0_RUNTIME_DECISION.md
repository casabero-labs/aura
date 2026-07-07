# Phase 5 Loop 0 — Decisión de Runtime

> **Estado:** decisión documentada, no implementada  
> **Loop:** Phase 5 L0  
> **Fecha:** 2026-07-01  
> **Base:** Phase 4 cerrada y congelada en `05878e4a960afd11d564a60f4924bfb8f0b527e7`  
> **Modelo:** DeepSeek Pro V4

---

## 1. Alcance de esta decisión

Este documento resuelve la pregunta pospuesta en `PHASE5_DESIGN.md` sección 4: qué runtime usará Phase 5 para ejecutar scripts `clean_dataset(df)` aprobados. La decisión se toma en Loop 0 (diseño, sin ejecución) y habilita la implementación de loops L1 en adelante.

No se modifica código productivo. No se ejecuta Python. No se tocan evidencias congeladas (Phase 3, Phase 4).

---

## 2. Auditoría de contradicciones documentales

### 2.1 Contradicciones detectadas y resueltas

| # | Documento A | Documento B | Contradicción | Resolución |
|---|---|---|---|---|
| 1 | `ROADMAP_FASES_RESTANTES.md`: «Phase 3 está congelada. La siguiente fase es Phase 4.» | `00_MAPA_MAESTRO_TFM.md`: Phase 4 cerrada y congelada. Phase 5 diseño pendiente. | ROADMAP está obsoleto desde el cierre de Phase 4. | **Se actualiza ROADMAP** en este loop. |
| 2 | `00_MAPA_MAESTRO_TFM.md`: Phase 5 «Diseño pendiente» | `RESUMEN_CIERRE_INCIDENTES_POLICIALES.md`: ColabExporter implementado, delta fixture ejecutado, loops 5b–5d y 7 cerrados. | El mapa maestro no reconoce experimentos ya ejecutados como trabajo de Phase 5. | **Los experimentos Colab son pre-Phase 5.** Pertenecen a la categoría «experimentos externos de validación». No son parte del pipeline formal de Phase 5. Esta decisión los reclasifica. |
| 3 | `PHASE5_DESIGN.md` §4: lista 4 opciones de runtime (Pyodide, Worker, Backend, Node+sandbox). | `DECISION_EJECUCION_PYTHON_AURA.md`: ya evaluó Pyodide vs Colab vs Script-only y recomendó Colab como camino inmediato. | PHASE5_DESIGN no referencia la decisión ya tomada ni los experimentos Colab existentes. | **PHASE5_DESIGN.md queda como diseño de arquitectura.** Esta decisión de runtime lo complementa sin modificarlo. |
| 4 | `NEXT_STEPS.md`: «Phase 5 Loop 0 — Design only. No ejecutar scripts generados.» | `RESUMEN_CIERRE_INCIDENTES_POLICIALES.md`: ya se ejecutó Python externo sobre fixture controlado con `run_colab_delta_fixture.mjs`. | NEXT_STEPS no distingue entre experimentos externos ya hechos y ejecución formal de Phase 5. | **Los experimentos externos no violan la regla.** Phase 5 formal aún no ha ejecutado nada. NEXT_STEPS se actualiza para aclarar la frontera. |
| 5 | `PLAN_LOOPS_PHASE5.md`: L0 entrega «PHASE5_DESIGN.md, IMPROVEMENT_RUN_CONTRACT.md, matriz de riesgos» | Realidad: ambos documentos ya existen antes de L0. | L0 se definió como productor de documentos que ya estaban escritos. | **L0 se redefine:** su entregable principal es esta decisión de runtime + actualización de roadmap/NEXT_STEPS. Los documentos existentes son insumos, no outputs. |

### 2.2 No-contradicciones verificadas

- Phase 3 congelada: todos los documentos respetan el freeze `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.
- Phase 4 congelada: todos los documentos respetan el freeze `05878e4a960afd11d564a60f4924bfb8f0b527e7`.
- Contracts v2 (`EvidenceEnvelopeV2`, `DiagnosisResponseV2`, `RemediationPlanV2`, `ScriptContractV2`): ningún documento propone modificarlos.
- Claims de ejecución Python interna: ningún documento vigente los afirma.

---

## 3. Separación de responsabilidades

### 3.1 Phase 5 formal pendiente

Trabajo que debe completarse dentro del pipeline AURA con código, tests, build, evidencia reproducible y cierre documental:

| Loop | Responsabilidad | Estado |
|---|---|---|
| L0 | Decisión de runtime + alineación documental | **Este documento** |
| L1 | Verificador pre-ejecución (preflight) | Pendiente |
| L2 | Runtime sandbox mínimo | Pendiente |
| L3 | Ejecución de `clean_dataset` sobre copia | Pendiente |
| L4 | Reauditoría post-ejecución con `EvidenceEnvelopeV2` | Pendiente |
| L5 | `HealthDeltaV1` formal | Pendiente |
| L6 | Exportación de CSV limpio + reporte | Pendiente |
| L7 | E2E + capturas | Pendiente |
| L8 | Cierre formal de Phase 5 | Pendiente |

### 3.2 Experimentos Colab/Python externos ya existentes

Trabajo ejecutado fuera del pipeline formal de Phase 5. Sirve como validación de concepto pero no como evidencia de cierre de fase:

| Artefacto | Ubicación | Tipo |
|---|---|---|
| `colabExporter.ts` | `src/services/` | Código productivo (exportación, no ejecución) |
| `colabExporter.test.ts` | `src/__tests__/` | Tests unitarios |
| `colabDeltaFixture.test.ts` | `src/__tests__/` | 19 tests sobre fixture delta |
| `evidenceManifest.test.ts` | `src/__tests__/` | 16 tests con source debt |
| `run_colab_delta_fixture.mjs` | `experiments/tests/` | Runner Python externo |
| `run_audit_wrapper.ts` | `experiments/tests/` | Wrapper TS para runAudit |
| `incidentes_semantic_sample.csv` | `experiments/tests/fixtures/` | Fixture 10 filas |
| `incidentes_clean_script.py` | `experiments/tests/fixtures/` | Script v1+v2 de limpieza |
| `incidentes_colab_delta_fixture.json` | `experiments/tests/results/` | Delta JSON con reAudit |
| `incidentes_notebook_exportado.ipynb` | `experiments/tests/results/` | Notebook nbformat 4.5 |
| `DECISION_EJECUCION_PYTHON_AURA.md` | `docs/.../05_desarrollo/` | Documento de decisión previa |
| `PROTOCOLO_VALIDACION_COLAB_REAL.md` | `docs/.../05_desarrollo/` | Protocolo manual pendiente |

### 3.3 Claims permitidos (tras este Loop 0)

- AURA dispone de un servicio `colabExporter.ts` que genera notebooks `.ipynb` nbformat 4.5 con trazabilidad completa del script aprobado.
- Se ejecutó Python externo sobre fixture controlado y el resultado fue re-auditado con `runAudit` oficial vía `tsx`. Score 65→26, delta −39. Clasificado como `source_debt_preserved`.
- La exportación a Colab es un camino de ejecución externa validado conceptualmente. No es ejecución interna de AURA.
- La decisión de runtime para Phase 5 formal está documentada y aprobada en este documento.
- Phase 5 Loop 0 está cerrado. El siguiente paso es Loop 1 (preflight verifier).

### 3.4 Claims prohibidos (sin cambios respecto al mapa maestro)

- AURA ejecuta Python internamente.
- El script mejora el score cuando el delta es negativo.
- Validado en Colab real (sin evidencia de ejecución manual).
- El script elimina la contaminación de CrimeId.
- AURA reduce data downtime con medición real.
- Elimina alucinaciones.
- HealthDelta real (no implementado).
- Benchmark formal de utilidad (no ejecutado).

---

## 4. Decisión de runtime

### 4.1 Opciones evaluadas

| Opción | Estado actual | Viabilidad inmediata | Riesgo | Valor TFM |
|---|---|---|---|---|
| **A. Colab formal inmediato** | colabExporter.ts existe. Notebook generado y validado. Protocolo de validación manual documentado. | Alta. Solo falta ejecución manual en Colab real. | Bajo. Depende de interacción humana externa. | Medio. Cierra el ciclo pero delega ejecución a Google. |
| **B. Pyodide experimental** | Spike intentado (timeout 30s). Requiere COOP/COEP en Coolify/Cloudflare. ~20 MB WASM + pandas. | Baja. Infraestructura no controlada. | Alto. Cold start 10-25s. Compatibilidad Safari 16.4+. | Alto. Ejecución 100% local-first. |
| **C. Backend local Python** | No implementado. Requiere servicio Python separado. | Media. Requiere deploy de nuevo servicio. | Medio. Nuevo servicio = nueva superficie de ataque. | Bajo. Rompe arquitectura local-first. |
| **D. Node + sandbox externo** | No implementado. | Baja. No ejecuta Python real sin child_process. | Alto. Aislamiento insuficiente en Node. | Bajo. |
| **E. Híbrida (Colab + Pyodide feature flag)** | Colab listo. Pyodide pendiente de infra. | Alta para Colab. Baja para Pyodide. | Medio. Dos caminos de mantenimiento. | Alto. Cubre ambos casos de uso. |

### 4.2 Decisión: Estrategia Híbrida con Colab formal inmediato

**Runtime primario para Phase 5:** Colab notebook exportable (`colabExporter.ts` ya implementado).

**Runtime secundario (stretch goal):** Pyodide como feature flag `?pyodide=1`, condicionado a resolver COOP/COEP en infraestructura.

**Fundamento:**

1. **Colab ya funciona.** El exportador está implementado, testeado (19 tests en `colabDeltaFixture.test.ts`) y verificado (nbformat 4.5, 8 celdas, script completo, privacidad, checklist). No requiere nueva infraestructura.

2. **Phase 5 necesita ejecución real para ser defendible.** Sin ejecución real del script, Phase 5 no puede calcular HealthDelta ni producir dataset corregido. Colab proporciona esa ejecución real con riesgo mínimo.

3. **Pyodide es el objetivo arquitectónico correcto** (local-first, sin dependencia externa) pero requiere trabajo de infraestructura (COOP/COEP en Coolify/Cloudflare) que está fuera del alcance inmediato de Phase 5.

4. **El contrato `ImprovementRunV1` es agnóstico al runtime.** Su campo `ExecutionSummaryV1.runtime` acepta `'pyodide' | 'local_python' | 'other'`. Colab se registra como `'other'` con metadata de notebook. Si Pyodide se implementa después, el contrato no requiere cambios.

5. **La evidencia de ejecución en Colab se obtiene mediante protocolo manual** documentado en `PROTOCOLO_VALIDACION_COLAB_REAL.md`. Esto es suficiente para el TFM: el sistema genera el artefacto ejecutable, el humano lo ejecuta en entorno controlado, y el resultado se re-audita en AURA.

### 4.3 Contrato de ejecución para Phase 5

```text
ScriptContractV2 aprobado
→ fresh verification (verifyScriptContractV2)
→ preflight check (L1)
→ generación de notebook Colab (colabExporter.ts)
→ ejecución manual en Colab (protocolo documentado)
→ descarga de CSV corregido
→ carga en AURA
→ reauditoría con EvidenceEnvelopeV2
→ HealthDeltaV1
→ ImprovementRunV1
→ exportación
```

Para Pyodide (futuro), el paso «generación de notebook Colab → ejecución manual» se reemplaza por ejecución directa en navegador.

---

## 5. Pendientes técnicos

| ID | Pendiente | Tipo | Loop destino |
|---|---|---|---|
| T1 | Implementar `preflightCheck()` que valide contrato, hash, fingerprint y acciones aceptadas antes de ejecutar | Código | L1 |
| T2 | Diseñar sandbox de ejecución con timeout, sin red, sin filesystem, imports whitelist | Código | L2 |
| T3 | Adaptar `colabExporter.ts` para aceptar `ImprovementRunV1` como entrada y generar notebook con metadatos de ejecución | Código | L3 |
| T4 | Integrar reauditoría con `EvidenceEnvelopeV2` sobre dataset post-ejecución | Código | L4 |
| T5 | Implementar `HealthDeltaV1` con status improved/unchanged/worsened/inconclusive | Código | L5 |
| T6 | Implementar exportación de CSV limpio + `ImprovementRunV1` JSON | Código | L6 |
| T7 | E2E tests para flujo completo de ejecución | Tests | L7 |
| T8 | Resolver COOP/COEP en Coolify/Cloudflare para Pyodide | Infraestructura | Post-Phase 5 |
| T9 | Ejecutar protocolo de validación Colab real (manual) | Evidencia | L3 (post-ejecución) |
| T10 | Medir cold start de Pyodide en entorno Coolify real | Infraestructura | Post-Phase 5 |

## 6. Pendientes académicos

| ID | Pendiente | Tipo | Loop destino |
|---|---|---|---|
| A1 | Actualizar `TERCERA_ENTREGA_AURA_CONSOLIDADA.md` con resultados de Phase 5 | Documento | L8 |
| A2 | Redactar sección «Trabajo futuro» mencionando Phase 5 como siguiente fase | Documento | L8 |
| A3 | Documentar limitaciones de ejecución Colab (dependencia externa, intervención humana) | Documento | L8 |
| A4 | Preparar tabla APA de HealthDelta para memoria/artículo | Documento | L8 |
| A5 | Comparar delta simulación JS vs delta ejecución Python real | Evidencia | L4-L5 |

---

## 7. Próximo loop exacto

**Phase 5 Loop 1 — Preflight Verifier.**

Objetivo: implementar helper `preflightCheck(contract: ScriptContractV2): PreflightResult` que valide condiciones de entrada antes de autorizar ejecución.

Alcance:
- Verificar `verifyScriptContractV2` fresco.
- Validar coincidencia de `scriptHash` con `scriptText`.
- Validar coincidencia de `datasetFingerprint`.
- Validar coherencia de `acceptedActionIds` con el plan HITL.
- Devolver `PreflightResult` con `status: 'ready' | 'blocked'` y razones de bloqueo.
- Tests unitarios con contratos válidos e inválidos.
- No ejecutar Python.
- No modificar contratos v2.

Criterio de cierre:
- `npm run typecheck` limpio.
- `npm run build` exitoso.
- Tests unitarios pasando.
- `NEXT_STEPS.md` actualizado a L2.

---

## 8. Riesgos abiertos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Colab real produce resultados diferentes al fixture local | Media | Bajo | Documentar divergencia como hallazgo, no como error |
| Pyodide nunca se implementa por bloqueo COOP/COEP | Media | Medio | Colab cubre el caso de uso académico. Pyodide es stretch goal. |
| El usuario no ejecuta el notebook en Colab (requiere cuenta Google) | Alta | Bajo | El protocolo manual es opt-in. La simulación JS sigue como fallback. |
| HealthDelta con score que no mejora (source_debt_preserved) | Alta | Bajo | Ya documentado en fixture. No es un fallo, es un resultado válido. |
| Cambios en API de Google Colab rompen el notebook | Baja | Medio | nbformat es estándar Jupyter. Colab es compatible hacia atrás. |
| Phase 5 se extiende más allá del calendario del TFM | Media | Alto | Priorizar L1-L5 (core). L6-L8 pueden simplificarse si es necesario. |

---

## 9. Referencias

- `PHASE5_DESIGN.md` — diseño de arquitectura Phase 5
- `IMPROVEMENT_RUN_CONTRACT.md` — contrato preliminar ImprovementRunV1
- `PLAN_LOOPS_PHASE5.md` — plan de loops Phase 5
- `DECISION_EJECUCION_PYTHON_AURA.md` — decisión previa sobre ejecución Python
- `PROTOCOLO_VALIDACION_COLAB_REAL.md` — protocolo manual de validación Colab
- `RESUMEN_CIERRE_INCIDENTES_POLICIALES.md` — experimentos pre-Phase 5
- `00_MAPA_MAESTRO_TFM.md` — mapa maestro
- `NEXT_STEPS.md` — próximos pasos
- `ROADMAP_FASES_RESTANTES.md` — roadmap (obsoleto, actualizado en este loop)
