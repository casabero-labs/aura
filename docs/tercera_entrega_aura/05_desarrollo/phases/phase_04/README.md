# Phase 4 — ScriptContractV2

## Objetivo

Construir un contrato de script y un renderer determinista a partir de acciones aprobadas de `RemediationPlanV2`.

## Alcance

- usar solo acciones `approved`;
- excluir `pending` y `rejected`;
- validar referencias de columnas;
- producir hash estable y reporte de validación;
- no usar el LLM para escribir código.

## Fuera de alcance

Ejecución real, Pyodide, Colab, reauditoría y delta de salud pertenecen a Phase 5.

## Estado

Planificada. Phase 3 permanece congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.
