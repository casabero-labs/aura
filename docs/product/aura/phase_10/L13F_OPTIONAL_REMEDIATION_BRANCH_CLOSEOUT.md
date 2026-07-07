# L13F — Optional Remediation Branch Polish (Closeout)

## Propósito

Pulir la rama opcional de remediación para que el usuario entienda claramente que generar script, revisarlo y reauditar son pasos **opcionales** posteriores al informe diagnóstico. El flujo principal cierra en `diagnostic_report -> export` sin necesidad de script, HITL ni reauditoría.

## Archivos creados

| Archivo | Propósito |
|---|---|
| `src/components/remediation/OptionalRemediationNotice.tsx` | Aviso reutilizable: explica que la remediación es opcional |
| `src/components/remediation/RemediationBranchActions.tsx` | Acciones reutilizables: volver al perfil definitivo, ir a exportación |
| `src/components/remediation/index.ts` | Barrel export para ambos componentes |
| `src/__tests__/optionalRemediationBranch.test.tsx` | Tests unitarios y de integración para los componentes de remediación |
| `docs/product/aura/phase_10/L13F_OPTIONAL_REMEDIATION_BRANCH_CLOSEOUT.md` | Este documento |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/MainPipeline.tsx` | Agrega `OptionalRemediationNotice` y `RemediationBranchActions` en estados `script` (v2 + legacy) y `review`. Agrega logs de remediación. |
| `src/components/DiagnosticReportStep.tsx` | Microcopy: "La remediación abre una rama opcional. Podés volver al reporte diagnóstico en cualquier momento." |
| `src/components/PipelineProgress.tsx` | Agrega clase CSS `stepper-step--optional` para script y review |
| `src/App.tsx` | Ajusta texto de exportación: "Script, notebook y Health Delta aparecen solo si fueron generados en la rama opcional de remediación." |
| `docs/product/aura/NEXT_STEPS.md` | Actualiza estado de L13F |

## Cómo queda el flujo principal

```
upload -> profile -> calibration -> diagnosis -> diagnostic_report -> export
```

- El informe diagnóstico PDF se genera sin necesidad de script, HITL ni provider LLM.
- `DiagnosticReportStep` ofrece "Generar script recomendado, opcional" como acción secundaria.
- `PipelineProgress` marca script y review como pasos opcionales con clase `stepper-step--optional`.

## Cómo queda la rama opcional

```
diagnostic_report -> script -> review -> export
```

- Al entrar a `script` o `review`, se muestra `OptionalRemediationNotice` con tono claro.
- Se muestra `RemediationBranchActions` con "Volver al perfil definitivo" e "Ir a exportación principal".
- HITL aplica solo para aprobar y simular un script de remediación.
- La aprobación HITL sigue siendo necesaria para exportar el script aprobado y el notebook Colab.
- El reporte principal se exporta sin necesidad de script ni HITL.

## Lo que se conserva intacto

- **Export contract**: sin cambios.
- **Contratos v2**: sin cambios, salvo imports/tipos necesarios de UI.
- **Scoring**: sin cambios.
- **runAudit**: sin cambios.
- **calibrationEvidence**: sin cambios.
- **Generador PDF profesional**: sin cambios, salvo texto mínimo si hace falta.
- **Dependencias**: ninguna nueva.
- **Camino principal**: `diagnostic_report -> export` intacto.
- **ScriptGenerationStepV2**: funciona igual.
- **ScriptGenerationStep legacy**: funciona igual.
- **ReviewStep**: funciona igual.
- **Aprobación HITL**: sigue siendo necesaria para exportar script aprobado y Colab.

## Cómo se mantiene HITL solo para remediación

- `DiagnosticReport.status.hitlRequiredForMainReport` es `false`.
- `DiagnosticReport.status.hitlRequiredForRemediation` es `true`.
- `OptionalRemediationNotice` explica que HITL aplica solo en la rama opcional.
- El botón "Script aprobado" y "Notebook Colab" siguen deshabilitados si no hay `approvedCleaningScript`.

## Cómo se mantiene PDF sin script

- `generateDiagnosticPdfReport` usa solo `DiagnosticReport`, no requiere script ni HITL.
- `handleDownloadPdf` en App prioriza `diagnosticReport` si existe, y cae a `generatePdfReport` legacy solo si no hay `diagnosticReport`.

## Logs agregados

- `remediation.branch.entered :: user opened optional script branch` — al entrar a `script` o `review`.
- `remediation.branch.returned :: user returned to diagnostic report` — al volver al perfil definitivo.
- `remediation.branch.export_main :: user exported without remediation` — al ir a exportación desde la rama opcional.

## Tests

| Test | Resultado esperado |
|---|---|
| `OptionalRemediationNotice` renderiza que la remediación es opcional | Texto contiene "opcional" y "recomendación" |
| Indica que el informe puede exportarse sin script | Texto contiene "sin necesidad de generar un script" |
| Indica que HITL aplica solo si se aprueba script | Texto contiene "HITL" y "única" |
| No sugiere que HITL sea obligatorio para el reporte principal | Texto contiene "ya puede exportarse sin necesidad de generar un script" |
| `RemediationBranchActions` llama `onBackToDiagnosticReport` | Callback invocado al hacer clic |
| `RemediationBranchActions` llama `onExportMain` | Callback invocado al hacer clic |
| Oculta botón volver cuando `showBack` es false | Botón ausente en DOM |
| Oculta botón exportar cuando `showExportMain` es false | Botón ausente en DOM |
| Renderiza ambos botones con texto claro | Texto contiene "Volver al perfil definitivo" e "Ir a exportación principal" |
| Navegación de ida y vuelta sin bloquear flujo | Ambos callbacks invocados, sin errores |

### Comandos exactos de tests

```bash
cd src && npx vitest run __tests__/diagnosticReportBuilder.test.ts
cd src && npx vitest run __tests__/diagnosticReportStep.test.tsx
cd src && npx vitest run __tests__/pipelineDiagnosticReportState.test.tsx
cd src && npx vitest run __tests__/diagnosticPdfGenerator.test.ts
cd src && npx vitest run __tests__/optionalRemediationBranch.test.tsx
```

## Validaciones

```bash
cd src && npm run typecheck
cd src && npm run build
```

## Riesgos abiertos

- La integración visual completa de `MainPipeline` con los nuevos componentes no está cubierta por tests unitarios (MainPipeline es costoso de montar en tests). La integración E2E queda para L13G Titanic E2E.
- El stepper visual con clase `stepper-step--optional` requiere estilo CSS correspondiente en la hoja de estilos (sin cambios en este loop).
- Los logs de remediación pueden acumularse si el usuario navega repetidamente entre estados (efecto ya gestionado por el límite de 18 entradas en `logs`).

## Siguiente loop recomendado

**L13G Titanic E2E**: validar el flujo humano completo con fixture Titanic y exportes principales, cubriendo la integración documentada en este loop.
