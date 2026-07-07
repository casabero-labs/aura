# Fragmentos de código para el documento

Cada fragmento se explica en español académico. Los hashes y detalles internos se omiten del texto.

---

## 1. Lectura local del CSV

**Archivo:** `src/services/csvService.ts`  
**Líneas:** función `parseCsv`  
**Explicación:** AURA lee el archivo CSV directamente en el navegador usando la librería PapaParse. Los datos nunca se envían a un servidor. El resultado incluye las filas, los nombres de columna y el delimitador detectado.

```typescript
const { data, meta } = await parseCsv(uploadedFile);
// data: filas del CSV como objetos
// meta.fields: nombres de columna
// meta.delimiter: separador detectado
```

**Qué demuestra:** Procesamiento local sin dependencia de backend.  
**Qué no demuestra:** No demuestra rendimiento con archivos de millones de filas.

---

## 2. Regla determinista representativa

**Archivo:** `src/services/auditEngine.ts`  
**Líneas:** regla de trimming (espacios fantasma)  
**Explicación:** El motor contiene reglas predefinidas que se ejecutan sin intervención externa. Cada regla inspecciona los datos y emite un hallazgo con severidad, columna afectada y porcentaje. Esta regla detecta espacios invisibles al inicio o final de textos.

```typescript
if (typeof value === 'string' && value !== value.trim()) {
  issues.push({
    ruleName: 'Espacios Fantasma (Trim)',
    severity: 'info',
    column: field,
    count: 1,
    affectedPercentage: ...,
  });
}
```

**Qué demuestra:** Reglas deterministas y reproducibles.  
**Qué no demuestra:** No demuestra que la regla cubra todos los casos de trimming necesarios.

---

## 3. Construcción del paquete de evidencia

**Archivo:** `src/services/executionEvidence.ts`  
**Líneas:** funciones `fingerprintDataset` y `buildAuditEvidence`  
**Explicación:** Antes de enviar información al diagnóstico asistido, AURA calcula un fingerprint del dataset y construye un paquete de evidencia que incluye tiempo de inicio, tiempo de finalización, fingerprint, columnas procesadas y traza de ejecución.

```typescript
const datasetFingerprint = fingerprintDataset(data, meta.fields);
const evidence = buildAuditEvidence({
  fileName, datasetFingerprint,
  startedAt, completedAt,
  parseDurationMs, auditDurationMs,
  rowsProcessed, columnsProcessed,
  report: auditResult,
  trace: trace.events,
});
```

**Qué demuestra:** Trazabilidad completa del procesamiento.  
**Qué no demuestra:** No demuestra resistencia a manipulación del paquete de evidencia.

---

## 4. Validación de referencias

**Archivo:** `src/contracts/llm/scriptBuilderV2.ts`  
**Líneas:** función `buildScriptCandidateV2`, validación de fingerprint  
**Explicación:** El constructor de script verifica que el fingerprint del plan de remediación coincida con el del contexto de ejecución y con el del contexto de remediación. Si algún fingerprint no coincide, la construcción se rechaza.

```typescript
if (plan.datasetFingerprint !== buildContext.sourceDatasetFingerprint) {
  builderError('SCRIPT_BUILD_REMEDIATION_MISMATCH', ...);
}
```

**Qué demuestra:** Consistencia entre plan, contexto y datos.  
**Qué no demuestra:** No demuestra que los fingerprints sean infalsificables.

---

## 5. Generación de script desde acciones aprobadas

**Archivo:** `src/contracts/llm/scriptRendererV2.ts`  
**Líneas:** función `renderActionV2`  
**Explicación:** Por cada acción aprobada en el plan de remediación, el renderer genera una o más líneas de código Python/Pandas. Las acciones rechazadas o pendientes no generan código. El resultado es un script que solo contiene transformaciones autorizadas.

```typescript
function renderActionV2(action, columnRef, columnRegistry): string {
  switch (action.actionType) {
    case 'trim_whitespace':
      return `df_clean[${writeTarget}] = df_clean[${writeTarget}].astype(str).str.strip()`;
    // ... otros actionType
  }
}
```

**Qué demuestra:** Código determinista derivado de decisiones humanas.  
**Qué no demuestra:** No demuestra que el código generado sea óptimo o cubra todos los casos.

---

## 6. Revisión humana y bloqueo

**Archivo:** `src/components/ReviewStep.tsx`  
**Líneas:** función `handleApproveV2`  
**Explicación:** Antes de aprobar el contrato, el sistema ejecuta una verificación fresca del script. Si la verificación falla (por ejemplo, porque el hash fue manipulado), la aprobación se bloquea y se muestra el error al usuario.

```typescript
const freshVerification = verifyScriptContractV2(
  scriptContractV2, remediationPlanV2, contextResult.buildContext
);
if (!freshVerification.valid) {
  setV2VerifyError(`Verificación fallida: ${freshVerification.errors...}`);
  setStage('pending');
  return; // bloquea la aprobación
}
```

**Qué demuestra:** Verificación fresca antes de aprobar; fail-closed ante manipulación.  
**Qué no demuestra:** No demuestra que todas las formas de manipulación sean detectadas.
