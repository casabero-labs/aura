# Phase 10 L4 — Agent Prompt

## Modelo recomendado

DeepSeek Pro V4

## Repo

casabero-labs/aura

## Nombre exacto del loop

Phase 10 L4 — Evidencia defendible de calibración

## Modo de trabajo

Trabaja localmente partiendo de `main`.

No hagas commit.
No hagas push.
No abras PR.
No crees ramas salvo autorización explícita del usuario.

## Objetivo

Convertir los resultados de la calibración embebida en evidencia defendible dentro del flujo de AURA, sin presentar la calibración como benchmark formal ni como selección universal de mejor modelo.

L3 ya permite ejecutar comparación experimental dentro del paso `calibration` y guardar resultados en `benchmarkResults`. L4 debe hacer que esa evidencia sea más clara, exportable y metodológicamente honesta.

## Contexto obligatorio

Antes de modificar, leer:

- `docs/product/aura/ORCHESTRATION_DIRECTIVES.md`
- `docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md`
- `docs/product/aura/phase_10/L3_PRIORITY_ADDENDUM.md`
- `docs/product/aura/phase_10/L3_AGENT_PROMPT.md`

Estado actual:

- `CalibrationEmbeddedPanel` existe.
- El opt-in ya no abre `BenchmarkLab`.
- `MainPipeline` guarda resultados de calibración en `benchmarkResults`.
- `buildEvidenceManifest` ya recibe `benchmarkResults`.
- El lenguaje de manifest todavía usa términos heredados como `benchmark`, `mejor score compuesto` y `laboratorio`.
- La entrega académica final debe centrarse en resultados de AURA y evidencia útil, no en documentación interna excesiva.

## Problema a resolver

La app ya guarda resultados experimentales, pero todavía falta una capa clara para explicar qué significan y cómo pueden defenderse:

1. Un resultado de calibración no equivale a benchmark formal.
2. No debe hablarse de `mejor modelo` o ganador universal.
3. Si no hay `formal_valid`, la evidencia debe quedar como preliminar o intento fallido.
4. La exportación debe mostrar límites y estado de evidencia de forma explícita.
5. El usuario debe poder entender qué resultados se guardaron sin entrar al antiguo `BenchmarkLab`.

## Alcance funcional

1. Revisar cómo `benchmarkResults` se presentan en exportación y manifest.
2. Ajustar lenguaje de `buildEvidenceManifest` para evitar claims de ranking absoluto.
3. Si es necesario, agregar un resumen explícito de calibración experimental:
   - total de corridas;
   - corridas completadas;
   - corridas fallidas/no disponibles;
   - cantidad con evidencia formal;
   - estado global: none / attempted / preliminary / formal.
4. Mostrar en exportación que los resultados son `calibración experimental`, no benchmark definitivo.
5. Evitar términos como `mejor modelo`, `ganador`, `benchmark definitivo`.
6. Mantener compatibilidad con `BenchmarkResult` existente si es posible.
7. Agregar tests focales para `evidenceManifest` y/o exportación JSON si aplica.
8. Crear closeout documental L4.

## Recomendación técnica

Preferir cambios pequeños y defendibles:

1. Actualizar `src/services/evidenceManifest.ts` para cambiar lenguaje heredado de benchmark a calibración/comparación experimental cuando no exista evidencia formal.
2. Evitar calcular o presentar `bestBenchmark` como veredicto si no hay `formal_valid`.
3. Agregar helper interno, por ejemplo:

```ts
const buildCalibrationSummary = (results: BenchmarkResult[]) => ({ ... })
```

4. Si se modifica el tipo `EvidenceManifest`, hacerlo de forma mínima y con tests.
5. Revisar `src/App.tsx` export JSON para que el bloque `experiment` sea honesto y claro.
6. No reabrir UI grande si no hace falta.

## Archivos esperados

Posibles archivos modificados:

- `src/services/evidenceManifest.ts`
- `src/types.ts` solo si se agrega una estructura mínima al manifest
- `src/App.tsx` si se ajusta la exportación JSON
- `src/__tests__/evidenceManifest.test.ts`
- `docs/product/aura/NEXT_STEPS.md` si se puede actualizar de forma segura

Archivo esperado a crear:

- `docs/product/aura/phase_10/L4_CALIBRATION_EVIDENCE_CLOSEOUT.md`

## Restricciones duras

No tocar:

- `auditEngine`
- scoring determinista
- contratos v2
- freezes Phase 5, 6, 7, 8 o 9
- `docs/tercera_entrega_aura/`

No hacer:

- No preparar cuarta entrega.
- No declarar production-ready.
- No declarar benchmark formal definitivo.
- No decir que la calibración elige el mejor modelo universal.
- No depender de Chrome AI o Gemini Nano real.
- No descargar modelos en tests.
- No ejecutar Python dentro de AURA.
- No usar datos reales.
- No eliminar `BenchmarkLab`.
- No hacer commit.
- No hacer push.

## Claims permitidos

- AURA conserva resultados de calibración experimental como evidencia trazable.
- La calibración puede producir evidencia preliminar o intentos fallidos.
- Solo una corrida con `formal_valid` puede sostener lenguaje formal limitado.
- La calibración no bloquea el diagnóstico normal.
- La exportación puede incluir resultados experimentales con sus límites.

## Claims prohibidos

- AURA tiene un benchmark definitivo de modelos.
- La calibración escoge el mejor modelo universal.
- Un resultado preliminar prueba superioridad del modelo.
- Una corrida fallida invalida el flujo principal.
- La calibración corrige datasets.
- La cuarta entrega ya empezó.

## Pruebas obligatorias

Ejecutar:

- `cd src && npm run typecheck`
- `cd src && npm run build`

Si se modifica `evidenceManifest`, ejecutar:

- `cd src && npm test -- --run evidenceManifest`

Si se modifica exportación en `App.tsx`, ejecutar los tests existentes relacionados si existen.

Si no existen tests específicos, reportarlo explícitamente.

## Greps obligatorios

Ejecutar:

- `grep -R "mejor modelo\|modelo ganador\|ganador universal\|benchmark definitivo\|production-ready" src docs/product/aura/phase_10 || true`
- `grep -R "mejor score compuesto\|bestBenchmark" src/services src/components src/App.tsx || true`
- `grep -R "cuarta entrega" src docs/product/aura/phase_10 || true`

Criterio:

- Claims prohibidos solo pueden aparecer en secciones de advertencia, restricciones, pruebas o claims prohibidos.
- Si aparece `bestBenchmark` o `mejor score compuesto`, justificarlo o reemplazarlo por lenguaje de calibración experimental.

## Validaciones Git

Ejecutar:

- `git branch --show-current`
- `git status --porcelain`
- `git diff --name-status`

No ejecutar commit ni push.

## Definition of Done

L4 queda listo para revisión si:

1. La evidencia de calibración se resume sin claims inflados.
2. El manifest/exportación diferencia preliminar, intento fallido y formal.
3. No se habla de mejor modelo universal.
4. No se presenta benchmark formal si no hay `formal_valid`.
5. Typecheck pasa.
6. Build pasa.
7. Tests focales pasan o se justifica su ausencia.
8. Closeout L4 existe.
9. No se tocó `auditEngine`.
10. No se tocó scoring determinista.
11. No se tocaron contratos v2.
12. No se tocaron freezes anteriores.
13. No se preparó cuarta entrega.
14. No se hizo commit.
15. No se hizo push.

## Reporte final obligatorio

Entregar:

- rama usada;
- archivos modificados;
- archivos creados;
- resumen funcional;
- resultado exacto de typecheck;
- resultado exacto de build;
- resultado de tests específicos o confirmación de que no existen;
- salida exacta de `git status --porcelain`;
- salida exacta de `git diff --name-status`;
- resultado de greps obligatorios;
- confirmación de no commit;
- confirmación de no push;
- confirmación de no `auditEngine`;
- confirmación de no scoring;
- confirmación de no contratos v2;
- confirmación de no freezes anteriores;
- confirmación de no cuarta entrega;
- riesgos abiertos;
- recomendación: listo para revisión humana o no listo.
