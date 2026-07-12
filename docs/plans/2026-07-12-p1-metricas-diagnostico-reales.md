# Métricas reales del diagnóstico OE4 Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Sustituir las métricas prellenadas del diagnóstico formal por mediciones derivadas de la respuesta, el envelope, el snapshot y el recibo reales.

**Architecture:** Un extractor determinista obtiene cumplimiento, claims numéricos sin soporte y anclajes visibles; el oráculo consume esa evidencia y persiste tanto el resultado como sus motivos. Las métricas de script no ejecutadas quedan en `null`, nunca en éxito o fallo inventado.

**Tech Stack:** TypeScript, Vitest, contratos V2, oráculo OE4 y exportadores existentes.

---

### Task 1: Extraer evidencia real del diagnóstico

**Files:**
- Create: `src/services/benchmark/formalDiagnosisEvidence.ts`
- Test: `src/__tests__/formalDiagnosisEvidence.test.ts`

**Step 1: Write failing tests**

Cubrir como mínimo:

- una respuesta válida y un receipt válido producen cumplimiento real;
- errores del validador, receipt invalid o modelo diferente producen incumplimiento y códigos persistidos;
- `prompt_libre` no obtiene anclajes de muestras;
- `recommended` solo obtiene `badSampleRefs` si el `evidenceRef` está en `visibleEvidence.badSampleAnchors` del `userPayload` real;
- referencias inventadas no dan crédito;
- una cifra presente en los hechos visibles no es claim sin soporte;
- una cifra estadística ausente de los hechos visibles sí se registra con ubicación y texto.

**Step 2: Verify failure**

Command:
`cd src && npm test -- --run __tests__/formalDiagnosisEvidence.test.ts`

**Step 3: Implement deterministic extraction**

Crear funciones puras que:

1. revaliden `DiagnosisResponseV2` contra `EvidenceEnvelopeV2`;
2. comprueben receipt, hashes, modo y modelo solicitado/observado;
3. analicen estrictamente `run.input.userPayload` y extraigan únicamente los anchors realmente visibles;
4. construyan por `issueId` los `evidenceRefs` y `badSampleRefs` permitidos;
5. extraigan cifras solo de `hypothesis`, `observation`, `recommendation` y `limitations`;
6. comparen cifras estadísticas con los hechos visibles del dataset, issue y columna, con tolerancia documentada para redondeos;
7. devuelvan `contractCompliant`, `contractErrors`, `unsupportedClaims`, `anchoredEvidenceRefs` y `anchoredBadSampleRefs`.

No reutilizar el parser permisivo de Markdown de `hallucinationDetector.ts`. La campaña formal ya dispone de JSON V2 estricto.

**Step 4: Verify success**

Command:
`cd src && npm test -- --run __tests__/formalDiagnosisEvidence.test.ts`

Expected: PASS.

### Task 2: Conectar la evidencia al oráculo formal

**Files:**
- Modify: `src/services/benchmark/formalDiagnosisEvaluator.ts`
- Modify: `src/services/benchmark/diagnosticOracleEvaluator.ts`
- Test: `src/__tests__/formalDiagnosisEvaluator.test.ts`
- Test: `src/__tests__/diagnosticOracleEvaluator.test.ts`

**Step 1: Write failing tests**

Demostrar que ya no existen las asignaciones constantes:

- `contractCompliant: true`;
- `contractErrors: []`;
- `unsupportedClaims: []`;
- copia directa de `evidenceRefs` hacia `badSampleRefs`.

Añadir casos donde una referencia falsa no suma anclaje y donde un anchor real de `recommended` sí suma.

**Step 2: Implement**

`evaluateFormalDiagnosisRun()` debe consumir el extractor de Task 1. `evaluateDiagnosticOracle()` debe otorgar crédito únicamente por intersección con las referencias visibles permitidas, no por longitud del array.

**Step 3: Verify**

Command:
`cd src && npm test -- --run __tests__/formalDiagnosisEvaluator.test.ts __tests__/diagnosticOracleEvaluator.test.ts`

Expected: PASS.

### Task 3: Persistir motivos y representar lo no medido

**Files:**
- Modify: `src/services/benchmark/experimentTypes.ts`
- Modify: `src/services/benchmark/experimentGuards.ts`
- Modify: `src/services/benchmark/evaluationService.ts`
- Modify: `src/services/benchmark/experimentArtifactExporter.ts`
- Modify: `src/services/benchmark/experimentReport.ts`
- Modify: `src/services/benchmark/formalRepresentativePreparation.ts`
- Test: `src/__tests__/experimentTypes.test.ts`
- Test: `src/__tests__/experimentArtifactExporter.test.ts`
- Test: `src/__tests__/experimentReport.test.ts`
- Test: `src/__tests__/formalRepresentativePreparation.test.ts`

**Step 1: Write failing tests**

Exigir que la evaluación persista:

- `contractErrors`;
- `anchoredEvidenceRefs`;
- `anchoredBadSampleRefs`;
- `unsupportedClaims` reales;
- `script.syntaxValid: null` mientras Python no haya sido ejecutado.

CSV y reporte deben distinguir `null/no medido` de `false/falló`.

**Step 2: Implement**

Cambiar `syntaxValid` a `boolean | null`. El diagnóstico formal y la preparación del representante deben dejarlo en `null`. Importar solamente un CSV resultante no puede cambiarlo a `true`. La prueba real de Python se implementará en P1-03 mediante recibo externo.

**Step 3: Verify**

Command:
`cd src && npm test -- --run __tests__/experimentTypes.test.ts __tests__/experimentArtifactExporter.test.ts __tests__/experimentReport.test.ts __tests__/formalRepresentativePreparation.test.ts`

Expected: PASS.

### Task 4: Cierre y ausencia de métricas artificiales

**Files:**
- Modify: `docs/product/aura/NEXT_STEPS.md`
- Modify: `docs/plans/2026-07-11-issues-26-27-ruta-v2-unica.md`

**Step 1: Run absence checks**

Commands:

```bash
rg -n "contractCompliant: true|contractErrors: \[\]|unsupportedClaims: \[\]|badSampleRefs: issueById.*evidenceRefs" src/services/benchmark/formalDiagnosisEvaluator.ts
rg -n "syntaxValid: true" src/services/benchmark/formalRepresentativePreparation.ts
```

Expected: zero matches.

**Step 2: Full validation**

Commands:

```bash
cd src
npm test -- --run
npm run typecheck
npm run build
npx playwright test tests/e2e/oe4-final-evaluation.spec.ts
cd ..
graphify update .
git diff --check
```

**Step 3: Document**

Marcar P1-02 `EN REVISIÓN`, mantener bloqueadas las corridas reales y dejar P1-03 como siguiente tarea: recibo verificable de compilación y ejecución Python.

No instalar modelos, no ejecutar smokes y no iniciar las 45 corridas.
