# Baseline INVALIDATED — Commit 4f1a211

## Motivo

La evaluacion v3 usaba normalizaciones agresivas (lowercase, NFD, collapse whitespace, trim) para citas y reglas, no usaba AST para extraccion de acciones ni para validar sintaxis Python, y el runner tenia rutas absolutas. El usuario detecto que el harness no es equivalente al flujo productivo real (ScriptGenerationStep.tsx).

## Problemas concretos

1. Runner no equivalente a ScriptGenerationStep — no maneja el fallback exacto del summary LLM como `operativeBrief`.
2. `summary.text` se recorta con `.trim()` pero no se respeta el camino real (solo se usa si truthy).
3. Acciones extraidas por regex sobre `df['col']` en lugar de AST (`ast.parse` + `ast.walk`).
4. `automaticActions` solo evaluaba una accion esperada (trim_whitespace) en vez de todas.
5. `unsafeActionCount` y `unsafeActionRate` no diferenciaban count vs rate real.
6. Citas usaban `norm()` (lowercase + NFD + collapse spaces + trim) — pierde espacios finales y diacriticos originales.
7. Reglas inventadas por regex sobre `Regla X` sin validacion estructurada.
8. Python validado por regex de `def clean_dataset`, no por `ast.parse`.
9. No se exigia `df_clean = df.copy()` ni `return df_clean`.
10. `protocol.json` tenia `commitSha: "main"` (placeholder).
11. `generate-real-audit.mjs` tenia rutas absolutas hardcodeadas.
12. Tests reimplementaban `norm()` y helpers en lugar de importar funciones reales del evaluador.

## Correccion en Fase 0D

Ver: `../baseline/` para el baseline corregido con:
1. Runner equivalente a `ScriptGenerationStep.generateScript`
2. `summary.text` usado cuando es truthy post-`trim()`, con fallback a `buildDiagnosisScriptBrief`
3. Extraccion AST con asociacion por columna e issue
4. TP/FP/FN sobre TODAS las acciones AUTOMATIZABLE
5. `unsafeActionCount` real + `unsafeActionRate = count/totalProposed`
6. Citas char-by-char sin trim ni colapso
7. Deteccion estructurada de reglas (comentarios `# AURA: regla=` + JSON `rule` fields)
8. `ast.parse` para validacion Python
9. `df_clean = df.copy()` + `return df_clean` requeridos
10. Protocol + manifest con full git SHA
11. Sin rutas absolutas
12. Tests que importan funciones reales del evaluador