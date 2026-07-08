# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica quedó presentada, evaluada y archivada como histórica. No hay tercera entrega viva.

Este archivo define el siguiente frente operativo del producto. Cualquier agente debe consultar este documento antes de implementar nuevos loops.

---

## Análisis de Fricción UX/UI del Estado Actual

Tras analizar la base de código actual (`MainPipeline.tsx`, `App.tsx`, `PipelineProgress.tsx` y los componentes de pantalla), se identifican los siguientes problemas de sobrecarga cognitiva y diseño que motivan este rediseño:

1. **Pipeline Stepper Lineal y Saturado (8 Pasos)**:
   - *Fricción*: `PipelineProgress.tsx` y `MainPipeline.tsx` muestran un flujo de 8 pasos como si todos fueran obligatorios y secuenciales (`upload → profile → calibration → diagnosis → diagnostic_report → script → review → export`).
   - *Impacto*: El usuario siente que la calibración experimental (paso 3) y la remediación con scripts/revisión HITL (pasos 6 y 7) son requisitos obligatorios para obtener el reporte. Además, al saltarse la remediación, el stepper marca los pasos intermedios como completados ("done") falsamente debido a su lógica de comparación de índices puramente lineal.
2. **Responsabilidad de Exportación Fragmentada**:
   - *Fricción*: `MainPipeline.tsx` maneja los estados de la UI del paso 1 al 7, pero el paso final de `export` es renderizado por `App.tsx` al evaluar `pipelineState === 'export'`.
   - *Impacto*: Falta de cohesión de código y saltos visuales bruscos al final del pipeline. La lógica de generación y descarga de paquetes debe vivir dentro de la secuencia lógica del pipeline.
3. **Exposición Prematura de Acciones en Footer**:
   - *Fricción*: Los botones de exportación consolidada y el botón destructivo "Cerrar sesión y destruir datos" están en el footer de `App.tsx`, haciéndose visibles desde la pantalla de carga del CSV.
   - *Impacto*: Confunde la línea temporal del usuario, permitiendo descargas vacías o clics en destrucción de sesión antes de iniciar el análisis.
4. **Sobrecarga de Datos Técnicos en Perfil de Calidad**:
   - *Fricción*: `ProfileStep.tsx` muestra de entrada metadatos técnicos crudos (estimación de memoria, encoding) y prioridades de remediación con lenguaje imperativo de limpieza ("Prioridades de limpieza").
   - *Impacto*: El usuario no técnico se siente abrumado. Hay parálisis de decisión al presentar dos CTAs equivalentes: "Calibrar calidad IA" y "Generar diagnóstico".
5. **Desviaciones en Diagnóstico y Calibración**:
   - *Fricción*: En `DiagnosisStep.tsx`, el botón "Continuar con script" compite directamente con "Continuar al reporte", lo que desvía la atención del verdadero entregable final (el reporte de gobernanza). En la calibración, se muestran métricas avanzadas de investigación académica (F1-score, Exact Match, Precision, Recall) sin la debida abstracción para usuarios de negocio.

---

## Estado actual del desarrollo

| Frente | Estado | Lectura correcta |
|---|---|---|
| Phase 5–9 | Cerradas/congeladas históricamente | No tocar salvo micro-fix documental autorizado |
| Phase 10 L13 | Cerrado | Diagnostic Report Pipeline estabilizado |
| L13H | Cerrado | Pipeline diagnóstico congelado |
| L14 Evidence Pack | Pausado | No iniciar hasta reorganizar UX/UI |
| UX/UI Main Flow (L15A-L15F) | Cerrado | Freeze: `phase_10/L15G_UX_MAIN_FLOW_FREEZE.md` |

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

## Principios de Diseño UX/UI (Progressive Disclosure & Simplicity)

Para resolver la sobrecarga de información y guiar al usuario de manera intuitiva, se aplicarán los siguientes principios de diseño en todo el flujo:

1. **Revelación Progresiva (Progressive Disclosure)**:
   - La pantalla mostrará por defecto únicamente el **80% de la información clave** que el usuario necesita para avanzar y entender el estado de su archivo.
   - El **20% restante (detalles técnicos, explicaciones matemáticas, configuraciones avanzadas o logs raw)** se mantendrá oculto tras interacciones secundarias explícitas (paneles colapsables con transiciones suaves, tooltips de ayuda contextual, botones de pestañas o drawers deslizantes).
2. **Jerarquía Visual Clara mediante Layouts Limpios**:
   - Mayor contraste tipográfico y uso de tamaños y pesos visuales para priorizar los títulos y los Scores principales.
   - Agrupación por contenedores visuales con bordes sutiles y fondos tipo *glassmorphism* (en lugar de listas interminables y textos planos).
3. **Eliminación de la Tensión de Decisión (Fewer CTAs)**:
   - Cada pantalla tendrá **un único CTA primario prominente** (botón lleno, color de acento).
   - Acciones secundarias como volver atrás o configurar opciones avanzadas usarán estilos visualmente más ligeros (botones con bordes, enlaces o botones de texto).

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

*Propósito Visual*: Foco absoluto en la carga del archivo con feedback inmediato de seguridad y privacidad local.

* **Siempre Visible (Flujo Principal)**:
  * Dropzone central con diseño limpio (bordes punteados, icono de carga animado al hover).
  * Mensaje de privacidad de alta visibilidad: *"Procesamiento 100% local. Tus datos no salen de tu navegador."*
  * Microcopy destacado: *"Carga un CSV para generar un perfil técnico local. AURA no modifica tu archivo original."*
  * Formatos y límites compactos: `.csv · Max 50MB`.
* **Revelación Progresiva (Details-on-Demand)**:
  * Pequeño acordeón informativo al pie: *"¿Cómo procesa AURA tus datos?"*. Al expandirse de manera fluida, explica de forma compacta el parseo local con PapaParse y la auditoría determinista en memoria del navegador.
* **Layout & Composición**:
  * Diseño de tarjeta centralizada con fondo ligeramente translúcido sobre el gradiente de la aplicación.
* **Lo que se elimina/mueve de esta pantalla**:
  * Sin enlaces a configuraciones de IA ni opciones de calibración.

---

### 2. Profile / Perfil base

*Propósito Visual*: Ofrecer un diagnóstico numérico determinista inmediato de la calidad del dataset y listar las áreas críticas que requieren atención, sin abrumar con código ni formatos internos.

* **Siempre Visible (Flujo Principal)**:
  * **Score de Calidad Determinista**: Representado mediante un gráfico de dona estilizado (verde para alta calidad, amarillo para regular, rojo para baja) que muestra el puntaje (0-100%).
  * **Ficha de Datos Limpia**: Bloques visuales simples con: Filas, Columnas, Tipos de datos detectados (ej. *3 de Texto, 2 Numéricos, 1 Fecha*).
  * **Hallazgos Prioritarios**: Tarjetas resumidas agrupadas por severidad (Crítico, Medio, Bajo). Cada tarjeta muestra el nombre del hallazgo (ej. *Valores faltantes*) y el número de registros o columnas afectadas.
  * **CTA Primario**: Botón principal destacado con el texto: *"Interpretar hallazgos →"* (conduce a Diagnóstico).
  * **CTA Secundario**: Botón de texto simple *"← Cargar otro archivo"* a la izquierda.
* **Revelación Progresiva (Details-on-Demand)**:
  * **Ficha Técnica Avanzada**: Detalles como el tamaño estimado de memoria y el tipo de codificación (encoding) se ocultan dentro de un tooltip de información junto a la Ficha de Datos.
  * **Detalle del Hallazgo (Drawer o Acordeón)**: Al hacer clic en una tarjeta de hallazgo prioritario, se despliega un panel lateral o acordeón con la descripción detallada del problema, las columnas específicas afectadas y ejemplos de filas inválidas.
* **Layout & Composición**:
  * Layout de dos columnas en pantallas medianas/grandes: columna izquierda para el Score y Ficha de Datos; columna derecha para la lista de Hallazgos Prioritarios.
* **Lo que se elimina/mueve de esta pantalla**:
  * Se elimina el botón "Calibrar calidad IA →" del flujo de navegación inferior.
  * Se elimina cualquier referencia a scripts de remediación o sugerencias imperativas de limpieza de datos en este punto.

---

### 3. Diagnosis / Diagnóstico

*Propósito Visual*: Configurar y ejecutar el análisis asistido por LLM de forma controlada y transparente.

* **Siempre Visible (Flujo Principal)**:
  * **Resumen del Dataset**: Pequeña tira horizontal con el nombre del archivo, filas y número de hallazgos para contextualizar.
  * **Proveedor Activo (Compacto)**: Fila con el logo o nombre del modelo seleccionado (ej. *Google Gemini 1.5 Flash*) y un enlace discreto *"Cambiar configuración"* en estilo botón de texto.
  * **Acción de Ejecución**: Botón central prominente *"🔍 Generar Diagnóstico Asistido"*.
  * **Pantalla de Progreso**: Durante el análisis, se muestra una barra de carga acompañada de un *log* de eventos de procesamiento humano-legible (ej. *Preparando smart sample...*, *Consultando proveedor cognitivo...*).
  * **CTA de Navegación (Post-ejecución)**: Botón principal *"Continuar al reporte diagnóstico →"* una vez terminado el análisis.
* **Revelación Progresiva (Details-on-Demand)**:
  * **Smart Sample Explainer**: Explicación de cómo AURA selecciona una muestra inteligente representativa y la anonimiza. Se coloca bajo un tooltip interactivo junto al título de "Muestra de análisis".
  * **Métricas de Rendimiento y Prompt Raw**: Tiempo de respuesta exacto y tokens consumidos se colocan en letra pequeña al pie del resultado. El prompt exacto enviado al LLM y la respuesta JSON cruda se mueven dentro de una sección colapsable al final titulada *"Datos de auditoría y diagnóstico para desarrolladores"*.
* **Lo que se elimina/mueve de esta pantalla**:
  * Se elimina por completo el botón "Continuar con script →".
  * Se eliminan los botones inline para exportar PDF o JSON en este paso (se posponen para la pantalla final de Exportación).

---

### 4. Diagnostic Report / Reporte diagnóstico

*Propósito Visual*: El centro absoluto del producto AURA. Presenta las conclusiones interpretadas por el LLM respaldadas por el motor determinista de forma legible y procesable.

* **Siempre Visible (Flujo Principal)**:
  * **Resumen Ejecutivo**: Una síntesis de 2-3 párrafos generada por el LLM sobre el estado del dataset.
  * **Visualización de Calidad**: Gráficos interactivos limpios que muestran la distribución de problemas por columna y por tipo de regla.
  * **Secciones Clave del Reporte**:
    1. *Riesgos Confirmados*: Problemas reales detectados con su impacto de negocio.
    2. *Posibles Falsos Positivos*: Alertas automáticas que la IA sugiere descartar tras analizar el contexto semántico.
    3. *Puntos de Revisión Humana*: Elementos ambiguos que requieren supervisión directa.
  * **Gobernanza y Responsabilidad**: Declaración de que la IA asiste pero el control final es humano (HITL).
  * **CTAs de Navegación**:
    * **CTA Primario**: Botón grande *"Ir a la Exportación →"* (lleva a la pantalla final de Exportar).
    * **CTA Secundario**: Enlace estilizado *"Configurar remediación opcional (Script / Limpieza)"* para los usuarios que deseen generar herramientas de código para mejorar el dataset.
* **Revelación Progresiva (Details-on-Demand)**:
  * **Principios de Gobernanza**: Los principios metodológicos de AURA (Factualidad, Reproducibilidad) se muestran como iconos interactivos que revelan su texto completo al hacer hover o clic.
  * **Datos de Respaldo por Riesgo**: Al hacer clic en un riesgo confirmado, se expande la evidencia exacta generada por la Capa 1 (filas afectadas, columnas y regla infringida).
* **Layout & Compositions**:
  * Pestañas superiores (Tabs) para separar las vistas: `[Vista General (Texto)]` y `[Análisis Gráfico (Métricas)]`. Esto evita que los gráficos empujen el texto del reporte hacia abajo de la pantalla, manteniendo la lectura limpia.
* **Lo que se elimina/mueve de esta pantalla**:
  * Se eliminan los botones de exportación individual directamente de los bloques de contenido para centralizar la acción en el siguiente paso.

---

### 5. Export / Exportación

*Propósito Visual*: Proveer al usuario de un paquete organizado de entregables estructurados, libre de distracciones, y cerrar de forma segura la sesión local de datos.

* **Siempre Visible (Flujo Principal)**:
  * **Bloque 1: Informe Principal (Siempre Disponible)**:
    * Botón de descarga para el **Reporte Diagnóstico PDF** (diseño corporativo, incluye gráficos y conclusiones).
    * Botón de descarga para el **JSON Técnico de Gobernanza** (ideal para integraciones y trazabilidad).
    * Botón de descarga para los **Hallazgos Críticos en CSV**.
  * **Bloque 2: Gestión de Sesión (Separado visualmente)**:
    * Botón destacado en color de advertencia (rojo sutil/bordeado) para *"Cerrar sesión y destruir datos locales"*, con aviso de que los datos no se guardan en el servidor.
* **Revelación Progresiva (Details-on-Demand / Condicional)**:
  * **Bloque 3: Anexos de Remediación Opcional (Condicional)**:
    * Si el usuario optó por seguir la rama de remediación y generó un script, este bloque se vuelve visible de forma elegante mostrando la descarga del **Script de Limpieza (.py/Pandas)** y el **Notebook de Colab interactivo**.
  * **Manifiesto de Evidencia Estructurada**: Un acordeón técnico al pie titulado *"Ver metadatos de trazabilidad y criptografía (Evidencia Capa 1)"* que muestra los hashes de los archivos y los registros de ejecución.
* **Layout & Composición**:
  * Distribución en tarjetas independientes (Cards) para separar claramente el "Informe de Calidad" de los "Anexos de Remediación" y de las "Acciones de Control de Datos" (Destrucción de sesión).
* **Lo que se elimina/mueve de esta pantalla**:
  * No hay CTAs para volver a procesar archivos en la misma pantalla sin antes pasar por la destrucción de sesión o un reinicio explícito del pipeline.

---

### 6. Remediación Opcional (Rama de Remediación)

*Propósito Visual*: Ofrecer herramientas interactivas de código y edición para aquellos usuarios que decidan corregir su dataset basándose en el reporte, garantizando que el usuario tenga control total sobre las modificaciones (Human-in-the-loop).

* **Siempre Visible (Flujo Principal)**:
  * **Plan de Acción Sugerido**: Lista de acciones correctivas propuestas por el LLM basadas en el reporte diagnóstico (ej. *Imputar nulos en la columna Edad usando la media*).
  * **Control Humano (HITL)**: Casillas de verificación o interruptores (toggle switches) individuales para **Aprobar / Rechazar** cada acción propuesta antes de codificarla.
  * **Generador de Código**: Botón central *"Generar Script de Remediación"* que crea el código Pandas correspondiente solo para las acciones aprobadas.
  * **Visor del Script**: Área de código con resaltado de sintaxis que muestra el script generado.
  * **CTAs de Navegación**:
    * Botón principal *"Aprobar y continuar a la Exportación →"* (retorna al flujo principal en el paso de Exportar, activando los Anexos).
    * Botón secundario *"← Cancelar y volver al reporte"* en la parte superior.
* **Revelación Progresiva (Details-on-Demand)**:
  * **Explicación del Código**: Un pequeño texto explicativo en lenguaje natural de lo que hace cada función de Pandas dentro del script, colapsado por defecto bajo un enlace *"Ver explicación de la lógica del script"*.
  * **Validación de Código (Preflight)**: Resultados del análisis estático del script (comprobación de sintaxis y seguridad) mostrados en un panel colapsable de estado técnico.
* **Lo que se elimina/mueve de esta pantalla**:
  * Se elimina cualquier lenguaje que indique que el script es obligatorio para terminar la sesión de AURA.

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
