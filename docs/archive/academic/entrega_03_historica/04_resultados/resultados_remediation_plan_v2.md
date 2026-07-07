# Resultados Empíricos: Phase 3 — RemediationPlan v2

> **Commit:** `fe5378e3eff87de45b60111eb42e30ed89beb1cd`
> **Fecha:** 2026-06-24
> **Harness:** `run-local-dataset-validation.mjs` v1.1.0
> **sourceTreeDirty:** `false`
> **plataforma:** macOS darwin, Node.js, sin Ollama

---

## 1. Propósito de la evaluación

Validar que el contrato `aura.remediation.v2` produce planes de remediación deterministas, internamente consistentes y verificables sin recurrir a inferencia LLM en tiempo de construcción.

## 2. Qué es RemediationPlanV2

`RemediationPlanV2` es un contrato que describe qué acciones de remediación se proponen para los issues detectados en un dataset, quién debe revisarlas, y qué evidencia las respalda.

Estructura principal:

```
contractId:         "aura.remediation.v2"
contractVersion:    "2.0.0"
planId:             `plan:${sha256short(hash)}` del plan serializado (longitud por defecto 8 caracteres)
diagnosisRef:       `diag:${SHA-256 de 64 hex del envelope}` (sin responseId ni generatedAt)
evidenceEnvelopeRef: Hash del envelope de evidencia
datasetFingerprint:  SHA-256 del CSV procesado
plan:               Array<RemediationActionV2>
actionabilityMap:   Record<issueId, Actionability>
exclusions:         Array<{ issueId, reason: "not_actionable" }>
generatedAt:        ISO 8601
```

El plan es **inmutable en su identidad**: alterar cualquier campo de contenido sin actualizar `planId` lo invalida.

## 3. Cómo se construye

El constructor `buildRemediationPlanV2` opera sin LLM:

1. Recibe `DiagnosisExecutionResult` (que incluye `remediationContext` y `diagnosis`).
2. Itera sobre cada issue del contexto.
3. Para cada issue, consulta `remediationPolicyV2.ts` → `lookupRemediationAction(ruleId)` para obtener el `actionType` autorizado.
4. Calcula `actionability` con `computeEffectiveActionability(ctxIssue, diagIssue, columns)`: degrada `auto_safe` → `review_only` según 8 reglas: nivel de acciónabilidad configurado, validación de autorización automática, coincidencia de tipo de acción con el registro, presencia del issue en el diagnóstico, columna ambigua/duplicada, y `requiresHumanReview` del diagnóstico.
5. Genera `actionId` como `act:${sha256short(sha256hex(canonicalJson({ diagnosisRef, issueId, ruleId, columnId, actionType })))`.
6. Agrupa en `exclusions` los issues donde `actionability = 'not_actionable'`.

## 4. Cómo se calcula actionability

La función `computeEffectiveActionability` aplica 8 reglas de degradación (de `auto_safe` → `review_only`):

```
Regla 1: trusted actionability = not_actionable → not_actionable
Regla 2: trusted actionability = review_only → review_only
Regla 3: issue ausente en diagnóstico → review_only
Regla 4: actionType de autorización no coincide con remediationPolicyV2 → review_only
Regla 5: automaticAuthorization.authorized = false → review_only
Regla 6: columna ambigua o duplicada → review_only
Regla 7: diagnóstico requiere revisión humana → review_only
Regla 8 (fallback): regla desconocida o condición no satisfecha → review_only
```

Solo si todas las condiciones de Regla 8 se satisfacen simultáneamente (trusted=auto_safe, auth autorizada, tipo coincide, issue presente, columna limpia, sin requerimiento de revisión) se asigna `auto_safe`. En caso contrario, el fallback es `review_only`.

## 5. Por qué el LLM no selecciona transformaciones

El LLM no tiene autoridad para seleccionar qué tipo de acción aplicar. Su rol se limita a:

- **Interpretar** la evidencia del motor determinista.
- **Explicar** los hallazgos en lenguaje natural.

Phase 3 implementa exclusivamente `RemediationPlanV2`. El plan **no contiene código**:
solo enumera acciones autorizadas, sus evidenceRefs y actionability. La generación de script
Python/Pandas corresponde a Phase 4 (renderer determinista), no a Contracts v2.

## 6. Papel de la revisión humana

Cada acción en el plan tiene estado inicial `pending`. El revisor humano puede:

- **Aprobar:** la acción pasa a `approved` y queda registrada para el renderer de Phase 4.
- **Rechazar:** la acción pasa a `rejected` y se excluye del script.
- **Resetear:** volver a `pending` para reevaluar.

Phase 4 implementará el renderer que genera el script Python/Pandas a partir de las acciones `approved`. Currently no se ejecutan transformaciones desde Phase 3.

La revisión humana es **obligatoria**: el approvalStatus registra la decisión.

## 7. Datasets utilizados

| Dataset | Filas | Columnas | SHA-256 | Issues | Descripción |
|---|---|---|---|---|---|
| synthetic_ground_truth.csv | 15 | 9 | `4e7d358f...` | 16 | Ground truth: 9 tipos, 26 instancias; 16 hallazgos detectados por el motor |
| titanic.csv | 891 | 12 | `4a437fde...` | 10 | Dataset real público, tamaño medio |
| adult_income.csv | 48.842 | 15 | `23f713bb...` | 12 | Dataset público UCI, alto volumen |

## 8. Tabla de resultados por dataset

| Dataset | Filas | Issues | Acciones | Auto-safe | Review-only | Exclusiones | Hash estable | Upgrades | Refs inválidas |
|---|---|---|---|---|---|---|---|---|---|
| synthetic_ground_truth.csv | 15 | 16 | 16 | 0 | 16 | 0 | true | 0 | 0 |
| titanic.csv | 891 | 10 | 9 | 0 | 9 | 1 | true | 0 | 0 |
| adult_income.csv | 48.842 | 12 | 12 | 0 | 12 | 0 | true | 0 | 0 |
| **Total** | — | **38** | **37** | **0** | **37** | **1** | **true** | **0** | **0** |

Todas las columnas de la tabla provienen del artefacto `validation-results.json` generado por el harness. No se han modificado manualmente.

## 9. Análisis de resultados

### 9.1 Consistencia estructural

Los tres planes pasaron la validación del contrato `aura.remediation.v2` sin errores. Esto confirma que:

- La infraestructura del contrato está correctamente implementada.
- `buildRemediationPlanId` produce identificadores estables.
- `validateRemediationPlanV2` recalcula correctamente los hashes y rechaza cualquier alteración.

### 9.2 Ausencia de upgrades inseguros

`unsafeUpgrades = 0` en los tres datasets. Ningún plan asignó `auto_safe` a una acción que debería haber sido `review_only`. Esto confirma que la política de `computeEffectiveActionability` se aplica consistentemente.

### 9.3 Ausencia de referencias inválidas

`invalidReferences = 0` en los tres datasets. Ningún `actionId` o `evidenceRef` apunta a un diagnóstico o contexto inexistente. Esto valida la integridad referencial del contrato.

### 9.4 Cero auto_safe

Los cero `auto_safe` en todos los datasets se explican por la política conservadora activa (las 8 reglas de `computeEffectiveActionability` asignan `review_only` cuando no se satisfacen todas las condiciones). El sistema **puede** construir planes con `auto_safe` (la lógica existe y está probada), pero los datasets del harness no cumplen los requisitos para ninguna acción automática.

### 9.5 Cobertura

El plan de Titanic tiene 9 acciones y 1 exclusión para 10 issues. El plan de synthetic tiene 16 acciones para 16 issues. Todos los issues tienen cobertura (acción o exclusión), sin duplicados.

## 10. Limitaciones

1. **Fixtures deterministas, no inferencia LLM.** El diagnóstico usa `DiagnosisResponseV2` fixture, no un modelo real. Los planes resultantes reflejan la cobertura del motor determinista, no la interpretación de un LLM.
2. **Auto-safe ausente por política.** No es un defecto del sistema; es el resultado esperado dado que las 8 reglas de `computeEffectiveActionability` asignan `review_only` cuando alguna condición no se satisface.
3. **Sin ejecución de scripts.** El harness valida la estructura del plan, no la ejecución de las transformaciones Python resultantes.
4. **Ground truth solo en sintético.** Titanic y Adult Income no tienen verdad base annotada, por lo que no se pueden calcular TP/FP/FN sobre sus issues.

## 11. Claims permitidos y no permitidos

### Permitidos

- El contrato `aura.remediation.v2` produce planes deterministas reproducibles.
- Los planes son estructuralmente válidos según el esquema del contrato.
- No se producen upgrades inseguros ni referencias inválidas en los tres datasets probados.
- La revisión humana es obligatoria antes de generar cualquier script.
- El LLM no selecciona transformaciones; consulta una política cerrada.

### No permitidos

- "El plan de remediación elimina errores del dataset" (el harness no ejecuta scripts).
- "AURA tiene 0% de errores" (no hay ground truth para Titanic ni Adult Income).
- "Los planes son equivalentes a inferencia LLM real" (se usan fixtures deterministas).
- "Auto-safe funciona mal" (la ausencia refleja política, no defecto).
