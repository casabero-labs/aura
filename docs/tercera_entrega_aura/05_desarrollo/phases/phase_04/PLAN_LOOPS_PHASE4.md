# Plan de Loops — Phase 4 (ScriptContractV2 + Renderer)

> **Versión:** 2.0.0 · **Fecha:** 2026-06-25 · **Commit congelado Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`

---

## Visión general

Phase 4 se divide en 6 loops. Cada loop produce código, tests y artefacto de evidencia. Los artefactos de evidencia se almacenan en `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/`.

**Flujo contractual:** `buildScriptCandidateV2` → `validateScriptCandidateV2` → `finalizeScriptContractV2`

**Regla de oro:** El LLM no escribe, corrige ni completa código en ningún punto.

---

## Loop 1: Base types, ScriptBuildContextV2 y column resolver

### Objetivo
Definir `ScriptBuildContextV2`, `ScriptContractCandidateV2`, completar `ScriptContractV2`, y crear el resolver de columnas con helpers `readColumn`/`writeColumn`.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/types.ts` | Añadir `ScriptBuildContextV2`, `ColumnRegistryV2`, `CorrespondenceEvidenceV2`, `ScriptContractCandidateV2`, actualizar `ScriptContractV2` |
| `src/contracts/llm/scriptColumnResolver.ts` | Crear — helpers `readColumn`, `writeColumn`, `accessColumn`, `buildPythonLiteral`, `buildColumnRegistry` |
| `src/contracts/llm/scriptBuildContext.ts` | Crear — `buildScriptContext()` |
| `src/contracts/llm/placeholderVocabulary.ts` | Crear — `PLACEHOLDER_VOCABULARY_V2` constante |
| `src/contracts/llm/index.ts` | Exportar nuevos módulos |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptContractV2.types.test.ts` | Shape de candidate, final, context. Campos obligatorios. |
| `src/__tests__/scriptColumnResolver.test.ts` | `readColumn`: normal, duplicada (ordinal), ambigua, reserved word, nula. `writeColumn`: pythonLiteral correcto. `accessColumn`: expresión df_clean completa. |
| `src/__tests__/placeholderVocabulary.test.ts` | Constante congelada, inmutable, contiene todos los valores esperados. |

### Implementación

1. `ScriptBuildContextV2`: `remediationContext`, `datasetFingerprint`, `columnRegistry`, `correspondenceEvidence`
2. `ColumnRegistryV2`: `byColumnId: Map<string, ColumnRef>`, `byName: Map<string, ColumnRef[]>`
3. `ScriptContractCandidateV2`: sin `scriptHash` ni `validationResult`
4. `ScriptContractV2`: con `scriptHash`, `validationResult`, `placeholderVocabularyVersion`, partición corregida
5. `buildPythonLiteral(name, duplicateOrdinal, isReservedWord)`: sanitización + ordinal + reserved word handling
6. `readColumn(columnId, registry)`: null-safe, busca por columnId
7. `writeColumn(col)`: devuelve `pythonLiteral` para escritura
8. `accessColumn(col)`: devuelve `df_clean[pythonLiteral]` para acceso
9. `PLACEHOLDER_VOCABULARY_V2`: `ReadonlyArray<string>`, `Object.freeze`, version `1.0.0`

### Artefacto de evidencia
Tabla en `loop_01_schema_and_columns.md` con:
- Casos de columna normal, duplicada (ordinal 0, 1), ambigua, reserved word, nula
- `pythonLiteral` generado para cada caso
- Vocabulario de placeholders completo

### Métrica
- Cobertura de columnas resueltas: 100%
- Columnas rechazadas por ambigüedad: documentadas
- Vocabulario: 19 placeholders, versión 1.0.0

### Criterio de cierre
- 25+ tests pasando
- `ScriptBuildContextV2` se construye sin modificar `RemediationContextV2`
- `correspondenceEvidence.columnsMatch === true` para contextos válidos
- `pythonLiteral` se obtiene de `ColumnRef`, no de `RemediationContextColumnV2`

### Riesgos
- Bajo. `ColumnRef` ya existe. Se añade `pythonLiteral` al resolver, no al tipo existente.

---

## Loop 2: Renderer determinista + PLACEHOLDER_VOCABULARY

### Objetivo
Construir el mapeo `actionType` → plantilla Python/Pandas usando helpers de columna y vocabulario de placeholders.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptRendererV2.ts` | Crear — mapeo actionType → plantilla |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptRendererV2.test.ts` | Cada `actionType` → script generado correcto. Columna duplicada (ordinal). Columna reserved word. `drop_exact_duplicates` con `columnRef` nulo. `requires_human_review` sin código. |

### Implementación

1. `renderActionV2(action, columnRef, params): string`
2. Para cada `actionType`:
   - `trim_whitespace`: `.str.strip()` + `.str.replace(r'\s+', ' ', regex=True)` si `collapseInternalWhitespace`
   - `drop_exact_duplicates`: acepta `columnRef === null`, `.drop_duplicates().copy()`
   - `normalize_placeholders`: usa `PLACEHOLDER_VOCABULARY_V2` para la lista de reemplazo
   - `normalize_casing`: `.str.title()` o `.str.lower()` según `strategy`
   - `convert_disguised_numbers`: `pd.to_numeric(...)`
   - `requires_human_review`: comentario Python con `reasonCode`, sin código
3. `buildScriptHeader()`: imports + `def clean_dataset(df):` + `df_clean = df.copy()`
4. `buildScriptFooter()`: `return df_clean`
5. `buildScriptText(actions, columnRegistry): string` — orquesta header + acciones + footer

### Artefacto de evidencia
Tabla en `loop_02_renderer.md` con:
- Cada actionType y su plantilla Python resultante
- Ejemplo con columna duplicada (Name_0, Name_1)
- Vocabulario de placeholders usado en `normalize_placeholders`

### Métrica
- 6 actionTypes cubiertos
- Script generado para plan de 9 acciones → salida determinista
- Mismo input → mismo output (hash estable, sin `generatedAt`)

### Criterio de cierre
- 20+ tests pasando
- Cada actionType produce exactamente la salida esperada
- Hash estable verificado con 3 ejecuciones
- `drop_exact_duplicates` funciona con `columnRef === null`

### Riesgos
- Medio. Las plantillas deben coincidir con la semántica de cada `actionType`. `collapseInternalWhitespace` requiere `.str.replace()` adicional.

---

## Loop 3: Script contract builder + finalizer

### Objetivo
Construir `ScriptContractCandidateV2` y `finalizeScriptContractV2()`.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptBuilderV2.ts` | Crear — `buildScriptCandidateV2()`, `finalizeScriptContractV2()`, función de reconstrucción |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptBuilderV2.test.ts` | Candidate con 0, 1, 9 acciones. Todas approved. Mix approved/rejected/pending. Columna ambigua. `requires_human_review`. Partición: rejected NUNCA en excluded. Finalizer con validación. Reconstrucción exacta. |

### Implementación

1. `buildScriptCandidateV2(plan, buildContext): ScriptContractCandidateV2`
2. Iterar `plan.plan[]` aplicando partición única:
   - `rejected` → `rejectedActionIds` (NUNCA en excluded)
   - `approved` + renderizable → `acceptedActionIds`
   - `approved` + no renderizable (columna ambigua, `requires_human_review`, etc.) → `excludedActionIds`
   - `pending` → `excludedActionIds` con `reason: 'pending'`
3. Construir `scriptText` concatenando acciones en `acceptedActionIds`
4. Si `acceptedActionIds` vacío → función `clean_dataset(df)` que copia y retorna sin transformaciones
5. Resolver `columnRefs` para acciones accepted
6. `finalizeScriptContractV2(candidate, validationResult): ScriptContractV2` — añade `scriptHash` y `validationResult`
7. `scriptHash` NO incluye `generatedAt`

### Artefacto de evidencia
JSON de ejemplo con `ScriptContractCandidateV2` y `ScriptContractV2` final para Titanic.

### Métrica
- Plan de 9 acciones → candidato con partición correcta
- `acceptedActionIds.length` depende de HITL
- `rejectedActionIds ∩ excludedActionIds = ∅`
- `scriptHash` estable (sin `generatedAt`)

### Criterio de cierre
- 25+ tests pasando
- Candidato válido según esquema
- Finalizer solo acepta candidatos validados
- Hash verificable y determinista

### Riesgos
- Bajo. La lógica es lineal y determinista.

---

## Loop 4: Script contract validator

### Objetivo
Validar `ScriptContractCandidateV2` contra el plan y el contexto, incluyendo validación por reconstrucción exacta.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptValidatorV2.ts` | Crear — `validateScriptCandidateV2()` con V1–V35 |
| `src/contracts/llm/scriptErrorCodes.ts` | Crear — `ScriptErrorCode`, `PythonSyntaxState` |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptValidatorV2.test.ts` | Validar candidato válido. Campos faltantes. remediationRef incorrecto. Acción rejected en excluded. Acción pending en accepted. Columna ambigua. Hash mismatch (en final). Render mismatch (reconstrucción). Executable content. Imports no autorizados. Python syntax: passed, failed, not_run. |

### Implementación

1. `validateScriptCandidateV2(candidate, plan, buildContext): ValidationResultV2`
2. Validaciones V1–V35 (definidas en `DISENO_SCRIPT_CONTRACT_V2.md`)
3. Validación de partición: `rejectedActionIds ∩ excludedActionIds = ∅`
4. Validación por reconstrucción: re-renderizar y comparar `scriptText`, `acceptedActionIds`, `columnRefs`, `cleanDatasetFn`
5. Python syntax tri-state: `'passed'` | `'failed'` | `'not_run'`
6. `not_run` emite warning, no bloquea finalización
7. Validación de seguridad exhaustiva

### Artefacto de evidencia
Tabla con casos de validación y resultados, incluyendo `SCRIPT_RENDER_MISMATCH`.

### Métrica
- 0 falsos positivos en candidato válido
- 100% de errores detectados en candidato inválido
- `SCRIPT_PARTITION_INVALID` detecta rejected en excluded
- `SCRIPT_RENDER_MISMATCH` detecta drift builder-validator

### Criterio de cierre
- 30+ tests pasando
- Todos los códigos de error cubiertos
- Reconstrucción exacta verificada

### Riesgos
- Medio. Validación de sintaxis Python requiere Python instalado. `not_run` no bloquea.
- La reconstrucción requiere que builder y validator usen exactamente el mismo renderer.

---

## Loop 5: Script generation step (UI)

### Objetivo
Conectar el sistema de script v2 con la UI existente.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/components/ScriptGenerationStepV2.tsx` | Crear — componente v2 |
| `src/components/ScriptGenerationStep.tsx` | Modificar — ruteo a ScriptGenerationStepV2 |
| `src/components/ReviewStep.tsx` | Modificar — aceptar ScriptContractV2 |
| `src/components/ScriptReview.tsx` | Modificar — aceptar contrato v2 |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptGenerationStepV2.test.ts` | Renderizado con plan, sin plan, con 0 acciones aprobadas |

### Implementación

1. Crear `ScriptGenerationStepV2`:
   - Recibe `remediationPlan` y `structuredDiagnosis`
   - Construye `ScriptBuildContextV2` desde `remediationContext`
   - Llama `buildScriptCandidateV2()` → `validateScriptCandidateV2()` → `finalizeScriptContractV2()`
   - Muestra script renderizado con syntax highlighting
   - Muestra resumen de gobernanza con partición única
   - Badge: `"Contrato válido"` / `"Validación fallida"` / `"Sin validar"`
   - NO muestra badge `"Seguro"`
   - Botón "Continuar a revisión"
2. Modificar `ScriptGenerationStep`: si `isV2 && remediationPlan`, renderizar `ScriptGenerationStepV2`
3. Modificar `ReviewStep`: aceptar `ScriptContractV2` como prop opcional

### Artefacto de evidencia
Screenshot del script generado para Titanic.

### Métrica
- Componente renderiza correctamente con plan de 9 acciones
- Badge muestra "Contrato válido" (no "Seguro")
- Script visible con syntax highlighting

### Criterio de cierre
- Componente monta sin errores
- Script renderizado coincide con `buildScriptCandidateV2`
- Navegación a ReviewStep funcional

### Riesgos
- Medio. `ScriptReview` actual usa CodeMirror/Monaco — verificar compatibilidad.

---

## Loop 6: E2E harness y capturas Phase 4

### Objetivo
Crear harness E2E para Phase 4 y generar capturas de evidencia.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/tests/e2e/harness/Phase4ScriptHarness.ts` | Crear — fixture de ScriptContractV2 para Titanic |
| `src/tests/e2e/fourth-delivery-evidence.spec.ts` | Crear — 3 tests E2E |
| `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/` | Crear — capturas |

### Tests primero (E2E)

| Test | Descripción | Assertions |
|---|---|---|
| 07 — `script_generation_v2.png` | Script generado | `script-stage` visible; código Python visible; `clean_dataset` function visible; badge "Contrato válido" visible; resumen de gobernanza con partición única |
| 08 — `script_review_v2.png` | Revisión del script | `review-stage` visible; `Aprobar` button visible; checklist con 5 items |
| 09 — `script_approved_v2.png` | Script aprobado | `Preparar exportación` button visible; HITL decision registrada; `APROBADO` badge visible |

### Implementación

1. Crear `src/tests/e2e/harness/Phase4ScriptHarness.ts` con fixture determinista
2. Crear `src/tests/e2e/fourth-delivery-evidence.spec.ts` con 3 tests E2E
3. Generar capturas y guardar en `phase4/`
4. Actualizar `CAPTURAS_MANIFEST.md` en `phase4/`

### Artefacto de evidencia
3 capturas PNG:
- `07_script_generation_v2.png` — Script renderizado
- `08_script_review_v2.png` — Revisión HITL
- `09_script_approved_v2.png` — Script aprobado

### Métrica
- 3/3 E2E tests pass
- 3 capturas generadas
- Harness determinista (sin Ollama, sin LLM)

### Criterio de cierre
- E2E tests 3/3 pass
- Capturas congeladas
- `CAPTURAS_MANIFEST.md` actualizado

### Riesgos
- Medio. Depende de Loop 5 (UI).

---

## Resumen de loops

| Loop | Título | Archivos | Tests | Riesgo |
|---|---|---|---|---|
| L1 | Types + BuildContext + column resolver + vocabulary | 5 | 25+ | Bajo |
| L2 | Renderer determinista | 2 | 20+ | Medio |
| L3 | Script contract builder + finalizer | 2 | 25+ | Bajo |
| L4 | Script contract validator (con reconstrucción) | 3 | 30+ | Medio |
| L5 | UI — Script generation + review | 4 | 10+ | Medio |
| L6 | E2E harness + capturas | 3 | 3 E2E | Medio |

## Archivos que se modificarían

| Archivo | Loop | Tipo de cambio |
|---|---|---|
| `src/contracts/llm/types.ts` | L1 | Añadir tipos |
| `src/contracts/llm/scriptBuildContext.ts` | L1 | Nuevo |
| `src/contracts/llm/scriptColumnResolver.ts` | L1 | Nuevo |
| `src/contracts/llm/placeholderVocabulary.ts` | L1 | Nuevo |
| `src/contracts/llm/scriptRendererV2.ts` | L2 | Nuevo |
| `src/contracts/llm/scriptBuilderV2.ts` | L3 | Nuevo |
| `src/contracts/llm/scriptValidatorV2.ts` | L4 | Nuevo |
| `src/contracts/llm/scriptErrorCodes.ts` | L4 | Nuevo |
| `src/contracts/llm/index.ts` | L1-L4 | Nuevos exports |
| `src/components/ScriptGenerationStepV2.tsx` | L5 | Nuevo |
| `src/components/ScriptGenerationStep.tsx` | L5 | Modificar ruteo |
| `src/components/ReviewStep.tsx` | L5 | Modificar props |
| `src/components/ScriptReview.tsx` | L5 | Modificar props |
| `src/tests/e2e/harness/Phase4ScriptHarness.ts` | L6 | Nuevo |
| `src/tests/e2e/fourth-delivery-evidence.spec.ts` | L6 | Nuevo |

## Archivos que NO se modifican

- `src/contracts/llm/remediationBuilderV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationValidatorV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationApprovalV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationPolicyV2.ts` (Phase 3 congelado)
- `src/services/deterministicScriptBuilder.ts` (legacy v1, se preserva)
- `src/services/scriptValidationService.ts` (legacy v1, se preserva)
- `src/tests/e2e/harness/Phase3EvidenceHarness.ts` (Phase 3 congelado)
- `src/tests/e2e/third-delivery-evidence.spec.ts` (Phase 3 congelado)
- Capturas 01–06 (Phase 3 congeladas)

## Dependencias entre loops

```
L1 (types + context + resolver + vocabulary) → L2 (renderer) → L3 (builder) → L4 (validator)
                                                                                    │
                                                                                    ▼
                                                                              L5 (UI) → L6 (E2E)
```

## Riesgos y decisiones abiertas

1. **Python syntax tri-state:** `not_run` no bloquea finalización pero emite warning. Solo `passed` es validación formal.
2. **`pythonLiteral` en `ColumnRef`, no en `RemediationContextColumnV2`:** Se obtiene del envelope original o se construye en `buildScriptContext()`.
3. **Script vacío (0 acciones):** Contiene función `clean_dataset(df)` completa, copia y retorna sin transformaciones.
4. **Reconstrucción exacta:** Builder y validator deben usar exactamente el mismo renderer para que `SCRIPT_RENDER_MISMATCH` no dé falsos positivos.
5. **Partición única:** `rejectedActionIds` y `excludedActionIds` son disjuntos por construcción. El validador lo verifica con `SCRIPT_PARTITION_INVALID`.
