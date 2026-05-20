---
version: "1.1"
name: AURA
description: Interfaz Warm Core con variante Terminal + Archive para auditoria reproducible de calidad del dato, diagnostico asistido por LLM y benchmark experimental.
source_of_truth:
  standards_repo: "/Users/casabero/Documents/GitHub/estandar-casabero"
  primary_reference: "/Users/casabero/Documents/GitHub/estandar-casabero/examples/frontend/showcase.html"
  required_frontend_docs:
    - "standards/frontend/UX_UI_MANIFESTO.md"
    - "standards/frontend/VARIANTS.md"
    - "standards/frontend/DESIGN_SYSTEM.md"
    - "standards/frontend/ACCESSIBILITY.md"
    - "standards/frontend/STATE.md"
variant: "Terminal + Archive"
colors:
  ink: "#1E1E1C"
  ink2: "#4A4540"
  ink3: "#9A9490"
  ink-soft: "#3A3632"
  ink-muted: "#8A857E"
  ink-faint: "#B5B0A8"
  bg: "#FAF8F4"
  surface: "#F5F1E8"
  surface-raised: "#F0ECE2"
  surface-hover: "#EBE6DB"
  border: "rgba(30,30,28,0.1)"
  border-strong: "rgba(30,30,28,0.18)"
  border-faint: "rgba(30,30,28,0.05)"
typography:
  font-heading: "Playfair Display"
  font-body: Inter
  font-mono: "JetBrains Mono"
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
components:
  shell: "Header sticky, main centrado, secciones de trabajo sin landing comercial"
  upload: "Dropzone tecnico con alternativa de seleccion y estado visible"
  profile: "Bloques Archive para caracterizacion, reglas y evidencia"
  diagnosis: "Panel cognitivo amplio con tablas legibles y contrato visible"
  lab: "Banco experimental con protocolo, runner, log, matriz y graficas"
  drawer: "Sheet lateral sin modal flotante para configuracion"
  feedback: "Logs, barras, etiquetas y texto; nunca solo color"
---

# Overview

AURA usa como fuente de verdad el repositorio `estandar-casabero` y, para esta interfaz, el archivo `examples/frontend/showcase.html`. La aplicacion debe sentirse como un instrumento tecnico de auditoria: clara, trazable y sobria. La variante elegida es **Terminal + Archive** porque el producto combina evidencia reproducible, logs, contratos, matrices y resultados experimentales.

# Colors

La identidad visual usa Warm Core: parchment, linen y off-black. El color frio solo aparece como utilidad tecnica en codigo, logs o graficas, no como identidad ni decoracion. Los estados se expresan con texto, borde, icono, peso visual y movimiento sutil; nunca solo por color.

# Typography

Titulos editoriales con `Playfair Display`. Inter para UI, labels y lectura continua. `JetBrains Mono` para fingerprints, logs, contratos, JSON, metricas y evidencia reproducible.

# Spacing

El contenido operativo se centra en un ancho legible. Las secciones se agrupan por responsabilidad: carga, perfil, reglas, hallazgos, diagnostico, script, revision y laboratorio. Se evita repetir informacion en bloques dispersos.

# Elevation

La profundidad se resuelve con `surface + border`. No usar glassmorphism, blur, gradientes decorativos ni sombras pesadas. Los paneles deben parecer documentos tecnicos, no tarjetas de marketing.

# Shapes

Botones 6px, inputs 8px, cards/paneles 10-12px y drawers 16px. No usar botones tipo pill salvo toggles o controles nativos donde aplique.

# Components

- `sys-nav`: header sticky sobrio, sin blur.
- `file-drop`: entrada local-first con estado y alternativa de teclado.
- `profile-block`: agrupacion Archive del perfil determinista.
- `advisor-shell`: lectura amplia del diagnostico LLM.
- `settings-sheet`: drawer lateral para modelos y contrato tecnico.
- `benchmark-lab-page`: banco experimental con protocolo, logs, tabla y metricas.

# Dos and Donts

Do:

- Usar `estandar-casabero/examples/frontend/showcase.html` como referencia visual primaria.
- Mantener Warm Core y Lucide con `stroke-width: 1.5px`.
- Separar determinismo, cognicion, script, HITL y benchmark.
- Mostrar progreso/logs cuando una operacion tarda.
- Preferir tablas anchas con scroll horizontal antes que columnas truncadas.

Dont:

- No usar el path antiguo `casabero-standards` como referencia si el usuario no lo pide.
- No usar glass, blur, gradientes decorativos, orbes ni paletas moradas/azules dominantes.
- No mezclar narrativas repetidas con evidencia operativa.
- No esconder explicaciones de metricas experimentales.
- No presentar benchmark como adorno si el titulo del TFM lo usa como parte central.
