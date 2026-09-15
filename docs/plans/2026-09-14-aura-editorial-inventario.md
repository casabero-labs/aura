# Aura · inventario para migración Editorial

**Estado: INVENTARIO ESTÁTICO · DISPOSICIÓN F9 15 de septiembre de 2026.**

**F9:** `:root` y oscuro son tokens Editorial 1.2. Se retiró `editorial-pilot`. Los 70 TSX conservados heredan esos tokens; no se retiró ninguno por desuso (los 15 sin camino de import siguen pendientes de prueba, no de excepción visual). `src/index.css` conserva selectores de layout históricos que ahora leen variables Editorial; no se afirma que cada regla de las 16.000 líneas haya sido reescrita.

**Destino obligatorio: Editorial exclusivo.** Cada componente conservado —productivo, condicional, legacy, auxiliar o fixture— se migra a Editorial. Cada componente confirmado como no utilizado se retira con su presentación obsoleta durante la ejecución. Ninguna clasificación autoriza conservar Ink/Warm, ni siquiera inactivos, en el código entregable. Los 15 archivos sin camino detectado necesitan comprobación, no una exención de migración.

[Plan principal](2026-09-14-aura-migracion-editorial-integral.md) · [Orden de ejecución](2026-09-14-aura-editorial-orden-ejecucion.md) · [Patrones del showcase](2026-09-14-editorial-showcase-brechas.md)

La columna «Fase candidata» (F0–F9) se ejecuta agrupada en esos tres loops; no reordena la vigencia de cada archivo.

## Método y alcance

Se enumeraron los **70 archivos TSX de `src/components`** y se siguieron imports relativos estáticos/dinámicos desde `src/index.tsx`, resolviendo archivos `.ts`, `.tsx` e índices. **55 tienen camino de importación; 15 no lo tienen en este recorrido.**

Esto no evalúa condiciones, flags, props, tree-shaking o rutas realmente visitables; tampoco prueba que un componente no enlazado pueda borrarse. La lectura de fuentes de los recorridos sustenta las familias; no se afirma revisión visual exhaustiva de los 70 archivos. F0 debe registrar ruta/estado de acceso y evidencia por componente o su disposición histórica.

`App.tsx` y `index.tsx` se inventarían aparte. `AvFixturePage` es un fixture condicionado al modo de desarrollo; el harness OE4 también se importa condicionalmente desde App y está fuera de components. Los componentes V1/legacy requieren verificación de vigencia para decidir migración o retirada. Todo lo conservado usa Editorial. No introducir pantallas retiradas en la navegación.

## Matriz de componentes

| Archivo existente | Alcanzabilidad | Familia | Fase candidata | Patrones requeridos |
|---|---|---|---|---|
| [`src/components/ApplyVerifyStep.tsx`](../../src/components/ApplyVerifyStep.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/AuditLogViewer.tsx`](../../src/components/AuditLogViewer.tsx) | Importado; confirmar contexto | Técnico compartido | F3/F5/F6 | EC-08 |
| [`src/components/AuraMark.tsx`](../../src/components/AuraMark.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/AvFixturePage.tsx`](../../src/components/AvFixturePage.tsx) | Fixture DEV condicionado | Shell, utilidades o auxiliar | F0 / soporte QA | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/BoxPlot.tsx`](../../src/components/BoxPlot.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/ChangelogModal.tsx`](../../src/components/ChangelogModal.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/ChromeAiStatusPanel.tsx`](../../src/components/ChromeAiStatusPanel.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/ColumnStatsPanel.tsx`](../../src/components/ColumnStatsPanel.tsx) | Importado; confirmar contexto | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/CopyableHash.tsx`](../../src/components/CopyableHash.tsx) | Importado; confirmar contexto | Técnico compartido | F3/F5/F6 | EC-08 |
| [`src/components/DatasetProfile.tsx`](../../src/components/DatasetProfile.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/DestructiveSessionDialog.tsx`](../../src/components/DestructiveSessionDialog.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/DeterministicEngineSummary.tsx`](../../src/components/DeterministicEngineSummary.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/DeterministicValidationPanel.tsx`](../../src/components/DeterministicValidationPanel.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/DevelopmentLoopsPanel.tsx`](../../src/components/DevelopmentLoopsPanel.tsx) | Sin camino detectado; F0 | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/DiagnosisContractGuide.tsx`](../../src/components/DiagnosisContractGuide.tsx) | Sin camino detectado; F0 | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/DiagnosisStep.tsx`](../../src/components/DiagnosisStep.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/DiagnosticReportGateStep.tsx`](../../src/components/DiagnosticReportGateStep.tsx) | Sin camino detectado; F0 | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/DiagnosticReportStep.tsx`](../../src/components/DiagnosticReportStep.tsx) | Importado; confirmar contexto | Informe | F5 | EC-06, EC-10 |
| [`src/components/ErrorBoundary.tsx`](../../src/components/ErrorBoundary.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/ExecutionLogsPanel.tsx`](../../src/components/ExecutionLogsPanel.tsx) | Importado; confirmar contexto | Técnico compartido | F3/F5/F6 | EC-08 |
| [`src/components/FileUpload.tsx`](../../src/components/FileUpload.tsx) | Importado; confirmar contexto | Carga y orquestación | F4 | EC-02, EC-03, EC-05 |
| [`src/components/FindingsTable.tsx`](../../src/components/FindingsTable.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/GeminiAdvisor.tsx`](../../src/components/GeminiAdvisor.tsx) | Importado; confirmar contexto; revisar ruta legacy | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/HealthDeltaDashboard.tsx`](../../src/components/HealthDeltaDashboard.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/HelpCenter.tsx`](../../src/components/HelpCenter.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/ImprovementRunExportCard.tsx`](../../src/components/ImprovementRunExportCard.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/ImprovementRunPage.tsx`](../../src/components/ImprovementRunPage.tsx) | Sin camino detectado; F0 | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/ImprovementRunPanel.tsx`](../../src/components/ImprovementRunPanel.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/IngestionEvidenceCard.tsx`](../../src/components/IngestionEvidenceCard.tsx) | Importado; confirmar contexto | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/LegacyScriptGenerationStepV1.tsx`](../../src/components/LegacyScriptGenerationStepV1.tsx) | Importado; confirmar contexto; revisar ruta legacy | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/MainPipeline.tsx`](../../src/components/MainPipeline.tsx) | Importado; confirmar contexto | Carga y orquestación | F4 | EC-02, EC-03, EC-05 |
| [`src/components/OllamaSetupStandalone.tsx`](../../src/components/OllamaSetupStandalone.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/OllamaSetupWizard.tsx`](../../src/components/OllamaSetupWizard.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/PipelineDevelopmentMatrix.tsx`](../../src/components/PipelineDevelopmentMatrix.tsx) | Sin camino detectado; F0 | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/PipelineProgress.tsx`](../../src/components/PipelineProgress.tsx) | Importado; confirmar contexto | Carga y orquestación | F4 | EC-02, EC-03, EC-05 |
| [`src/components/ProfileEvidencePackage.tsx`](../../src/components/ProfileEvidencePackage.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/ProfileStageHeader.tsx`](../../src/components/ProfileStageHeader.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/ProfileStep.tsx`](../../src/components/ProfileStep.tsx) | Importado; confirmar contexto | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/ProgressDisclosure.tsx`](../../src/components/ProgressDisclosure.tsx) | Importado; confirmar contexto | Carga y orquestación | F4 | EC-02, EC-03, EC-05 |
| [`src/components/RemediationPlanStepV2.tsx`](../../src/components/RemediationPlanStepV2.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/ReviewStep.tsx`](../../src/components/ReviewStep.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/RuleActivationMatrix.tsx`](../../src/components/RuleActivationMatrix.tsx) | Sin camino detectado; F0 | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/ScriptGenerationStep.tsx`](../../src/components/ScriptGenerationStep.tsx) | Importado; confirmar contexto; revisar ruta legacy | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/ScriptGenerationStepV2.tsx`](../../src/components/ScriptGenerationStepV2.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/ScriptReview.tsx`](../../src/components/ScriptReview.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/SettingsPanel.tsx`](../../src/components/SettingsPanel.tsx) | Importado; confirmar contexto | Shell, utilidades o auxiliar | F0/F3 | EC-01, EC-04, EC-12, EC-14 |
| [`src/components/SeverityDistributionChart.tsx`](../../src/components/SeverityDistributionChart.tsx) | Importado; confirmar contexto | Perfil y evidencia | F4 | EC-06, EC-08, EC-10 |
| [`src/components/SyntaxDisplay.tsx`](../../src/components/SyntaxDisplay.tsx) | Importado; confirmar contexto | Técnico compartido | F3/F5/F6 | EC-08 |
| [`src/components/benchmark/BenchmarkCampaignLab.tsx`](../../src/components/benchmark/BenchmarkCampaignLab.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/BenchmarkGlossary.tsx`](../../src/components/benchmark/BenchmarkGlossary.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/CampaignConfigurationPanel.tsx`](../../src/components/benchmark/CampaignConfigurationPanel.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/CampaignMatrix.tsx`](../../src/components/benchmark/CampaignMatrix.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/CampaignReportPanel.tsx`](../../src/components/benchmark/CampaignReportPanel.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/CampaignResultsExplorer.tsx`](../../src/components/benchmark/CampaignResultsExplorer.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/CampaignSetupPanel.tsx`](../../src/components/benchmark/CampaignSetupPanel.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/ExecutionEvidencePanel.tsx`](../../src/components/benchmark/ExecutionEvidencePanel.tsx) | Sin camino detectado; F0 | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/ExperimentRunDetail.tsx`](../../src/components/benchmark/ExperimentRunDetail.tsx) | Importado; confirmar contexto | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/benchmark/HumanRubricPanel.tsx`](../../src/components/benchmark/HumanRubricPanel.tsx) | Sin camino detectado; F0 | Laboratorio | F7 | EC-06, EC-10, EC-13 |
| [`src/components/diagnosis/DiagnosisCognitiveContractCanvas.tsx`](../../src/components/diagnosis/DiagnosisCognitiveContractCanvas.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosis/DiagnosisContractPanel.tsx`](../../src/components/diagnosis/DiagnosisContractPanel.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosis/DiagnosisHeroPanel.tsx`](../../src/components/diagnosis/DiagnosisHeroPanel.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosis/DiagnosisProviderPanel.tsx`](../../src/components/diagnosis/DiagnosisProviderPanel.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosis/DiagnosisQuickConfigModal.tsx`](../../src/components/diagnosis/DiagnosisQuickConfigModal.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosis/TechnicalEvidencePanel.tsx`](../../src/components/diagnosis/TechnicalEvidencePanel.tsx) | Importado; confirmar contexto | Diagnóstico | F5 | EC-04, EC-05, EC-08 |
| [`src/components/diagnosticReport/DiagnosticFindingGroup.tsx`](../../src/components/diagnosticReport/DiagnosticFindingGroup.tsx) | Importado; confirmar contexto | Informe | F5 | EC-06, EC-10 |
| [`src/components/diagnosticReport/DiagnosticRecommendationsPanel.tsx`](../../src/components/diagnosticReport/DiagnosticRecommendationsPanel.tsx) | Importado; confirmar contexto | Informe | F5 | EC-06, EC-10 |
| [`src/components/diagnosticReport/DiagnosticReportChartPreview.tsx`](../../src/components/diagnosticReport/DiagnosticReportChartPreview.tsx) | Importado; confirmar contexto | Informe | F5 | EC-06, EC-10 |
| [`src/components/diagnosticReport/DiagnosticReportSummaryCards.tsx`](../../src/components/diagnosticReport/DiagnosticReportSummaryCards.tsx) | Importado; confirmar contexto | Informe | F5 | EC-06, EC-10 |
| [`src/components/remediation/OptionalRemediationNotice.tsx`](../../src/components/remediation/OptionalRemediationNotice.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |
| [`src/components/remediation/RemediationBranchActions.tsx`](../../src/components/remediation/RemediationBranchActions.tsx) | Importado; confirmar contexto | Remediación | F6 | EC-07, EC-08, EC-09 |

## Entradas y salidas fuera de components

| Archivo | Alcance | Fase |
|---|---|---|
| `src/index.tsx` | Entrada normal y `?view=ollama-setup` | F2/F3 |
| `src/App.tsx` | Shell, Home, ajustes/ayuda/lab, exportación, sesión y overlays | F3/F5/F9 |
| `src/index.html` | Fuentes, favicon, selector inicial | F2 |
| `src/index.css` | Cascada completa y piloto local | F2–F9 |
| `src/services/pdfGenerator.ts` | Informe determinista | F8 |
| `src/services/diagnosticReport/diagnosticPdfGenerator.ts` | Informe diagnóstico | F8 |
| `src/services/diagnosticReport/pdfLayout.ts` | Tipografía/colores/paginación | F8 |
| `src/services/diagnosticReport/pdfTables.ts` | Tablas PDF | F8 |
| `src/services/diagnosticReport/pdfCharts.ts` | Figuras PDF | F8 |
| `src/services/benchmark/experimentPdfReport.ts` | PDF de Laboratorio | F8 |
| `src/services/benchmark/experimentArtifactExporter.ts` | Ensamble/manifiesto de campaña; preservar contratos | F7/F8 QA |
| `src/tests/e2e/harness/Oe4CampaignE2eHarness.tsx` | Fixture condicionado de QA; no sustituye ruta productiva | F0/F7 QA |

## Dependencias funcionales protegidas

Estos archivos no se rediseñan por estética. Revisar/regresar si una modificación de consumidor los afecta:

- `src/services/pipelineSession.ts`: restauración y límites de persistencia.
- `src/services/remediationExecution/valuePreservation.mjs`: valores fuera del alcance aprobado.
- `src/services/remediationExecution/verifiedRemediationEvidence.ts`: evidencia de verificación.
- `src/services/remediationExecution/pythonExecutionContract.ts`: bundle/recibo y cadena de ejecución.
- `src/services/exportPackage.ts`, `src/services/evidenceArchive.ts`, `src/services/exportContractValidation.ts`: exportación.
- `src/services/benchmark/campaignPipelineConfiguration.ts`: transferencia de configuración.
- `src/services/benchmark/finalEvaluationProtocol.ts`: protocolo y semántica experimental.

## Contrato para cerrar el inventario

Añadir en F0 y mantener por fase: **vigencia**, **ruta/acción de entrada**, **escenarios**, **claro/oscuro Editorial**, **móvil/escritorio**, **teclado**, **ancla EC**, **evidencia**, **SHA** y **disposición final: migrado o retirado**. Toda retirada lleva motivo y consumidor/test contrastado. Ningún componente conservado se excluye de la migración visual.

No usar el cociente 55/70 como porcentaje de migración: los 70 incluyen piezas auxiliares y componentes de tamaño muy distinto. Medir cierre por recorridos, estados y dependencias, además de la disposición de cada archivo.
