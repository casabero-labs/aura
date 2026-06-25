# Next steps — AURA

## Estado

Phase 3 está cerrada y congelada en `d3774dd5ac98d89ca4454c693b1b0a30856cd191`. No modificar su evidencia.

Phase 4 Loop 1R **completado** — pendiente de reauditoría.

## Loop 1R — Completado ✓

SHA: `9a8f5e0...` → `HEAD`

Entrega:
- Remediados 10 hallazgos de la revisión adversarial (1 Critical, 3 High, 4 Medium, 2 Low)
- `buildColumnReadExpression` y `buildColumnWriteTarget` con sintaxis Pandas válida
- `ReadonlyMapView` con inmutabilidad runtime verificada
- `buildColumnRegistryV2` con validación de `pythonLiteral` canónico
- `resolveScriptColumn` fail-closed (`context_invalid`)
- Tests: 78 passing (integración real con `buildColumnRegistry()`)
- Python `ast.parse`: PASS
- `buildColumnRegistry.ts` no fue modificado

## Siguiente tarea

**Reauditoría de Loop 1R.** No continuar con Loop 2 hasta que Loop 1R sea aprobado.

## Loops pendientes

| Loop | Título | Archivos |
|---|---|---|
| L2 | Renderer determinista | `scriptRendererV2.ts` |
| L3 | Builder + Finalizer | `scriptBuilderV2.ts` |
| L4 | Validator | `scriptValidatorV2.ts`, `scriptErrorCodes.ts` |
| L5 | UI | `ScriptGenerationStepV2.tsx`, etc. |
| L6 | E2E + capturas | `Phase4ScriptHarness.ts`, `fourth-delivery-evidence.spec.ts` |

## Regla

No implementar Loop 2 hasta que Loop 1R sea aprobado en reauditoría. No iniciar Phase 5 hasta congelar Phase 4.
