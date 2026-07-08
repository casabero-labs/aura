# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica quedó presentada, evaluada y archivada como histórica. No hay tercera entrega viva.

Este archivo define el siguiente frente operativo del producto. Cualquier agente debe consultar este documento antes de implementar nuevos loops.

## Estado actual

| Frente | Estado | Lectura correcta |
|---|---|---|
| Phase 5–9 | Cerradas/congeladas históricamente | No tocar salvo micro-fix documental autorizado |
| Phase 10 L13 | Cerrado | Diagnostic Report Pipeline estabilizado |
| L13H | Cerrado | Pipeline diagnóstico congelado |
| L14 Evidence Pack | Pausado | No iniciar hasta reorganizar UX/UI |
| Nuevo frente | **Activo** | UX/UI Main Flow Reorganization |

### Phase 10 L13 — Diagnostic Report Pipeline (cerrado)

Decisión de producto: el flujo principal de AURA debe cerrar en un perfil definitivo / informe diagnóstico, con PDF como salida principal. El perfil técnico base sigue ejecutándose antes del diagnóstico y alimenta al LLM, pero la generación de script, revisión HITL y reauditoría pasan a una rama opcional de remediación.

Plan base: `docs/product/aura/phase_10/L13_DIAGNOSTIC_REPORT_PIPELINE_PLAN.md`

| Loop | Foco | Estado |
|---|---|---|
| L13A Architecture | Documentar decisión, flujo observado, flujo propuesto, riesgos y criterios | Cerrado |
| L13B Report data model | Definir modelo interno de `DiagnosticReport` desde `AuditReport`, `auditEvidence` y diagnóstico asistido | Cerrado |
| L13C Pipeline state refactor | Agregar `diagnostic_report` y separar camino principal de remediación | Cerrado |
| L13D DiagnosticReportStep UI | Crear pantalla de perfil definitivo con acciones de exportación principal | Cerrado |
| L13E Professional PDF generator | Generar PDF diagnóstico profesional con gráficos reproducibles desde `DiagnosticReport.chartSpecs` | Cerrado |
| L13F Optional remediation branch | Convertir script, HITL y reauditoría en rama opcional | Cerrado |
| L13G Titanic E2E | Validar el flujo humano completo con fixture Titanic y exportes principales | Cerrado |
| L13H Freeze Diagnostic Pipeline | Congelar pipeline diagnóstico con documentación de freeze | Cerrado |

### Deuda técnica separada

- **Chrome AI / Gemini Nano E2E real**: queda como opt-in experimental separado. No es el foco técnico actual ni bloquea el flujo principal. Auditoría existente en `docs/product/aura/e2e/CHROME_AI_REAL_E2E_AUDIT.md`. Pendiente: corregir spec E2E para usar `connectOverCDP` en lugar de `launchPersistentContext`.

---

## Foco técnico actual — UX/UI Main Flow Reorganization

### Objetivo

Ordenar el flujo visible principal de AURA para que el usuario entienda qué hace cada etapa, cuál es la salida principal del sistema y qué elementos son opcionales.

### Flujo principal objetivo

```
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
```

Equivalente técnico:

```
upload → profile → diagnosis → diagnostic_report → export
```

### Ramas fuera del flujo principal

- **Calibración experimental**: Configuración/Lab avanzado.
- **Remediación opcional**: nace desde Reporte diagnóstico.
- **Revisión humana**: solo dentro de remediación.
- **Anexos de remediación**: solo aparecen en Exportación si existen.

Rama opcional equivalente técnico:

```
diagnostic_report → remediation/script → review → export anexos
```

Configuración avanzada:

```
settings/lab → calibration experimental
```

### Decisión central

AURA primero explica el dataset. Después, si el usuario lo decide, propone cómo mejorarlo.

---

## Ponderación de prioridades

| Prioridad | Frente | Peso | Motivo |
|---|---|---:|---|
| P0 | Ordenar flujo principal visible | 40% | Es la base de comprensión del usuario |
| P0 | Sacar calibración del camino principal | 20% | Evita confundir calibración con paso obligatorio |
| P0 | Corregir Diagnosis para llevar a Reporte, no a Script | 15% | Alinea la UI con diagnóstico como salida principal |
| P1 | Pulir Reporte diagnóstico como centro del producto | 10% | Refuerza la propuesta de valor |
| P1 | Reorganizar Exportación por paquetes | 10% | Clarifica qué se lleva el usuario |
| P2 | Rebrand de Script a Remediación opcional | 5% | Reduce sensación de obligatoriedad |

P0 bloquea Evidence Pack. P1 mejora claridad. P2 pule lenguaje y percepción.

---

## Decisión UX vigente

AURA no debe recolectar evidencia académica ni construir Evidence Pack mientras la interfaz principal siga mezclando pasos obligatorios, subflujos opcionales y herramientas experimentales.

La prioridad inmediata es ordenar la jerarquía de producto:

- el análisis principal termina en el reporte diagnóstico;
- la exportación principal no exige script;
- la remediación, HITL y scripts son rama opcional;
- la calibración experimental vive en configuración o laboratorio avanzado.

**Principio rector:**

> AURA primero explica el dataset. Después, si el usuario lo decide, propone cómo mejorarlo.

> AURA no obliga al usuario a limpiar el dataset. Primero produce un diagnóstico contextualizado y portable. La generación de scripts, revisión humana y reauditoría constituyen una rama opcional de remediación.

---

## Flujo UX objetivo

```
Carga
  → Perfil base
    → Diagnóstico
      → Reporte diagnóstico
        → Exportación

Desde Reporte diagnóstico:
  → Remediación opcional
    → Revisión humana
      → Exportación con anexos

Desde Configuración/Lab:
  → Calibración experimental
```

---

## Organización por pantalla

### 1. Upload / Carga

**Debe contener:**
- dropzone;
- validación CSV;
- privacidad local;
- estado de procesamiento;
- mensaje de que AURA no modifica el archivo original.

**No debe contener:**
- calibración;
- configuración IA;
- script;
- promesas de limpieza;
- explicaciones largas.

**Microcopy recomendado:**

> Carga un CSV para generar un perfil técnico local. AURA no modifica tu archivo original.

---

### 2. Profile / Perfil base

**Debe contener:**
- score base determinista;
- filas y columnas;
- tipos de datos;
- hallazgos prioritarios;
- evidencia técnica colapsada;
- CTA: *Interpretar hallazgos* / *Generar diagnóstico*.

**Cambios de lenguaje:**
- "Requiere limpieza" → "Requiere revisión".
- "Prioridades de limpieza" → "Hallazgos prioritarios".
- "Generar diagnóstico" puede mantenerse o evolucionar a "Interpretar hallazgos".

**No debe contener:**
- remediación;
- script;
- benchmark visible;
- calibración como paso obligatorio.

---

### 3. Diagnosis / Diagnóstico

**Debe contener:**
- resumen de entrada;
- proveedor activo compacto;
- botón generar diagnóstico;
- progreso;
- fallback determinista;
- resultado breve;
- CTA: *Continuar al reporte diagnóstico*.

**No debe contener:**
- botón "Continuar con script";
- PDF/JSON consolidado propios;
- configuración avanzada ocupando el flujo central;
- wizard de proveedor como protagonista del flujo.

**Configuración de proveedor:**

Debe moverse o reducirse a resumen compacto con enlace a Configuración.

---

### 4. Diagnostic Report / Reporte diagnóstico

**Debe contener:**
- resumen ejecutivo;
- score base;
- principios de gobernanza;
- riesgos confirmados;
- posibles falsos positivos;
- revisión humana requerida;
- recomendaciones;
- CTA principal: *Exportar informe diagnóstico*;
- CTA secundario: *Explorar remediación opcional*.

**Debe ser el centro del producto.**

**Debe dejar claro:**
- el score base no fue modificado por LLM;
- el diagnóstico contextualiza, no reemplaza evidencia;
- exportar no exige script;
- HITL solo aplica si se entra a remediación.

---

### 5. Export / Exportación

**Debe organizarse en tres bloques:**

1. **Informe principal:**
   - Informe diagnóstico PDF;
   - JSON técnico;
   - Hallazgos CSV.

2. **Anexos de remediación opcional:**
   - Script aprobado;
   - Notebook Colab;
   - Health Delta, si existe.

3. **Gestión de sesión:**
   - Cerrar y destruir sesión.

**Debe quedar claro:**

Los anexos opcionales solo están disponibles si se completó la rama opcional de remediación.

---

### 6. Remediación opcional

No es paso principal.

**Debe organizar:**
- revisar acciones sugeridas;
- aprobar/rechazar acciones;
- generar script;
- revisar script;
- aprobar;
- exportar anexos.

**Debe quedar claro:**
- no es obligatoria;
- no bloquea PDF;
- no bloquea exportación principal;
- HITL solo aplica aquí.

---

## L14 — UX/UI Main Flow Reorganization

| Loop | Nombre | Prioridad | Objetivo | Archivos probables | Estado |
|---|---|---|---|---|---|
| L14A | UX Flow Reorganization Spec | P0 | Documentar nuevo flujo, ramas opcionales y reglas UX antes de tocar código | `docs/product/aura/ux/L14A_MAIN_FLOW_REORGANIZATION_SPEC.md`, `NEXT_STEPS.md` | Siguiente |
| L14B | Main Stepper Simplification | P0 | Mostrar solo 5 pasos principales: Carga, Perfil base, Diagnóstico, Reporte, Exportación | `PipelineProgress.tsx`, `MainPipeline.tsx`, tests relacionados | Pendiente |
| L14C | Calibration to Settings/Lab | P0 | Sacar calibración del camino principal y dejarla como opción avanzada | `MainPipeline.tsx`, `App.tsx`, `CalibrationOptInExplainer.tsx`, `CalibrationEmbeddedPanel.tsx` | Pendiente |
| L14D | Profile Copy and Hierarchy Cleanup | P0 | Cambiar lenguaje de limpieza por lenguaje de hallazgos/revisión | `ProfileStep.tsx`, tests UI | Pendiente |
| L14E | Diagnosis UX Cleanup | P0 | Cambiar "Continuar con script" por "Continuar al reporte diagnóstico"; mover exportaciones viejas fuera de Diagnosis | `DiagnosisStep.tsx`, `DiagnosisHeroPanel.tsx` | Pendiente |
| L14F | Diagnostic Report Product Polish | P1 | Consolidar Reporte diagnóstico como centro del producto y ajustar CTAs | `DiagnosticReportStep.tsx`, componentes `diagnosticReport` | Pendiente |
| L14G | Export Package Layout | P1 | Separar exportación en Informe principal, Anexos opcionales y Gestión de sesión | `App.tsx`, export UI tests | Pendiente |
| L14H | Remediation Optional Rebrand | P2 | Renombrar visualmente Script opcional a Remediación opcional y ordenar subflujo | `ScriptGenerationStepV2.tsx`, `RemediationPlanStepV2.tsx`, `MainPipeline.tsx` | Pendiente |
| L14I | UX Regression E2E | P1 | Validar flujo principal limpio y rama opcional sin bloquear export | Playwright E2E | Pendiente |
| L14J | Freeze UX Main Flow | P0 | Congelar reorganización UX/UI y habilitar Evidence Pack solo después | FREEZE / closeout docs | Pendiente |

---

## Dependencias de avance

- L14A debe cerrarse antes de tocar código.
- L14B y L14E son bloqueantes para Evidence Pack.
- L14C es bloqueante porque calibración no debe seguir en el flujo principal.
- L14J habilita retomar Evidence Pack.
- Evidence Pack no debe iniciarse antes de L14J.

---

## Reglas operativas L14

- Trabajar en main solo cuando el usuario autorice implementación.
- No iniciar Evidence Pack.
- No preparar entrega académica.
- No declarar production-ready.
- No declarar benchmark definitivo.
- No decir modelo ganador.
- No decir que la calibración valida formalmente el diagnóstico.
- No hacer script obligatorio.
- No hacer HITL obligatorio para exportar el informe principal.
- No modificar score determinista.
- No modificar `runAudit`.
- No modificar contratos v2 salvo necesidad estricta.
- No tocar freezes Phase 5–9.
- No tocar documentación académica histórica.
- Mantener Chrome AI real como opt-in separado, no como bloqueo del flujo principal.

---

## Claims permitidos durante L14

- AURA está reorganizando su UX para reflejar que el reporte diagnóstico es la salida principal.
- La remediación es opcional.
- La calibración experimental será tratada como configuración avanzada.
- El informe diagnóstico se puede exportar sin script.
- El score base no es modificado por LLM.
- El diagnóstico contextualiza la evidencia determinista.

## Claims prohibidos durante L14

- No decir que AURA está lista para producción general.
- No decir que AURA corrige datasets automáticamente.
- No decir que el script es obligatorio.
- No decir que HITL es requisito para el reporte principal.
- No decir que la calibración es benchmark formal definitivo.
- No decir que existe modelo ganador universal.
- No decir que una nueva entrega académica está en preparación.
- No decir que Evidence Pack ya empezó.

---

## Estado documental

- Documento fuente de verdad: `docs/product/aura/CURRENT_STATE.md`
- Roadmap vivo: `docs/product/aura/ROADMAP.md`
- Tercera entrega: archivada en `docs/archive/academic/entrega_03_historica/`

NEXT_STEPS.md manda sobre el siguiente frente operativo inmediato. Si CURRENT_STATE.md o ROADMAP.md contradicen este plan, deben actualizarse en un loop posterior, no en este.

## Frontera académica

- Tercera entrega: presentada y evaluada positivamente.
- No existe una nueva entrega académica numerada.
- Objetivo académico futuro: depósito definitivo.
- No preparar entregas intermedias sin instrucción explícita.
- Evidence Pack queda pausado hasta finalizar L14J.
- No se debe recolectar evidencia académica sobre una UX desordenada.
- La prioridad es estabilizar producto, no redactar entrega.
