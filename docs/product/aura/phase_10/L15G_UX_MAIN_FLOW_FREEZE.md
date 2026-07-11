# Phase 10 L15G — Freeze UX Main Flow

> **Corte histórico, superado el 10 de julio de 2026.** La rama de calibración y
> el acceso al laboratorio que aparecen abajo fueron retirados del producto. Se
> conserva este documento únicamente como evidencia del estado en su SHA.

## Cierre documental del rediseño del flujo principal de AURA bajo progressive disclosure

- **Fecha de cierre**: 2026-07-07
- **Rama**: `main`
- **SHA de cierre**: `fe1b9b8`
- **Estado**: Congelado

---

## 1. Flujo principal congelado

```
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
```

| Paso | Etiqueta del stepper | Propósito |
|---|---|---|
| **Carga** | Carga | Ingreso del dataset mediante archivo CSV. Validación de privacidad y procesamiento local en el navegador. |
| **Perfil base** | Perfil base | Análisis determinista inicial. Score de calidad, hallazgos por reglas explícitas, heurísticas y estadística descriptiva. Evidencia reproducible. |
| **Diagnóstico** | Diagnóstico | Interpretación asistida. El LLM contextualiza los hallazgos del perfil base y genera una lectura estructurada. Terminal visible durante ejecución. |
| **Reporte diagnóstico** | Reporte diagnóstico | Informe profesional legible y trazable. Resumen ejecutivo, riesgos confirmados, falsos positivos, revisión humana, gobernanza, gráficos y recomendaciones. |
| **Exportación** | Exportación | Paquete final de entregables. Informe PDF, JSON técnico de gobernanza, CSV de hallazgos, anexos de remediación si existen y cierre seguro de sesión. |

---

## 2. Ramas fuera del flujo principal

Estos estados existen técnicamente pero **no son pasos del riel principal**:

| Estado | Dónde vive | Cómo se alcanza |
|---|---|---|
| **Calibración experimental** | Configuración / Laboratorio avanzado | Menú "Laboratorio" o harness `__PHASE3_SET_STATE__('calibration')` |
| **Remediación opcional (Script)** | Rama desde Reporte diagnóstico | Botón secundario "Configurar remediación opcional (Script / Limpieza)" |
| **Revisión humana (HITL)** | Dentro de la rama de remediación | Solo tras generar y aprobar un script |
| **Anexos de remediación** | Bloque condicional en Exportación | Solo visibles si `approvedCleaningScript` o `healthDelta` existen |

No deben volver al stepper principal salvo decisión formal posterior.

---

## 3. Resumen de loops L15A–L15F

| Loop | Commit | Propósito | Resultado |
|---|---|---|---|
| **L15A** | `bcafd82` | Progressive disclosure en Diagnóstico | Hero limpio, summary strip, terminal durante ejecución, disclosure "Datos técnicos y auditoría del diagnóstico", CTA hacia Reporte |
| **L15A hotfix** | `fc0d36d` | Un solo CTA primario después del diagnóstico | Hero muestra "Regenerar" como `btn-s` cuando existe diagnóstico; `progressTimer` limpiado en `finally` |
| **L15B** | `9081c5d` | Progressive disclosure en Perfil base | Hero con eyebrow "PERFIL BASE", summary strip, distribución de severidad visible, columnas más afectadas, CTA "Continuar al diagnóstico →" |
| **L15C** | `1b7e551` | Reporte profesional | Summary strip, governance HITL, findings con top-3 + "Ver más", disclosure "Evidencia técnica del reporte" (metadatos, chart specs JSON, informe completo) |
| **L15C hotfix** | `1810bc4` | Polish editorial | Título "Informe diagnóstico de calidad del dato", remediation actions "Volver al reporte diagnóstico" y "Ir a Exportación", notice actualizada |
| **L15D** | `8394ebb` | Stepper de 5 pasos + "Nuevo análisis" | PipelineProgress reducido a 5 pasos con index badges; branch badge para calibration/script/review. `handleNewAnalysis()` con confirm + clearPipelineSession + reset completo |
| **L15E** | `044564e` | Exportación como paquete final | 4 bloques visuales: Informe principal, Anexos (condicional), Evidencia técnica (collapsed), Gestión de sesión. Delivery cards con ícono, descripción y botón |
| **L15F** | `fe1b9b8` | QA visual responsive | Reglas responsive a 768px y 640px para los nuevos componentes (summary strips, stepper badges, delivery cards, disclosures). Sin cambios de texto ni lógica |

---

## 4. Decisiones UX congeladas

1. **Progressive disclosure** como patrón base en todas las pantallas del flujo principal.
2. **Un solo CTA primario** por pantalla. Las acciones secundarias usan `btn-s`.
3. **Detalles técnicos colapsados por defecto** (disclosures, no modales, no en la vista principal).
4. **Calibración experimental fuera del flujo principal**. No es un paso del stepper. Se alcanza desde el menú "Laboratorio".
5. **Script/Remediación como rama opcional**. El usuario puede exportar el informe diagnóstico sin generar script ni pasar por revisión humana.
6. **Exportación como cierre natural del flujo**. El informe PDF es el protagonista; los anexos de remediación solo aparecen si existen.
7. **"Nuevo análisis" limpia la sesión real** (clearPipelineSession + INITIAL_PIPELINE_DATA) en lugar de recargar la página con `window.location.reload()`.
8. **Evidencia técnica visible solo cuando aporta trazabilidad**. Los metadatos, hashes, chart specs JSON y el informe completo van dentro de disclosures cerrados por defecto.
9. **No usar lenguaje absoluto**. Quedan prohibidos: "perfil definitivo", "diagnóstico definitivo", "precisión total", "corrección garantizada", "script obligatorio", "IA cognitiva", "Benchmark formal". Ver sección 6.

---

## 5. Terminología oficial

### Términos aprobados

| Término | Contexto de uso |
|---|---|
| **Carga** | Paso 1 del stepper. Upload de CSV. |
| **Perfil base** | Paso 2 del stepper. Análisis determinista. |
| **Diagnóstico asistido** | Paso 3 del stepper. Interpretación LLM + motor determinista. |
| **Reporte diagnóstico** | Paso 4 del stepper. Informe profesional consolidado. |
| **Informe diagnóstico de calidad del dato** | Título del hero del Reporte diagnóstico. |
| **Exportación** | Paso 5 del stepper. Paquete final de entregables. |
| **Remediación opcional** | Rama desde Reporte diagnóstico. Script / limpieza. |
| **Revisión humana** | Dentro de la rama de remediación. HITL. |
| **Evidencia técnica** | Término genérico para disclosures de trazabilidad. |
| **Trazabilidad** | Hashes, fingerprints, metadata de auditoría. |
| **Gobernanza** | Principios, claims y limitaciones del informe. |
| **Laboratorio / Calibración experimental** | Badge del stepper en estado `calibration`. |

### Términos prohibidos

| Término prohibido | Razón |
|---|---|
| perfil definitivo | Implica carácter final absoluto |
| exportación principal | Ya consolidado como "Exportación" |
| diagnóstico definitivo | Implica verdad final |
| precisión total | Claim no respaldado |
| corrección garantizada | Claim no respaldado |
| script obligatorio | La remediación es opcional |
| IA cognitiva | Fuera del scope técnico de AURA |
| Benchmark formal | No aplica a calibración experimental |
| Continuar con script | El CTA principal va a Reporte, no a Script |
| Generar script recomendado | Reemplazado por "Configurar remediación opcional (Script / Limpieza)" |

Estos términos pueden aparecer en tests defensivos solo si el test valida explícitamente que son términos prohibidos (ej. `providerOptIn.test.ts`).

---

## 6. Estado de validaciones acumuladas

| Validación | Resultado en cada loop L15A–L15F |
|---|---|
| `npx tsc --noEmit` | **exit 0** en todos los loops |
| `npx vite build` | **exit 0** en todos los loops |
| `npx vitest run` | **78 files / 1508 passed / 6 skipped** (consistente desde L15D) |
| E2E Playwright | No ejecutado en sandbox por falta de dev server/harness activo. Pendiente para CI real. |

---

## 7. Deuda pendiente

1. **Ejecutar Playwright en CI/local real** con `VITE_PHASE3_E2E_HARNESS=true` para validar el flujo completo Carga → Perfil → Diagnóstico → Reporte → Exportación.
2. **Generar screenshots reales** del flujo completo en 1440px, 1024px, 768px y 390px. Guardar en `docs/product/aura/phase_10/l15f_visual_qa/screenshots/`.
3. **Revisar tema claro y oscuro** en todas las pantallas del flujo principal.
4. **Decidir futuro de `calibration`** como estado técnico fuera del flujo principal. El componente `CalibrationOptInExplainer` sigue en MainPipeline pero ya no es alcanzable desde el flujo principal (solo vía harness).
5. **Evaluar si se requiere una pantalla dedicada** de Configuración / Laboratorio avanzado para calibración experimental.
6. **Revisar visualmente Exportación** con y sin anexos de remediación (el bloque 2 muestra estado vacío cuando no hay `approvedCleaningScript`).
7. **Validar flujo "Nuevo análisis"** en navegador real después de cerrar sesión (confirm → clearPipelineSession → reset → pantalla inicial).

---

## 8. Criterio de congelamiento

A partir de L15G, el flujo principal UX de AURA queda congelado como:

```
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
```

Cualquier cambio que reincorpore Calibración, Script o Revisión como pasos principales del stepper debe justificarse mediante una nueva decisión de producto y documentarse explícitamente. Las ramas secundarias (calibración experimental, remediación opcional, revisión humana) permanecen funcionales pero no compiten visualmente con el flujo principal.

---

## 9. Próximos pasos recomendados

1. **CI real Playwright** — ejecutar la suite completa de e2e con harness activo y validar todos los selectores actualizados.
2. **Screenshot evidence pack** — capturar el flujo en 4 resoluciones y ambos temas para documentación visual.
3. **Freeze visual con capturas** — complementar este documento con evidencia gráfica del flujo congelado.
4. **Revisión académica del flujo** — preparar la narrativa de producto para el TFM usando el flujo congelado como base.
5. **Cierre de deuda de calibración** — decidir si se mueve a un módulo independiente o se elimina del pipeline principal.
6. **No iniciar nuevos loops de UX** hasta que la deuda documentada haya sido revisada y aceptada.

---

## 10. SHA de cierre

El repositorio queda en `fe1b9b8` al cierre de este freeze.

Stack L15 completo:

| Commit | Loop | Descripción |
|---|---|---|
| `bcafd82` | L15A | Diagnosis progressive disclosure |
| `fc0d36d` | L15A hotfix | CTA único + timer cleanup |
| `9081c5d` | L15B | Profile progressive disclosure |
| `1b7e551` | L15C | Diagnostic Report layout |
| `1810bc4` | L15C hotfix | Editorial polish |
| `8394ebb` | L15D | Stepper 5 pasos + Nuevo análisis |
| `044564e` | L15E | Export progressive disclosure |
| `fe1b9b8` | L15F | Visual QA responsive |
