# P1-04 — Claridad UX, trazabilidad visible y exportaciones

**Commit base**: `055bbeec3f25ee5737c9e36e9eda19886d4ab266`
**Commit final**: `26bfb588afb9e97f869dc2d87c9d3a9c75792c47`
**Fecha**: 2026-07-12

## Objetivo

Dejar AURA preparada para que el usuario instale/verifique los modelos, ejecute
smokes reales y realice la intervención humana, sin ejecutar la campaña formal.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/App.tsx` | Diálogo de confirmación para nueva sesión y destruir sesión; descripciones de exportación; nota de validez |
| `src/components/DiagnosticReportStep.tsx` | Nuevo `DiagnosticInvocationSummary` con modelo, método, latencia, cumplimiento, claims, sintaxis, ejecución, reauditoría |
| `src/components/DiagnosisStep.tsx` | `CopyHash` con botón de copiar; hashes completos visibles; campos extendidos del recibo de ejecución; nota de integridad |
| `src/components/SettingsPanel.tsx` | Resumen de privacidad (local/externo); indicador de disponibilidad; enlaces a avanzada y laboratorio |
| `src/index.css` | Estilos para summary grid, hash display, diálogos modales, botón destructivo, descripciones de exportación |
| `src/tests/e2e/oe4-p1-04-ux.spec.ts` | E2E: terminología, cancelar/confirmar nueva sesión |

## Decisiones UX

1. **Reporte**: `syntaxValid: null` se muestra como "No medido". Las métricas se agrupan en tarjetas (modelo, método, cumplimiento, claims, script, ejecución).
2. **Trazabilidad**: Cada hash truncado tiene botón "Copiar" que copia el hash completo. Se añadió nota de que el recibo es evidencia de integridad local, no firma digital.
3. **Configuración**: Se añadió resumen de privacidad que indica qué información permanece local y qué sale del dispositivo según el proveedor.
4. **Terminología**: "Laboratorio", "experimento", "corrida" unificados en toda la interfaz visible. "Campaña" solo en tipos internos.
5. **Nueva sesión**: `window.confirm()` reemplazado por diálogo modal con descripción de qué se elimina, qué se conserva, y aviso de irreversibilidad.
6. **Exportaciones**: Cada botón incluye descripción del contenido, propósito y disponibilidad.

## Pruebas ejecutadas

| Suite | Resultado |
|---|---|
| `npm run typecheck` | 0 errores |
| `npm run build` | OK |
| `npm test -- --run` | 1744 passed, 6 skipped (103 files) |
| Playwright `oe4-final-evaluation.spec.ts` | 1 passed |
| Playwright `oe4-p1-04-ux.spec.ts` | 3 passed (terminología, cancelar, confirmar) |
| `graphify update .` | OK |

## Confirmaciones

- [x] No se ejecutaron modelos reales
- [x] No se iniciaron smokes (1×3×1, 3×1×1)
- [x] No se inició la campaña de 45 diagnósticos
- [x] No hubo intervención humana (selección, aprobación, rúbrica)
- [x] No se modificaron métricas, scoring, protocolo ni contratos centrales
- [x] No se implementó firma digital

## Riesgos abiertos

- La vista de trazabilidad muestra hashes del recibo de ejecución Python solo cuando `execution` está presente en el run; si no hay ejecución externa, esos campos no se renderizan.
- El diálogo de nueva sesión es un componente inline en App.tsx; si la app crece, debería extraerse.

## Siguiente paso

Instalar/verificar los tres modelos Ollama, ejecutar smoke 1×3×1, luego 3×1×1. Detenerse si cualquiera falla.

## Addendum P1-04R1 — Cierre adversarial

- Recibo LLM y recibo Python diferenciados en UI.
- ExecutionEvidencePanel muestra todos los campos del recibo Python.
- DiagnosticInvocationSummary no convierte ausencia en cero.
- E2E: 6 escenarios (reporte sin evidencia, pre-recibo, post-recibo, clipboard, exportaciones, no-auto-ejecución).
- Gates de campaña restaurados en NEXT_STEPS.
- Validaciones ejecutadas localmente: 1744 tests, typecheck, build, 4 E2E → verde.
- No se usaron modelos reales.
