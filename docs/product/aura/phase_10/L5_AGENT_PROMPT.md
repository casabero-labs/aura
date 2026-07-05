# Phase 10 L5 — Agent Prompt

## Modelo recomendado

DeepSeek Pro V4

## Repo

casabero-labs/aura

## Nombre exacto del loop

Phase 10 L5 — Contrato estable de exportación y compatibilidad JSON

## Modo de trabajo

Trabaja localmente partiendo de `main`.

No hagas commit.
No hagas push.
No abras PR.
No crees ramas salvo autorización explícita del usuario.

## Objetivo

Estabilizar el contrato del JSON exportado después de Phase 10 L4, incorporando metadatos de versión, compatibilidad y migración para que `calibrationEvidence` sea defendible sin romper silenciosamente consumidores que esperaban el bloque heredado `experiment`.

L4 hizo correcta la evidencia de calibración, pero dejó un riesgo abierto: consumidores externos del JSON heredado deben migrar al bloque `calibrationEvidence`. L5 debe convertir ese riesgo en un contrato explícito y testeable.

## Contexto obligatorio

Antes de modificar, leer:

- `docs/product/aura/ORCHESTRATION_DIRECTIVES.md`
- `docs/product/aura/phase_10/L4_CALIBRATION_EVIDENCE_CLOSEOUT.md`
- `docs/product/aura/phase_10/L4_AGENT_PROMPT.md`
- `docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md`

Estado actual:

- `buildEvidenceManifest` ya produce `calibrationSummary`.
- `EvidenceManifest` ya incluye `calibrationSummary`.
- `AllowedClaims` usa `calibrationEvidence`.
- `App.tsx` exporta un JSON técnico con bloque `calibrationEvidence`.
- El bloque heredado `experiment` fue reemplazado.
- No existe un test específico para `handleExportJson`.
- El closeout L4 reconoce como riesgo que consumidores del JSON heredado deberán migrar.

## Problema a resolver

El JSON exportado necesita una forma explícita de decir:

1. qué versión de contrato usa;
2. qué bloques son canónicos;
3. qué bloques fueron reemplazados;
4. cómo debe migrar un consumidor externo;
5. que `calibrationEvidence` no representa benchmark definitivo ni ranking universal.

## Alcance funcional

1. Añadir metadatos de contrato al JSON exportado, por ejemplo:

```ts
exportContract: {
  name: 'aura-technical-export',
  version: '2.0',
  generatedAt: string,
  canonicalBlocks: ['manifest', 'profile', 'diagnosis', 'script', 'calibrationEvidence'],
  deprecatedBlocks: [{ from: 'experiment', to: 'calibrationEvidence', reason: '...' }],
}
```

2. Mantener `calibrationEvidence` como bloque canónico.
3. Decidir si se incluye un alias legacy mínimo para `experiment`:
   - preferencia: no reintroducirlo si no hay consumidor interno que lo requiera;
   - alternativa aceptable: incluir un bloque `legacy` o `compatibility` explícitamente marcado como deprecated, nunca un `experiment` silencioso.
4. Extraer la construcción del JSON a una función pura testeable si el cambio en `App.tsx` empieza a crecer.
5. Agregar tests focales para verificar:
   - existe `exportContract.version`;
   - `calibrationEvidence` es canónico;
   - `experiment` no reaparece como bloque silencioso;
   - la migración `experiment → calibrationEvidence` queda documentada;
   - no se incluyen claims de benchmark definitivo.
6. Crear closeout documental L5.

## Recomendación técnica

Preferir una implementación pequeña y testeable:

1. Crear `src/services/exportPackage.ts` con una función pura, por ejemplo:

```ts
export const buildAuraExportPackage = (params) => ({ ... })
```

2. Mover allí la estructura JSON que hoy se arma dentro de `handleExportJson`.
3. Hacer que `App.tsx` solo invoque el helper y descargue el resultado.
4. Crear `src/__tests__/exportPackage.test.ts` o equivalente.
5. Mantener el manifest como fuente de verdad para `calibrationSummary`.
6. No crear un schema complejo si no hace falta; basta con un contrato estable, legible y validado por tests.

## Archivos esperados

Posibles archivos modificados:

- `src/App.tsx`
- `src/types.ts` solo si se define un tipo mínimo para el contrato de exportación
- `docs/product/aura/NEXT_STEPS.md` si se puede actualizar de forma segura

Archivos esperados a crear:

- `src/services/exportPackage.ts`
- `src/__tests__/exportPackage.test.ts`
- `docs/product/aura/phase_10/L5_EXPORT_SCHEMA_CLOSEOUT.md`

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

- El JSON exportado tiene un contrato versionado.
- `calibrationEvidence` es el bloque canónico para resultados experimentales de calibración.
- El bloque heredado `experiment` fue reemplazado de forma explícita y trazable.
- La compatibilidad se documenta sin vender la calibración como benchmark formal.
- La exportación conserva evidencia y límites metodológicos.

## Claims prohibidos

- El export JSON prueba un benchmark definitivo.
- `calibrationEvidence` identifica el mejor modelo universal.
- Un resultado preliminar prueba superioridad.
- La calibración corrige datasets.
- AURA está lista para producción general.
- La cuarta entrega ya empezó.

## Pruebas obligatorias

Ejecutar:

- `cd src && npm run typecheck`
- `cd src && npm run build`

Si se crea `exportPackage`, ejecutar:

- `cd src && npm test -- --run exportPackage`

Si se toca `evidenceManifest`, ejecutar también:

- `cd src && npm test -- --run evidenceManifest`

Si no existen tests específicos, reportarlo explícitamente.

## Greps obligatorios

Ejecutar:

- `grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 || true`
- `grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ || true`
- `grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ || true`
- `grep -R "cuarta entrega" src docs/product/aura/phase_10 || true`

Criterio:

- `experiment` solo puede aparecer como referencia de compatibilidad/deprecación, no como bloque canónico silencioso.
- Claims prohibidos solo pueden aparecer en restricciones, tests o validadores.
- `calibrationEvidence` debe aparecer como bloque canónico en exportación.

## Validaciones Git

Ejecutar:

- `git branch --show-current`
- `git status --porcelain`
- `git diff --name-status`

No ejecutar commit ni push.

## Definition of Done

L5 queda listo para revisión si:

1. El JSON exportado tiene contrato/versionado explícito.
2. `calibrationEvidence` queda como bloque canónico.
3. La migración desde `experiment` queda documentada en el propio export o en metadatos de compatibilidad.
4. `experiment` no reaparece como bloque canónico silencioso.
5. Existe test focal de exportación o se justifica con precisión su ausencia.
6. Typecheck pasa.
7. Build pasa.
8. Closeout L5 existe.
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
