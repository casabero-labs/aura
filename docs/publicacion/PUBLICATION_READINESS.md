# Publicación de AURA

Estado: **no publicar todavía**.

## Limpieza aplicada

- Licencia Apache-2.0 agregada para el código fuente propio.
- `NOTICE` agregado para separar código, datasets, evidencias y marca.
- Artefactos `.playwright-mcp/` retirados del tracking y agregados a `.gitignore`.
- `repomix-output.xml`, logs y temporales quedan ignorados como artefactos generados.
- Dependencias revisadas en `src`, `api`, `experiments`, `tools/evidence` y `.opencode`.
- `src/.env.local` local eliminado del workspace; la ruta ya está ignorada por Git.

## Evidencia 2026-07-01

- `npm audit --audit-level=high`: 0 vulnerabilidades en paquetes revisados.
- `npm run typecheck` en `src`: OK.
- `npm run build` en `src`: OK.
- `gitleaks dir . --redact=100`: OK en árbol actual.
- `gitleaks detect --source . --redact=100`: falla por historia Git en `.playwright-mcp/console-2026-06-15T19-48-57-073Z.log`, línea 12, commits `8d6fe579` y `6e1cee5c`.
- `npm test` en `src`: 1133 tests pasan y 6 quedan skip, pero Vitest reporta error de worker en `src/__tests__/scriptGenerationStepV2.test.tsx`; requiere estabilización antes de publicar.

## Gate pendiente antes de hacerlo público

1. Rotar cualquier token que haya aparecido en logs históricos.
2. Reescribir historia o crear repositorio público limpio sin los commits contaminados.
3. Confirmar que datasets y evidencias públicas son sintéticas o tienen permiso/licencia.
4. Estabilizar `src/__tests__/scriptGenerationStepV2.test.tsx` bajo Vitest 4.
5. Ejecutar Gitleaks desde un clon limpio después de la reescritura/higiene final.

## Regla operativa

No cambiar visibilidad del repositorio hasta que los cinco puntos anteriores estén cerrados.
