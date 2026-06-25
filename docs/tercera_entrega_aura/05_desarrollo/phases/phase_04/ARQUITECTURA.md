# Arquitectura — Phase 4

Entrada: `DiagnosisExecutionResult` validado y `RemediationPlanV2` validado.

Procesamiento: seleccionar acciones `approved`, resolver `columnId`, mapear `actionType` a plantillas deterministas y construir `ScriptContractV2`.

Salida: contrato, script Python/Pandas, `acceptedActionIds`, `rejectedActionIds`, `columnRefs`, `scriptHash` y `validationResult`.

Regla de seguridad: el LLM no escribe código ni cambia la política; acciones pendientes, rechazadas, ambiguas o no autorizadas no se renderizan.
