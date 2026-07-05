# Phase 10 L7 — Agent Prompt

## Nombre exacto

Phase 10 L7 — Preflight interno del paquete exportado 2.0

## Repo

casabero-labs/aura

## Modo de trabajo

Trabaja desde `main`.

Si typecheck, build, tests y greps pasan, debes hacer commit y push a `origin/main`.

No abras PR. No crees ramas salvo autorización explícita.

El orquestador revisará el commit publicado.

## Objetivo

Agregar una validación interna ligera del paquete técnico antes de exportar el JSON.

L6 creó el JSON Schema independiente para `aura-technical-export` versión `2.0`, pero `App.tsx` todavía descarga el paquete generado sin un preflight interno. L7 debe validar reglas críticas antes de la descarga.

## Leer antes de modificar

- `docs/product/aura/phase_10/L6_JSON_SCHEMA_CLOSEOUT.md`
- `docs/product/aura/contracts/aura-technical-export.schema.json`
- `src/services/exportPackage.ts`
- `src/__tests__/exportPackage.test.ts`
- `src/__tests__/exportPackageSchema.test.ts`
- `src/App.tsx`

## Alcance

Crear un validador interno, por ejemplo:

```text
src/services/exportContractValidation.ts
```

Debe exponer una función tipo:

```ts
validateAuraExportPackage(packageLike): {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

Debe verificar como mínimo:

- existe `exportContract`;
- `exportContract.name === 'aura-technical-export'`;
- `exportContract.version === '2.0'`;
- `exportContract.canonicalBlocks` contiene `calibrationEvidence`;
- `exportContract.compatibility.legacyAliasIncluded === false`;
- no existe bloque raíz `experiment`;
- existe `calibrationEvidence`;
- `calibrationEvidence.classification === 'experimental'`;
- `calibrationEvidence.summary.status` pertenece a `none`, `attempted`, `preliminary` o `formal`.

Integrar en `App.tsx` justo después de `buildAuraExportPackage` y antes de `downloadTextFile`.

Si el preflight falla, no descargar el JSON y mostrar/registrar una advertencia controlada. No lanzar errores crudos al usuario.

## Archivos esperados

Modificar:

- `src/App.tsx`
- `docs/product/aura/NEXT_STEPS.md`

Crear:

- `src/services/exportContractValidation.ts`
- `src/__tests__/exportContractValidation.test.ts`
- `docs/product/aura/phase_10/L7_EXPORT_PREFLIGHT_CLOSEOUT.md`

## Restricciones

No tocar:

- `auditEngine`
- scoring determinista
- contratos v2
- freezes Phase 5-9
- `docs/tercera_entrega_aura/`
- `evidenceManifest`, salvo necesidad estricta
- schema L6, salvo necesidad estricta

No declarar:

- sistema listo para producción general;
- benchmark definitivo;
- mejor modelo universal;
- inicio de cuarta entrega.

## Pruebas obligatorias

Ejecutar:

```text
cd src && npm run typecheck
cd src && npm run build
cd src && npm test -- --run exportPackage
cd src && npm test -- --run exportPackageSchema
cd src && npm test -- --run exportContractValidation
```

## Greps obligatorios

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

Criterio:

- `experiment` solo puede aparecer como deprecado, migración o test de ausencia.
- Claims prohibidos solo pueden aparecer en restricciones, tests o validadores.
- `calibrationEvidence` debe aparecer como bloque canónico o regla de validación.

## Git antes de commit

Ejecutar y reportar:

```text
git branch --show-current
git status --porcelain
git diff --name-status
```

## Commit y push

Si todo pasa:

```text
git add <archivos del loop>
git commit -m "feat: add export package preflight validation"
git push origin main
```

Reportar SHA completo y estado final limpio/sincronizado.

## Definition of Done

- Existe preflight interno.
- `App.tsx` lo usa antes de descargar JSON.
- Paquete inválido no se exporta silenciosamente.
- Tests focales pasan.
- Typecheck y build pasan.
- Closeout L7 existe.
- No se tocaron restricciones duras.
- Commit y push hechos solo tras validaciones exitosas.
