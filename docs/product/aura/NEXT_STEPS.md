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

## Estado aprobado AURA-CIERRE-P0-01R3 (12 julio 2026)

Los gates técnicos de trazabilidad P0 quedaron cerrados y aprobados por el orquestador:
- Suite 1725 tests, typecheck, build y E2E → verde.
- `DiagnosisFailureEvidenceV2` separa fallo de éxito; sin `as any`.
- `buildExecutionReceiptV1` rechaza en construcción: valid sin modelo, valid con códigos, invalid sin códigos.
- `runStructuredDiagnosis` valida `requestedModel` ANTES de llamar al proveedor.
- Todas las rutas Ollama capturan `data.model`/`event.model`.
- Exportación estricta: `valid`, `invalid`, `not_run`, recálculo de hashes y correspondencia entre snapshot, diagnóstico/fallo y recibo.
- Detección case-insensitive de `apiKey`, `api_key`, `api-key` recursiva.
- Estado exclusivo éxito/fallo: limpieza local y superior al iniciar una nueva ejecución; restauración desde sesión.
- SHA-256 del dataset solo desde `auditEvidence.datasetSha256`.
- Warm-ups como `Map<blockKey, WarmupReceiptV1>`; 15 instancias para 45 corridas.

Se añadieron las pruebas adversariales que faltaban: modelo solicitado ausente,
modelo observado nulo o diferente, fallo de transporte, hashes alterados,
estados de exportación, credenciales dentro de arrays, cinco rutas Ollama y
validación de 45 corridas con 15 warm-ups únicos.

**P0-01R3 está COMPLETO.** Esto cierra la trazabilidad técnica; no autoriza todavía la campaña real.

## Estado AURA-CIERRE-P1-02 (12 julio 2026)

P1-02 extrae métricas reales del diagnóstico:
- Suite completa, typecheck, build y E2E → verde.
- `formalDiagnosisEvidence.ts` revalida `DiagnosisResponseV2` contra el envelope y el recibo reales.
- `contractCompliant`, `contractErrors` y `unsupportedClaims` ya no son constantes.
- `badSampleRefs` solo de `userPayload.visibleEvidence.badSampleAnchors`.
- `syntaxValid: boolean | null` — null = Python no ejecutado. Importar CSV no lo cambia.
- El reporte cuenta la sintaxis solo sobre corridas evaluadas y exporta `not_measured` de forma explícita.
- Pruebas adversariales cubren recibo ausente, salida alterada, referencia de otro issue y números instructivos.
- Greps de ausencia: cero `contractCompliant: true`, cero `syntaxValid: true` en los archivos evaluados.

**P1-02 COMPLETO.** P1-03 (recibo Python) es la siguiente tarea. La campaña real continúa bloqueada.

## Pendientes no cubiertos por P0

**La campaña real sigue BLOQUEADA** hasta cerrar las métricas reales P1,
instalar los tres modelos y superar los smokes.

Además, el producto tiene las siguientes limitaciones conocidas:

| Área | Pendiente |
|---|---|
| Script | Validación Python con trazabilidad de procedencia |
| Reporte diagnóstico | Claridad de secciones, visualizaciones, PDF profesional |
| Trazabilidad técnica | Mostrar recibo completo en UI, no solo resumen |
| Laboratorio | Nombres consistentes (Laboratorio/experimento/corrida/campaña) |
| UX general | Mensaje de nueva sesión; explicación de qué contiene cada exportación |
| Exportación | Documentar contrato de exportación técnica para terceros

## Hoja de ruta desde este punto

1. Ejecutar P1-03: recibo verificable de compilación y ejecución Python.
2. Cerrar la claridad de Reporte diagnóstico, Trazabilidad técnica,
   Configuración, nombres del Laboratorio, nueva sesión y exportaciones.
3. Instalar/verificar los tres modelos formales en Ollama.
4. Ejecutar primero los smokes reales: 1×3×1 y 3×1×1.
5. Si ambos pasan, ejecutar manualmente la campaña completa de 45 diagnósticos.
6. Evaluar la rúbrica humana, aprobar o rechazar los nueve representantes,
   ejecutar los scripts aprobados sobre copias y reauditar.
7. Exportar el expediente final y redactar el documento de depósito.

No se debe iniciar la campaña completa si falla la igualdad de hashes, cambia
el modelo observado, falta un calentamiento, una respuesta no supera el
contrato completo, o una corrida completed carece de warmupReceipt o
executionReceipt válido.
