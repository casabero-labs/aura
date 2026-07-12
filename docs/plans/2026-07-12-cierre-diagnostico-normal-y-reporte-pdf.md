# Cierre del diagnóstico normal y reporte PDF Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Conseguir que una corrida normal de AURA produzca un diagnóstico LLM V2 completo, verificable y coherente con el motor determinista, y que exporte un PDF ejecutivo claro junto con JSON y CSV enlazados criptográficamente.

**Architecture:** Mantener el motor determinista como fuente del score y de los hallazgos; hacer del contrato V2 la única ruta de diagnóstico normal; construir un `DiagnosticReport` canónico que separe hechos confirmados, falsos positivos y lectura del LLM; generar desde ese objeto los tres artefactos con una identidad común. El LLM nunca cambia el score y una respuesta incompleta o no verificable se conserva como evidencia inválida, no como diagnóstico válido.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest, Testing Library, Playwright, Ollama, jsPDF 4.2, jspdf-autotable 5, D3 7.

## Estado de ejecución — 12 de julio de 2026

Se auditó el commit `85d5d400a175d1997207e5be2ce80293b7d087e7`. El cambio simplificó algunos títulos del reporte, pero también retiró información de evaluación, gobernanza y gráficos, dejó la remediación por delante de la exportación y rompió nueve pruebas focales. La integración conserva la lectura directa útil del commit y restaura las garantías necesarias.

Completado:

- Tasks 1–4: ruta V2 única, inferencia canónica, exportación veraz y motor determinista corregido;
- Task 5: rechazo de valores citados sin evidencia por hallazgo y de recomendaciones destructivas sin revisión humana;
- Tasks 6–7: `DiagnosticReport` canónico e identidad común en PDF, JSON y CSV;
- Tasks 8–9: escalas porcentuales reales, texto corregido y PDF editorial de cinco páginas;
- Task 10: recorrido real CSV → auditoría → exportación y validaciones UX ejecutados en Chromium. La llamada real a Ollama queda deliberadamente para la repetición manual acompañada, no para un proveedor simulado presentado como evidencia real;
- Task 11: suites, typecheck, build, revisión visual página por página y actualización del grafo forman el gate final de este cierre.

Gate ejecutado: 110 archivos de prueba, 1756 pruebas aprobadas y 6 omitidas;
typecheck sin errores; build de producción correcto; 8 recorridos E2E focales
aprobados en Chromium; PDF sintético renderizado e inspeccionado en sus cinco
páginas.

La campaña de 45 corridas continúa bloqueada. El siguiente paso autorizado después de publicar estos cambios es una sola corrida normal, guardada en `experiments/tests/flujo3/`, siguiendo Task 12.

---

## Evidencia consolidada: flujo1 y flujo2

| Comprobación | Qwen3 8B (`flujo1`) | Gemma 4 E4B (`flujo2`) | Conclusión |
| --- | --- | --- | --- |
| Dataset | `synthetic_ground_truth.csv`, SHA-256 `4e7d...ac49` | Igual | Comparación válida |
| Motor determinista | 16 hallazgos, score 0, macro F1 0.96 | Igual | Resultado estable |
| CSV | SHA-256 `364c...0875` | Mismo SHA-256 | Idéntico byte por byte |
| Modelo guardado | Modelo solicitado Qwen | Modelo solicitado Gemma | No prueba el modelo observado |
| Estado exportado | `not_run` | `not_run` | Contradice que existe texto LLM |
| Evidencia V2 | Todo `null` | Todo `null` | No hay método, hashes ni recibo |
| Texto LLM | 3.562 caracteres | 4.386 caracteres | Ambos terminan cortados |
| PDF | 9 páginas | 9 páginas | Mismos problemas de contenido y maquetación |

### Hallazgos confirmados en ambos flujos

1. La corrida normal entra por la ruta legacy porque `VITE_CONTRACTS_V2_ENABLED` no está activo en producción. El PDF incluso declara que el diagnóstico es legacy.
2. El exportador permite `diagnosis.status = not_run` aunque `diagnosisText` tenga contenido. Por eso el JSON parece formal, pero no certifica la llamada realizada.
3. No se conserva el método de entrada, prompt, input, respuesta cruda, hashes, tokens, latencia, modelo observado ni recibo de ejecución.
4. Ambos textos se cortan. La ruta legacy usa `DEFAULT_NUM_PREDICT = 1200`; la UI documenta 1600 para V2, creando además una posible diferencia entre la inferencia real y la declarada.
5. El hallazgo `semantic-burned-range-fecha_ingreso` figura en el ground truth como `expected_fp`, pero el PDF lo cuenta como riesgo confirmado y eleva los riesgos confirmados a 16.
6. `fecha_ingreso` e `ip_acceso` aparecen con tipo semántico `phone`. El detector de teléfono es demasiado amplio y se ejecuta antes del detector de IP.
7. La evidencia de fecha mixta no incluye el valor realmente diferente `01/15/2023`; enseña tres fechas ISO. Esto induce al modelo a explicar mal el formato.
8. Las barras de porcentaje se escalan contra el máximo de la muestra. Cuatro columnas con 6,67 % de nulos se dibujan casi al 100 %.
9. El PDF no identifica modelo, método o recibo y apenas incorpora el diagnóstico LLM en la narrativa.
10. El PDF corta texto al margen, divide filas y secciones entre páginas, repite información, usa etiquetas técnicas en inglés y carece de metadatos, fuentes embebidas y accesibilidad.
11. PDF, JSON y CSV no comparten `reportId`, `runId` ni hashes que permitan demostrar que pertenecen a la misma corrida.

### Hallazgos nuevos de Gemma

1. Gemma atribuye `N/A` a la columna `email`, pero la evidencia real es `NULL`.
2. Recomienda “aplicar decodificación UTF-8” como arreglo directo del mojibake, afirmación que no está demostrada y puede empeorar el texto.
3. Recomienda *capping* o eliminación de outliers sin decisión de dominio; debe expresarse como opción sujeta a revisión humana.
4. Su respuesta termina literalmente en `## Limites de la`, confirmando truncamiento y ausencia de validación de completitud.
5. El cambio de modelo no corrige el problema: la falla principal está en la ruta, el contrato, la evidencia y el generador del reporte.

## Condición de salida

No se autoriza otra corrida formal ni la campaña de 45 diagnósticos hasta que:

- una corrida normal produzca `status=valid` o `status=invalid`, nunca `not_run` con texto;
- el recibo pruebe modelo solicitado y observado, método, prompt, input, respuesta e inferencia;
- el motor deje de clasificar fechas e IP como teléfono y elimine el falso positivo R24;
- el PDF diferencie score 0/100 de F1 96 %, muestre la lectura LLM trazable y no corte contenido;
- PDF, JSON y CSV compartan una identidad verificable;
- las pruebas unitarias, typecheck, build y E2E pasen.

---

### Task 1: Hacer V2 la única ruta de diagnóstico normal

**Files:**
- Modify: `src/components/DiagnosisStep.tsx`
- Modify: `src/contracts/llm/diagnosisSelector.ts`
- Modify: `src/contracts/llm/diagnosisPipelineV2.ts`
- Modify: `src/contracts/llm/contractRegistry.ts`
- Modify: `src/contracts/llm/index.ts`
- Test: `src/__tests__/diagnosisPipelineV2.test.ts`
- Test: `src/__tests__/diagnosisV2Integration.test.ts`
- Test: `src/__tests__/llmContractBaseline.test.ts`

**Step 1: Write the failing tests**

Agregar pruebas que demuestren que, sin ninguna variable de entorno, `DiagnosisStep` llama `runStructuredDiagnosis()` y que `runDiagnosisPipeline()` no devuelve `CONTRACTS_V2_DISABLED`.

```ts
it('usa contrato V2 en una corrida normal sin feature flag', async () => {
  delete (import.meta as any).env.VITE_CONTRACTS_V2_ENABLED;
  // ejecutar la acción de diagnóstico
  expect(runStructuredDiagnosis).toHaveBeenCalledTimes(1);
  expect(legacyGenerateText).not.toHaveBeenCalled();
});
```

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/diagnosisPipelineV2.test.ts __tests__/diagnosisV2Integration.test.ts __tests__/llmContractBaseline.test.ts`

Expected: FAIL porque V2 está desactivado cuando falta la variable y la UI entra en la rama legacy.

**Step 3: Implement the unique route**

- Eliminar la rama legacy de diagnóstico de `DiagnosisStep.tsx`.
- Eliminar los guardas de feature flag en `diagnosisSelector.ts` y `diagnosisPipelineV2.ts`.
- Conservar tipos legacy solo para leer sesiones históricas; no permitir nuevas ejecuciones legacy.
- Cambiar los mensajes visibles de “Diagnosis v2” a “Diagnóstico” donde no sea necesario exponer la versión interna.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/diagnosisPipelineV2.test.ts __tests__/diagnosisV2Integration.test.ts __tests__/llmContractBaseline.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/DiagnosisStep.tsx src/contracts/llm src/__tests__/diagnosisPipelineV2.test.ts src/__tests__/diagnosisV2Integration.test.ts src/__tests__/llmContractBaseline.test.ts
git commit -m "fix: make structured diagnosis the only normal path"
```

### Task 2: Unificar la inferencia real y la declarada

**Files:**
- Modify: `src/services/providers/ollamaProvider.ts`
- Modify: `src/contracts/llm/diagnosisSelector.ts`
- Modify: `src/types.ts`
- Create: `src/services/ollamaInferenceConfig.ts`
- Test: `src/__tests__/ollamaProvider.test.ts`
- Test: `src/__tests__/diagnosisV2Integration.test.ts`

**Step 1: Write the failing tests**

Probar que los valores enviados a Ollama son exactamente los mismos que quedan en `executionReceipt.inference`, incluyendo `numCtx`, `numPredict`, `topP`, `temperature`, `seed`, `keepAlive` y timeout.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/ollamaProvider.test.ts __tests__/diagnosisV2Integration.test.ts`

Expected: FAIL porque el proveedor usa 1200 por defecto y el recibo puede declarar 1600.

**Step 3: Implement the canonical inference config**

- Crear una función que resuelva una sola configuración final.
- Inyectarla tanto al proveedor como al constructor del recibo.
- Usar un `numPredict` suficiente para el JSON V2; si se agota la generación, el parser estricto debe producir recibo `invalid` con respuesta cruda hasheada.
- No aceptar una respuesta parcial como texto válido.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/ollamaProvider.test.ts __tests__/diagnosisV2Integration.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/ollamaInferenceConfig.ts src/services/providers/ollamaProvider.ts src/contracts/llm/diagnosisSelector.ts src/types.ts src/__tests__
git commit -m "fix: align Ollama inference with execution receipts"
```

### Task 3: Cerrar la contradicción `not_run` con texto

**Files:**
- Create: `src/services/diagnosisExportState.ts`
- Modify: `src/App.tsx`
- Modify: `src/services/exportPackage.ts`
- Modify: `src/services/exportContractValidation.ts`
- Test: `src/__tests__/exportContractValidation.test.ts`
- Create: `src/__tests__/diagnosisExportState.test.ts`

**Step 1: Write the failing tests**

Cubrir estas reglas:

```ts
expect(validateDiagnosis({ status: 'not_run', diagnosisText: 'respuesta' }).valid).toBe(false);
expect(deriveDiagnosisExportState(success).status).toBe('valid');
expect(deriveDiagnosisExportState(failure).status).toBe('invalid');
```

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/exportContractValidation.test.ts __tests__/diagnosisExportState.test.ts`

Expected: FAIL porque el preflight actual no relaciona `diagnosisText` con el estado.

**Step 3: Implement the invariant**

- Derivar el bloque de diagnóstico desde un único resultado discriminado.
- `valid` exige diagnóstico estructurado y recibo válido.
- `invalid` exige evidencia de fallo y recibo inválido.
- `not_run` exige ausencia total de texto y evidencia técnica.
- Eliminar el estado paralelo donde `aiAnalysis` puede sobrevivir sin recibo.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/exportContractValidation.test.ts __tests__/diagnosisExportState.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/services/diagnosisExportState.ts src/services/exportPackage.ts src/services/exportContractValidation.ts src/__tests__
git commit -m "fix: enforce truthful diagnosis export state"
```

### Task 4: Corregir tipos semánticos y el falso positivo R24

**Files:**
- Modify: `src/services/auditEngine.ts`
- Modify: `src/services/deterministicValidation.ts`
- Modify: `experiments/datasets/synthetic_ground_truth.json`
- Test: `src/__tests__/auditEngine.test.ts`
- Test: `src/__tests__/deterministicValidation.test.ts`

**Step 1: Write the failing tests**

```ts
expect(result.columnStats.fecha_ingreso.semanticType).toBe('date');
expect(result.columnStats.ip_acceso.semanticType).toBe('ip');
expect(result.issues.find(i => i.id === 'semantic-burned-range-fecha_ingreso')).toBeUndefined();
expect(mixedDate.sampleValues).toContain('01/15/2023');
```

Mantener una prueba positiva con valores como `18-25`, `26 a 35` o `65+` para no perder la regla real de rangos demográficos.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/auditEngine.test.ts __tests__/deterministicValidation.test.ts`

Expected: FAIL por la prioridad del teléfono, el regex de rangos dentro de fechas y la muestra incorrecta.

**Step 3: Implement the fixes**

- Evaluar IP y fecha antes que teléfono.
- Restringir `REGEX_PHONE` para no aceptar fechas o IPv4.
- Excluir columnas con tipo `date` y valores ISO de la regla de rango demográfico.
- Construir la evidencia de fechas mixtas con al menos un ejemplo por formato detectado.
- Actualizar el ground truth para que R24 deje de ser un falso positivo documentado y el macro F1 esperado sea 1.0.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/auditEngine.test.ts __tests__/deterministicValidation.test.ts`

Expected: PASS con 12 reglas esperadas, cero FP y macro F1 1.0.

**Step 5: Commit**

```bash
git add src/services/auditEngine.ts src/services/deterministicValidation.ts experiments/datasets/synthetic_ground_truth.json src/__tests__/auditEngine.test.ts src/__tests__/deterministicValidation.test.ts
git commit -m "fix: correct semantic detection and date evidence"
```

### Task 5: Medir claims sin soporte en el diagnóstico normal

**Files:**
- Modify: `src/services/benchmark/formalDiagnosisEvidence.ts`
- Create: `src/services/diagnosisEvidenceReview.ts`
- Modify: `src/contracts/llm/diagnosisValidatorV2.ts`
- Test: `src/__tests__/formalDiagnosisEvidence.test.ts`
- Create: `src/__tests__/diagnosisEvidenceReview.test.ts`

**Step 1: Write the failing tests**

Usar como casos negativos las afirmaciones observadas en Gemma:

- `N/A` en `email` cuando la evidencia contiene `NULL`;
- decodificación UTF-8 como causa confirmada;
- *capping* o eliminación automática de outliers;
- tratar R24 como riesgo confirmado.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/formalDiagnosisEvidence.test.ts __tests__/diagnosisEvidenceReview.test.ts`

Expected: FAIL hasta que el diagnóstico normal reutilice el extractor formal y marque claims no soportados.

**Step 3: Implement fail-closed evidence review**

- Reutilizar el extractor determinista ya usado por Laboratorio.
- Mostrar claims sin soporte como limitación, no como hecho.
- Impedir que una recomendación destructiva se presente sin `requiresHumanReview=true`.
- No modificar score ni métricas deterministas.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/formalDiagnosisEvidence.test.ts __tests__/diagnosisEvidenceReview.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/benchmark/formalDiagnosisEvidence.ts src/services/diagnosisEvidenceReview.ts src/contracts/llm/diagnosisValidatorV2.ts src/__tests__
git commit -m "fix: flag unsupported claims in normal diagnosis"
```

### Task 6: Convertir `DiagnosticReport` en la fuente canónica

**Files:**
- Modify: `src/services/diagnosticReport/types.ts`
- Modify: `src/services/diagnosticReport/diagnosticReportBuilder.ts`
- Modify: `src/components/MainPipeline.tsx`
- Test: `src/__tests__/diagnosticReportBuilder.test.ts`
- Test: `src/__tests__/pipelineDiagnosticReportState.test.tsx`

**Step 1: Write the failing tests**

Probar que:

- un `expected_fp` nunca entra en `confirmedRisks`;
- el reporte conserva método, modelo solicitado/observado, hashes, latencia, tokens y estado de validación;
- cada observación LLM mantiene `issueId` y `evidenceRefs`;
- score determinista y F1 se muestran como métricas distintas.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/diagnosticReportBuilder.test.ts __tests__/pipelineDiagnosticReportState.test.tsx`

Expected: FAIL porque `buildFindingGroups()` ignora `deterministicValidation` y el modelo del reporte no conserva toda la trazabilidad.

**Step 3: Extend the report model**

- Pasar `deterministicValidation` a `buildFindingGroups()`.
- Separar `confirmedRisks`, `documentedFalsePositives`, `contextualCandidates` y `humanReviewRequired`.
- Añadir `diagnosisTrace` con recibo y métricas verificadas.
- Incluir una sección de lectura LLM basada en `diagnosisBlocks`, no en el primer fragmento del texto legacy.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/diagnosticReportBuilder.test.ts __tests__/pipelineDiagnosticReportState.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/diagnosticReport src/components/MainPipeline.tsx src/__tests__/diagnosticReportBuilder.test.ts src/__tests__/pipelineDiagnosticReportState.test.tsx
git commit -m "feat: build diagnostic report from verified evidence"
```

### Task 7: Enlazar PDF, JSON y CSV con una identidad común

**Files:**
- Create: `src/services/exportArtifactIdentity.ts`
- Modify: `src/services/exportPackage.ts`
- Modify: `src/services/exportContractValidation.ts`
- Modify: `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- Modify: `src/utils/download.ts`
- Modify: `src/App.tsx`
- Test: `src/__tests__/exportContractValidation.test.ts`
- Create: `src/__tests__/exportArtifactIdentity.test.ts`

**Step 1: Write the failing tests**

Probar que los tres artefactos exponen el mismo `runId`, `reportId`, `datasetSha256`, `diagnosisReceiptHash` y hash del contenido canónico.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/exportContractValidation.test.ts __tests__/exportArtifactIdentity.test.ts`

Expected: FAIL porque hoy solo el PDF contiene `reportId` y el CSV no tiene identidad de corrida.

**Step 3: Implement artifact identity**

- Crear identidad antes de descargar cualquier artefacto.
- Añadirla al JSON.
- Repetirla en todas las filas del CSV o en un encabezado técnico estable.
- Insertarla en metadatos y anexo del PDF.
- Incluir `DiagnosticReport` en el JSON para poder regenerar el PDF.
- Validar hashes antes de descargar.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/exportContractValidation.test.ts __tests__/exportArtifactIdentity.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/exportArtifactIdentity.ts src/services/exportPackage.ts src/services/exportContractValidation.ts src/services/diagnosticReport/diagnosticPdfGenerator.ts src/utils/download.ts src/App.tsx src/__tests__
git commit -m "feat: link exported artifacts with verified identity"
```

### Task 8: Rediseñar gráficos con escala correcta y estilo Casabero

**Files:**
- Modify: `src/services/diagnosticReport/pdfCharts.ts`
- Modify: `src/services/diagnosticReport/diagnosticReportBuilder.ts`
- Modify: `src/services/diagnosticReport/types.ts`
- Modify: `src/services/diagnosticReport/presentation.ts`
- Test: `src/__tests__/diagnosticPdfGenerator.test.ts`
- Test: `src/__tests__/diagnosticReportBuilder.test.ts`

**Step 1: Write the failing tests**

Probar que un gráfico con sufijo `%` usa dominio `[0,100]`, que `6.67` ocupa aproximadamente 6,67 % del ancho y que las etiquetas de severidad salen en español.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/diagnosticPdfGenerator.test.ts __tests__/diagnosticReportBuilder.test.ts`

Expected: FAIL porque la escala actual usa `[0,maxValue]`.

**Step 3: Implement the visual system**

- Usar la paleta editorial Casabero: fondo `#FAF8F4`, superficie `#F5F1E8`, tinta `#1E1E1C` y acentos sobrios.
- Eliminar la paleta arcoíris; reservar color fuerte para severidad y estado.
- Mostrar: distribución de severidad, mapa de calidad por columna, afectación real 0–100 %, outliers con límites IQR y diferencia entre score y F1.
- Usar títulos y leyendas en español y explicar qué significa cada gráfico.
- No llamar `pie` a una barra apilada; implementar el tipo correcto o renombrarlo.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/diagnosticPdfGenerator.test.ts __tests__/diagnosticReportBuilder.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/diagnosticReport src/__tests__/diagnosticPdfGenerator.test.ts src/__tests__/diagnosticReportBuilder.test.ts
git commit -m "feat: redesign diagnostic charts with truthful scales"
```

### Task 9: Reorganizar el PDF en cinco páginas defendibles

**Files:**
- Modify: `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- Modify: `src/services/diagnosticReport/pdfLayout.ts`
- Modify: `src/services/diagnosticReport/pdfTables.ts`
- Modify: `src/services/diagnosticReport/presentation.ts`
- Add: `src/assets/fonts/` with licensed embedded font files
- Test: `src/__tests__/diagnosticPdfGenerator.test.ts`

**Step 1: Write the failing tests**

Agregar aserciones de estructura:

- página 1: decisión y métricas;
- página 2: panorama visual;
- página 3: hallazgos y evidencia;
- página 4: diagnóstico LLM y trazabilidad;
- página 5: plan de acción y certificado;
- ninguna fila se divide entre páginas;
- títulos nunca quedan solos al final o principio de página;
- no aparecen textos con `...` por truncamiento silencioso.

**Step 2: Run tests to verify they fail**

Run: `cd src && npm test -- --run __tests__/diagnosticPdfGenerator.test.ts`

Expected: FAIL con el PDF actual de 9 páginas, filas partidas y contenido truncado.

**Step 3: Implement the five-page report**

- Aplicar `rowPageBreak: 'avoid'` y reservar espacio por sección.
- Mover inventario técnico detallado al JSON; el PDF solo conserva certificado y trazabilidad necesaria.
- Renderizar el diagnóstico estructurado en bloques breves ligados a la evidencia.
- Corregir todos los acentos y términos en español.
- Embebir Inter para cuerpo, Playfair Display para títulos y JetBrains Mono para hashes/código, respetando licencias.
- Añadir título, autor, asunto y palabras clave en metadatos PDF.
- Si jsPDF no soporta etiquetado accesible completo, documentar esa limitación sin afirmar cumplimiento PDF/UA.

**Step 4: Run tests to verify they pass**

Run: `cd src && npm test -- --run __tests__/diagnosticPdfGenerator.test.ts`

Expected: PASS.

**Step 5: Render and inspect every page**

Run:

```bash
pdftoppm -png -r 144 <pdf-generado> tmp/pdfs/final-review/page
pdftotext -layout <pdf-generado> tmp/pdfs/final-review/report.txt
```

Expected: cinco páginas legibles, sin cortes, sin solapamientos y con jerarquía editorial Casabero.

**Step 6: Commit**

```bash
git add src/services/diagnosticReport src/assets/fonts src/__tests__/diagnosticPdfGenerator.test.ts
git commit -m "feat: deliver concise evidence-backed diagnostic PDF"
```

### Task 10: Añadir una prueba E2E del flujo humano de exportación

**Files:**
- Create: `src/tests/e2e/diagnostic-export-v2.spec.ts`
- Modify: `src/playwright.config.ts`
- Modify: `src/__tests__/pipelineDiagnosticReportState.test.tsx`

**Step 1: Write the failing E2E**

Recorrido: cargar `synthetic_ground_truth.csv` → seleccionar Ollama → ejecutar diagnóstico → abrir reporte → descargar JSON, CSV y PDF → verificar identidad y estado.

La prueba puede usar un proveedor determinista de contrato V2, pero debe recorrer la misma UI de producción y no activar una ruta alternativa legacy.

**Step 2: Run E2E to verify it fails**

Run: `cd src && npx playwright test tests/e2e/diagnostic-export-v2.spec.ts`

Expected: FAIL hasta completar tareas 1–9.

**Step 3: Implement only the required test harness**

- Interceptar solo la respuesta del proveedor.
- No reemplazar `runAudit`, `buildDiagnosticReport` ni el exportador.
- Comprobar `status=valid`, modelo observado, método y hashes.
- Comprobar que el PDF contiene las cinco secciones esperadas.

**Step 4: Run E2E to verify it passes**

Run: `cd src && npx playwright test tests/e2e/diagnostic-export-v2.spec.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/tests/e2e/diagnostic-export-v2.spec.ts src/playwright.config.ts src/__tests__/pipelineDiagnosticReportState.test.tsx
git commit -m "test: cover verified diagnostic export journey"
```

### Task 11: Ejecutar gates completos y actualizar la hoja de ruta

**Files:**
- Modify: `docs/product/aura/NEXT_STEPS.md`
- Modify: `docs/plans/2026-07-11-issues-26-27-ruta-v2-unica.md`
- Modify: this plan

**Step 1: Run focused suites**

```bash
cd src
npm test -- --run \
  __tests__/auditEngine.test.ts \
  __tests__/deterministicValidation.test.ts \
  __tests__/diagnosisPipelineV2.test.ts \
  __tests__/diagnosisV2Integration.test.ts \
  __tests__/exportContractValidation.test.ts \
  __tests__/diagnosticReportBuilder.test.ts \
  __tests__/diagnosticPdfGenerator.test.ts \
  __tests__/pipelineDiagnosticReportState.test.tsx
```

Expected: PASS.

**Step 2: Run repository gates**

```bash
cd src
npm test -- --run
npm run typecheck
npm run build
npx playwright test tests/e2e/diagnostic-export-v2.spec.ts
```

Expected: todos en verde.

**Step 3: Run absence and invariant checks**

```bash
rg "Diagnostico legacy|diagnóstico legacy" src --glob '!**/__tests__/**'
rg "status: 'not_run'.*diagnosisText" src
rg "VITE_CONTRACTS_V2_ENABLED" src --glob '!**/__tests__/**'
```

Expected: cero rutas productivas legacy y cero estados contradictorios.

**Step 4: Update documentation**

Marcar cada tarea completada con evidencia real. Mantener la campaña formal bloqueada hasta la corrida manual de Task 12.

**Step 5: Refresh graph**

Run: `graphify update .`

Expected: grafo actualizado sin error.

**Step 6: Commit**

```bash
git add docs graphify-out
git commit -m "docs: record verified diagnostic closeout"
```

### Task 12: Realizar la primera repetición formal manual

**Owner:** Usuario, acompañado por el orquestador.

**Precondition:** Tasks 1–11 completas, desplegadas y verificadas en `aura.casabero.com`.

**Step 1: Prepare**

- Reiniciar análisis.
- Cargar `experiments/datasets/synthetic_ground_truth.csv`.
- Confirmar SHA-256 `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`.
- Elegir primero Qwen3 8B y el método `recommended`.

**Step 2: Execute one diagnosis**

- Ejecutar el diagnóstico una sola vez.
- No editar el texto ni regenerar hasta exportar.
- Confirmar en trazabilidad: modelo solicitado = observado, método, prompt hash, input hash, receipt hash, tokens y latencia.

**Step 3: Export all artifacts**

- Descargar PDF, JSON y CSV en `experiments/tests/flujo3/`.
- Verificar que los tres muestran el mismo `runId`, `reportId`, SHA del dataset y receipt hash.

**Step 4: Review with the orchestrator**

- Revisar las cinco páginas del PDF.
- Validar que el JSON dice `status=valid`.
- Confirmar cero claims sin soporte y cero falso positivo R24.
- Confirmar que el CSV contiene las referencias de identidad.

**Step 5: Repeat with Gemma only after approval**

Repetir el mismo procedimiento con Gemma. No iniciar la campaña de 45 diagnósticos hasta que ambas corridas normales queden aprobadas.

---

## Orden definitivo

1. P0: Tasks 1–4 — verdad de ejecución y motor determinista.
2. P1: Tasks 5–7 — evidencia, reporte canónico e identidad de exportación.
3. P2: Tasks 8–9 — gráficos y PDF final.
4. P3: Tasks 10–11 — recorrido humano, gates y documentación.
5. Validación manual: Task 12 — una corrida Qwen, revisión, luego una corrida Gemma.

La campaña formal permanece **bloqueada** hasta cerrar este plan y aprobar ambas corridas de repetición.
