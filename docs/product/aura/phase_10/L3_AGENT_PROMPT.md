# Phase 10 L3 — Agent Prompt

## Modelo recomendado

DeepSeek Pro V4

## Repo

casabero-labs/aura

## Nombre exacto del loop

Phase 10 L3 — Experiencia embebida de calibración

## Modo de trabajo

Trabaja localmente partiendo de `main`.

No hagas commit.
No hagas push.
No abras PR.
No crees ramas salvo autorización explícita del usuario.

## Objetivo

Reemplazar la apertura de `BenchmarkLab` como pantalla separada por una experiencia embebida dentro del paso `calibration` del pipeline principal.

La calibración debe seguir siendo opcional, experimental y secundaria. El flujo normal debe poder continuar sin calibración.

## Contexto obligatorio

Antes de modificar, leer:

- `docs/product/aura/phase_10/L2_AGENT_ORCHESTRATION.md`
- `docs/product/aura/phase_10/L2_INTEGRATION_CLOSEOUT.md`
- `docs/product/aura/phase_10/L2_PUBLICATION_ADDENDUM.md`
- `docs/product/aura/phase_10/L3_PRIORITY_ADDENDUM.md`

Estado actual:

- `MainPipeline.tsx` ya tiene estado `calibration`.
- `ProfileStep.onContinue` ya envía a `calibration`.
- `CalibrationOptInExplainer` aparece después de perfilamiento.
- La acción primaria continúa a `diagnosis`.
- La acción secundaria llama `onOpenLab?.()` y abre `BenchmarkLab` como pantalla separada.
- `Laboratorio` ya no aparece en navegación principal ni Home.
- `BenchmarkLab` sigue existiendo internamente.

## Problema a resolver

L2 integró el opt-in, pero todavía genera una salida lateral: al activar comparación experimental, el usuario abandona el flujo principal y entra en `BenchmarkLab` como pantalla separada.

L3 debe mantener al usuario dentro del paso `calibration`.

## Alcance funcional

1. Crear o integrar un panel embebido de calibración dentro de `calibration`.
2. Evitar que el botón `Activar comparación experimental` abra `BenchmarkLab` como pantalla completa.
3. Mantener visible y prioritaria la acción `Continuar diagnóstico normal`.
4. Permitir que el usuario ejecute o prepare comparación experimental desde el propio paso.
5. Guardar resultados de calibración en `benchmarkResults` o una estructura equivalente ya existente.
6. Permitir volver o continuar a diagnóstico sin perder el flujo.
7. Mantener `BenchmarkLab` disponible internamente, pero no como destino principal.

## Recomendación técnica

Preferir una implementación incremental:

1. Crear `src/components/calibration/CalibrationEmbeddedPanel.tsx`.
2. Integrarlo desde `MainPipeline.tsx` dentro del estado `calibration`.
3. Mantener `CalibrationOptInExplainer` como pantalla inicial del paso.
4. Al hacer opt-in, mostrar `CalibrationEmbeddedPanel` en el mismo paso.
5. No portar todo `BenchmarkLab` si eso infla el cambio.
6. Si la lógica completa de benchmark no es segura de reutilizar, crear un panel controlado que documente estado `planned` o `preliminary` y prepare la integración para L4.

## UX requerida

El paso `calibration` debe tener dos capas:

1. Explicación opt-in:
   - qué hace;
   - qué no hace;
   - continuar diagnóstico normal;
   - activar comparación experimental.

2. Panel embebido si el usuario acepta:
   - estado experimental;
   - opciones mínimas;
   - resultados si existen;
   - botón para continuar diagnóstico normal;
   - botón para cerrar calibración y volver a la explicación.

No saturar con métricas.
No venderlo como benchmark formal.
No hablar de ganador universal.

## Archivos esperados

Posibles archivos modificados:

- `src/components/MainPipeline.tsx`
- `src/components/calibration/CalibrationOptInExplainer.tsx`
- `src/App.tsx` solo si hace falta retirar `onOpenLab` del flujo principal
- `docs/product/aura/NEXT_STEPS.md` si se puede actualizar de forma segura

Archivos esperados a crear:

- `src/components/calibration/CalibrationEmbeddedPanel.tsx`
- `docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md`

Tests recomendados si la infraestructura lo permite:

- `src/components/calibration/CalibrationEmbeddedPanel.test.tsx`
- test mínimo para que `CalibrationOptInExplainer` active panel embebido sin llamar navegación externa

## Restricciones duras

No tocar:

- `auditEngine`
- scoring
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

- La calibración experimental queda embebida dentro del flujo principal.
- El usuario puede continuar diagnóstico normal sin calibración.
- La comparación experimental sigue siendo opt-in.
- Los resultados, si existen, son preliminares salvo clasificación formal.
- `BenchmarkLab` se conserva internamente durante la transición.

## Claims prohibidos

- AURA está lista para producción general.
- Existe benchmark formal definitivo.
- La calibración decide el mejor modelo universal.
- La calibración corrige datasets.
- Proveedores reales siempre están disponibles.
- Chrome AI o Gemini Nano se validan en E2E estándar.
- La cuarta entrega ya empezó.

## Pruebas obligatorias

Ejecutar:

- `cd src && npm run typecheck`
- `cd src && npm run build`

Si existen o se crean tests relevantes, ejecutar también:

- `cd src && npm test -- --run CalibrationEmbeddedPanel`
- `cd src && npm test -- --run calibration`
- `cd src && npm test -- --run MainPipeline`

Si no existen tests específicos, reportarlo explícitamente.

## Greps obligatorios

Ejecutar:

- `grep -R "Abrir laboratorio" src/App.tsx src/components || true`
- `grep -R "Laboratorio" src/App.tsx src/components || true`
- `grep -R "mejor modelo\|benchmark definitivo\|modelo ganador universal\|validación formal\|production-ready" src docs/product/aura/phase_10 || true`

Criterio:

- `Laboratorio` no debe reaparecer como navegación principal.
- Claims prohibidos solo pueden aparecer en advertencias, restricciones o claims prohibidos.

## Validaciones Git

Ejecutar:

- `git branch --show-current`
- `git status --porcelain`
- `git diff --name-status`

No ejecutar commit ni push.

## Definition of Done

L3 queda listo para revisión si:

1. El usuario puede activar calibración sin salir del pipeline principal.
2. `onOpenLab` deja de ser el camino principal del botón de opt-in.
3. La acción primaria `Continuar diagnóstico normal` sigue funcionando.
4. El panel embebido comunica límites y estado experimental.
5. `BenchmarkLab` no fue eliminado.
6. `Laboratorio` no reaparece en navegación ni Home.
7. Typecheck pasa.
8. Build pasa.
9. El closeout L3 existe.
10. No se hizo commit.
11. No se hizo push.

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
