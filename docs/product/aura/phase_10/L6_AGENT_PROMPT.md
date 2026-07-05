# Phase 10 L6 — Agent Prompt

## Modelo recomendado

DeepSeek Pro V4

## Repo

casabero-labs/aura

## Issue

Phase 10 L6 — JSON Schema formal para exportación técnica 2.0

## Nombre exacto del loop

Phase 10 L6 — JSON Schema formal para exportación técnica 2.0

## Modo de trabajo actualizado

Trabaja localmente partiendo de `main`.

Sí debes hacer commit y push al terminar si todas las validaciones pasan.
No abras PR.
No crees ramas salvo autorización explícita del usuario.

El orquestador revisará el commit publicado después del push.

## Objetivo

Publicar un JSON Schema independiente para el contrato `aura-technical-export` versión `2.0`, de modo que el paquete técnico exportado por AURA tenga una especificación externa, versionada y verificable.

L5 dejó el contrato protegido por TypeScript y tests, pero el riesgo abierto fue que todavía no existe un JSON Schema independiente. L6 debe cerrar ese riesgo sin modificar el motor de auditoría ni inflar claims.

## Contexto obligatorio

Antes de modificar, leer:

- `docs/product/aura/ORCHESTRATION_DIRECTIVES.md`
- `docs/product/aura/phase_10/L5_EXPORT_SCHEMA_CLOSEOUT.md`
- `docs/product/aura/phase_10/L5_AGENT_PROMPT.md`
- `src/services/exportPackage.ts`
- `src/__tests__/exportPackage.test.ts`
- `src/services/evidenceManifest.ts`
- `src/types.ts`

Estado actual:

- `buildAuraExportPackage` construye el JSON técnico.
- `exportContract.name` es `aura-technical-export`.
- `exportContract.version` es `2.0`.
- `calibrationEvidence` es bloque canónico.
- `experiment` solo aparece como bloque deprecado/migración.
- `legacyAliasIncluded` es `false`.
- No existe JSON Schema independiente.

## Problema a resolver

El contrato existe en código, pero falta una especificación JSON Schema que permita validar o documentar externamente el paquete exportado.

L6 debe crear ese schema sin convertirlo en promesa de producción general y sin preparar una entrega académica.

## Alcance funcional

1. Crear un JSON Schema para `aura-technical-export` versión `2.0`.
2. El schema debe exigir como mínimo:
   - `exportContract`;
   - `manifest`;
   - `profile`;
   - `diagnosis`;
   - `script`;
   - `calibrationEvidence`.
3. El schema debe validar que:
   - `exportContract.name` sea `aura-technical-export`;
   - `exportContract.version` sea `2.0`;
   - `exportContract.canonicalBlocks` incluya `calibrationEvidence`;
   - `exportContract.compatibility.legacyAliasIncluded` sea `false`;
   - `calibrationEvidence.classification` sea `experimental`;
   - `calibrationEvidence.summary.status` sea `none`, `attempted`, `preliminary` o `formal`.
4. Documentar que `experiment` está deprecado y no debe existir como bloque raíz canónico.
5. Agregar tests focales que validen el paquete generado contra el schema.
6. Crear closeout documental L6.
7. Actualizar `NEXT_STEPS.md` si es seguro hacerlo.

## Recomendación técnica

Preferir una implementación pequeña:

1. Crear schema en una ruta clara, por ejemplo:

```text
docs/product/aura/contracts/aura-technical-export.schema.json
```

2. Si el proyecto ya tiene una carpeta mejor para contratos, úsala.
3. Agregar un test que lea el schema y valide un paquete generado por `buildAuraExportPackage`.
4. Si no hay dependencia de validación JSON Schema instalada, preferir una validación estructural mínima en test sin agregar dependencias pesadas.
5. Si se agrega dependencia, justificarlo en el closeout y asegurar que no infle el build.
6. No modificar `buildEvidenceManifest` salvo que sea estrictamente necesario.
7. No modificar `auditEngine` ni scoring.

## Archivos esperados

Posibles archivos modificados:

- `src/__tests__/exportPackage.test.ts`
- `docs/product/aura/NEXT_STEPS.md`
- `package.json` y lockfile solo si se justifica una dependencia de schema validation

Archivos esperados a crear:

- `docs/product/aura/contracts/aura-technical-export.schema.json`
- `docs/product/aura/phase_10/L6_JSON_SCHEMA_CLOSEOUT.md`

Opcional si conviene:

- `src/services/exportPackageSchema.ts`
- `src/__tests__/exportPackageSchema.test.ts`

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

## Claims permitidos

- El export técnico tiene contrato TypeScript y JSON Schema independiente.
- `calibrationEvidence` es el bloque canónico de calibración experimental.
- `experiment` está documentado como reemplazado/deprecado.
- El schema ayuda a validar estructura, no resultados reales ni calidad de modelos.
- La exportación conserva límites metodológicos.

## Claims prohibidos

- El JSON Schema hace que AURA esté lista para producción general.
- El schema valida calidad o verdad de los resultados.
- `calibrationEvidence` identifica el mejor modelo universal.
- El export prueba un benchmark definitivo.
- La cuarta entrega ya empezó.

## Pruebas obligatorias

Ejecutar:

- `cd src && npm run typecheck`
- `cd src && npm run build`
- `cd src && npm test -- --run exportPackage`

Si creas un test nuevo de schema, ejecutar también su filtro exacto, por ejemplo:

- `cd src && npm test -- --run exportPackageSchema`

Si modificas `evidenceManifest`, ejecutar también:

- `cd src && npm test -- --run evidenceManifest`

## Greps obligatorios

Ejecutar:

- `grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true`
- `grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true`
- `grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true`
- `grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true`

Criterio:

- `experiment` solo puede aparecer como deprecado, migración o test de ausencia.
- Claims prohibidos solo pueden aparecer en restricciones, tests o validadores.
- `calibrationEvidence` debe aparecer como bloque canónico.

## Validaciones Git

Ejecutar:

- `git branch --show-current`
- `git status --porcelain`
- `git diff --name-status`

## Commit y push obligatorios si todo pasa

Si todas las validaciones pasan y no hay restricciones rotas:

1. `git add` de los archivos del loop.
2. Commit recomendado:

```text
feat: add JSON schema for technical export contract
```

3. Push a `origin/main`.
4. Reportar SHA completo del commit.
5. Reportar estado final limpio y sincronizado.

No hagas commit/push si typecheck o build fallan.

## Definition of Done

L6 queda listo si:

1. Existe JSON Schema independiente para `aura-technical-export` 2.0.
2. El schema exige `calibrationEvidence` como bloque canónico.
3. `experiment` queda documentado como deprecado/migrado, no como bloque raíz.
4. Hay prueba focal de schema o validación estructural equivalente.
5. Typecheck pasa.
6. Build pasa.
7. Tests focales pasan.
8. Closeout L6 existe.
9. No se tocó `auditEngine`.
10. No se tocó scoring determinista.
11. No se tocaron contratos v2.
12. No se tocaron freezes anteriores.
13. No se preparó cuarta entrega.
14. Se hizo commit y push solo después de validaciones exitosas.

## Reporte final obligatorio

Entregar:

- rama usada;
- archivos modificados;
- archivos creados;
- resumen funcional;
- ruta del JSON Schema;
- resultado exacto de typecheck;
- resultado exacto de build;
- resultado de tests específicos;
- salida exacta de `git status --porcelain` antes del commit;
- salida exacta de `git diff --name-status` antes del commit;
- resultado de greps obligatorios;
- SHA completo del commit;
- confirmación de push;
- estado final limpio/sincronizado;
- confirmación de no `auditEngine`;
- confirmación de no scoring;
- confirmación de no contratos v2;
- confirmación de no freezes anteriores;
- confirmación de no cuarta entrega;
- riesgos abiertos;
- recomendación: listo para revisión del orquestador o no listo.
