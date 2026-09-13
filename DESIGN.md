---
version: "1.2.0"
standard_version: "1.2.0"
theme: "Casabero Editorial"
name: AURA
description: Interfaz Editorial para diagnóstico reproducible, evidencia verificable y decisiones humanas sobre calidad de datos.
source_of_truth:
  standards_repo: "/Users/casabero/Documents/GitHub/estandar-casabero"
  standard_commit: "1ac2d4d0e49a5f393c30c26f5c7d2bbe163e3383"
  normative_theme: "standards/design/themes/EDITORIAL.md"
  core: "standards/design/CORE.md"
  web: "standards/design/media/WEB.md"
  record_detail: "standards/design/components/RECORD_DETAIL.md"
  table: "standards/design/components/TABLE.md"
  accessibility: "standards/frontend/ACCESSIBILITY.md"
  human_first_ux: "standards/frontend/HUMAN_FIRST_UX.md"
  visual_example: "examples/frontend/showcase-editorial.html"
preset: "Editorial estándar"
typography:
  reading: 'Source Serif 4'
  operation: 'Source Sans 3'
  data: system-mono
roles:
  Lectura: "Párrafos, explicaciones, citas y conclusiones en serif."
  Estructura: "Títulos, subtítulos y entradas de sección en serif con jerarquía contenida."
  Operación: "Navegación, botones, formularios, ayudas y estados en sans funcional."
  Datos: "Tablas, cifras, identificadores y código con sans tabular o mono cuando el dominio lo exige."
  Metadatos: "Fechas, numeración, fuentes, captions y firma en sans discreta."
tokens:
  canvas: "#FFFFFF"
  ink: "#191919"
  ink_secondary: "#4D4D4A"
  ink_muted: "#6B6B67"
  line: "#D9D9D4"
  line_strong: "#A7A7A0"
  surface: "#F7F7F4"
  surface_quiet: "#FBFBF9"
components:
  brand_mark: "Tres elipses del mismo color, fill none, currentColor y stroke-width 1.55; sin glifo interno."
  shell: "Nav estable de 52px, skip link, ubicación actual, contenido centrado hasta 1280px y ayuda consistente."
  primary_action: "Una acción primaria por bloque; botones outline o texto salvo diferenciación operativa necesaria."
  record_detail: "Identidad, identificador, metadata, procedencia y acciones en un eje editorial."
  table: "Tabla semántica con caption, thead, scope, unidades y scroll local cuando sea necesario."
  status: "Texto, estructura y señal no cromática; el color solo refuerza."
  artifact: "Web, PDF, SVG e impresión comparten canvas, tinta, líneas y roles tipográficos."
invariants:
  - "Los contratos de datos, schemas, hashes, receipts, score, reglas y resultados permanecen intactos."
  - "La evidencia se conserva al navegar entre ejecución, informe y exportación."
  - "El contenido sigue siendo legible sin fuentes remotas."
  - "No se habilita modo oscuro automático dentro de esta migración."
---

# AURA — Casabero Editorial

AURA adopta Casabero Editorial 1.2 como su único tema visual activo. La pieza usa
blanco puro, serif dominante para lectura y títulos, sans funcional para operación,
tablas y metadatos, y mono únicamente para código, hashes e identificadores técnicos.

La referencia normativa es `EDITORIAL.md` en el commit indicado arriba. El catálogo
`showcase.html` es Warm y no gobierna esta interfaz; `showcase-editorial.html` se usa
solo para contrastar ejemplos de composición.

## Composición y estados

El shell tiene una medida máxima de 1280px y la narrativa se mantiene entre 58 y
72ch. Las secciones se orientan con numeración `01`, `02`, `03`; las tablas y el
código pueden ocupar el ancho disponible en un wrapper local. Las líneas finas
separan estructura, no decoran, y una acción primaria queda diferenciada por bloque.

Los estados comunican qué ocurrió, qué sigue y qué límite existe mediante texto y
estructura además del color. Las operaciones mayores a 800ms muestran progreso
humano. El foco visible, el teclado, la impresión, el zoom y `prefers-reduced-motion`
son parte del contrato de la interfaz.

## Marca

`AuraMark` conserva exactamente tres elipses del mismo color, `fill="none"`,
`stroke="currentColor"` y `stroke-width="1.55"`, sin centro, glifo ni forma adicional.
La firma CASABERO es opcional y discreta; no compite con AURA ni con la procedencia
de los datos.

## Límites

Esta definición visual no modifica `PipelineState`, contratos V2, schemas, hashes,
receipts, archivos exportados ni decisiones humanas. Una evidencia de DOM,
captura, build o prueba unitaria no se presenta por sí sola como cierre del flujo:
la migración se cierra con recorridos humanos y evidencia runtime delimitada.
