# Matriz de desarrollo por etapa AURA

> Proposito: convertir la retroalimentacion de la segunda entrega en acciones visibles dentro de AURA, resultados medibles y evidencias reutilizables para la tercera entrega y el articulo.

## Lectura ejecutiva

AURA ya tiene un flujo funcional de seis etapas: Subir CSV, Perfilar, Diagnostico, Script, Revisar y Exportar. La consolidacion requerida no consiste en cambiar ese flujo, sino en volver cada etapa defendible academicamente:

- definir ground truth, umbrales y criterios de evaluacion;
- medir desempeno determinista y cognitivo con resultados comparables;
- evidenciar mitigacion de alucinaciones y control humano;
- exportar tablas, anexos y manifest de reproducibilidad;
- conectar cada objetivo especifico con evidencia obtenida.

## Matriz

| Etapa | Lo que tenemos actualmente | Requerido por la ultima revision | Fortalezas | Debilidades | Objetivos de desarrollo | Loop / E2E |
|---|---|---|---|---|---|---|
| Subir CSV | Carga local .csv; parseo en navegador; deteccion de campos/delimitador; trazas y fingerprint inicial. | Capturar metadatos del caso, ground truth asociado, errores de carga y contrato de ingestion exportable. | Local-first; entrada simple; privacidad visible; arranque reproducible. | No vincula ground truth; no registra protocolo experimental desde UI; errores poco reutilizables como evidencia. | Ficha experimental de dataset; contrato de ingestion en JSON; pruebas de carga valida/invalida. | ~~L02-A: abrir -> subir fixture -> ver feedback -> perfilar.~~ **COMPLETADO** — Contrato de ingestion con: fileSize, rows, columns, delimiter, truncated, fingerprint, parseDurationMs, ingestionStatus. Componente `IngestionEvidenceCard` visible en perfil. Tests unitarios (5) + E2E verificando evidencia visible. |
| Perfilar | Motor determinista; perfil estadistico; score; matriz de reglas; hallazgos; paquete de evidencia. | Reportar precision, recall y F1 por dataset/regla; justificar umbrales; describir ground truth y criterios de etiquetado. | Base mas solida de AURA; trazable; separa hechos de interpretacion LLM. | Metricas academicas no integradas en pantalla; umbrales poco visibles; objetivos especificos no siempre quedan vinculados. | Tabla por regla TP/FP/FN; ficha de umbrales/version; conexion OE1/OE2. | ~~L02-B: subir fixture -> ver perfil -> exportar metricas deterministas.~~ **COMPLETADO** — `DeterministicValidationPanel` muestra métricas por regla (TP/FP/FN, P/R/F1). Ground truth definido para synthetic (13 reglas) y Titanic (3 reglas). Macro F1 synthetic=92.3%, Titanic=100%. Umbrales documentados en `DETERMINISTIC_THRESHOLDS`. Export JSON incluye `deterministicValidation`. Tests: 12 unitarios + E2E. |
| Diagnostico | LLM restringido por smart sample y hallazgos; proveedor local/cloud; hash de prompt; exportacion JSON/PDF; laboratorio de modelos. | Benchmark multimodelo formal; medicion de formato, alucinaciones, columnas inventadas y claims no soportados; comparacion smart sample vs prompt libre. | Capa cognitiva acotada; permite discutir privacidad/gobernanza/costo; ya existen detectores y servicios de evaluacion. | Resultados comparativos no cerrados; utilidad del diagnostico aun debe medirse objetivamente; falta tabla publicable. | Protocolo de benchmark; estado formal de evidencia por corrida; tabla comparativa articulo-ready. | ~~L03-A: abrir laboratorio -> ejecutar corrida -> ver estado -> exportar JSON.~~ **COMPLETADO** — `EvidenceStatus` graduado (planned → attempted_failed → preliminary_valid → formal_valid, este último requiere ground truth match + formato OK + cero alucinaciones). Export JSON incluye `formalValidCount`, `failedCount`, `bestByMetric`. `BenchmarkSummaryCard` visible con conteos. Bug corregido en regex de columnas Python (doble comilla). Tests: 15 hallucinationDetector + 12 benchmarkContract + 4 deriveEvidenceStatus. E2E verifica panel. Corridas son preliminares (sin API keys reales activas en este momento). |
| Script | Generacion Python/Pandas desde diagnostico; fallback determinista; validacion de columnas, cobertura, operaciones destructivas, Pandas y revision humana. | Demostrar ausencia de columnas fantasma; medir cobertura de hallazgos; separar generacion, validacion y aprobacion HITL. | No depende ciegamente del LLM; matriz de validacion visible; prompt anclado al diagnostico. | Cobertura aun no es metrica formal; politica destructiva debe endurecerse; faltan E2E de invalido/fallback. | Tabla de validacion de script; bloqueo por riesgos criticos; pruebas de fallback y columnas fantasma. | ~~L04-A: diagnosticar -> generar script -> validar -> bloquear o continuar.~~ **COMPLETADO** — `ScriptValidationResult` extendido con `safetyScore` (0-100 ponderado), `coveragePercentage`, `uncoveredIssueIds`, `scriptOrigin`, `hasPandasImport`. `valid` ahora requiere: columnas OK + cobertura > 0 + sin operaciones destructivas. Regex `df_clean[` corregido para detectar columnas en cualquier variable DataFrame. SafetyScore visible con barra + desglose. Tests: 8 unitarios. E2E verifica flujo. |
| Revisar | Revision/edicion/aprobacion humana; simulacion sobre copia; ImprovementRun con delta antes/despues. | Documentar criterios HITL; presentar delta como evidencia de impacto; conectar con gobernanza y mitigacion de riesgos IA. | HITL real; no modifica dato original; delta permite discutir impacto aplicado. | No captura razon estructurada de aprobacion/rechazo; falta checklist formal; ImprovementRun debe integrarse al paquete final. | Checklist de revision; decision humana en JSON; tabla de delta de salud. | ~~L04-B: revisar -> aprobar -> simular -> ver delta -> preparar exportacion.~~ **COMPLETADO** — `HitlDecision` tipado con approved, safetyScoreAtApproval, coverageAtApproval, checklist (5 criterios), reviewerNotes, timestamp. Bloque visible en ReviewStep con veredicto, métricas de aprobación y checklist colapsable. `ImprovementRun.hitlDecision` pasado por `createImprovementRun`. Export JSON incluye `hitlDecision`. Tests: 7 unitarios. E2E verifica flujo completo. |
| Exportar | PDF; anexo JSON; CSV de hallazgos; script aprobado; resumen de criticos, advertencias y estado HITL. | Paquete unico para TFM/articulo; checklist por objetivo; manifest con versiones, datasets, comandos, metricas y limites. | Artefactos multiples; separacion clara de perfil/diagnostico/script/experimento; cierre verificable. | Artefactos fragmentados; PDF no siempre incluye benchmark formal; no hay gate de completitud academica. | Bundle TFM/articulo; tablas APA-ready; bloqueo de claims sin evidencia formal. | ~~L05-A: exportar -> descargar artefactos -> verificar objetivos cubiertos.~~ **COMPLETADO** — `EvidenceManifest` con mapeo OE1-OE5 (3 completed, 1 partial, 1 completed), `allowedClaims` graduado (formal/preliminary/none), `objectivesCoverage` checklist visible en UI de export. Export JSON incluye `manifest` como sección raíz. `CIERRE_RESULTADOS_TFM_ARTICULO.md` con resumen ejecutivo, claims, limitaciones, deuda y métricas. Tests: 14 unitarios. E2E verifica flujo completo. |

## Directriz de desarrollo

Cada loop debe cerrar con tres salidas:

1. Resultado visible en AURA.
2. Prueba automatizada, idealmente E2E si toca el flujo humano.
3. Evidencia exportable o reproducible para memoria y articulo.

## Secuencia recomendada

1. ~~L02-A~~ **COMPLETADO 2026-06-14**: contrato de ingestion cerrado.
2. ~~L02-B~~ **COMPLETADO 2026-06-14**: validacion determinista formal por regla.
3. ~~L03-A~~ **COMPLETADO 2026-06-14**: benchmark LLM formal con EvidenceStatus graduado.
4. ~~L04-A~~ **COMPLETADO 2026-06-14**: script seguro y medible.
5. ~~L04-B~~ **COMPLETADO 2026-06-14**: revision humana trazable.
6. ~~L05-A~~ **COMPLETADO 2026-06-14**: paquete final con manifest, checklist OE1-OE5, allowedClaims y CIERRE_RESULTADOS_TFM_ARTICULO.md.

## Estado global del pipeline AURA al cierre L05-A

| Etapa | Loop | Estado |
|---|---|---|
| Subir CSV | L02-A | COMPLETADO |
| Perfilar | L02-B | COMPLETADO |
| Diagnóstico | L03-A | COMPLETADO (parcial: benchmark sin corridas reales) |
| Script | L04-A | COMPLETADO |
| Revisar | L04-B | COMPLETADO |
| Exportar | L05-A | COMPLETADO |

## Deuda metodológica documentada

- **Corridas reales**: los benchmarks requieren API keys válidas o WebGPU funcional.
- **Burned-range FP (R24)**: regex `\d{1,3}[-–]\d{1,3}` captura fechas ISO. Deuda del motor determinista.
- **Regex df["col"]/df_clean["col"]** corregido en L03-A/L04-A: ahora acepta cualquier variable `df\w*["col"]`.
- **Trazabilidad de reglas**: `hasRuleTrace` usa coincidencia textual; no detecta `drop_duplicates` como trazable a `Filas Duplicadas` a menos que el script incluya un comentario explícito. Deuda documentada: requiere heurística semántica o comentarios obligatorios.

## Próximos pasos post-L05-A

1. **Corridas reales de benchmark**: activar API key de Google/Groq/DeepSeek o WebGPU para ejecutar corridas formales. Subir OE3 de PARTIAL a COMPLETADO.
2. **Corregir R24 (burned-range FP)**: ajustar regex de rangos demográficos para excluir fechas ISO.
3. **Ground truth ampliado**: agregar Adult Income y Melbourne Housing con definiciones de reglas esperadas.
4. **Redacción del artículo**: usar las tablas markdown exportables y el `EvidenceManifest` como fuente de datos.
5. **Commit/push**: cuando el tribunal o director lo solicite.

## Criterio de cierre

Una etapa no se considera terminada solo porque funciona en pantalla. Se considera terminada cuando permite defender una afirmacion del TFM con evidencia descargable, prueba automatizada o resultado reproducible.
