# Diccionario de componentes — AURA

| Nombre técnico | Nombre académico sugerido | Función | Evidencia asociada | Riesgo que controla |
|---|---|---|---|---|
| `csvService.ts` | Módulo de lectura local | Lee y parsea el CSV en el navegador sin enviarlo a ningún servidor | Captura 01 | Fuga de datos; dependencia de backend |
| `auditEngine.ts` | Motor determinista de auditoría | Ejecuta reglas predefinidas sobre los datos sin intervención externa | Captura 02 | Subjetividad; variabilidad entre ejecuciones |
| `executionEvidence.ts` | Registro de evidencia de ejecución | Calcula fingerprint del dataset y registra trazabilidad temporal | Captura 03 | Datos no trazables; auditoría no reproducible |
| `AuditReport` | Informe técnico de auditoría | Estructura hallazgos con severidad, columna afectada y conteo | Capturas 01, 02 | Diagnóstico desestructurado |
| `EvidenceEnvelopeV2` | Paquete estructurado de evidencia | Encapsula fingerprint, columnas, hallazgos y límites antes del diagnóstico asistido | Captura 03 | Diagnóstico sin restricciones de evidencia |
| `DiagnosisResponseV2` | Diagnóstico asistido estructurado | Recibe evidencia restringida y produce hipótesis con confianza y límites | Captura 04 | Alucinaciones; referencias inválidas |
| `RemediationPlanV2` | Plan de remediación gobernado | Genera acciones deterministas clasificadas por tipo y riesgo | Captura 05 | Acciones automáticas no autorizadas |
| `ScriptContractV2` | Contrato verificable de script | Genera código Python/Pandas con hash, partición y verificación | Capturas 07, 08 | Script no trazable o no verificable |
| Renderer determinista | Generador controlado de código | Transforma acciones aprobadas en código Python sin intervención del LLM | Captura 07 | Código incorrecto o inseguro |
| HITL | Revisión humana antes de aprobar | El usuario aprueba o rechaza cada acción antes de generar el script | Captura 06 | Aprobación automática sin supervisión |
| `BenchmarkLab` | Laboratorio de comparación de modelos | Permite ejecutar múltiples modelos y comparar resultados | Captura 10 | Selección de modelo sin evidencia |
