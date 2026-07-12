# Próximo paso de AURA

La hoja de ruta vigente es:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)
- Corrección comprobable de los issues 26 y 27:
  [`docs/plans/2026-07-11-issues-26-27-ruta-v2-unica.md`](../../plans/2026-07-11-issues-26-27-ruta-v2-unica.md)

## Estado actual

AURA ya tiene una única ruta V2 para el diagnóstico normal y el Laboratorio.
Los tres métodos producen un snapshot canónico distinto y conservan un
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

El `Laboratorio` ya puede crear un experimento formal desde
`controlled_customers_phase8.csv`. Antes de crearlo verifica el hash del CSV,
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

**P1-02 COMPLETO.** La campaña real continúa bloqueada.

## Estado AURA-CIERRE-P1-03 (12 julio 2026)

P1-03 cierra la procedencia de la ejecución Python:
- AURA descarga un bundle ligado al `runId`, contrato del script aprobado y CSV fuente.
- `npm run oe4:python:run` compila y ejecuta `clean_dataset(df)` con Python/pandas.
- El ejecutor produce el CSV y `aura.python-execution-receipt.v1` con versiones, tiempos y hashes.
- El Laboratorio exige CSV + recibo y recalcula script, entrada, salida y hash del propio recibo.
- `syntaxValid` solo cambia a `true` tras verificar una ejecución aprobada; importar únicamente un CSV ya no es posible.
- `campaign.json`, `runs.csv` y el reporte consolidan la evidencia Python.

**P1-03 COMPLETO.** La campaña real continúa bloqueada hasta cerrar UX y superar los smokes con modelos reales.

## Estado AURA-CIERRE-P1-04 (12 julio 2026)

P1-04 cierra la claridad UX, trazabilidad y exportaciones:
- Reporte diagnóstico: `DiagnosticInvocationSummary` muestra modelo, método, latencia, cumplimiento, claims, sintaxis, ejecución y reauditoría. `syntaxValid: null` → "No medido".
- Trazabilidad técnica: recibo, método solicitado y efectivo, secciones, modelo observado y hashes verificables.
- Configuración: resumen de privacidad (local/externo); indicador de disponibilidad.
- Terminología: "Laboratorio", "experimento", "corrida" unificados en interfaz visible.
- Nueva sesión: diálogo modal con descripción de eliminación, preservación y aviso de irreversibilidad.
- Exportaciones: descripciones de cada artefacto; nota de validez sobre recibos requeridos.
- Ollama: asistente React integrado con verificación de conexión, descarga real de los tres modelos recomendados, progreso y registro técnico visible. La antigua implementación HTML quedó reducida a una redirección segura de compatibilidad.
- Configuración: eliminados los enlaces sin destino a configuración avanzada y laboratorio experimental.
- Despliegue: el oráculo formal conserva una copia desplegable dentro de `src`, verificada byte a byte contra la fuente canónica de `experiments`, para que el build aislado de Coolify no pierda evidencia.

**P1-04 COMPLETO.** Suite 1738 tests, typecheck y build en verde; 6/6 E2E del cierre UX aprobados en Chromium.

## Pendientes no cubiertos por P1

**La campaña real sigue BLOQUEADA** hasta instalar los tres modelos y superar los smokes.

| Área | Pendiente |
|---|---|
| Script | Recibo verificable implementado; falta ejecutar los nueve representantes reales |
| Smokes | Instalar/verificar los tres modelos Ollama; ejecutar 1×3×1 y 3×1×1 |

## Gates obligatorios antes de la campaña completa

Antes de lanzar los 45 diagnósticos reales, cada uno de los siguientes gates debe pasar sin fallos:

- Hash del CSV de entrada no coincide con el esperado en el experimento.
- Versión de Ollama inferior a la requerida (>= 0.5.0).
- Modelos formales ausentes en la lista de Ollama (`hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL`, `hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL`, `hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL`).
- Digest local ausente o con formato inválido. AURA lo captura para congelar el entorno; el SHA-256 de referencia del archivo GGUF se conserva por separado y no se presenta como si fuera el digest de Ollama.
- Modelo observado en la respuesta del LLM no coincide con el modelo solicitado.
- Warmup ausente o incompleto para un bloque de modelo antes de las repeticiones.
- Un bloque de diagnosis se asocia a un warmup del bloque incorrecto.
- Contrato de diagnosis devuelve `validationStatus !== 'valid'`.
- Recibo de ejecución de diagnosis ausente o corrupto.
- Snapshot de entrada ausente o no corresponde al snapshot canónico del método.
- Smoke 1×3×1 falla en alguna de las 3 corridas.
- Smoke 3×1×1 falla en alguna de las 3 corridas.
- Errores de persistencia en IndexedDB durante la campaña (pérdida de runs tras recarga).
- Denominador de evaluaciones no coincide con el número de corridas ejecutadas.
- Sustitución silenciosa: un resultado de una corrida anterior se mezcla con otra sin registro de auditoría.

## Hoja de ruta desde este punto

1. Instalar/verificar los tres modelos formales en Ollama.
2. Ejecutar primero los smokes reales: 1×3×1 y 3×1×1.
3. Si ambos pasan, ejecutar manualmente la campaña completa de 45 diagnósticos.
4. Evaluar la rúbrica humana, aprobar o rechazar los nueve representantes,
   ejecutar los scripts aprobados sobre copias y reauditar.
5. Exportar el expediente final y redactar el documento de depósito.
