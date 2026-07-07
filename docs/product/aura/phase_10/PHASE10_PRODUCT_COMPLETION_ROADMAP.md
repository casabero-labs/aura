# Phase 10 — Roadmap de cierre funcional de AURA

## Naturaleza documental

Este documento pertenece a la bitácora viva de desarrollo de producto de AURA.

No forma parte de una entrega académica específica y no inicia una nueva entrega del TFM.

Su propósito es consolidar el camino técnico para llevar AURA a una versión local, demostrable, testeada, trazable y académicamente defendible.

## Decisión de alcance

AURA no se declara como sistema de producción general.

La meta de cierre funcional es:

> AURA estará lista cuando permita cargar un dataset CSV sintético o de prueba, perfilar su calidad, presentar un diagnóstico asistido o determinístico, ofrecer calibración experimental opcional dentro del pipeline, permitir continuar el flujo principal sin bloquear al usuario y exportar un paquete técnico `aura-technical-export` versión `2.0` validado, trazable y reproducible.

Esta definición prioriza una aplicación local y demostrable para defensa del TFM, no una plataforma multiusuario en producción.

## Definición de app funcional completa para el TFM

| Área | Condición de completitud |
|---|---|
| Entrada | El usuario puede cargar un CSV desde la UI. |
| Perfilamiento | AURA calcula estructura, columnas, filas, problemas y score del dataset. |
| Diagnóstico | AURA presenta explicación del estado del dataset con provider mock, local o Chrome AI según disponibilidad. |
| Calibración | El antiguo laboratorio aparece como opción informada dentro del pipeline principal. |
| Decisión humana | El usuario puede continuar, revisar, aprobar o saltar pasos sin bloqueo. |
| Exportación | AURA exporta JSON técnico bajo contrato `aura-technical-export` versión `2.0`. |
| Evidencia | El sistema registra dataset, diagnóstico, calibración, límites, validaciones y trazabilidad. |
| UX/UI | El flujo no presenta bloqueos visibles, overflow crítico ni botones principales inaccesibles. |
| Reproducibilidad | Tests focales, E2E, screenshots y `evidence.json` sostienen los claims técnicos. |
| Documentación | El TFM explica qué hace AURA, cómo se validó, qué evidencia existe y cuáles son sus límites. |

## Phase 10 como eje de producto

Phase 10 no es únicamente una cadena de tests de exportación.

Phase 10 tiene como eje:

> Integrar el antiguo laboratorio como opción informada dentro del flujo principal de AURA, sin convertirlo en requisito ni en promesa de benchmark formal.

Regla UX central:

- acción principal: `Continuar diagnóstico normal`;
- acción secundaria: `Activar comparación experimental`.

Los loops L5-L10 no sustituyen ese objetivo. Funcionan como armadura de evidencia alrededor de la integración: contrato, schema, preflight, exportación, navegador real y trazabilidad.

## Estado consolidado hasta L9

| Loop | Resultado |
|---|---|
| L2 | Se agregó estado `calibration`, opt-in después del perfilamiento y se retiró el laboratorio de la navegación principal. |
| L3 | `CalibrationEmbeddedPanel` quedó embebido dentro del pipeline y `BenchmarkLab` dejó de ser destino visible del opt-in. |
| L4 | La calibración se convirtió en evidencia defendible, clasificada como `none`, `attempted`, `preliminary` o `formal`, sin ranking absoluto. |
| L5 | Se estabilizó el contrato de exportación `aura-technical-export` versión `2.0`. |
| L6 | Se creó JSON Schema independiente para el contrato técnico. |
| L7 | Se añadió preflight interno antes de la descarga del JSON técnico. |
| L8 | Se validó el flujo de fallo de preflight en UI. |
| L9 | Se validó el contrato de exportación 2.0 con Playwright en navegador real, evidencia versionada, screenshots y fixture verificado. |

## Frentes pendientes para cierre funcional

### L10 — E2E flujo CSV desde UI hasta exportación 2.0

Objetivo:

Validar el flujo visible principal desde carga de CSV sintético hasta exportación técnica 2.0.

Debe demostrar:

1. AURA abre en Chromium con Playwright.
2. El CSV se carga desde la UI con `setInputFiles` o mecanismo equivalente.
3. El perfilamiento ocurre o queda trazado de forma verificable.
4. La capa de IA se estabiliza con provider mock/harness si es necesario.
5. El usuario llega a exportación técnica.
6. El JSON exportado cumple contrato `aura-technical-export` versión `2.0`.
7. `calibrationEvidence` existe como bloque raíz.
8. `experiment` no existe como bloque raíz.
9. El reporte exportado refleja el CSV cargado o el reporte derivado del CSV.
10. La evidencia queda en `docs/product/aura/phase_10/l10_evidence/`.

Condición de cierre:

> AURA puede recorrer un flujo principal verificable desde archivo CSV de prueba hasta evidencia técnica exportable.

### L11 — E2E de calibración embebida dentro del pipeline principal

Objetivo:

Validar el corazón original de Phase 10: el laboratorio/calibración ya no opera como habitación separada, sino como opción experimental dentro del pipeline principal.

Debe demostrar:

1. Después del perfilamiento aparece la opción de calibración.
2. La acción principal `Continuar diagnóstico normal` sigue disponible.
3. La acción secundaria `Activar comparación experimental` abre el panel embebido.
4. El flujo no navega al viejo `BenchmarkLab` como módulo principal.
5. La calibración registra un estado defendible: `none`, `attempted`, `preliminary` o `formal`.
6. La exportación refleja ese estado en `calibrationEvidence`.
7. No aparecen claims de benchmark definitivo, mejor modelo universal ni producción general.

Condición de cierre:

> El laboratorio queda validado como calibración experimental opcional integrada al flujo principal.

### L12 — Provider readiness y fallback UX

Objetivo:

Garantizar que AURA no dependa obligatoriamente de Gemini Nano, Chrome AI ni proveedores externos para ser usable.

Debe demostrar:

1. El sistema identifica modo de proveedor: mock, local, Chrome AI, unavailable o skipped.
2. Si `LanguageModel`/Chrome AI no está disponible, AURA no se rompe.
3. El usuario recibe una explicación clara del estado del proveedor.
4. El flujo puede continuar con diagnóstico determinístico o mock controlado.
5. El estado del proveedor queda registrado en evidencia/exportación cuando aplique.

Condición de cierre:

> AURA es funcional aun cuando el proveedor IA real no esté disponible.

### L13 — Auditoría UX/UI con Playwright

Objetivo:

Detectar bloqueos mecánicos o visuales en el flujo principal.

Debe revisar:

1. No hay errores críticos de consola durante el recorrido probado.
2. No hay overflow horizontal crítico.
3. Los botones principales están visibles.
4. Los botones principales son clickeables.
5. Las alertas importantes son visibles y comprensibles.
6. Los estados del pipeline son distinguibles.
7. La calibración no bloquea el camino normal.
8. La exportación es accesible.
9. Se generan screenshots por etapa.

Condición de cierre:

> El flujo principal no presenta bloqueos UI evidentes en el recorrido validado.

### L14 — Release Candidate local/demo

Objetivo:

Preparar una versión local demostrable para defensa y revisión.

Debe dejar:

1. Instrucciones claras de instalación y ejecución.
2. Dataset demo incluido o referenciado.
3. Comandos de validación documentados.
4. `npm run typecheck` en cero errores.
5. `npm run build` exitoso.
6. Tests focales pasando.
7. E2E principales pasando.
8. Guía de demo corta.
9. Export JSON demo generable.
10. Limitaciones visibles.

Condición de cierre:

> AURA puede ejecutarse localmente, demostrarse y validarse sin conocimiento implícito del equipo desarrollador.

### L15 — Freeze Phase 10

Objetivo:

Cerrar formalmente Phase 10 después de validar integración, flujo, providers, UX y release candidate local.

Debe consolidar:

1. L2-L4: integración de laboratorio/calibración.
2. L5-L8: contrato, schema y preflight.
3. L9-L10: E2E y flujo CSV → exportación.
4. L11: calibración embebida validada.
5. L12: provider readiness/fallback.
6. L13: UX/UI audit.
7. L14: release candidate local/demo.
8. Limpieza de `NEXT_STEPS.md`, removiendo frentes obsoletos.
9. Resumen de riesgos aceptados.
10. Lista de claims permitidos y prohibidos.

Condición de cierre:

> Phase 10 queda congelada como integración experimental opcional del laboratorio dentro del pipeline principal, con evidencia técnica reproducible y límites metodológicos explícitos.

## Orden recomendado

| Orden | Frente | Propósito |
|---|---|---|
| 1 | L10 | Flujo CSV desde UI hasta exportación 2.0. |
| 2 | L11 | Validar calibración embebida en pipeline principal. |
| 3 | L12 | Provider readiness y fallback cuando no haya IA real. |
| 4 | L13 | Auditoría UX/UI del flujo validado. |
| 5 | L14 | Release Candidate local/demo. |
| 6 | L15 | Freeze técnico de Phase 10. |

## Fuera de alcance para este cierre

No abrir todavía:

- autenticación de usuarios;
- roles multiusuario;
- base de datos persistente multiusuario;
- despliegue cloud formal;
- monitoreo productivo;
- corrección automática real de datasets sin revisión humana;
- benchmark formal definitivo entre modelos;
- selección del mejor modelo universal;
- integración pesada con servidores externos;
- preparación de una nueva entrega académica sin instrucción explícita.

Estas tareas pueden declararse como trabajo futuro si el TFM lo requiere.

## Claims permitidos

Se permite afirmar:

- AURA funciona como aplicación local demostrable dentro del alcance del TFM.
- AURA permite perfilar datasets CSV de prueba.
- AURA integra calibración experimental opcional dentro del pipeline principal.
- AURA exporta evidencia técnica bajo contrato `aura-technical-export` versión `2.0`.
- AURA cuenta con pruebas focales y E2E reproducibles para los flujos validados.
- AURA documenta límites metodológicos y estados de disponibilidad de proveedores.

## Claims prohibidos

No se debe afirmar:

- AURA está lista para producción general.
- AURA corrige datasets reales sin revisión humana.
- AURA ejecuta siempre Gemini Nano o Chrome AI.
- AURA ofrece un benchmark definitivo.
- AURA determina el mejor modelo universal.
- AURA ya inició una entrega académica futura.

## Criterio final de listo

AURA se considera lista para cierre funcional del TFM cuando se cumpla:

```text
CSV de prueba cargado desde UI
→ perfilamiento visible
→ diagnóstico asistido/determinístico
→ calibración experimental opcional dentro del pipeline
→ continuidad del flujo principal
→ exportación JSON técnico 2.0
→ evidencia versionada
→ UX sin bloqueos críticos
→ build, typecheck, Vitest y E2E principales pasando
→ documentación de límites y claims
```

## Nota de gobierno del desarrollo

Cada loop técnico debe:

1. trabajar en `main`;
2. no abrir PR ni ramas salvo instrucción explícita;
3. ejecutar validaciones antes de commit;
4. hacer commit y push solo si todo pasa;
5. dejar closeout claro;
6. no tocar `docs/tercera_entrega_aura/`;
7. no inflar claims;
8. distinguir desarrollo de producto de documentación académica.
