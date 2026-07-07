# Phase 8 L5 — Benchmark Evidence Classification

## Objetivo

Definir una clasificación formal de evidencia benchmark para AURA, de modo que toda corrida de modelos quede etiquetada correctamente como `planned`, `attempted_failed`, `preliminary_valid` o `formal_valid`, protegiendo los claims académicos/técnicos contra la venta de fallos o pruebas incompletas como benchmark formal.

## Problema que resuelve

1. **Inflación de claims**: sin clasificación, una corrida aislada puede ser presentada como "benchmark completo".
2. **Falsos positivos académicos**: un `attempted_failed` puede ser reportado como evidencia si no está marcado explícitamente.
3. **Ausencia de protocolo**: sin criterios documentados, no hay forma de saber si un resultado es repeatable o generalizable.
4. **Proveedores variables**: Chrome AI puede fallar en un entorno y funcionar en otro. Sin clasificación, no se distingue fallo ambiental de fallo del modelo.

## Estados de Clasificación

### 1. `planned`

La corrida está definida pero no ejecutada.

**Criterios de entrada:**
- Fila creada en el benchmark evidence register.
- Dataset identificado.
- Provider y modelo identificados.

**Criterios de salida:**
- Se ejecutó y produjo clasificación superior.

**Claims permitidos:**
- Ninguno. Una corrida planeada no ha producido evidencia.

### 2. `attempted_failed`

La corrida se intentó pero falló por una causa técnica documentada.

**Criterios de entrada:**
- `status != 'completed'`
- Fallo técnico documentado: API key, proveedor no disponible, timeout, modelo no descargado, formato inválido, error de red.

**Criterios de invalidez:**
- NUNCA tratar attempted_failed como evidencia válida.
- NUNCA reclusterarlo como preliminary_valid sin nueva ejecución exitosa.

**Claims permitidos:**
- "AURA attempt to run benchmark on provider X failed due to <reason>."
- "Provider X was not available in this environment."

**Claims prohibidos:**
- "AURA produced valid output."
- "AURA was benchmarked."
- "Provider validated."
- "Formal evaluation completed."

### 3. `preliminary_valid`

La corrida produjo salida evaluable, pero faltan criterios formales.

**Criterios de entrada:**
- `status === 'completed'`
- Dataset especificado (controlled_synthetic o public).
- Provider y model documentados.
- Output exportado.
- Archivos de evidencia generados.

**Criterios que impiden formal_valid (mantienen preliminary_valid):**
- Faltan repeticiones (menos de 3).
- Faltan latencias medidas.
- Faltan hallazgos de alucinaciones.
- Faltan phantom columns count.
- Faltan tabla comparativa.
- Faltan limitaciones documentadas.
- Faltan human review.

**Claims permitidos:**
- "AURA produced valid output on controlled dataset."
- "<provider>/<model> was used in controlled run."
- "Output is preliminary and should not be treated as formal benchmark."
- "Results apply only to this specific configuration and dataset."

**Claims prohibidos:**
- "AURA was formally benchmarked."
- "Results are a formal benchmark."
- "AURA is production-ready."
- "Results generalize to other datasets or providers."
- "External independent validation performed."
- "Chrome AI or Gemini Nano is always available."

### 4. `formal_valid`

La corrida cumple protocolo completo.

**Criterios de entrada (TODOS requeridos):**
1. Dataset controlado o público documentado.
2. Provider / model / version / configuración registrados.
3. Temperatura / parámetros registrados.
4. Input mode documentado.
5. Salida exportada.
6. Validación JSON / script.
7. Latencia medida.
8. Detección de alucinaciones (0 hallucination_flags, 0 phantom_columns).
9. Repeticiones (3+ recommended).
10. Tabla comparativa producida.
11. Limitaciones documentadas.
12. Human review o criterios de aceptación aplicados.
13. Script generado sin phantom columns.

**Claims permitidos:**
- "AURA was formally benchmarked with documented protocol."
- "Results are repeatable with 3+ runs on the same configuration."
- "Dataset, provider, model, and all parameters are documented."
- "Output was validated for JSON, script, hallucinations, and latency."
- "Limitations are documented."

**Claims prohibidos (aunque sea formal_valid):**
- "AURA is production-ready."
- "Results generalize to ALL datasets."
- "AURA corrected real datasets."
- "External independent validation performed."

## Tratamiento de fallos específicos

### API key (status = api_error)

Clasificar como `attempted_failed`.
No reportar como benchmark. El fallo es de configuración, no de capacidad.
Documentar: "API key missing or invalid for provider X."

### Proveedor no disponible (status = provider_unavailable)

Clasificar como `attempted_failed`.
No reportar como benchmark. El fallo es ambiental, no de modelo.
Documentar: "Provider X not available in this environment (Chrome AI not detected / Ollama not running)."
Vincular con Phase 8 L4 provider validation opt-in.

### Salida sin JSON válido (status = invalid_output)

Clasificar como `attempted_failed`.
Documentar: "Model output is not valid JSON or missing required fields."

### Script inválido (status = completed, scriptGenerated = false)

Clasificar como `preliminary_valid` (si todo lo demás está bien).
Incluir limitación: "Script was not generated or is invalid."

### Alucinaciones (hallucinationFlags.length > 0)

Clasificar como `preliminary_valid`.
Documentar cada hallucination_flag.
Incluir phantom_columns_count en la limitación.

## Relación con L4 Provider Opt-in

- Toda corrida con proveedor real (Chrome AI, Ollama, Gemini Cloud) requiere que `AURA_PROVIDER_VALIDATION` esté activa (Phase 8 L4).
- Si la variable no está presente, el run no debe ejecutarse y se clasifica como `planned`.
- Si falla por `api_error` o `provider_unavailable`, se clasifica como `attempted_failed`.
- Si completa pero sin todos los criterios formales, es `preliminary_valid`.
- WebLLM es experimental y no debe producir claims de benchmark formal (out_of_scope).

## Metadatos obligatorios por corrida

Toda corrida debe registrar, como mínimo:
- `run_id`, `dataset_id`, `provider`, `model`
- `execution_mode`, `input_mode`, `temperature`
- `started_at`, `completed_at`, `status`
- `latency_ms`
- `json_valid`
- `classification`
- `evidence_files`

## Limitaciones

1. **Sin validación externa**: la clasificación es interna. AURA no puede auto-validarse como formal_valid sin revisión humana independiente.
2. **Repeticiones variables**: "3+ runs" es un mínimo documental, no un estándar estadístico riguroso.
3. **Human review pendiente**: ninguna corrida actual tiene revisión humana formal. Los runs L3 y futuros quedarán en preliminary_valid hasta que exista.
4. **Dependencia del helper**: la función `classifyBenchRun()` en `benchmarkEvidenceClassification.ts` automatiza la clasificación, pero los datos de entrada (status, latencia, alucinaciones) deben ser verificados manualmente.
5. **No es un scoring alternativo**: la clasificación `planned/attempted_failed/preliminary_valid/formal_valid` no reemplaza el `diagnosisReliabilityScore()`. Son complementarios.
