# Plan de Loops — Phase 4 (ScriptContractV2 + Renderer)

> **Versión:** 1.0.0 · **Fecha:** 2026-06-25 · **Commit congelado Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`

---

## Visión general

Phase 4 se divide en 6 loops. Cada loop produce código, tests y artefacto de evidencia. Los artefactos de evidencia se almacenan en `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/`.

**Regla de oro:** El LLM no escribe, corrige ni completa código en ningún punto.

---

## Loop 1: Base types y column resolver

### Objetivo
Actualizar `ScriptContractV2` al tipo completo y crear el resolver de columnas para el renderer.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/types.ts` | Actualizar `ScriptContractV2` con campos completos |
| `src/contracts/llm/scriptColumnResolver.ts` | Crear — resuelve `columnId` → `pythonLiteral` |
| `src/contracts/llm/index.ts` | Exportar nuevo módulo |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptContractV2.types.test.ts` | Verificar shape del tipo, campos obligatorios |
| `src/__tests__/scriptColumnResolver.test.ts` | Resolver columnas normales, duplicadas, ambiguas, reserved words, `columnId` nulo |

### Implementación

1. Completar `ScriptContractV2` en `types.ts` con `datasetFingerprint`, `excludedActionIds`, `generatedAt`
2. Cambiar `columnRefs: string[]` → `columnRefs: ColumnRef[]`
3. Cambiar `scriptText?: string` → `scriptText: string`
4. Crear `scriptColumnResolver.ts` con función `resolveActionColumn(action, contextColumns): ColumnRef | AmbiguousLookupError`
5. Usar `duplicateOrdinal` y `pythonLiteral` del `ColumnRef` existente en `RemediationContextV2`

### Artefacto de evidencia
Tabla en `loop_01_column_resolver.md` con:
- Casos de columna normal, duplicada, ambigua, reserved word, nula
- Decisión de renderizado para cada caso

### Métrica
- Cobertura de columnas resueltas: 100%
- Columnas rechazadas por ambigüedad: documentadas

### Criterio de cierre
- 20+ tests pasando
- Todas las variantes de columna cubiertas
- `isAmbiguous`, `isDuplicate`, `isReservedWord` probados

### Riesgos
- Bajo. El `ColumnRef` ya existe en `RemediationContextV2.columns[]`.

---

## Loop 2: Renderer determinista

### Objetivo
Construir el mapeo `actionType` → plantilla Python/Pandas.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptRendererV2.ts` | Crear — mapeo actionType → plantilla |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptRendererV2.test.ts` | Cada `actionType` → script generado correcto |

### Implementación

1. Crear `renderActionV2(action: RemediationActionV2, columnRef: ColumnRef): string`
2. Para cada `actionType`:
   - `trim_whitespace`: `.str.strip()` con/sin `collapseInternalWhitespace`
   - `drop_exact_duplicates`: `.drop_duplicates().copy()`
   - `normalize_placeholders`: `.replace([...], np.nan)`
   - `normalize_casing`: `.str.title()` o `.str.lower()` según `strategy`
   - `convert_disguised_numbers`: `pd.to_numeric(...)`
   - `requires_human_review`: comentario Python, sin código
3. Crear `buildScriptHeader(): string` — imports, `df_clean = df.copy()`
4. Crear `buildScriptFooter(): string` — comentario de cierre

### Artefacto de evidencia
Tabla en `loop_02_renderer.md` con:
- Cada actionType y su plantilla Python resultante
- Ejemplo con datos ficticios

### Métrica
- 6 actionTypes cubiertos
- Script generado para plan de 9 acciones → salida determinista
- Mismo input → mismo output (hash estable)

### Criterio de cierre
- 15+ tests pasando
- Cada actionType produce exactamente la salida esperada
- Hash estable verificado con 3 ejecuciones

### Riesgos
- Medio. Las plantillas deben coincidir con la semántica de cada `actionType`. El `collapseInternalWhitespace` requiere `.str.replace(r'\s+', ' ', regex=True)` adicional.

---

## Loop 3: Script contract builder

### Objetivo
Construir `ScriptContractV2` completo a partir de `RemediationPlanV2` y `RemediationContextV2`.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptBuilderV2.ts` | Crear — builder principal |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptBuilderV2.test.ts` | Build con 0, 1, 9 acciones; todas approved; mix approved/rejected/pending; columna ambigua; requires_human_review |

### Implementación

1. `buildScriptContractV2(plan, remediationContext): ScriptContractV2`
2. Iterar `plan.plan[]`:
   - `approved` → intentar renderizar (si columna válida) → `acceptedActionIds`
   - `rejected` → `rejectedActionIds`
   - `pending` → `excludedActionIds` con `reason: 'pending'`
   - Columna ambigua → `excludedActionIds` con `reason: 'ambiguous_column'`
   - `requires_human_review` → `excludedActionIds` con `reason: 'unsupported_action'`
3. Construir `scriptText` concatenando acciones aprobadas
4. Calcular `scriptHash` con `canonicalJson`
5. Resolver `columnRefs` para acciones aprobadas

### Artefacto de evidencia
JSON de ejemplo con `ScriptContractV2` resultante para Titanic (9 acciones → 1 approved, 7 pending, 1 rejected).

### Métrica
- Plan de 9 acciones → contrato completo con 1 acción aprobada
- `scriptHash` estable
- `acceptedActionIds.length === 1`, `rejectedActionIds.length === 1`, `excludedActionIds.length === 7`

### Criterio de cierre
- 20+ tests pasando
- Contrato válido según esquema
- Hash verificable

### Riesgos
- Bajo. La lógica es lineal y determinista.

---

## Loop 4: Script contract validator

### Objetivo
Validar `ScriptContractV2` contra el plan y el contexto.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `src/contracts/llm/scriptValidatorV2.ts` | Crear — validador exhaustivo |
| `src/contracts/llm/scriptErrorCodes.ts` | Crear — códigos de error |
| `src/contracts/llm/index.ts` | Exportar |

### Tests primero

| Archivo | Tests |
|---|---|
| `src/__tests__/scriptValidatorV2.test.ts` | Validar contrato válido; contrato con campos faltantes; remediationRef incorrecto; acción no aprobada en scriptText; columna ambigua; hash mismatch; cobertura incompleta; executable content; imports no autorizados |

### Implementación

1. `validateScriptContractV2(contract: unknown, plan: RemediationPlanV2, ctx: RemediationContextV2): ValidationResultV2`
2. Implementar validaciones V1–V28 (definidas en `DISENO_SCRIPT_CONTRACT_V2.md`)
3. Validación de sintaxis Python (opcional, depende de entorno)
4. Validación de seguridad (executable content, network, file access, unauthorized imports)
5. Validación de cobertura exacta

### Artefacto de evidencia
Tabla con casos de validación y resultados.

### Métrica
- 0 falsos positivos en contrato válido
- 100% de errores detectados en contrato inválido

### Criterio de cierre
- 25+ tests pasando
- Todos los códigos de error cubiertos
- Validación de seguridad exhaustiva

### Riesgos
- Medio. La validación de sintaxis Python requiere entorno con Python instalado (no siempre disponible en CI). Implementar como best-effort.

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
   - Construye `ScriptContractV2` via `buildScriptContractV2`
   - Muestra script renderizado con syntax highlighting
   - Muestra resumen: acciones aprobadas, rechazadas, pendientes
   - Botón "Continuar a revisión"
2. Modificar `ScriptGenerationStep`:
   - Si `isV2 && remediationPlan`, renderizar `ScriptGenerationStepV2`
3. Modificar `ReviewStep`:
   - Aceptar `ScriptContractV2` como prop opcional
   - Mostrar validación del contrato
   - Checklist HITL actualizado con métricas del contrato

### Artefacto de evidencia
Screenshot del script generado para Titanic (1 acción trim_whitespace, 7 pending, 1 rejected).

### Métrica
- Componente renderiza correctamente con plan de 9 acciones
- Script visible con syntax highlighting
- Resumen de gobernanza visible

### Criterio de cierre
- Componente monta sin errores
- Script renderizado coincide con `buildScriptContractV2`
- Navegación a ReviewStep funcional

### Riesgos
- Medio. Integración con el pipeline existente requiere cuidado con el ruteo v1/v2.
- `ScriptReview` actual usa CodeMirror/Monaco — verificar compatibilidad.

---

## Loop 6: E2E harness y capturas Phase 4

### Objetivo
Crear harness E2E para Phase 4 y generar capturas de evidencia.

### Archivos previstos

| Archivo | Acción |
|---|---|
| `tests/e2e/harness/Phase4ScriptHarness.ts` | Crear — fixture de ScriptContractV2 para Titanic |
| `tests/e2e/fourth-delivery-evidence.spec.ts` | Crear — 3 tests E2E |
| `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/` | Crear — capturas |

### Tests primero (E2E)

| Test | Descripción | Assertions |
|---|---|---|
| 07 — `script_generation_v2.png` | Script generado con 1 acción approved | `script-stage` visible; código Python visible; `clean_dataset` function visible; resumen de gobernanza visible |
| 08 — `script_review_v2.png` | Revisión del script con checklist | `review-stage` visible; `Aprobar` button visible; checklist con 5 items; `Seguro` badge visible |
| 09 — `script_approved_v2.png` | Script aprobado y listo para exportación | `Preparar exportación` button visible; HITL decision registrada; `APROBADO` badge visible |

### Implementación

1. Crear `Phase4ScriptHarness.ts` con `PHASE4_TITANIC_SCRIPT` (fixture determinista)
2. Crear `fourth-delivery-evidence.spec.ts` con 3 tests E2E
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
- Medio. Depende de Loop 5 (UI). Si la UI no está lista, las capturas no se pueden tomar.

---

## Resumen de loops

| Loop | Título | Archivos | Tests | Riesgo |
|---|---|---|---|---|
| L1 | Base types + column resolver | 3 | 20+ | Bajo |
| L2 | Renderer determinista | 2 | 15+ | Medio |
| L3 | Script contract builder | 2 | 20+ | Bajo |
| L4 | Script contract validator | 3 | 25+ | Medio |
| L5 | UI — Script generation + review | 4 | 10+ | Medio |
| L6 | E2E harness + capturas | 3 | 3 E2E | Medio |

## Archivos que se modificarían

| Archivo | Loop | Tipo de cambio |
|---|---|---|
| `src/contracts/llm/types.ts` | L1 | Actualizar tipo |
| `src/contracts/llm/scriptColumnResolver.ts` | L1 | Nuevo |
| `src/contracts/llm/scriptRendererV2.ts` | L2 | Nuevo |
| `src/contracts/llm/scriptBuilderV2.ts` | L3 | Nuevo |
| `src/contracts/llm/scriptValidatorV2.ts` | L4 | Nuevo |
| `src/contracts/llm/scriptErrorCodes.ts` | L4 | Nuevo |
| `src/contracts/llm/index.ts` | L1-L4 | Nuevos exports |
| `src/components/ScriptGenerationStepV2.tsx` | L5 | Nuevo |
| `src/components/ScriptGenerationStep.tsx` | L5 | Modificar ruteo |
| `src/components/ReviewStep.tsx` | L5 | Modificar props |
| `src/components/ScriptReview.tsx` | L5 | Modificar props |
| `tests/e2e/harness/Phase4ScriptHarness.ts` | L6 | Nuevo |
| `tests/e2e/fourth-delivery-evidence.spec.ts` | L6 | Nuevo |

## Archivos que NO se modifican

- `src/contracts/llm/remediationBuilderV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationValidatorV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationApprovalV2.ts` (Phase 3 congelado)
- `src/contracts/llm/remediationPolicyV2.ts` (Phase 3 congelado)
- `src/services/deterministicScriptBuilder.ts` (legacy v1, se preserva)
- `src/services/scriptValidationService.ts` (legacy v1, se preserva)
- `tests/e2e/harness/Phase3EvidenceHarness.ts` (Phase 3 congelado)
- `tests/e2e/third-delivery-evidence.spec.ts` (Phase 3 congelado)
- Capturas 01–06 (Phase 3 congeladas)

## Dependencias entre loops

```
L1 (types + resolver) ──► L2 (renderer) ──► L3 (builder) ──► L4 (validator)
                                                                    │
                                                                    ▼
                                                              L5 (UI) ──► L6 (E2E)
```

Los loops L1-L4 pueden implementarse y probarse de forma aislada (sin UI, sin browser). L5 y L6 requieren los loops anteriores completos.

## Riesgos y decisiones abiertas

1. **Validación de sintaxis Python en CI:** `compile()` requiere Python instalado. Decisión: implementar como validación best-effort (salta si Python no está disponible).

2. **`pythonLiteral` para columnas con nombres especiales:** Si una columna se llama `class`, `def`, `import`, etc., el `pythonLiteral` debe usar notación de diccionario (`df['class']`). Ya resuelto en `ColumnRef.pythonLiteral`.

3. **Colisiones de nombres de función:** Si `cleanDatasetFn` colisiona con nombres built-in de pandas. Decisión: prefijar con `_aura_` si es necesario, o documentar que el usuario puede renombrarla.

4. **Legacy v1 vs v2 coexistence:** Los componentes legacy se preservan. El ruteo en `ScriptGenerationStep` decide cuál usar basado en `isContractsV2Enabled()`.

5. **Script vacío (0 acciones aprobadas):** El contrato debe ser válido incluso con `acceptedActionIds: []`. `scriptText` contiene solo header + footer + comentario.
