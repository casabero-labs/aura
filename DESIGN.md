---
version: "1.0"
name: AURA
description: Interfaz dark-terminal editorial para auditoria reproducible de calidad del dato con arquitectura local-first, motor determinista y benchmark LLM.
colors:
  bg: "#0D0D0C"
  surface: "#141413"
  surface2: "#1C1C1A"
  ink: "#F0EDE8"
  ink2: "#7A7771"
  ink3: "#3D3C39"
  border: "rgba(240,237,232,0.08)"
  border-strong: "rgba(240,237,232,0.15)"
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
components:
  shell: "Nav superior sticky + main centrado max-width 900px"
  terminal: "Bloque de bitacora inspirado en aura-system.html"
  layers: "Filas compactas con numero, descripcion y tag"
  buttons: "6px radius, ink para accion primaria"
  feedback: "Terminal log, stats y barras horizontales para procesos >800ms"
---

# Overview

AURA debe seguir `casabero-standards/examples/frontend/aura-system.html`: dark terminal, editorial, tecnico y centrado. La interfaz existe para operar el flujo del TFM: cargar dataset, ejecutar Capa 1, interpretar con Capa 2, comparar modelos y exportar evidencia.

# Colors

Usa exclusivamente la escala dark terminal AURA: `#0D0D0C`, `#141413`, `#1C1C1A`, `#F0EDE8`, `#7A7771`, `#3D3C39`. El color no se usa como decoracion; los estados se expresan con texto, peso, bordes y movimiento sutil.

# Typography

Headings editoriales con `Playfair Display`. UI, labels y controles con `Inter`. Metadatos, tokens y bitacoras con `JetBrains Mono`.

# Spacing

Sistema compacto. El `main` se centra en 900px, con secciones de `2.5rem`, terminal y filas densas.

# Elevation

La profundidad viene de `surface + border`. La nav puede usar blur sutil porque la referencia canonica `aura-system.html` lo usa.

# Shapes

Botones `6px`, terminal/cards `10px`, capas `8px`. No usar pills salvo switches nativos de formulario.

# Components

- `sys-nav`: nav superior sticky.
- `sys-main`: contenedor centrado de 900px.
- `hero`: encabezado editorial tecnico del sistema.
- `term`: bitacora de ejecucion.
- `stats`: resumen numerico.
- `layers`: arquitectura por capas.
- `file-drop`: ingreso de dataset.
- `benchmark-grid`: comparacion de modelos.

# Dos and Donts

Do:

- Mostrar el estado de cada proceso importante.
- Mantener el benchmark como instrumento experimental.
- Separar secciones por responsabilidad.
- Usar labels claros en espanol.

Dont:

- No usar hero comercial; el hero debe ser tecnico y operativo como `aura-system.html`.
- No usar sidebar dashboard si rompe la referencia AURA.
- No usar gradientes ni paletas fuera del sistema.
- No ocultar benchmark ni evidencia bajo scroll narrativo.
- No mezclar prototipos antiguos con el flujo operativo actual.
