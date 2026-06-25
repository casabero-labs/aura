# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

## Siguiente tarea

Diseñar Phase 4: `ScriptContractV2` y renderer determinista.

Antes de implementar:

1. definir contrato, invariantes y errores;
2. definir mapeo `actionType` → plantilla;
3. fijar entradas, salidas y hashes;
4. diseñar pruebas para `approved`, `pending`, `rejected`, columnas ambiguas y referencias inválidas;
5. definir artefactos y métricas de cierre;
6. actualizar la documentación de `05_desarrollo/phases/phase_04/`.

## Regla

No iniciar Phase 5 ni consolidar el Word final hasta congelar Phase 4. Cada loop debe dejar código, pruebas, evidencia, resultados, limitaciones y commit exacto.
