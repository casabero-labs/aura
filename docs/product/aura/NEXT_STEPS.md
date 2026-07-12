# Próximo paso de AURA

La hoja de ruta vigente es:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)
- Corrección comprobable de los issues 26 y 27:
  [`docs/plans/2026-07-11-issues-26-27-ruta-v2-unica.md`](../../plans/2026-07-11-issues-26-27-ruta-v2-unica.md)

## Estado actual

AURA ya tiene una única ruta V2 para el diagnóstico normal y la evaluación
OE4. Los tres métodos producen un snapshot canónico distinto y conservan un
recibo verificable con método, secciones, prompt, hashes, modelo, digest y
parámetros observados.

En la interfaz, `Laboratorio` es el módulo completo, cada ejecución preparada es
un `experimento` y cada combinación modelo × método × repetición es una
`corrida`. `Campaña` queda reservado a contratos y artefactos internos.

El protocolo ejecutable es `aura.oe4.final-evaluation.v2`:

- 3 modelos × 3 métodos × 5 repeticiones = 45 diagnósticos evaluados;
- 15 calentamientos reales, uno por bloque de modelo, excluidos de las métricas;
- 60 llamadas reales en total;
- ninguna llamada LLM para generar scripts;
- 9 scripts deterministas, uno por representante seleccionado mediante la
  mediana del F1, siempre después de revisión y aprobación humana.

El `Laboratorio de evaluación LLM` ya puede crear un experimento formal desde
`controlled_customers_phase8.csv`. Antes de crearla verifica el hash del CSV,
la versión de Ollama, los tres modelos y sus digests. Cada salida pasa por el
validador completo `aura.diagnosis.v2` y por el oráculo diagnóstico. Las claves
API no se guardan en localStorage ni se sincronizan al backend.

El SHA-256 del dataset se calcula sobre los bytes reales del archivo; no se
confunde con el fingerprint operativo corto de la interfaz. Los calentamientos
guardan su propio recibo en IndexedDB para no repetirse al recargar la página.

## Estado post AURA-CIERRE-P0-01R3 (12 julio 2026)

Gates técnicos de cierre P0 en revisión:
- Suite 1711 tests, typecheck, build, E2E → verde.
- `DiagnosisFailureEvidenceV2` separa fallo de éxito; sin `as any`.
- `buildExecutionReceiptV1` rechaza en construcción: valid sin modelo, valid con códigos, invalid sin códigos.
- `runStructuredDiagnosis` valida `requestedModel` ANTES de llamar al proveedor.
- Todas las rutas Ollama capturan `data.model`/`event.model`.
- Exportación estricta: `valid`, `invalid`, `not_run` con validación de correspondencia.
- Detección case-insensitive de `apiKey`, `api_key`, `api-key` recursiva.
- Estado exclusivo éxito/fallo: limpiar mutuamente al iniciar nueva ejecución.
- SHA-256 del dataset solo desde `auditEvidence.datasetSha256`.
- Warm-ups como `Map<blockKey, WarmupReceiptV1>`; 15 instancias para 45 corridas.

**P0-01R3 NO está marcado como completo.** Pendiente de aprobación del orquestador.

## Pendientes no cubiertos por P0

**La campaña real sigue BLOQUEADA** hasta instalar los 3 modelos y ejecutar smokes.

Además, el producto tiene las siguientes limitaciones conocidas:

| Área | Pendiente |
|---|---|
| Diagnóstico LLM | `unsupportedClaims` real (no inventado), `badSampleRefs` real con anclaje |
| Script | Validación Python con trazabilidad de procedencia |
| Reporte diagnóstico | Claridad de secciones, visualizaciones, PDF profesional |
| Trazabilidad técnica | Mostrar recibo completo en UI, no solo resumen |
| Laboratorio | Nombres consistentes (Laboratorio/experimento/corrida/campaña) |
| UX general | Mensaje de nueva sesión; explicación de qué contiene cada exportación |
| Exportación | Documentar contrato de exportación técnica para terceros

## Lo que falta

1. Instalar/verificar los tres modelos formales en Ollama.
2. Ejecutar primero los smokes reales: 1×3×1 y 3×1×1.
3. Si ambos pasan, ejecutar manualmente la campaña completa de 45 diagnósticos.
4. Evaluar la rúbrica humana, aprobar o rechazar los nueve representantes,
   ejecutar los scripts aprobados sobre copias y reauditar.
5. Exportar el expediente final y redactar el documento de depósito.

No se debe iniciar la campaña completa si falla la igualdad de hashes, cambia
el modelo observado, falta un calentamiento, una respuesta no supera el
contrato completo, o una corrida completed carece de warmupReceipt o
executionReceipt válido.
