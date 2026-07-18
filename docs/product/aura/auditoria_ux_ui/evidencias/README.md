# Evidencias de la auditoría UX/UI

## Identificación

- **Fecha:** 18 de julio de 2026.
- **Commit observado:** `d9272a264fad2d2a33b9745908231f25c78cf4c9`.
- **Servidor:** Vite local en `http://127.0.0.1:3000/`.
- **Viewports:** `1440 × 900` y `390 × 844`.
- **Fixture:** `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv`.
- **Consola:** sin entradas `warning` o `error` durante el recorrido.

## Registro reproducible

| Evidencia | Secuencia | Resultado verificable | Hallazgos |
|---|---|---|---|
| `EV-01` | Home → Empezar auditoría | Se alcanza Carga de datos | Contexto de `FL-01` |
| `EV-02` | Cargar `README.md` | Mensaje: seleccionar archivo `.csv`; reintento disponible | Control de recuperación, sin hallazgo |
| `EV-03` | Cargar fixture válido | 6 filas, 4 columnas, 4 hallazgos, `60/100` | Base de `FL-02` y `FL-03` |
| `EV-04` | Perfil → Continuar al diagnóstico | Cloud no disponible; CTA asistida deshabilitada | `AURA-UX-001` |
| `EV-05` | Abrir Configurar desde Diagnóstico | Diálogo rápido con modelo y evidencia, sin selector de proveedor | `AURA-UX-001` |
| `EV-06` | Activar paso 4 del stepper | Informe determinista disponible | `AURA-UX-001` |
| `EV-07` | Revisar secciones del informe | 4 hallazgos; listas de 3 y 4 con elementos solapados | `AURA-UX-002` |
| `EV-08` | Informe a 390 px | Sin overflow; metadatos fragmentados y paso 4 fuera de vista inicial | `AURA-UI-001` |
| `EV-09` | Exportar → cerrar sesión | Overlay visible; foco detrás; sin rol dialog; cierre sin nombre; Escape no cierra | `AURA-A11Y-002` |
| `EV-10` | Ayuda → buscar error exacto | Sin resultados para `proveedor no disponible` | `AURA-CONTENT-001` |
| `EV-11` | Abrir Historial | Foco detrás del overlay; versión visible del 14 de julio | `AURA-A11Y-002`, `AURA-UI-002` |
| `EV-12` | Recargar a 390 px | Home visible con `scrollY = 180` | `AURA-UX-003` |
| `EV-13` | Menú móvil cerrado | Toggle sin nombre; seis controles del menú en árbol accesible | `AURA-A11Y-001` |
| `EV-14` | Comparar nav desktop/móvil | `Trazabilidad` solo en móvil | `AURA-IA-001` |
| `EV-15` | Abrir Laboratorio | Tres modelos Ollama detectados; experimento deshabilitado hasta preflight | Contexto de `AURA-UX-001` |
| `EV-16` | Abrir Configuración global | Selectores Chrome AI, Ollama y Cloud disponibles | Contexto de `AURA-UX-001` |

## Evidencia de código focal

- [`src/App.tsx`](../../../../../src/App.tsx): navegación, menú móvil y confirmación destructiva.
- [`src/components/MainPipeline.tsx`](../../../../../src/components/MainPipeline.tsx): estados y stepper del recorrido.
- [`src/components/DiagnosisStep.tsx`](../../../../../src/components/DiagnosisStep.tsx): indisponibilidad y configuración rápida.
- [`src/index.css`](../../../../../src/index.css): manifestación visual y responsiva.

## Integridad de la evidencia

No se conserva una captura binaria como prueba durable en este corte. Cada
evidencia anterior incluye secuencia y resultado para repetición. Las
limitaciones de captura, descarga y tecnología de asistencia están registradas
en [`../07_LIMITACIONES_Y_EVIDENCIA_FALTANTE.md`](../07_LIMITACIONES_Y_EVIDENCIA_FALTANTE.md).
