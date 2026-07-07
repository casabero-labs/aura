# Phase 9 — Technical Debt Cleanup and Typecheck Baseline Plan

## Objetivo

Aislar, clasificar y planificar la limpieza de deuda técnica TypeScript heredada de fases previas congeladas (Phase 5, Phase 6, Phase 7, Phase 8), sin romper evidencias congeladas ni mezclar limpieza con nuevas features.

## Alcance

- Documentar el baseline actual de errores TypeScript (`npx tsc --noEmit`).
- Clasificar cada error por tipo, origen probable, riesgo y prioridad.
- Definir un plan de limpieza por loops pequeños y controlados.
- Cada loop resuelve un tipo de error aislado, sin tocar otros archivos.
- Verificar typecheck limpio (`npx tsc --noEmit` sin errores) al cierre de Phase 9.

## Fuera de alcance

- No arreglar errores en L0 (solo documentar).
- No tocar código productivo en L0.
- No modificar tests.
- No modificar servicios.
- No modificar componentes.
- No tocar contratos v2.
- No tocar freezes Phase 5, Phase 6, Phase 7 ni Phase 8.
- No preparar cuarta entrega.
- No iniciar refactors grandes.
- No cambiar scoring.
- No cambiar auditEngine.
- No cambiar comportamiento funcional de AURA.

## Relación con Phase 8 congelada

Phase 8 quedó congelada en `7fc32409160e5e9ee84d38bbe56db2fb4e504af4`. Durante su ejecución se documentaron 8 errores TypeScript preexistentes que no bloquearon Phase 8 porque no eran atribuibles a los loops nuevos. Phase 9 recibe ese baseline como input y planifica su resolución.

## Estrategia de limpieza por loops

| Loop | Nombre | Objetivo | Estado |
|---|---|---|---|
| L0 | Technical Debt Baseline Plan | Documentar baseline actual de typecheck | En ejecución |
| L1 | Test Dependency Baseline Cleanup | Resolver dependencias faltantes en tests | Pendiente |
| L2 | ImprovementRunPanel Type Fixtures | Corregir mocks/tipos heredados del visual harness | Pendiente |
| L3 | ReviewStep Contract Cleanup | Resolver prop mismatch de ReviewStep | Pendiente |
| L4 | E2E Typing Cleanup | Corregir tipos en phase7-claims-visible.spec.ts | Pendiente |
| L5 | Typecheck Green Verification | Lograr `npx tsc --noEmit` sin errores | Pendiente |
| L6 | Freeze Phase 9 | Congelar Phase 9 si typecheck queda limpio | Pendiente |

### Reglas por loop

- Cada loop solo toca los archivos de su scope.
- Cada loop debe verificarse con `npx tsc --noEmit` después de su fix.
- Ningún loop debe introducir nuevos errores.
- Ningún loop debe modificar archivos fuera de su scope.
- Ningún loop debe romper freezes existentes.

## Riesgos

- **Regresión funcional**: Corregir tipos podría romper comportamiento en runtime si los mocks se ajustan incorrectamente.
- **Dependencia oculta**: `@testing-library/*` podría requerir otras peer dependencies.
- **Mock incompleto vs interfaz real**: Ajustar mocks para satisfacer tipos sin cubrir todos los campos podría ocultar errores reales.
- **E2E flakiness**: Cambiar tipos en tests E2E podría introducir flakiness si los selectores o assertions cambian.
- **Falsos positivos**: Typecheck limpio no garantiza que los mocks sean correctos semánticamente.

## Reglas operativas

- Trabajar en main.
- No crear ramas.
- No abrir PR.
- No modificar Phase 3, Phase 4, Phase 5, Phase 6, Phase 7 ni Phase 8.
- No tocar `FREEZE_PHASE5.md`, `FREEZE_PHASE6.md`, `FREEZE_PHASE7.md` ni `FREEZE_PHASE8.md`.
- No modificar contratos v2.
- No modificar servicios, componentes ni tests en L0.
- No iniciar L1 hasta que L0 esté cerrado.

## Criterio de cierre de Phase 9

- `npx tsc --noEmit` ejecutado desde `src/` sin errores.
- Todos los loops L1-L5 completados con evidencia documental de cada cierre.
- `FREEZE_PHASE9.md` generado con snapshot final.
- Ningún freeze previo modificado.
- Ningún contrato v2 modificado.
- Ningún test roto.

## Claims permitidos durante Phase 9

- AURA cuenta con un baseline documentado de deuda TypeScript.
- La deuda TypeScript es heredada de fases previas congeladas.
- Cada loop de limpieza es aislado y verificable.
- Typecheck limpio es un objetivo alcanzable dentro de Phase 9.
- La limpieza no introduce nuevas features ni modifica comportamiento funcional.

## Claims prohibidos durante Phase 9

- No afirmar que AURA está production-ready.
- No afirmar que la deuda fue resuelta hasta que L5 esté cerrado.
- No afirmar que typecheck está limpio antes de L5.
- No afirmar que se corrigieron bugs funcionales (solo deuda de tipos).
- No afirmar que la cuarta entrega está en construcción.
- No afirmar que la limpieza de tipos mejora el runtime.
