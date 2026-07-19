# Análisis profundo: AURA Diagnosis V3 — contrato de interpretación pura

**Archivo analizado:** `docs/product/aura/architecture/DIAGNOSIS_V3_INTERPRETATION_PURE_DEMO_SPEC.md`
**Commit origen:** `3c65111` (rama `origin/agent/unify-diagnosis-input-builders`)
**Autor del análisis:** agente opencode minimax M3
**Fecha:** 2026-07-19
**Marco de revisión:** lectura crítica cruzada contra el código fuente real de `src/contracts/llm/`, los expedientes de diagnóstico existentes en `experiments/tests/` y la conversación de troubleshooting que originó la revisión.

---

## 0. Contexto de la revisión

Este análisis se produce después de tres hallazgos que convierten al spec V3 en algo más que una propuesta académica:

1. **El error real en producción** (`evidenceRef belongs to different issue`) es exactamente el tipo de fallo que V3 declara hacer irrepresentable. El spec tiene anclaje empírico.
2. **El codebase tiene dos builders V2 coexistentes** (`buildDiagnosisInputPackageV2` canónico y `buildDiagnosisPromptV2` legacy), detectado durante la auditoría previa. V3 debe decidir qué hace con esa herencia.
3. **El validador V2 no conoce el `inputMode`** (anomalía documentada #20.5), lo que hace que `prompt_libre` permita que un modelo que adivine `ev-XXXX` válidos pase la validación. V3 promete cerrar esto con `PromptProjectionV3`.

La revisión se hace con lentes de: corrección técnica, viabilidad de implementación, coherencia con el código existente, y aporte real al problema concreto que se está resolviendo.

---

## 1. Lo que el documento hace bien

### 1.1 Diagnóstico quirúrgico del problema

La §3.2 enumera 10 clases de error que el contrato V2 permite. De esas 10, **al menos 4 son "errores de copiado" que no tienen contenido semántico**: `issueId` inexistente, `issueId` repetido, issue omitido, bloque omitido, bloque huérfano, `ruleId` válido pero de otro issue, `columnId` válido pero de otro issue, `evidenceRef` válida pero de otro issue. Estos errores son ruido en métricas y ruido en costos de reintento. V3 los ataca en su raíz en vez de agregar más validaciones.

### 1.2 La invarianza "no se puede expresar" es la diferencia fundamental

La §3.3 demuestra con un ejemplo mínimo (dos issues con ruleId distintos, LLM devuelve el ruleId del otro) que un diagnóstico semánticamente correcto queda bloqueado por `DIAGNOSIS_REFERENCE_INVALID`. El ejemplo tiene 11 líneas y es devastador. Muestra que el problema no es "el LLM es malo", sino "el contrato exige al LLM hacer trabajo determinista que AURA puede hacer mejor".

### 1.3 Mapa por `issueId` en lugar de dos arrays paralelos

La §7.5 resuelve elegantemente el problema del join `issues[]` ↔ `diagnosisBlocks[]`. Eliminar el paralelismo convierte la cobertura en `Object.keys(response.interpretations)` (operación directa) en lugar de un algoritmo de matching. Esto es **menos código y menos bugs**.

### 1.4 StableEvidenceRefV1 content-addressed

La §8 aborda un problema real (refs ordinales se renumeran al reordenar) con una solución content-addressed: `ev:v1:<issueDigest>:<sampleDigest>`. La decisión de calcular el hash sobre la representación post-privacidad (§8.4) es **correcta** porque garantiza que dos corridas con diferente política de privacidad no compartan una ref que apunta a contenido semánticamente distinto.

### 1.5 `ProjectionAwareValidatorV3` cierra una anomalía concreta

El validador V2 actual no recibe el `inputMode`. El spec V3 lo resuelve pasando `projection: PromptProjectionV3` al validador (§9.1). Esto cierra la anomalía #20.5 detectada en la auditoría previa y permite que el validador exija `DIAGNOSIS_V3_HIDDEN_EVIDENCE_CLAIM` cuando el modelo afirme haber visto muestras que no fueron visibles (§13.2).

### 1.6 Honestidad sobre compatibilidad

La §15 no propone "romper V2 y migrar". Propone coexistencia, feature flag (`AURA_DIAGNOSIS_CONTRACT=v2|v3|dual`), adaptador de UI, y campaña dual antes de decidir. Esto es **imprescindible** dado que V2 está certificado por las campañas formales OE4 y los snapshots exportados a PDF.

### 1.7 10 criterios de aceptación verificables (§19)

Cada criterio es testeable y objetivamente verificable, no "mejor experiencia de usuario" ni "más cobertura". El #5 ("una asociación cruzada de ruleId no puede expresarse") es particularmente bueno: si pasa una prueba adversarial que intente expresar ese cruce, queda demostrado.

### 1.8 Plan de 9 fases con dependencias explícitas (§17)

V3-L0 → L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8 sigue el orden natural: contrato → proyección → refs → parser → validador → ensamblador → dual run → integración → decisión. La decisión de "no comenzar por modificar V2" (§21) preserva el baseline. Esto es gestión de riesgo seria.

---

## 2. Lo que el documento hace mal o deja incompleto

### 2.1 No cuantifica el ahorro esperado

La §16.2 define métricas a medir (tokens de salida, latencia, reintentos) pero **no da un baseline V2 actual**. Sin un número concreto hoy, la promesa "V3 > V2 en schema valid" es vacía. ¿Cuántos runs V2 fallan por `DIAGNOSIS_REFERENCE_INVALID`? ¿Cuál es la distribución de tokens de salida hoy por issue? ¿Cuánto cuesta cada reintento en latencia?

**Falta:** una tabla con métricas V2 medidas en `experiments/tests/` antes de L0.

### 2.2 El dynamic import sin resolver

El spec no menciona que existe `diagnosisPipelineV2.ts:335` haciendo `await import('./diagnosisPromptV2')` dentro de `diagnoseWithV2`. Esto es un consumidor residual del builder legacy que V3 debe decidir si:
- a) elimina en L0 como parte del unification
- b) preserva como bridge hacia V3
- c) reescribe para que el bridge sea al V3

La decisión tiene impacto en la fase L7 (integración) y debería tomarse antes.

### 2.3 `StableEvidenceRefV1` introduce costo de tokens no evaluado

`ev:v1:7baf91c2e10a:0d221a9f413c` son 31 caracteres vs 7 de `ev-0000`. Para un envelope con 16 refs promedio, son +384 chars de payload por prompt solo en identifiers. Para 4 referencias visibles en `recommended`, eso es 124 chars vs 28. No es catastrófico, pero tampoco es gratis. **Falta:** análisis costo/beneficio de tokens en sección de presupuesto.

### 2.4 La decisión abierta §20.3 es estructural, no cosmética

El spec reconoce ambigüedad sobre `evidenceRefs` finales: ¿representan lo visible, lo interno del engine, o ambos? Recomienda `visibleEvidenceRefs` + `engineEvidenceRefs` separados. Esto es **una decisión arquitectónica**, no un detalle. Cambia:
- El contrato `DiagnosisResultV3`
- La auditoría (¿qué citas son del LLM y cuáles del motor determinista?)
- El PDF export (¿qué muestras se imprimen en el reporte?)
- La cita en `limitations` (¿cuáles son por falta de visibilidad?)

Esta decisión debe tomarse **antes de L0**, no dejarse para "evaluar por separado" como sugiere §20.4.

### 2.5 Visualizaciones: el spec esquiva el problema

§20.4 dice "evaluar por separado" sin dar criterio. Pero `visualizations` es un output del LLM en V2 con `dataSource` y `kind` que la UI hoy consume. Sacarlo del output del LLM significa:
- ¿Las genera AURA determinísticamente desde `severity_counts` + `category_counts`?
- ¿El LLM solo recomienda y AURA decide si incluir?
- ¿Se elimina la feature?

El silencio aquí es preocupante porque toca un output visible al usuario final.

### 2.6 `requiresHumanReview` 100% determinista tiene un costo no mencionado

§20.5 dice que el modelo no puede reducir la política HITL. Eso es **correcto y deseable** para evitar downgrade indebido. Pero también significa que en `recommended` mode, donde el LLM ve más contexto (autorización, acción), **no puede añadir HITL adicional cuando tiene dudas legítimas**. Solo puede expresarlo vía `confidence` y `limits`. ¿Es eso suficiente? El spec no lo discute.

### 2.7 No aborda la auditoría con receipts congelados

`ExecutionReceiptV1` actual firma la respuesta cruda del LLM. Con V3, la "respuesta cruda" del LLM es mucho más pequeña (solo interpretaciones), pero hay un nuevo artefacto: `PromptProjectionV3` con su `projectionHash`. El spec §14 propone añadir `projectionHash`, `interpretationResponseHash`, `assembledDiagnosisHash` al receipt, pero **no dice cómo se firma el diagnóstico final** ni qué pasa con los hashes de campañas históricas OE4 que están congelados en `experiments/tests/campana2/resultado_export/campaign.json`.

### 2.8 El spec asume `DiagnosisInputModeV2` se mantiene

§6.3 referencia `inputMode: DiagnosisInputModeV2` en `PromptProjectionV3`. Pero V3 podría querer:
- Eliminar `prompt_libre` (porque en V3 puro las muestras siempre son visibles o el LLM no las cita)
- Añadir un modo `dual` para la campaña comparativa §16
- Renombrar `recommended` a algo más semántico

Esta elección está implícita pero no explícita.

### 2.9 El dataset demo es demasiado amable

§11 usa `clientes_credito.csv` con 3 issues bien comportados (extremo, negativo, variantes). No incluye:
- Columnas con nombres ambiguos (caso que activa `governanceDemandsReview` en V2)
- Columnas duplicadas (caso documentado en anomalía #20.3)
- Issues con `actionability: 'review_only'` (vs `auto_safe`)
- Datasets sin issues
- Muestras con PII

Para validar "no inferioridad" (§16.2) se necesita un dataset adversarial mínimo que V2 maneja con HITL forzado.

---

## 3. Análisis de coherencia con el código existente

### 3.1 Mapeo entre tipos V3 propuestos y tipos V2 actuales

| Tipo V3 propuesto | Equivalente V2 | Acción |
|---|---|---|
| `PromptProjectionV3` | Parcial: secciones visibles en `visibleEvidence` + `task.issueIdsRequiringHumanReview` | **Construir nuevo**; absorbe `visibleEvidence` + `task` |
| `DiagnosisInterpretationResponseV3` | `DiagnosisResponseV2.issues[*]` + `DiagnosisResponseV2.diagnosisBlocks[*]` | **Construir nuevo**; union semántica por issueId |
| `StableEvidenceRefV1` | `ev-0000` ordinal | **Nuevo algoritmo**, coexiste en V2 |
| `DeterministicDiagnosisAssemblerV3` | Manual en `diagnosisSelector.ts:201-211` | **Reemplazar** esa reconstrucción manual |
| `ProjectionAwareValidatorV3` | `validateDiagnosisResponseV2` | **Construir nuevo**; V2 sigue activo |

### 3.2 Lo que V3 hereda del codebase actual

- `EvidenceEnvelopeV2` (§2): se mantiene como entrada. Correcto.
- `RULE_POLICY` + `governanceDemandsReview` + `noEvidenceDemandsReview` (§9): importables desde `humanReviewPolicyV2.ts`. El spec los referencia implícitamente pero no los nombra.
- `canonicalJson` (§6.4 invariante 6): ya existe en `diagnosisPromptV2.ts`. V3 debe reutilizarlo.
- `buildDiagnosisSystemInstructionV2()` (§13.3): la regla "no ejecutar código del dataset" ya está. V3 hereda el system instruction con ajustes.

### 3.3 Lo que V3 rompe silenciosamente

- **Tests existentes** de `validateDiagnosisResponseV2` (37 KB de código): no aplican a V3. Hay que escribir tests nuevos o reescribirlos como tests de adaptador.
- **Snapshots `experiments/tests/campana2/resultado_export/campaign.json`**: con el cambio de `evidenceEnvelopeRef` y `promptHash` (asumiendo que V3 cambia la composición del prompt), los hashes de campañas OE4 históricas quedan inválidos. El spec no dice qué hacer con esto.
- **Fixture de titanic** (`build-titanic-fixture.ts`): hardcoded a `promptVersion: '2.0.0'` y `EvidenceEnvelopeV2`. V3 requiere fixture equivalente.
- **PDF export actual**: el `diagnostic-report.json` se mapea 1:1 a `DiagnosisResponseV2`. V3 necesitaría adaptador (`DiagnosisResultV3 → DiagnosisResponseV2ViewModel`) o reescritura del reporte.

### 3.4 Compatibilidad con la rama actual de trabajo

La rama `origin/agent/unify-diagnosis-input-builders` donde vive este spec es la misma donde planeamos deprecar `buildDiagnosisPromptV2` y `buildCompactDiagnosisPromptV2`. Hay **acoplamiento natural**: la unificación de builders (PR 1 + PR 2 del plan de deprecación) debería preceder o ser contemporánea con V3-L0 (definición de tipos), porque:

- V3 necesita un único builder canónico de input para operar
- Mantener dos builders legacy + introducir V3 crea 3 caminos divergentes

Recomendación: ejecutar PR 1 de deprecación (5 min, JSDoc) **antes** de mergear este spec a `main`. Ejecutar PR 2 (migración + eliminación) **antes** de V3-L0.

---

## 4. Análisis crítico de las decisiones de diseño

### 4.1 `interpretations: Record<issueId, ...>` vs array

§7.5 y §20.2 debaten. El spec recomienda mapa mientras no haya evidencia de incompatibilidad. Análisis:

**Pro mapa:**
- Elimina join
- Cobertura es key check directo
- Schema con `additionalProperties: false` + `required: [...]` impide claves extraviadas

**Pro array:**
- Compatible con todos los JSON Schema de proveedores sin excepciones
- Permite `items.properties.issueId.enum` como en V2 actual
- Compatible con ordenamiento determinista

**Recomendación del análisis:** array con `issueId` explícito es más portable. El "join" eliminado no es el problema real; el problema real es que V2 tiene **dos arrays paralelos** (issues + diagnosisBlocks). V3 puede tener **un array con issueId explícito** y mantener los beneficios. La forma de mapa es elegante pero introduce un caso especial que requerirá código defensivo en adapters.

### 4.2 `StableEvidenceRefV1` con dos segmentos hex de 12

§8.5 propone 12+12 caracteres con ampliación a 16 ante colisión. Análisis:

- 12 hex = 48 bits = 2.8×10^14 valores. Para un dataset con <1000 issues × 4 muestras, probabilidad de colisión ≈ 1.4×10^-11. Insignificante.
- 16 hex = 64 bits. Más allá de lo necesario.
- El problema real no es la longitud del hash, es **el costo de tokens en el prompt**. Cada ref aparece múltiples veces: en `evidenceSamples`, en `ruleActivations.evidenceRefs`, en `badSampleAnchors`, en la respuesta del LLM. Multiplicar 31 chars × 6 apariciones promedio × 15 issues ≈ 2790 chars extra solo en identifiers.

**Recomendación:** mantener refs ordinales V2 como `ev-XXXX` para el prompt (compatibilidad y ahorro de tokens), y calcular `StableEvidenceRefV1` solo como **identificador interno** del envelope y del assembler. El LLM sigue viendo refs cortas; el motor interno usa refs content-addressed para auditoría.

### 4.3 Feature flag `AURA_DIAGNOSIS_CONTRACT=v2|v3|dual`

§15.3 propone un único env var con 3 valores. Análisis:

- **Bueno:** simple, una variable, semántica clara.
- **Malo:** un solo flag no permite combinar V2 para diagnóstico y V3 para experimentación en la misma sesión. Para una campaña dual §16, se necesita control por corrida, no global.

**Recomendación:** flag por **corrida**, no global. `runStructuredDiagnosis(envelope, { contract: 'v2'|'v3'|'dual' })`. La UI puede ofrecer la opción por dataset. El flag global queda como default.

### 4.4 Recepción de V3 en UI sin breaking change

§15.2 propone adaptador `DiagnosisResultV3 → DiagnosisResponseV2ViewModel`. Esto implica que el PDF, los exports, y la lectura humana siguen viendo shape V2 aunque el motor use V3 internamente. Análisis:

- **Bueno:** cero impacto en artefactos exportados a clientes.
- **Malo:** el adaptador es **pérdida de información**. Si V3 introduce `visibleEvidenceRefs` vs `engineEvidenceRefs` (§20.3), el adapter debe decidir cuál pasa a V2. Esa decisión es semántica y no trivial.

**Recomendación:** definir el adapter formalmente con un type `DiagnosisV3ToV2AdapterConfig` que documente qué información se conserva y qué se descarta. Es un contrato, no una función utilitaria.

---

## 5. Análisis del problema que originó esta conversación

Volviendo al origen: el error `evidenceRef belongs to different issue` en tu corrida real fue causado por:

1. El LLM devolvió `evidenceRefs: ["ev-0012", "ev-0013"]` para `logic-outlier-tukey-Fare`, cuando esos refs pertenecen a `logic-outlier-Fare` según el envelope.
2. El LLM duplicó `logic-outlier-tukey-Age` en el array `issues[]`.
3. El LLM dijo "Cabin column" en la hipótesis de `semantic-long-tail-Name` cuando el envelope y los refs apuntan a Name.

V3 habría prevenido **solo el problema 1**, porque el LLM ya no devuelve `evidenceRefs`. V3 **no previene** los problemas 2 y 3, porque:
- Duplicación: el spec §9.2 paso 5 exige cobertura exacta. Duplicar `logic-outlier-tukey-Age` dos veces sigue siendo detectable, pero el LLM todavía puede hacerlo en `interpretations`.
- Hipótesis incorrecta: V3 no valida que la hipótesis mencione la columna correcta. Sigue siendo texto libre.

**Implicación:** V3 reduce una clase de errores, pero no los elimina todos. La cobertura sigue dependiendo de que el LLM itere correctamente sobre todos los `requiredIssueIds`. La calidad semántica sigue dependiendo de que el LLM razone correctamente sobre el texto del envelope.

**Recomendación:** el spec debe ser **honesto** sobre esto. §19 lista 10 criterios de aceptación, pero ninguno cubre "hipótesis menciona la columna correcta". V3 no es bala de plata.

---

## 6. Contraste cuantitativo contra los problemas actuales

Esta sección cruza la propuesta V3 contra los **datos empíricos** extraídos de las campañas formales OE4 ya ejecutadas, para responder la pregunta que el spec no hace: **¿vale la pena el esfuerzo?**

### 6.1 Baseline V2 medido en `experiments/tests/`

**Fuentes:** `experiments/tests/campana2/resultado_export/campaign.json` (campaña #2) y `experiments/tests/test_campaña/campaign.json` (campaña #1). Ambas son campañas formales con 27 runs cada una (3 datasets × 3 inputModes × 3 modelos).

#### Tasa de fallo global

| Campaña | Total | Passed | Failed | Tasa fallo |
|---|---:|---:|---:|---:|
| campana1 (`test_campaña`) | 27 | 19 | 8 | **29.6%** |
| campana2 (`resultado_export`) | 27 | 20 | 7 | **25.9%** |

#### Distribución por inputMode (campana2)

| Modo | Runs | Failed | Tasa fallo |
|---|---:|---:|---:|
| `prompt_libre` | 9 | 1 | 11% |
| `smart_sample` | 9 | 3 | 33% |
| `recommended` | 9 | 3 | 33% |

**Hallazgo 1:** Los modos con evidencia visible (`smart_sample`, `recommended`) fallan **3× más** que `prompt_libre`. Esto contradice la intuición inicial. La causa probable: cuando el LLM ve muestras, intenta citarlas, y al citarlas introduce cruces `evidenceRef belongs to different issue`.

#### Distribución por modelo (campana2)

| Modelo | Runs | Failed | Tasa fallo |
|---|---:|---:|---:|
| `Qwen3.5-4B-GGUF:UD-Q4_K_XL` | 9 | 0 | **0%** |
| `gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL` | 9 | 0 | **0%** |
| `SmolLM3-3B-GGUF:UD-Q4_K_XL` | 9 | 7 | **78%** |

**Hallazgo 2:** El fallo está **concentrado en un modelo** (SmolLM3-3B). Los otros dos modelos pasan el 100%. Esto sugiere que el problema de `DIAGNOSIS_REFERENCE_INVALID` no es estructural del contrato, sino **capacidad del modelo de seguir instrucciones estructuradas**. V3 no elimina esta causa: SmolLM3 seguiría intentando copiar identificadores si se le pidiera.

#### Códigos de error específicos (campana2)

| Código | Instancias |
|---|---:|
| `DIAGNOSIS_REFERENCE_INVALID` | 4 |
| `DIAGNOSIS_SCHEMA_INVALID` | 3 |

**Hallazgo 3:** De los 7 fallos, **4 son `DIAGNOSIS_REFERENCE_INVALID`** (todos en SmolLM3). Los otros 3 son `DIAGNOSIS_SCHEMA_INVALID` (JSON malformado o campos extra). V3 elimina los 4 primeros; no toca los 3 segundos.

#### Output tokens y latencia (campana2)

| Modo | Avg output tokens | Avg latencia (ms) |
|---|---:|---:|
| `prompt_libre` | 3255 | 40258 |
| `smart_sample` | 3477 | 45053 |
| `recommended` | 3485 | 46260 |

| Modelo | Avg output tokens | Avg latencia (ms) |
|---|---:|---:|
| Qwen3.5-4B | 3705 | 52439 |
| gemma-4-E4B | 3647 | 49814 |
| SmolLM3-3B | 2865 | 29318 |

**Hallazgo 4:** La diferencia de tokens entre `prompt_libre` y `recommended` es **solo +230 tokens** (7%). El contrato V2 ya es eficiente. V3 promete eliminar campos del output, pero el **ahorro esperado es <230 tokens por corrida** (solo los `issueId`, `ruleId`, `columnId`, `scope`, `evidenceRefs` por issue × 15 issues ≈ ~1000 chars ≈ ~250 tokens). Esto no mueve la aguja de costo ni de latencia.

### 6.2 Lo que V3 resuelve vs lo que NO resuelve

| Problema actual | Frecuencia empírica | V3 lo resuelve? |
|---|---|---|
| `evidenceRef belongs to different issue` | 4/54 runs (7.4%) | **SÍ** (elimina `evidenceRefs` del output LLM) |
| `DIAGNOSIS_SCHEMA_INVALID` | 3/54 runs (5.6%) | **NO** (el LLM puede seguir produciendo JSON malformado) |
| `logic-outlier-tukey-Age` duplicado | 1 caso visto | **NO** (cobertura sigue siendo trabajo del LLM) |
| Hipótesis menciona columna incorrecta | 1 caso visto | **NO** (sigue siendo texto libre) |
| Dos builders V2 coexistentes | Estructural | **SÍ** (V3 debe reemplazar el legacy) |
| Validador no conoce `inputMode` | Estructural | **SÍ** (`ProjectionAwareValidatorV3`) |
| Refs ordinales frágiles | Estructural | **SÍ** (`StableEvidenceRefV1`) |

### 6.3 Análisis costo-beneficio de V3

**Beneficios cuantificables:**
- Elimina 4/54 runs fallidos (7.4%) en el peor modelo. Cero impacto en Qwen y gemma.
- Cierra 3 anomalías estructurales documentadas (builders legacy, validador sin modo, refs frágiles).
- Reduce ~250 tokens de output por corrida (≈7%).

**Costos cuantificables:**
- 9 fases de implementación, 0.5-1 día de deprecación previa + estimación 2-4 semanas para V3-L0..L5.
- Adaptador de UI/PDF (`DiagnosisResultV3 → DiagnosisResponseV2ViewModel`).
- Reescritura de fixtures (`build-titanic-fixture.ts`, snapshots de campañas).
- Campaña dual V2/V3 con baseline V2 real antes y después.
- Análisis de impacto en `diagnostic-report.json` y `EvidencePackage v1`.

**Pregunta crítica:** el 7.4% de ahorro en fallos **solo aplica a SmolLM3-3B**. Para Qwen3.5-4B y gemma-4-E4B, V3 ofrece cero mejora medible. **¿Vale 2-4 semanas de trabajo eliminar el 7.4% de fallos en el modelo más débil?**

**Respuesta condicional:**
- **SÍ vale** si la decisión es también cerrar las 3 anomalías estructurales, porque esas anomalías son deuda técnica real que V3 paga como efecto secundario.
- **NO vale** si el único motivador es "el LLM copia mal los refs", porque ese problema se resuelve **alternativamente** cambiando de modelo (Qwen3.5-4B pasa al 100%) o ajustando el prompt V2 con few-shot examples de uso correcto de refs.

### 6.4 Lo que el spec debería haber hecho antes de §17 (plan)

Un análisis cuantitativo previo. Concretamente, una sección §A "Baseline V2" que contenga:

1. Tasa de fallo global (25.9% campana2, 29.6% campana1).
2. Distribución por modo (33% smart_sample, 33% recommended, 11% prompt_libre).
3. Distribución por modelo (78% SmolLM3, 0% Qwen3.5, 0% gemma-4).
4. Códigos de error (4× REFERENCE_INVALID, 3× SCHEMA_INVALID, 0× REVIEW_DOWNGRADE).
5. Tokens y latencia promedio por modo (3255-3485 out, 40-46s).
6. Identificación de que el fallo está concentrado en UN modelo, no distribuido.

Con esos números en la mesa, el plan §17 debería:
- Diferir V3 si el modelo en producción no es SmolLM3.
- Acelerar V3 si el modelo en producción es SmolLM3 o similar.
- Considerar alternativa más barata: ajuste de prompt con few-shot examples antes de embarcarse en 9 fases.

### 6.5 Implicación directa sobre la pregunta original

La pregunta que originó toda esta revisión fue: "¿por qué `evidenceRef belongs to different issue`?". La respuesta empírica es: **el modelo que se usó (SmolLM3-3B) copia mal los identificadores**. V3 previene esa clase de error pero no resuelve la causa raíz, que es capacidad del modelo.

**Recomendación final basada en datos:**

1. **Si el modelo objetivo es SmolLM3 o equivalente (3B params):** V3 es casi obligatorio. El 78% de tasa de fallo es inaceptable.
2. **Si el modelo objetivo es Qwen3.5-4B o gemma-4-E4B:** V3 es nice-to-have. Cero mejora en tasa de fallo; solo paga deuda técnica.
3. **Antes de V3:** PR 1 (deprecación JSDoc builders legacy, 5 min) **SIEMPRE**. PR 2 (migración + eliminación, 0.5-1 día) **SIEMPRE**, porque limpia el camino a V3 o a V2.5 (alternativa).
4. **V3 vs V2.5:** evaluar si una versión intermedia V2.5 — con `PromptProjectionV3` ligero que el validador V2 consulta opcionalmente — paga la misma deuda técnica con 1/4 del esfuerzo.

### 6.6 Lo que el spec necesita agregar para ser aprobable

Dados los números, el spec debe añadir antes de L0:

1. **§A. Baseline cuantitativo V2** con los datos anteriores.
2. **§B. Análisis de impacto en `EvidencePackage v1` y `aura-technical-export.json`** (verificar si la estructura de exportación tolera V3).
3. **§C. Decisión arquitectónica sobre `visibleEvidenceRefs` vs `engineEvidenceRefs`** (estructural, no cosmética).
4. **§D. Análisis costo/beneficio honesto** considerando que el problema está concentrado en un modelo.
5. **§E. Alternativa V2.5** (prompt con few-shot + validación reforzada) como comparación.
6. **§F. Decisión sobre builders legacy** acoplada a la decisión sobre V3 (no son independientes).

---

## 7. Opinión final

### 7.1 Valor del spec

Este documento es **el mejor spec técnico del repositorio**. Tiene estructura clara, ejemplos mínimos verificables, honestidad sobre lo que no resuelve, plan de fases con dependencias, criterios de aceptación objetivos, y estrategia de compatibilidad. Si todos los specs del proyecto tuvieran esta calidad, no necesitaríamos auditorías previas.

### 7.2 Decisión recomendada

**Aprobar como demo experimental, NO como roadmap de producción, hasta resolver:**

1. **Baseline cuantitativo V2** (crítico): medir tokens de salida promedio, tasa de `DIAGNOSIS_REFERENCE_INVALID`, latencia, reintentos. Sin baseline, §16.2 no demuestra nada.
2. **Decisión §20.3** (crítico): ¿`visibleEvidenceRefs` + `engineEvidenceRefs` separados? Esto cambia el contrato `DiagnosisResultV3`, la auditoría, el PDF, y debe tomarse antes de L0.
3. **Decisión sobre builders legacy** (importante): ejecutar PR 1 de deprecación (JSDoc `@deprecated`) antes de mergear. Ejecutar PR 2 (migración + eliminación) antes de V3-L0.
4. **Análisis costo/beneficio de StableEvidenceRefV1** (importante): ¿refs content-addressed internas + refs ordinales en prompt, o content-addressed everywhere? Decisión antes de V3-L2.
5. **Forma del response: mapa vs array** (menor): análisis concreto de compatibilidad con proveedores antes de V3-L0.
6. **Dataset adversarial para §11** (importante): el demo de `clientes_credito.csv` es demasiado amable. Añadir mínimo: columnas ambiguas, issues `review_only`, PII, dataset sin issues.

### 7.3 Lo que el spec debería agregar antes de aprobar

- **§A. Métricas V2 baseline** con números reales de `experiments/tests/`
- **§B. Análisis de impacto en `diagnostic-report.json` y PDF export**
- **§C. Decisión arquitectónica sobre `visibleEvidenceRefs` / `engineEvidenceRefs`**
- **§D. Forma final del response (mapa o array) con justificación**
- **§E. Plan de coexistencia con builders legacy durante V3-L0..L8**
- **§F. Dataset adversarial mínimo para §11**

### 7.4 Riesgos si se aprueba tal cual

1. La promesa "V3 elimina errores estructurales" es **parcialmente cierta**. El spec lo dice bien, pero un lector apresurado puede creer que V3 previene todos los errores del LLM. No los previene: solo cambia la superficie donde pueden ocurrir.
2. StableEvidenceRefV1 puede inflar tokens del prompt sin un análisis previo. Riesgo de regresión en `local_full` donde el presupuesto de caracteres (`maxCharacters: 28000`) ya es justo.
3. Sin baseline V2, la campaña dual §16 puede completarse y "no demostrar nada" o "demostrar que V3 es peor" sin que sepamos si fue el spec o el ruido experimental.
4. La coexistencia V2/V3 con un único flag global puede bloquear experimentación durante la campaña dual.

### 7.5 Recomendación operativa

Pasos concretos recomendados:

1. **Hoy:** mergear PR 1 de deprecación de builders legacy (`@deprecated` JSDoc).
2. **Antes de V3-L0:** resolver §A, §B, §C, §D, §E, §F de este análisis.
3. **V3-L0:** solo definición de tipos y schemas en archivo aislado `src/contracts/llm/diagnosisV3/`. Sin tocar `runStructuredDiagnosis`.
4. **V3-L1..L5:** implementar componentes en isolation, sin conexión con producción.
5. **V3-L6:** campaña dual con flag por corrida, no global.
6. **V3-L7..L8:** solo después de que §16 demuestre no inferioridad con baseline cuantitativo.

### 7.6 Cierre

El spec V3 no es perfecto, pero es **honesto, verificable y accionable**. Los seis agregados sugeridos lo convertirían en un spec defendible ante revisión externa. Sin ellos, es una demo conceptual buena con riesgo de prometer más de lo que entrega.

La pregunta que el spec no hace y debería hacer es: **¿vale la pena el esfuerzo?** Si V2 funciona razonablemente y los errores estructurales son <5% de las corridas, V3 puede ser mejora marginal con costo alto. Si los errores estructurales son >15%, V3 es casi obligatorio. Esa medición es lo que falta.

---

**Análisis generado por:** agente opencode minimax M3
**Commit analizado:** `3c65111`
**Conversación origen:** troubleshooting de `DIAGNOSIS_REFERENCE_INVALID` en corrida real sobre `titanic.csv`
**Outputs cruzados:** auditoría previa de `buildDiagnosisInputPackageV2` vs `buildDiagnosisPromptV2`