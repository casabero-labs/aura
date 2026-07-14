# Cierre ejecución, reauditoría y ZIP TFM Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Cerrar una corrida real de AURA desde el diagnóstico hasta el CSV corregido, su reauditoría y un ZIP completo de evidencia.

**Architecture:** El LLM diagnostica; AURA construye un script determinista aprobado; un runner local ejecuta Python/Pandas sobre una copia; AURA valida el recibo, reaudita el resultado con el mismo motor determinista y exporta la evidencia sin incluir el CSV original.

**Tech Stack:** React, TypeScript, Vitest, Playwright, Node.js, Python, Pandas, fflate.

---

## Alcance congelado

Este cierre incluye únicamente:

1. Aceptar que el diagnóstico cite un subconjunto válido de la evidencia, sin aceptar referencias inventadas.
2. Ejecutar la reauditoría después de validar `corrected.csv` y `receipt.json`.
3. Mostrar score y hallazgos antes/después.
4. Incluir script, ejecución y reauditoría en el ZIP completo.
5. Certificar una corrida humana real sobre un dataset controlado pequeño.

No incluye persistencia del CSV corregido tras recargar, ejecución de Python dentro del navegador, refactor del `ImprovementRun` histórico, rediseños generales ni campaña de 45 corridas.

## Reglas no negociables

- No ejecutar código escrito libremente por el LLM.
- No modificar el CSV original.
- No reutilizar `runImprovementFlow()`: corresponde al flujo histórico de simulación/Colab.
- No guardar `File`, filas completas ni el CSV corregido en `localStorage`.
- No incluir `source.csv` en el ZIP.
- El ZIP puede incluir `corrected.csv`; debe advertir que puede contener PII.
- Una referencia del diagnóstico puede ser vacía o un subconjunto de la evidencia segura. Una referencia ajena continúa bloqueada.
- La reauditoría usa `runAudit`; por tanto demuestra una comparación reproducible con el mismo motor, no una validación externa independiente.

### Task 1: Cerrar el bloqueo de referencias del plan

**Files:**
- Modify: `src/contracts/llm/remediationValidatorV2.ts`
- Test: `src/__tests__/remediationValidatorV2.test.ts`

**Step 1: Write failing tests**

Agregar dos casos:

```ts
it('accepts empty diagnosis evidenceRefs when trusted context retains evidence', () => {
  // diagnosis.evidenceRefs=[] and requiresHumanReview=true
  // plan actions must retain context.evidenceRefs
});

it('rejects evidenceRefs absent from trusted context', () => {
  // diagnosis.evidenceRefs=['ev:invented']
  // expect REMEDIATION_REFERENCE_INVALID
});
```

**Step 2: Verify failure**

Command:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/remediationValidatorV2.test.ts
```

Expected: el caso de referencias vacías falla por comparación exacta.

**Step 3: Implement minimal subset validation**

En `validateRemediationPlanV2()` reemplazar igualdad exacta por:

```ts
const contextRefs = new Set(contextIssue.evidenceRefs);
const unsupportedRefs = diagnosisIssue.evidenceRefs.filter(ref => !contextRefs.has(ref));
if (unsupportedRefs.length > 0) {
  errors.push(/* REMEDIATION_REFERENCE_INVALID */);
}
```

El builder seguirá copiando `contextIssue.evidenceRefs` al plan.

**Step 4: Verify success**

Expected: test PASS y una referencia inventada continúa fallando.

**Estado:** implementado localmente; 19 pruebas específicas, typecheck y build aprobados.

### Task 2: Crear evidencia verificada de reauditoría

**Files:**
- Create: `src/services/remediationExecution/verifiedRemediationEvidence.ts`
- Modify: `src/components/ApplyVerifyStep.tsx`
- Modify: `src/components/MainPipeline.tsx`
- Modify: `src/services/pipelineSession.ts`
- Test: `src/__tests__/verifiedRemediationEvidence.test.ts`
- Test: `src/__tests__/ApplyVerifyStep.test.tsx`
- Test: `src/__tests__/MainPipelineR4.test.tsx`
- Test: `src/__tests__/pipelineSession.test.ts`

**Step 1: Write failing service tests**

Definir el resultado canónico:

```ts
export interface VerifiedRemediationEvidence {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  correctedCsv: Uint8Array;
  reaudit: {
    summary: ReauditSummaryV1;
    output: OutputDatasetSummaryV1;
    beforeReport: AuditReport;
    afterReport: AuditReport;
  };
  beforeAfterSummary: HealthDelta;
}
```

Probar que:

- Un CSV fuente y uno corregido válidos producen score/hallazgos antes-después.
- El resultado no contiene `beforeOutput`, `afterOutput` ni `rawCsv`.
- Una salida vacía o inválida falla de forma explícita.

**Step 2: Verify failure**

```bash
npm test -- --run __tests__/verifiedRemediationEvidence.test.ts
```

Expected: módulo inexistente.

**Step 3: Implement service**

La función debe recibir la ejecución ya validada y ejecutar:

```ts
const beforeCsv = decode(sourceCsv);
const afterCsv = decode(correctedCsv);
const reaudit = runReaudit(beforeCsv, afterCsv, evidenceEnvelopeRef, { delimiter });
const beforeAfterSummary = calculateHealthDelta(reaudit.beforeReport, reaudit.afterReport);
return {
  bundle,
  receipt,
  correctedCsv,
  reaudit: {
    summary: reaudit.summary,
    output: reaudit.output,
    beforeReport: reaudit.beforeReport,
    afterReport: reaudit.afterReport,
  },
  beforeAfterSummary,
};
```

**Step 4: Connect MainPipeline**

Reemplazar `onVerifiedExecution={setVerifiedExecution}` por un handler asíncrono. Estados nuevos:

```ts
type ReauditState = 'not_run' | 'running' | 'completed' | 'failed';
```

El handler debe:

1. Conservar que la ejecución Python ya fue validada.
2. Leer fuente y resultado en memoria.
3. Construir `VerifiedRemediationEvidence`.
4. Guardar resumen, marcar `completed` y registrar log.
5. Si falla, conservar el recibo verificado pero marcar la reauditoría `failed`; no afirmar remediación verificada.

`invalidateDescendants()` debe limpiar toda evidencia de ejecución y reauditoría.

**Step 5: Update UI**

En el bloque verificado mostrar:

```text
Score antes / después
Hallazgos antes / después
Reglas corregidas
Reglas persistentes
Reglas nuevas
```

El botón hacia la exportación completa se habilita únicamente con reauditoría `completed`.

**Step 6: Preserve session privacy**

`pipelineSession.ts` debe continuar excluyendo `verifiedExecution` y los bytes del CSV. Al restaurar, solicitar nuevamente `corrected.csv` y `receipt.json`.

**Step 7: Verify success**

```bash
npm test -- --run __tests__/verifiedRemediationEvidence.test.ts __tests__/ApplyVerifyStep.test.tsx __tests__/MainPipelineR4.test.tsx __tests__/pipelineSession.test.ts
```

### Task 3: Añadir ejecución y reauditoría al ZIP

**Files:**
- Modify: `src/services/evidenceArchive.ts`
- Modify: `src/App.tsx`
- Test: `src/__tests__/evidenceArchive.test.ts`
- Test: `src/__tests__/exportJsonPreflight.integration.test.tsx`

**Step 1: Write failing archive tests**

Para una corrida verificada exigir estos archivos:

```text
remediation/approved-script.py
execution/execution-bundle.json
execution/receipt.json
execution/corrected.csv
execution/reaudit-result.json
execution/before-after-summary.json
```

Probar también:

- Bytes exactos de `corrected.csv`.
- SHA-256 y tamaño correctos en `manifest.json`.
- Ausencia absoluta de `source.csv`.
- `reaudit-result.json` no contiene `rawCsv`, `beforeOutput` ni `afterOutput`.
- La ejecución alterada o incompleta bloquea el ZIP verificado.

**Step 2: Verify failure**

```bash
npm test -- --run __tests__/evidenceArchive.test.ts
```

**Step 3: Extend EvidenceArchiveInput**

```ts
export interface EvidenceArchiveInput {
  technicalExport: AuraTechnicalExport;
  issuesCsv: string;
  diagnosticPdf?: Uint8Array | null;
  activityLog?: Array<{ time: string; msg: string }>;
  verifiedExecution?: VerifiedRemediationEvidence | null;
}
```

Agregar los cinco archivos `execution/*` solo cuando exista evidencia verificada completa. El script aprobado permanece bajo `remediation/approved-script.py`.

**Step 4: Add privacy declaration**

El manifest debe declarar:

```ts
correctedDatasetIncluded: boolean;
correctedDatasetMayContainPersonalData: boolean;
```

El README debe indicar que el original no se incluye y que el corregido puede contener información sensible.

**Step 5: Wire App export**

`handleExportEvidencePackage()` debe pasar `pipelineData.verifiedExecution`. Si la UI afirma ejecución verificada y falta la evidencia en memoria, debe detener la exportación completa y pedir reimportar los archivos.

**Step 6: Verify success**

```bash
npm test -- --run __tests__/evidenceArchive.test.ts __tests__/exportJsonPreflight.integration.test.tsx
```

### Task 4: Certificar recorrido real de navegador

**Files:**
- Modify: `src/components/ApplyVerifyStep.tsx`
- Test: `src/__tests__/ApplyVerifyStep.test.tsx`
- Modify: `src/tests/e2e/apply-verify-e2e.spec.ts`
- Optional Modify: `src/tests/e2e/aura-full-flow-export.spec.ts`

**Step 1: Remove the impossible browser-only syntax gate**

El navegador no ejecuta Python y genera legítimamente `pythonSyntax.state='not_run'`. El runner local ejecuta `python -m py_compile` antes de aplicar el script y conserva ese resultado en `receipt.json`.

Por tanto, las precondiciones de `ApplyVerifyStep` deben:

```ts
if (!verification || verification.valid !== true || verification.pythonSyntax.state === 'failed') {
  errors.push('La verificación V2 del script falló.');
}
```

Aceptar `passed` y `not_run`; bloquear `failed`. Añadir pruebas para ambos casos. No alterar ni fabricar el estado de sintaxis en el E2E.

**Step 2: Extend happy path**

El E2E debe:

1. Llegar a un plan válido sin parchear referencias.
2. Aprobar al menos una acción segura.
3. Generar y aprobar el script.
4. Descargar bundle y fuente.
5. Ejecutar `experiments/runners/run-aura-remediation.mjs` realmente.
6. Importar `corrected.csv` y `receipt.json`.
7. Ver score y hallazgos antes/después.
8. Descargar y descomprimir el ZIP.
9. Confirmar los seis artefactos y sus hashes.

No usar `force: true` ni alterar `pythonSyntax` en el camino feliz. Mantener recibo alterado como prueba negativa independiente. El camino feliz debe comprobar `receipt.syntax.status === 'passed'`, producido por el runner local real.

**Step 3: Run E2E**

```bash
npx playwright test tests/e2e/apply-verify-e2e.spec.ts
```

Expected: PASS con runner Python real.

### Task 5: Gates técnicos y recorrido humano único

**Step 1: Focused regression**

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run \
  __tests__/remediationBuilderV2.test.ts \
  __tests__/remediationValidatorV2.test.ts \
  __tests__/remediationV2Integration.test.ts \
  __tests__/scriptBuilderV2.test.ts \
  __tests__/verifiedRemediationEvidence.test.ts \
  __tests__/ApplyVerifyStep.test.tsx \
  __tests__/MainPipelineR4.test.tsx \
  __tests__/evidenceArchive.test.ts \
  __tests__/exportJsonPreflight.integration.test.tsx
npm run typecheck
npm run build
```

**Step 2: Update graph**

```bash
cd /Users/casabero/Documents/GitHub/aura
graphify update .
git diff --check
```

**Step 3: Human acceptance gate**

Una sola corrida sobre dataset controlado pequeño:

```text
diagnóstico válido
→ plan sin mismatch
→ aprobar una acción segura
→ script generado y aprobado
→ runner local
→ corrected.csv + receipt.json
→ reauditoría visible
→ ZIP con seis artefactos
```

El original debe permanecer intacto y un recibo alterado debe ser rechazado. Si un paso falla, el cierre no se declara terminado.

## Secuencia de agentes

1. **Agente A:** Task 2 solamente. No tocar ZIP ni E2E.
2. **Revisión del orquestador:** código, tests y claims.
3. **Agente B:** Task 3 solamente sobre la base aprobada.
4. **Revisión del orquestador:** contenido y privacidad del ZIP.
5. **Agente C:** Task 4 y gates de Task 5.
6. **Usuario + orquestador:** recorrido humano final y congelación de evidencia del TFM.

Cada agente debe devolver: commit, archivos modificados, decisiones, pruebas con conteos, limitaciones y `git diff --check`. No debe hacer push ni merge sin autorización expresa del orquestador.
