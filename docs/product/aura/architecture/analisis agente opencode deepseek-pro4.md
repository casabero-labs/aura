# Diagnóstico Crítico del Spec V3 de AURA — Agente DeepSeek-Pro4

**Fecha:** 2026-07-19
**Agente:** DeepSeek-Pro4 via OpenCode
**Contexto:** Análisis independiente del spec `DIAGNOSIS_V3_INTERPRETATION_PURE_DEMO_SPEC.md`

---

## 1. Resumen Ejecutivo

El spec V3 propone una reforma arquitectónica de 9 fases para eliminar errores estructurales del LLM. Los datos de 2 campañas formales (54 corridas, 3 modelos, 3 datasets, 3 modos) muestran que **el 100% de los 604 errores de validación provienen de un solo modelo (SmolLM3-3B)**, mientras que Qwen3.5-4B y Gemma-4-E4B logran **0% de fallos con el contrato V2 actual**. V3 eliminaría ~99.5% de esos errores, pero todos benefician exclusivamente a un modelo que ya produce menos tokens y peor output que sus pares. El spec diagnostica correctamente el mecanismo de fallo pero **no analiza su distribución por modelo**, llevando a una propuesta de 9 fases para un problema que podría resolverse con una regla de capacidad mínima. Recomiendo: **no aprobar** el spec en su forma actual, sino ejecutar primero un análisis de capacidad por modelo y evaluar la alternativa de bajo costo (gate de modelo + ajuste de prompt).

---

## 2. Datos Extraídos de las Campañas

### 2.1 Tasas de Fallo Global

| Campaña | Total | Pasó/Completó LLM | Falló LLM | Tasa Fallo |
|---------|-------|-------------------|-----------|------------|
| Campana2 (2026-07-15) | 27 | 20 | 7 | 25.9% |
| Test Campaña (2026-07-14) | 27 | 19* | 8 | 29.6% |

*19 corridas en `awaiting_human` — el LLM completó exitosamente, falta revisión humana. **Cero fallos de Qwen/Gemma en esta campaña también.**

### 2.2 Fallos por Modelo (ambas campañas combinadas)

| Modelo | Parámetros | Pasó | Falló | Tasa Fallo |
|--------|-----------|------|-------|------------|
| Qwen3.5-4B-GGUF:UD-Q4_K_XL | ~4B | 18 | **0** | **0.0%** |
| Gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL | ~4B | 18 | **0** | **0.0%** |
| SmolLM3-3B-GGUF:UD-Q4_K_XL | ~3B | 3 | **15** | **83.3%** |

**Conclusión: el problema es 100% atribuible a SmolLM3-3B. No hay un solo error de Qwen o Gemma en 36 corridas.**

### 2.3 Fallos por InputMode (solo SmolLM)

| Modo | Pasó | Falló | Tasa Fallo |
|------|------|-------|------------|
| `prompt_libre` | 3 | 3 | 50.0% |
| `smart_sample` | 0 | 6 | 100.0% |
| `recommended` | 0 | 6 | 100.0% |

En `prompt_libre`, SmolLM pasa el 50% de las veces porque no hay `evidenceRefs` que cruzar entre issues. En `smart_sample` y `recommended`, falla el 100%.

### 2.4 Distribución de Códigos de Error (604 totales)

| Código | Ocurrencias | % | Causa raíz |
|--------|-------------|---|------------|
| `DIAGNOSIS_REFERENCE_INVALID` | 364 | 60.3% | `evidenceRef belongs to different issue` (115), orphan blocks (92), missing issues (22), unsupported data claims (11) |
| `DIAGNOSIS_REVIEW_DOWNGRADE` | 129 | 21.4% | El LLM baja `requiresHumanReview` indebidamente |
| `DIAGNOSIS_SCHEMA_INVALID` | 111 | 18.4% | `Duplicate issueId` (76), `Must not be null for column scope` (29), `Must be a non-empty string` (3), `Must be null for dataset scope` (3) |

### 2.5 Output Tokens por Modelo

| Modelo | Avg Output Tokens | Rango |
|--------|-------------------|-------|
| Qwen3.5-4B | 3,705-3,769 | 3,120-4,113 |
| Gemma-4-E4B | 3,581-3,647 | 3,181-4,138 |
| SmolLM3-3B | 2,865-3,047 | 2,549-3,425 |

SmolLM produce ~20% menos tokens que sus pares, consistente con menor capacidad.

### 2.6 Latencia por Modelo

| Modelo | Avg Latencia | Rango |
|--------|-------------|-------|
| Qwen3.5-4B | 53.9-54.9s | 43.8-62.3s |
| Gemma-4-E4B | 51.2-51.9s | 44.4-58.7s |
| SmolLM3-3B | 30.3-32.3s | 27.0-36.0s |

SmolLM es más rápido (~40% menos latencia), pero falla.

### 2.7 Overhead Estructural en V2

Del JSON de una respuesta V2 típica (11,917 caracteres), ~29.5% son campos estructurales (`issueId`, `ruleId`, `columnId`, `scope`, `evidenceRefs`, `contractId`, `requiresHumanReview`, etc.). El 70.5% es contenido semántico. V3 eliminaría este overhead del output del LLM (~30% de ahorro en tokens de salida).

### 2.8 Prompt Tokens por Modo

| Modo | Avg Prompt Tokens | Rango |
|------|-------------------|-------|
| `prompt_libre` | 4,189 | 3,923-4,372 |
| `smart_sample` | 7,376 | 6,792-7,725 |
| `recommended` | 10,031 | 9,247-10,523 |

---

## 3. Análisis: Problema Real vs. Problema que V3 Ataca

### Lo que el spec diagnostica correctamente:

- El contrato V2 fuerza al LLM a copiar identidad (`issueId`, `ruleId`, `columnId`, `scope`, `evidenceRefs`) entre dos arreglos paralelos (`issues[]` y `diagnosisBlocks[]`). Esto es propenso a errores de join.
- Cuando el LLM cruza un `evidenceRef` del issue A al bloque del issue B, toda la respuesta se rechaza con `DIAGNOSIS_REFERENCE_INVALID`.
- El error es estructural, no semántico: el modelo puede haber entendido los datos pero copió mal los IDs.

### Lo que el spec NO diagnostica (y los datos evidencian):

**El problema no es arquitectónico — es de capacidad de modelo.** Dos modelos de 4B parámetros (Qwen, Gemma) logran 0% de fallos con el contrato V2 actual. Solo SmolLM3-3B falla. Esto sugiere que copiar IDs entre arreglos paralelos **está dentro de la capacidad de modelos ≥4B con buen entrenamiento en JSON estructurado**, pero fuera del alcance de modelos de 3B.

El spec describe el problema como si fuera universal ("el LLM es forzado a ser copista"), pero los datos muestran que es **condicional**: ocurre cuando el modelo no tiene suficiente capacidad. La narrativa del spec no menciona este matiz en ninguna de sus 1,238 líneas.

---

## 4. Lo que V3 Resuelve vs. Lo que NO Resuelve

| Código de Error / Problema | Ocurrencias | ¿V3 lo elimina? | ¿Cómo? | ¿A quién beneficia? |
|---|---|---|---|---|
| `DIAGNOSIS_REFERENCE_INVALID` (evidenceRef cruzada, bloques huérfanos, issues faltantes) | 364 | **Sí** | El LLM ya no devuelve `ruleId`, `columnId`, `scope`, ni `evidenceRefs`. El join determinista es responsabilidad de AURA. | Solo a SmolLM. Qwen/Gemma nunca tuvieron este error. |
| `DIAGNOSIS_REVIEW_DOWNGRADE` | 129 | **Sí** | `requiresHumanReview` pasa a ser 100% determinista, calculado por el `DeterministicDiagnosisAssemblerV3`. | Solo a SmolLM. |
| `DIAGNOSIS_SCHEMA_INVALID` (Duplicate issueId) | 76 | **Sí** | `Record<string, Interpretation>` no puede tener claves duplicadas. | Solo a SmolLM. |
| `DIAGNOSIS_SCHEMA_INVALID` (null/not-null scope) | 32 | **Sí** | El LLM ya no devuelve `scope`. | Solo a SmolLM. |
| `DIAGNOSIS_SCHEMA_INVALID` (empty string) | 3 | **No** | Un modelo que devuelve strings vacíos para `hypothesis` u `observation` en V3 seguiría fallando con `DIAGNOSIS_V3_SCHEMA_INVALID`. | N/A (afectaría a cualquier modelo). |
| **Problema de fondo: SmolLM3-3B no es capaz** | — | **No** | V3 simplifica el contrato pero no garantiza que SmolLM produzca interpretaciones semánticas de calidad. Podría pasar la validación con texto vacío o genérico. | — |
| **Costo de implementación y mantenimiento dual V2/V3** | — | **No** | Agrega 5 componentes nuevos, 9 fases, feature flags, y estrategia de coexistencia. | — |

### Tabla de Resumen de Impacto

| | V2 (actual) | V3 (propuesto) | Diferencia |
|---|---|---|---|
| Errores totales (54 corridas) | 604 | ~3 (est.) | -99.5% |
| Modelos que fallan | 1 de 3 | ~0 de 3 | -1 |
| Modelos que NUNCA fallaron en V2 | 2 de 3 | 2 de 3 | Sin cambio |
| Componentes de código nuevos | 0 | 5 | +5 |
| Fases de implementación | — | 9 | +9 |
| Mantenimiento dual requerido | No | Sí (V2+V3 durante transición) | +100% overhead |

---

## 5. Análisis Costo-Beneficio Basado en Datos

### Costo de V3 (9 fases, 5 componentes):

- **V3-L0 a V3-L8**: contratos, proyección, refs estables, parser, validador, ensamblador, dual run, integración, decisión.
- Mantener V2 y V3 en paralelo durante toda la transición.
- Refactorizar `DiagnosisStep.tsx` para consumir `DiagnosisResultV3` vía adaptador.
- Nuevo validador con 12 pasos, nuevo sistema de hashes, nuevo formato de referencias.
- Riesgo: V3 introduce 5 nuevos puntos de fallo deterministas que no existían en V2.

### Beneficio de V3:

- Elimina 601/604 errores en las campañas actuales. **Pero los 601 errores afectan exclusivamente a SmolLM3-3B.**
- Reduce ~30% de tokens de output para todos los modelos (ahorro de ~1,000 tokens/output).
- Mejora auditabilidad con `projectionHash` y cadena de hashes completa.
- Principio arquitectónico sólido: separación de concerns (interpretación vs. identidad).

### Alternativa de Costo Mínimo (no contemplada en el spec):

| Alternativa | Esfuerzo | Impacto |
|---|---|---|
| **Gate de capacidad mínima de modelo**: exigir ≥4B parámetros o benchmark de JSON estructurado | 1 día | Elimina 100% de los errores actuales (SmolLM queda fuera). |
| **Ajuste de prompt V2** para SmolLM: instrucciones más explícitas sobre no cruzar evidenceRefs | 2-4 horas | Incierto — SmolLM probablemente carece de capacidad, no de instrucción. |
| **Post-procesado heurístico** para SmolLM: corregir referencias cruzadas antes de validar | 1-2 días | Frágil, no garantizado. |
| **Reemplazar SmolLM por Qwen3.5-4B o Gemma-4-E4B** | 0 días (ya funcionan) | Elimina 100% de errores, sin cambios de código. |

**Relación costo/beneficio de V3**: ~9 fases de implementación para resolver un problema que ya está resuelto para 2 de 3 modelos y que podría eliminarse para el tercero con una regla de negocio de 1 línea (`MIN_MODEL_PARAMS=4B`).

### Token savings reales de V3:

El spec predice "reducción de tokens de salida". Los datos confirman ~30% de ahorro en output (campos estructurales). Para Qwen/Gemma (~3,700 tokens/output), esto es ~1,100 tokens ahorrados por corrida. A costos de API típicos ($0.50-2.00/M tokens), el ahorro es de **$0.0005-$0.002 por corrida**. Para un sistema que corre diagnósticos on-demand, esto es despreciable frente al costo de 9 fases de implementación.

---

## 6. Recomendación Concreta

### **No aprobar el spec en su forma actual. Aprobar con condiciones.**

**Condición 1 — Análisis previo obligatorio (pre-L0):**
El spec debe incluir una sección que analice la distribución de fallos por modelo usando los datos de las campañas existentes. Debe responder: ¿por qué Qwen y Gemma logran 0% de fallos con V2 mientras SmolLM falla 83%? ¿Es esto un problema de arquitectura o de capacidad de modelo?

**Condición 2 — Justificar V3 con datos de modelos que SÍ funcionan:**
V3 solo se justifica si demuestra beneficio para Qwen o Gemma (los modelos que los usuarios realmente usarán). Si el único beneficiario es SmolLM3-3B, el spec debe explicar por qué se invierten 9 fases para soportar un modelo de 3B en vez de exigir 4B mínimo.

**Condición 3 — Evaluar la alternativa de bajo costo primero:**
Antes de L0, implementar y medir: (a) gate de capacidad mínima de modelo, (b) benchmark de JSON estructurado como requisito de entrada. Si esto elimina SmolLM del pool y Qwen/Gemma siguen en 0% fallos, V3 pierde su justificación principal.

**Condición 4 — Cuantificar el ahorro de tokens con datos reales:**
El spec debe calcular el ahorro monetario real de eliminar ~30% de tokens de output para los modelos que ya funcionan. Si el ahorro es < $0.01 por corrida, no justifica la inversión.

---

## 7. Brechas que el Spec Debería Cerrar Antes de L0

1. **Análisis de distribución de fallos por modelo** (secciones 3 y 16). El spec habla de fallos estructurales en abstracto. Debe incluir una tabla como la sección 2.2 de este reporte.

2. **Justificación de mínimo de capacidad de modelo**. ¿Por qué el sistema acepta un modelo de 3B que falla el 83% de las veces? ¿Hay un umbral de capacidad mínima?

3. **Evidencia de que V3 mejora algo para Qwen/Gemma**. Si Qwen y Gemma tienen 0% de fallos con V2, ¿qué gana el usuario con V3? ¿Calidad semántica? ¿Menor latencia? El spec debe demostrarlo con datos, no con hipótesis.

4. **Cuantificación del ahorro en tokens**. La sección 16.2 propone medir "tokens de salida" pero no establece un objetivo cuantitativo ni analiza si el ahorro justifica el costo. Con los datos actuales: ~1,100 tokens ahorrados por corrida = ~$0.001/corrida.

5. **Evaluación de riesgo de los 5 componentes nuevos**. Cada componente nuevo (`PromptProjectionV3`, `StableEvidenceRefV1`, `DeterministicDiagnosisAssemblerV3`, `ProjectionAwareValidatorV3`) es un punto de fallo nuevo. El spec no analiza qué pasa si el ensamblador determinista produce un join incorrecto (bug de código vs. bug de LLM).

6. **Decisión abierta no resuelta**: ¿`PromptProjectionV2` o `PromptProjectionV3`? (sección 20.1). El spec deja esto abierto, pero es una decisión de naming con impacto en versionado de contratos.

7. **El spec dice "No se debe asumir que un hash corto es infalible"** (línea 556) pero propone 12+12 caracteres hex (48 bits de entropía). Con 100 issues × 100 muestras = 10,000 refs, la probabilidad de colisión con 48 bits es ~0.001%. Esto debería cuantificarse con la fórmula del birthday problem, no dejarse como nota cualitativa.

8. **Compatibilidad con proveedores de structured output**. El spec menciona en 16.3 probar con "proveedor con structured output" pero no analiza si el formato `Record<string, Interpretation>` (mapa dinámico) es compatible con los schemas JSON rígidos que proveedores como OpenAI o Anthropic exigen (donde las propiedades deben declararse estáticamente). La sección 7.5 lo menciona brevemente pero no lo resuelve.

9. **Qué pasa con datasets de 0 issues**. El spec menciona este caso en 16.4 pero no define el comportamiento de V3 para él. ¿`interpretations: {}` vacío? ¿El validador lo acepta?

10. **El spec no aborda la migración de campañas existentes**. Las 54 corridas de Campana2 y Test Campaña usan contrato V2. Si V3 cambia el formato de referencias (`ev:v1:...` en vez de `ev-0000`), ¿son comparables los resultados entre campañas V2 y V3?

---

## 8. Lo que No Puedo Verificar con los Datos Disponibles

- **Calidad semántica**: las campañas miden validez estructural, no si las hipótesis del LLM son correctas. No puedo afirmar que V3 mejore o degrade la calidad de las interpretaciones.
- **Comportamiento con modelos cloud** (GPT-4, Claude): las campañas solo usan modelos locales vía Ollama. No sé si modelos más grandes también sufren errores de referencia con datasets más complejos (>15 issues).
- **El spec menciona `DIAGNOSIS_V3_UNSUPPORTED_CLAIM`** (línea 597) como detección de claims no soportados por evidencia visible. Esto es semánticamente ambicioso y no hay datos para evaluar si es implementable de forma determinista.
- **La demo del spec usa un dataset ficticio de 4 filas** (sección 11). Esto no es representativo de datasets reales con 15+ issues y cientos de muestras.

---

**Conclusión final**: El spec V3 es arquitectónicamente elegante pero empíricamente desvinculado de los datos que deberían justificarlo. Propone 9 fases de implementación para resolver un problema que, según la evidencia disponible, se limita a un modelo de 3B parámetros que probablemente no debería estar en el pool de modelos soportados. La acción correcta antes de aprobar es: (1) establecer un umbral de capacidad mínima de modelo, (2) re-ejecutar las campañas solo con modelos que pasen ese umbral, y (3) solo entonces decidir si la inversión en V3 se justifica por razones de auditabilidad, ahorro de tokens, o preparación para modelos futuros — no por los errores de SmolLM3-3B.
