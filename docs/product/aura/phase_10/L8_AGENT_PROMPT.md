# Phase 10 L8 — Agent Prompt

## Nombre exacto

Phase 10 L8 — Prueba de integración de exportación técnica 2.0

## Repo

casabero-labs/aura

## Modo de trabajo

Trabaja desde `main`.

Si typecheck, build, tests y greps pasan, debes hacer commit y push a `origin/main`.

No abras PR. No crees ramas salvo autorización explícita.

El orquestador revisará el commit publicado.

## Objetivo

Agregar una prueba de integración ligera para el flujo de exportación JSON técnica 2.0.

L7 agregó `validateAuraExportPackage` y lo integró en `App.tsx`, pero el riesgo abierto fue que no existe una prueba de navegador/interfaz que verifique que un preflight fallido cancela la descarga y muestra aviso controlado.

## Leer antes de modificar

- `docs/product/aura/phase_10/L7_EXPORT_PREFLIGHT_CLOSEOUT.md`
- `src/App.tsx`
- `src/services/exportContractValidation.ts`
- `src/__tests__/exportContractValidation.test.ts`
- `src/services/exportPackage.ts`
- `src/__tests__/exportPackage.test.ts`
- `src/__tests__/exportPackageSchema.test.ts`
- `src/package.json`

## Alcance

Crear una prueba focal que cubra el flujo:

1. Se intenta exportar JSON técnico.
2. El preflight devuelve fallo.
3. `downloadTextFile` no se ejecuta.
4. Aparece el aviso `export-json-preflight-warning`.
5. El error mostrado es controlado y no expone detalles internos crudos.

Preferencia técnica:

- Usar Vitest + Testing Library si se puede probar sin levantar Playwright.
- Usar Playwright solo si ya hay infraestructura e2e lista o si resulta más simple y estable.
- Evitar agregar dependencias nuevas.

## Recomendación de implementación

Opción preferida:

1. Crear test de integración en `src/__tests__/exportJsonPreflight.integration.test.tsx`.
2. Mockear `validateAuraExportPackage` para devolver `{ valid: false, errors: [...], warnings: [] }`.
3. Mockear/espíar `downloadTextFile` si está exportado o extraerlo mínimamente si hoy está embebido.
4. Renderizar el componente o una unidad testeable cercana al flujo de exportación.
5. Disparar el botón `JSON técnico`.
6. Verificar que el aviso aparece y la descarga no ocurre.

Si el acoplamiento de `App.tsx` impide un test limpio, crear una función pequeña testeable para coordinar:

```ts
runJsonExportPreflight({ package, validate, download })
```

pero no rediseñar la app.

## Archivos esperados

Modificar solo si hace falta:

- `src/App.tsx`
- `src/utils/download.ts` o equivalente si existe
- `docs/product/aura/NEXT_STEPS.md`

Crear:

- `src/__tests__/exportJsonPreflight.integration.test.tsx` o nombre equivalente
- `docs/product/aura/phase_10/L8_EXPORT_PREFLIGHT_INTEGRATION_CLOSEOUT.md`

## Restricciones

No tocar:

- `auditEngine`
- scoring determinista
- contratos v2
- freezes Phase 5-9
- `docs/tercera_entrega_aura/`
- schema L6, salvo necesidad estricta
- `evidenceManifest`, salvo necesidad estricta

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

Ejecutar además el test nuevo con su filtro exacto, por ejemplo:

```text
cd src && npm test -- --run exportJsonPreflight
```

Si usas Playwright, ejecutar:

```text
cd src && npm run test:e2e -- <filtro o archivo específico>
```

## Greps obligatorios

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ docs/product/aura/contracts || true
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

Criterio:

- `experiment` solo puede aparecer como deprecado, migración, test de ausencia o código experimental histórico.
- Claims prohibidos solo pueden aparecer en restricciones, tests o validadores.
- `calibrationEvidence` debe aparecer como bloque canónico o regla de validación.

## Git antes de commit

Reportar:

```text
git branch --show-current
git status --porcelain
git diff --name-status
```

## Commit y push

Si todo pasa:

```text
git add <archivos del loop>
git commit -m "test: cover export preflight failure flow"
git push origin main
```

Reportar SHA completo y estado final limpio/sincronizado.

## Definition of Done

- Existe prueba focal del fallo de preflight en flujo de exportación.
- Un preflight inválido no dispara descarga.
- La UI muestra aviso controlado.
- Tests previos de exportación siguen pasando.
- Typecheck y build pasan.
- Closeout L8 existe.
- No se tocaron restricciones duras.
- Commit y push hechos solo tras validaciones exitosas.
