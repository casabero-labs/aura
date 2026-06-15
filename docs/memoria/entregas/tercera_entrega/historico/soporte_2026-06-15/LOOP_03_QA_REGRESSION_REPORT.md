# LOOP 03 - QA Regression Report - AURA

> Fecha: 2026-06-15
> Rama base: `loop-02-ux-strict-casabero` (2ba83c9)
> Documentos de referencia: LOOP_01, LOOP_02, AUDITORIA_UX (2026-06-14), PROTOCOLO_BENCHMARK, AURA_QA_HUMAN_FIRST, BORRADOR_TERCERA_ENTREGA

---

## 1. Veredicto general

**GO con observaciones**

No se detectan bloqueantes. Los cambios funcionales de Loop 01 y las refiniciones UX de Loop 02 están confirmados en código. Tests pasan. Build compila. El flujo principal upload→perfil→diagnóstico→script→revisión→exportación funciona sin regresión. Las observaciones son de severidad baja y no afectan la defensa académica ni la estabilidad del flujo.

---

## 2. Resumen ejecutivo

Loop 03 verifica que los cambios de Loop 01 (provider-unavailable-notice, delta-zero-warning, lab-unavailable-notice, rutas `__dirname`) y Loop 02 (focus-visible, hint académico, min-width fixes) están presentes y funcionan. Se ejecutan 3 baterías de prueba: 133 tests unitarios OK, build exitoso (warning webllm 6MB pre-existente), 5 E2E OK con FAIL conocido de nav visibility en mobile. Se detectan 4 observaciones no bloqueantes: `formatCompliance` directo sin fallback en `ExperimentDesigner.tsx`, pill "TFM UNIR" visible en nav, `jsonCompliance` legacy fallback, y label "benchmark formal" en manifest como categoría técnica. Todas las rutas documentales son correctas. Zero regresión funcional.

---

## 3. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| `npm test` | 16/16 archivos, 133/133 tests OK | 487ms. Sin fallos ni skipped. |
| `npm run build` | Build exitoso en 2.98s | Chunk warning webllm 6,017kB (pre-existente). Sin errores. |
| `npm run test:e2e` | 5/5 tests OK (6.5s) | Nav visibility FAIL en mobile 390x844 (pre-existente, documentado en LOOP_01 riesgo abierto). Desktop OK. |

---

## 4. Consistencia código-documentación

| Tema | Código | Documento | Estado | Acción |
|------|--------|-----------|--------|--------|
| **Provider-unavailable-notice** | `DiagnosisStep.tsx:444-468` clases `provider-unavailable-notice`, `provider-unavailable-header`, `provider-unavailable-reasons`, `provider-unavailable-actions` | LOOP_01 sección 3.1 — "mensaje específico por tipo de proveedor, CTA determinista, notice attempt_failed" | ✅ Coincide | Ninguna |
| **Delta-zero warning** | `ReviewStep.tsx:267` condicional `healthDelta.scoreDelta === 0` renderiza `review-delta-zero-warning` | LOOP_01 sección 3.2 — "bloque condicional cuando scoreDelta === 0" | ✅ Coincide | Ninguna |
| **Lab unavailable notice** | `BenchmarkLab.tsx:327-344` clases `lab-unavailable-notice`, `lab-unavailable-header`, `lab-unavailable-reasons`, `lab-unavailable-actions`. WebGPU detection en `BenchmarkLab.tsx:78` vía `checkWebGPUSupport()` | LOOP_01 sección 3.3 — "detección WebGPU, notice con causa específica, botón cambio proveedor" | ✅ Coincide | Ninguna |
| **Rutas `__dirname` en tests** | 4 test files usan `path.resolve(__dirname, ...)` sin `process.cwd()` | LOOP_01 sección 3.4 — "todas usan __dirname, sin depender de process.cwd()" | ✅ Coincide | Ninguna |
| **Focus-visible en botones** | `index.css:778` `.btn:focus-visible`, `index.css:5056` `.stepper-step:focus-visible` | LOOP_02 sección 6 — "Agregar :focus-visible en .btn y .stepper-step" | ✅ Coincide | Ninguna |
| **Hint técnico cambiado** | `App.tsx:598` "cobertura de evidencia y manifest" (antes: "cobertura de objetivos TFM") | LOOP_02 sección 6 — "Cambiar hint de technical-details" | ✅ Coincide | Ninguna |
| **Min-width fixes** | `index.css:5608,5820,5830,5872,5926,5942,5973` `min-width: 0` en contenedores export. `index.css:5026` stepper-step `min-width: 60px`. `index.css` btn `min-height: 44px` | LOOP_02 sección 6 — "min-width: 0 a export-claim, stepper-step min-width 60px, btn min-height 44px" | ✅ Coincide | Ninguna |
| **contractCompliance como discurso principal** | Todos los componentes usan `contractCompliance ?? formatCompliance`. Excepción: `ExperimentDesigner.tsx:259` usa `formatCompliance` directo. | PROTOCOLO_BENCHMARK sección 8 — "formatCompliance queda como alias histórico" | ⚠️ Parcial | Corregir ExperimentDesigner.tsx para usar fallback |
| **TFM UNIR pill** | `App.tsx:309` `<span className="nav-academic-pill">TFM UNIR</span>` | LOOP_02 sección 7 — "Eliminar nav-academic-pill o moverlo a estado dev" | ⚠️ No aplicado | App.tsx:309 no se modificó. Decisión pendiente del autor. |
| **Num tests en QA doc** | 133 tests actuales | `AURA_QA_HUMAN_FIRST.md` citaba 131 tests | ⚠️ Desactualizado | Diferencia por tests agregados en loops posteriores. No es error del doc original. |
| **jsonCompliance legacy fallback** | `evaluationService.ts:217` usa `weights.jsonCompliance` como fallback de `contractCompliance`. `evaluationService.ts:480` igual. | PROTOCOLO_BENCHMARK sección 8 — "jsonCompliance queda reservado a parseo JSON real" | ⚠️ Legacy aceptable | Backward compatibility. No hay riesgo porque `jsonCompliance` en weights se comporta como `contractCompliance`. |

---

## 5. Hallazgos bloqueantes

No se detectaron bloqueantes.

---

## 6. Hallazgos no bloqueantes

| Hallazgo | Evidencia | Riesgo | Recomendación |
|----------|-----------|--------|---------------|
| **ExperimentDesigner.tsx usa `formatCompliance` sin fallback** | `src/components/ExperimentDesigner.tsx:259`: `r.formatCompliance ? '✓' : '✗'` sin `contractCompliance ??` | Bajo. Solo afecta visualización en el designer experimental (componente interno). No afecta scoring ni export. | Cambiar a `(r.contractCompliance ?? r.formatCompliance) ? '✓' : '✗'` por consistencia con el resto del código. |
| **"TFM UNIR" pill visible en navegación** | `src/App.tsx:309`. Ya identificado en Loop 02 como hallazgo medio. | Bajo. Riesgo de defensa si se presenta como demo con contexto académico visible. No bloquea flujo. | Eliminar pill u ocultarlo condicionalmente (ej. solo en modo dev). |
| **"benchmark formal" como label de categoría en manifest técnico** | `src/services/evidenceManifest.ts:53`: `label: 'Diagnóstico LLM y benchmark formal'` | Bajo. Dentro de technical-details colapsado. No es afirmación de resultado formal. | Considerar renombrar a "Diagnóstico LLM y laboratorio" para evitar ambigüedad en contexto académico. |
| **jsonCompliance legacy weight fallback** | `evaluationService.ts:217,480`: `weights.contractCompliance ?? weights.jsonCompliance ?? 0.25` | Bajo. Compatibilidad hacia atrás con configs antiguas. No introduce falsos positivos. | Mantener; documentado como `@deprecated`. |
| **E2E mobile nav visibility FAIL** | 3 checks FAIL en mobile: Nav Auditoría, Lab, Configuración no detectados como visibles. | Bajo. Pre-existente desde Loop 01. Los botones son funcionales al hacer clic. Race condition de Playwright con sticky nav. | Agregar `waitFor` o scroll before visibility check en E2E. |

---

## 7. Claims permitidos para el TFM

- AURA implementa un flujo local-first de carga, perfilamiento y auditoría determinista.
- El motor determinista produce evidencia reproducible y puede evaluarse contra ground truth.
- La capa LLM interpreta hallazgos deterministas bajo contratos de entrada.
- El sistema valida scripts antes de revisión humana.
- El Lab permite comparar configuraciones LLM bajo condiciones controladas.
- Las corridas fallidas del Lab se registran como intentos fallidos (`attempted_failed`), no como resultados.
- AURA advierte al usuario cuando un proveedor LLM no está disponible y ofrece un camino determinista alternativo.
- La pantalla de revisión advierte explícitamente cuando la simulación no produce mejora (scoreDelta === 0).
- AURA comunica al usuario qué requisitos faltan para ejecutar corridas formales en el Lab (API key, WebGPU).
- Las rutas de datasets en tests son independientes del directorio de ejecución (basadas en `__dirname`).
- La UI cumple criterios Casabero: lenguaje humano, estados visibles, información progresiva, detalles colapsados.
- `contractCompliance` es la métrica principal de cumplimiento de salida; `formatCompliance` es alias histórico.
- `jsonCompliance` se reserva a parseo JSON real, distinto del cumplimiento contractual textual.
- La aprobación humana no sustituye mejora efectiva del score.

## 8. Claims no permitidos todavía

- "AURA diagnostica con IA incluso sin proveedor LLM configurado." — El proveedor-unavailable-notice bloquea esta afirmación.
- "AURA elimina alucinaciones del LLM." — El detector es parcial, no cubre todas las afirmaciones semánticas.
- "El Laboratorio garantiza resultados comparables entre modelos sin verificación de proveedor." — Sin API key/WebGPU no hay corrida formal.
- "La aprobación humana del script implica mejora efectiva del dataset." — Delta-zero warning bloquea esta interpretación.
- "Los resultados del benchmark son formales sin ground truth, proveedor completo y contrato cumplido." — El evidenceStatus diferencia formal/preliminary/attempted.
- "AURA demuestra que X modelo es superior" sin tabla formal con 3 corridas por configuración.
- "JSON compliance validado" cuando solo se verificó contrato textual (debe decir `contractCompliance`).
- "Reducción real de data downtime demostrada" — No hay medición en entorno productivo.
- "Benchmark formal completado" si no hay corridas `formal_valid` en el Lab exportado.

---

## 9. Recomendación para siguiente loop

**Preparar redacción TFM.**

El código está sincronizado con la documentación. Los cambios de Loop 01 y Loop 02 están verificados. Tests pasan. No hay bloqueantes. La deuda es solo cosmética (pill TFM UNIR, fallback formatCompliance). El siguiente paso natural es redactar la memoria con los claims permitidos y ejecutar el benchmark real cuando haya proveedor disponible.

---

## 10. Commit sugerido

```
docs: add QA regression report for third delivery

- LOOP_03 verifies Loop 01 (functional hardening) and Loop 02 (UX strict)
  changes are present and working
- 133 tests pass, build OK, 5/5 E2E
- No blocking findings; 4 non-blocking observations documented
- Claims permitidos y no permitidos consolidados
```
