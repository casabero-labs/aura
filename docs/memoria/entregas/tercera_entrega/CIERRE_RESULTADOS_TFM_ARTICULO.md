# Cierre de Resultados — TFM / Artículo

> Documento generado por AURA-L05-A. Resume la evidencia disponible, claims permitidos, limitaciones y artefactos exportables para la tercera entrega y el artículo académico.

**Fecha de cierre**: 2026-06-14  
**App**: AURA v0.5.0 — Auditoría Unificada de Riesgos Algorítmicos  
**Repositorio**: [github.com/anomalyco/aura](https://github.com/anomalyco/aura)

---

## 1. Objetivos específicos y cobertura

| OE | Objetivo | Estado | Evidencia |
|---|---|---|---|
| OE1 | Ingestión y perfilamiento determinista | COMPLETADO | Contrato de ingestión (`AuditExecutionEvidence`), parseo local-first, fingerprint, metadatos. Componente `IngestionEvidenceCard`. |
| OE2 | Validación determinista formal por regla | COMPLETADO | Ground truth sintético (13 reglas, Macro F1=92.3%) y Titanic (3 reglas, Macro F1=100%). `DeterministicValidationPanel`. |
| OE3 | Diagnóstico LLM y benchmark formal | PARCIAL | Contrato completo de benchmark. `EvidenceStatus` graduado. Corridas preliminares (sin API keys activas). |
| OE4 | Script seguro y validación HITL | COMPLETADO | `ScriptValidationResult` con safetyScore (0-100), coverage%, detección de columnas fantasma y ops destructivas. |
| OE5 | Exportación, gobernanza y resultados | COMPLETADO | `HitlDecision` con checklist de 5 criterios. Delta de salud simulado. `EvidenceManifest` con mapeo OE1-OE5. |

---

## 2. Claims permitidos según evidencia

| Dominio | Nivel | Justificación |
|---|---|---|
| Motor determinista | **Formal** | Ground truth sintético + Titanic. Métricas TP/FP/FN por regla exportables. |
| Benchmark LLM | **Preliminar** | Contrato formal implementado pero corridas requieren API keys/WebGPU activos. |
| Script seguro | **Formal** | SafetyScore, detección de columnas fantasma y ops destructivas funcionando. |
| Decisión HITL | **Formal** | Checklist de 5 criterios capturado al aprobar. Decisión estructurada exportable. |
| Delta de salud | **Formal** | Simulación sobre copia con before/after score, issues y críticos. |

---

## 3. Artefactos exportables

| Artefacto | Formato | Incluye |
|---|---|---|
| `aura_audit_{ts}.json` | JSON | Manifest completo + perfil + validación + benchmark + script + HITL |
| `aura_issues_{ts}.csv` | CSV | Hallazgos deterministas (id, severidad, categoría, regla, columna, count) |
| `aura_script_aprobado_{ts}.py` | Python | Script de limpieza aprobado por HITL |
| Reporte PDF | PDF | Resumen ejecutivo con score, hallazgos y recomendaciones |

---

## 4. Limitaciones

- Simulación de remediación sobre copia en memoria; no modifica el archivo original.
- Benchmark LLM es preliminar hasta que se activen API keys o WebGPU.
- Ground truth disponible solo para datasets sintético (15 filas) y Titanic (891 filas).
- Métricas deterministas por regla usan detección binaria (rule fired / not fired), no conteo de filas afectadas.
- Dataset truncado a 5000 filas en modo preview del navegador (PapaParse).
- `R24 — Rangos Demográficos Quemados` produce FP en columnas de fecha (regex captura fragmentos ISO).

---

## 5. Deuda metodológica

| Item | Impacto | Plan |
|---|---|---|
| Corridas reales de benchmark | OE3 queda en partial | Activar API keys o WebGPU para corridas formales |
| Burned-range FP (R24) | 1 FP documentado en synthetic | Corregir regex o excluir columnas de fecha |
| Trazabilidad semántica de reglas | `hasRuleTrace` usa coincidencia textual | Implementar heurística semántica (ej: drop_duplicates → Filas Duplicadas) |
| Ground truth ampliado | Solo 2 datasets con ground truth | Agregar Adult Income, Melbourne Housing, Dirty Restaurant |

---

## 6. Métricas clave

| Métrica | Valor |
|---|---|
| Macro F1 determinista (synthetic) | 92.3% |
| Macro F1 determinista (Titanic) | 100% |
| Reglas evaluadas | 13 (synthetic) + 3 (Titanic) |
| Tests unitarios | 119 (15 archivos) |
| Tests E2E | 1 (Playwright) |
| Build | OK |

---

## 7. Próximos pasos

1. **Corridas reales de benchmark**: activar API key de Google/Groq/DeepSeek o WebGPU con modelo local para ejecutar corridas formales y subir OE3 a COMPLETADO.
2. **Corregir R24**: ajustar regex de rangos demográficos para excluir fechas ISO.
3. **Ground truth ampliado**: agregar Adult Income y Melbourne Housing con definiciones de reglas esperadas.
4. **Redacción del artículo**: usar las tablas markdown exportables y el `EvidenceManifest` como fuente de datos para la sección de resultados.
5. **Commit/push**: cuando el tribunal o director lo solicite.
