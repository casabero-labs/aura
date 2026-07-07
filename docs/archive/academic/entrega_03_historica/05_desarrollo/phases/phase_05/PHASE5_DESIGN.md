# Phase 5 — Diseño de ejecución, reauditoría y HealthDelta

> **Estado:** diseño preparado, no implementado  
> **Base documental:** Phase 4 cerrada y congelada  
> **Evidencia Phase 4:** `aa167995316962a70ff41a3970326d4824d980c0`  
> **Freeze Phase 4:** `05878e4a960afd11d564a60f4924bfb8f0b527e7`

## 1. Propósito

Phase 5 debe convertir un `ScriptContractV2` aprobado en una ejecución controlada sobre copia del dataset, seguida de reauditoría y cálculo de HealthDelta.

La fase no debe permitir ejecución libre de código ni transformaciones sin contrato. Solo puede operar sobre un contrato generado, validado, verificado y aprobado en Phase 4.

## 2. Frontera de entrada

Phase 5 solo puede iniciar si existen:

1. `ScriptContractV2` aprobado por revisión humana.
2. Verificación fresca válida mediante `verifyScriptContractV2`.
3. `scriptHash` coincidente con `scriptText`.
4. `datasetFingerprint` coincidente con el CSV original.
5. `acceptedActionIds` coherentes con el plan HITL final.

Si cualquiera de estas condiciones falla, Phase 5 debe bloquear la ejecución.

## 3. Flujo objetivo

```text
ScriptContractV2 aprobado
→ fresh verification
→ sandbox execution
→ clean_dataset(df_original.copy())
→ dataset limpio en memoria
→ reauditoría EvidenceEnvelopeV2
→ HealthDelta
→ reporte ImprovementRun
→ exportación controlada
```

## 4. Runtime pendiente de decisión

La decisión de runtime debe resolverse en Loop 0 antes de implementar:

| Opción | Ventaja | Riesgo |
|---|---|---|
| Pyodide en navegador | local-first, sin backend | peso, compatibilidad pandas, rendimiento |
| Worker aislado | separa UI y ejecución | no ejecuta Python real por sí solo |
| Backend local Python | pandas real, más control | requiere servicio local |
| Node + sandbox externo | integración JS | riesgo de aislamiento insuficiente |

La recomendación inicial es diseñar un runtime controlado con límites explícitos antes de escribir código de ejecución.

## 5. Reglas de seguridad

Phase 5 debe imponer:

- timeout de ejecución;
- límite de memoria;
- sin red;
- sin acceso libre a filesystem;
- imports permitidos por lista blanca;
- solo función `clean_dataset(df)`;
- ejecución sobre copia, nunca sobre el dataset original;
- logs estructurados;
- bloqueo fail-closed ante error.

## 6. Salidas esperadas

Phase 5 debe producir:

- `ImprovementRunV1`;
- dataset limpio exportable;
- evidencia de ejecución;
- reauditoría posterior;
- HealthDelta;
- reporte de cambios;
- manifest de claims permitidos y no permitidos.

## 7. Claims permitidos al finalizar Phase 5

Solo después de ejecutar y medir se podrá afirmar:

- script ejecutado bajo sandbox;
- dataset limpio generado sobre copia;
- reauditoría pre/post;
- HealthDelta calculado;
- mejora, empeoramiento o delta cero según evidencia.

## 8. Claims prohibidos antes de Phase 5

Mientras Phase 5 no esté implementada y cerrada, no se debe afirmar:

- ejecución real de Python;
- corrección efectiva del dataset;
- mejora medida;
- HealthDelta real;
- benchmark final de utilidad.

## 9. Primer loop recomendado

`Phase 5 Loop 0 — diseño de runtime y contratos`.

Debe producir únicamente diseño, contratos, fixtures y plan de pruebas. No debe ejecutar scripts generados.
