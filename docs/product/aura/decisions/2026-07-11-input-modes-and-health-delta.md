# Decisión de producto — Simplificar métodos de entrada y retirar Health Delta de la UI activa

**Fecha:** 2026-07-11
**Issue:** [#25](https://github.com/casabero-labs/aura/issues/25)
**Estado:** Aceptada · implementada en `main`
**Scope:** `src/components/SettingsPanel.tsx`, `src/App.tsx`, copy de usuario, `src/components/remediation/OptionalRemediationNotice.tsx`

## 1. Contexto y motivo

La Configuración de AURA exponía al usuario cinco modos de entrada con etiquetas internas (`smart_sample`, `recommended`, `enhanced_registry`, `copy_paste_bad_samples`, `prompt_libre`), dos de los cuales (`enhanced_registry`, `copy_paste_bad_samples`) eran técnicamente redundantes con `recommended`. La persona nueva no entendía qué evidencia recibiría el modelo ni por qué escoger una opción.

Al mismo tiempo, el módulo **Health Delta** se había retirado de hecho del recorrido activo del usuario (Phase 5–7), pero su UI seguía montada en `App.tsx` con dos entradas de navegación (desktop y móvil) y un copy que hablaba de "medir delta de salud". Mantener ese módulo visible contradecía la decisión de producto y creaba fricción cognitiva sin valor.

## 2. Decisión

1. **Reducir los métodos de entrada visibles a tres**, con nombres humanos, manteniendo intactos los valores internos formales (`prompt_libre`, `smart_sample`, `recommended`).
2. **Ocultar de la UI** los modos redundantes `enhanced_registry` y `copy_paste_bad_samples`.
3. **Migrar configuraciones antiguas** que aún conserven los dos modos redundantes, normalizándolas a `recommended` al abrir Configuración. No romper sesiones ni contratos de exportación.
4. **Retirar Health Delta de la interfaz activa**: importar, estado, botones de navegación (desktop y móvil), montaje y copy. Preservar el código histórico como evidencia y compatibilidad interna.
5. **Mantener la trazabilidad**: componentes, servicios, contratos, campos de sesión/exportación, tests históricos y documentación archivada no se eliminan.

## 3. Mapeo de nombres

| Nombre visible (nuevo) | Valor interno | Default | Recomendado |
|---|---|---|---|
| Contexto mínimo | `prompt_libre` | — | — |
| Evidencia equilibrada | `smart_sample` | sí | sí |
| Evidencia completa | `recommended` | — | — |

Valores retirados de la selección visible (siguen disponibles internamente para evidencia, exports y prompts):

- `enhanced_registry`
- `copy_paste_bad_samples`

## 4. Política de migración de configuraciones antiguas

Al abrir Configuración:

- Si `aiConfig.inputMode === 'enhanced_registry' || aiConfig.inputMode === 'copy_paste_bad_samples'`, se normaliza a `'recommended'` antes de hidratar `localConfig`.
- La normalización también se aplica en runtime si el estado recibe un valor legacy por otro camino (`useEffect` defensivo en `SettingsPanel.tsx`).
- Si el modo guardado es válido y actual (`prompt_libre` | `smart_sample` | `recommended`), se respeta tal cual.
- Si el modo guardado es `undefined` o cualquier valor desconocido, se usa `'smart_sample'` (default recomendado).
- El cambio se persiste solo cuando el usuario pulsa **Guardar configuración**. No se reescribe `localStorage` automáticamente.

No se migran exports ni sesiones históricas: los paquetes 2.0 exportados con campos `improvementRun`, `healthDelta` u `hitlDecision` siguen siendo válidos y reproducibles.

## 5. Health Delta retirado de la UI activa

Eliminado de la experiencia actual:

- Importación de `ImprovementRunPage` en `src/App.tsx`.
- Estado `showImprovementRun` y helper `goImprovementRun`.
- Botón **Health Delta** en la navegación de escritorio (`nav-center-menu`).
- Botón **Health Delta** en la navegación móvil (`nav-links`).
- Montaje de `ImprovementRunPage` desde `App.tsx`.
- Condiciones de ocultación de `main` y `footer` referidas a `showImprovementRun`.
- Copy "medir delta de salud" en `buildDeterministicPdfContent` y en `OptionalRemediationNotice.tsx`, reemplazado por lenguaje neutral: *"Reauditar el dataset después de una remediación y comparar los hallazgos antes/después."*

Preservado como compatibilidad interna (no se borra):

- `src/components/ImprovementRunPage.tsx`
- `src/components/ImprovementRunPanel.tsx`
- `src/components/ImprovementRunExportCard.tsx`
- `src/components/HealthDeltaDashboard.tsx`
- `src/services/improvementRunService.ts`, `improvementService.ts`, `reauditService.ts`
- Tipos `HealthDelta`, `ImprovementRun`, `HitlDecision` en `src/types.ts`
- Campos `improvementRun`, `healthDelta`, `hitlDecision` en el paquete de exportación
- `src/tests/e2e/phase7-claims-visible.spec.ts` y `phase8-boundary.spec.ts` (archivados como evidencia histórica de Phase 5–7)
- Documentación archivada de Phase 5–7

## 6. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `src/components/SettingsPanel.tsx` | `INPUT_MODE_OPTIONS` reescrito con tres entradas humanas + tarjetas comparativas. Sección renombrada a **Evidencia que recibe el modelo**. `migrateLegacyInputMode` aplicado en `useState` initializer y `useEffect` defensivo. |
| `src/App.tsx` | Sin import de `ImprovementRunPage`, sin `showImprovementRun`/`goImprovementRun`. Sin botones Health Delta (desktop/móvil). Copy neutral en PDF. |
| `src/components/remediation/OptionalRemediationNotice.tsx` | Copy neutral en la nota de remediación opcional. |

No se modificaron:

- `src/types.ts` — el tipo `InputMode` conserva los cinco valores por compatibilidad.
- `src/services/providers/prompts.ts` — los constructores de prompt siguen aceptando los cinco modos.
- `src/services/improvementRunService.ts`, `improvementService.ts`, `reauditService.ts`.
- Documentación archivada de Phase 5–7.

## 7. Tests focales ejecutados

- `src/__tests__/SettingsPanel.test.tsx` — sigue verde tras el refactor (tests existentes de Ollama model reconciliation).
- `src/__tests__/inputModes.test.ts` — sigue verde: los cinco modos siguen produciendo prompts distintos en el motor (`enhanced_registry` y `copy_paste_bad_samples` siguen disponibles internamente).

Nuevos assertions que se incorporaron al test de SettingsPanel en este commit:

- Configuración muestra exactamente las tres etiquetas humanas: **Contexto mínimo**, **Evidencia equilibrada**, **Evidencia completa**.
- Las etiquetas retiradas (`Registro extendido`, `Muestras problemáticas`, `Mínimo experimental`, `Smart sample`, `Completo`) no aparecen en el DOM de Configuración.
- `Evidencia equilibrada` (smart_sample) es el valor activo por defecto y exhibe la insignia `Recomendado`.
- Hidratar SettingsPanel con `inputMode: 'enhanced_registry'` deja el control activo en `Evidencia completa` (migración legacy → `recommended`).
- Hidratar SettingsPanel con `inputMode: 'copy_paste_bad_samples'` deja el control activo en `Evidencia completa` (migración legacy → `recommended`).
- El testid `evidence-modes-section` está presente y la sección se titula `Evidencia que recibe el modelo`.

## 8. Restricciones respetadas

- `OE4_INPUT_MODES` y el protocolo congelado no fueron modificados.
- No se borró documentación archivada.
- No se rompieron exports ni sesiones históricas (los campos `improvementRun`, `healthDelta`, `hitlDecision` siguen viajando en el paquete).
- No se creó rama ni PR.
- No se añadieron funcionalidades fuera de este alcance.

## 9. Definition of Done — verificado

- [x] Configuración muestra solo tres métodos con nombres humanos.
- [x] Los dos métodos redundantes no aparecen en la UI.
- [x] Configuraciones antiguas se migran sin romper la sesión.
- [x] Existe una guía comparativa clara, seleccionable y accesible (`role="radiogroup"`).
- [x] `Evidencia equilibrada` es la opción predeterminada y recomendada.
- [x] Health Delta no aparece en navegación desktop ni móvil.
- [x] `ImprovementRunPage` no se monta desde `App.tsx`.
- [x] La evidencia histórica no se elimina (componentes, servicios, contratos, docs, tests e2e archivados).
- [x] Documento de decisión creado.
- [x] Typecheck, build y tests focales verdes.
- [x] Un único commit sustancial a `main`.
