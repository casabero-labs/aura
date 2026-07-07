# controlled_customers_phase8 — Claims

## Qué se podrá afirmar usando este dataset

1. AURA fue evaluada contra un dataset sintetico controlado de 50 filas con 15 columnas.
2. El ground truth documentado contiene 52 issues esperados.
3. El dataset no contiene PII: los correos usan dominio `.invalid` (RFC 6761), los nombres usan patron sintetico, los telefonos son de ejemplo.
4. Los resultados de deteccion (precision, recall) son validos exclusivamente dentro del contexto de este dataset y sus reglas.
5. Las metricas obtenidas sirven como evidencia preliminar de la capacidad de profile de AURA.
6. Todos los errores en el dataset fueron diseniados intencionalmente, no descubiertos fortuitamente.

## Qué NO se podrá afirmar

1. Que AURA fue validada con datos reales de clientes.
2. Que AURA corrigio datasets reales.
3. Que los resultados generalizan a cualquier dominio, industria o tipo de dato.
4. Que AURA esta production-ready basado en esta validacion.
5. Que existe un benchmark formal definitivo.
6. Que la validacion fue externa e independiente (el dataset fue diseniado conociendo las reglas de AURA).
7. Que el recall/precision medido aplica a datasets reales con distribuciones de error arbitrarias.
8. Que AURA ejecuta Python internamente (siempre es delegado a Colab).
9. Que Chrome AI / Gemini Nano siempre esta disponible o es necesario para esta validacion.

## ¿Cómo se usará en L3?

En Phase 8 L3 (Controlled Pilot Run), AURA:

1. Cargara `controlled_customers_phase8.csv` desde el filesystem o interfaz de carga.
2. Ejecutara `runAudit` del motor determinista.
3. Generara un `AuditReport` con la lista de issues detectados.
4. Se comparara el output de AURA contra `controlled_customers_phase8_ground_truth.json`.
5. Se calcularan metricas de deteccion: true positives, false positives, false negatives.
6. Se exportara el resultado como `phase8_pilot_run_audit.json`.

**No** se ejecutara:

- Limpieza de datos (script generation).
- HealthDelta.
- ImprovementRun completo.
- Proveedores AI reales (Chrome AI, Gemini, Ollama, cloud).
- Python dentro de AURA.

## Limitaciones por ser sintético

1. Los patrones de error son conocidos y diseniados. En datos reales los errores son mas diversos e impredecibles.
2. El dominio del dataset (clientes SaaS en Chile) es acotado. No representa otros sectores.
3. El tamano (50 filas) no permite evaluar escalabilidad.
4. Las reglas deterministicas de AURA pueden coincidir exactamente con los errores diseniados, inflando artificialmente el recall.
5. No hay ambiguedad semantica real: los placeholders (N/A, SIN_DATO) son explicitos. En datos reales los placeholders pueden ser mas sutiles.

## Advertencia de no validación externa

Este dataset fue creado por el mismo equipo que desarrolla AURA. No constituye una validacion externa ni independiente. Para una validacion externa se requeriria:

- Un dataset curado por un tercero sin conocimiento de las reglas de AURA.
- Un protocolo de evaluacion definido por el tercero.
- Resultados publicados y reproducibles por el tercero.

## Advertencia de no dataset real

Este dataset NO proviene de ninguna fuente real (empresa, institucion, base de datos productiva). Es 100% fabricado con propositos de prueba. Cualquier similitud con datos reales es coincidencia.

## Claims de privacidad

- Todos los correos electronicos usan el dominio `.invalid`, reservado por IETF RFC 6761 para documentacion y pruebas.
- Los telefonos usan formato sintetico `+56-9-1111-XXXX` donde XXXX es un secuencial de prueba.
- Los tax_id usan prefijo `SYN-` para marcar explicitamente datos sinteticos.
- Los nombres de empresa son genericos (SolucionesDelta, TecnologiasOmega, etc.) sin relacion con empresas reales.
- Las ciudades corresponden a ubicaciones geograficas reales de Chile, pero los datos asociados (clientes, transacciones) son ficticios.
