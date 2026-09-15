---
version: "2.0"
name: AURA
description: Auditoría local-first de calidad del dato. Casabero Editorial 1.2 exclusivo. Claro y oscuro son modos, no temas.
source_of_truth:
  standards_repo: "/Users/casabero/Documents/GitHub/estandar-casabero"
  theme: "standards/design/themes/EDITORIAL.md"
  profile: "standards/frontend/DESIGN_SYSTEM_EDITORIAL.md"
  catalog: "examples/frontend/showcase-editorial.html"
  design_context: "CLAUDE.md"
  sequence: "docs/plans/2026-09-14-aura-editorial-orden-ejecucion.md"
theme: editorial
selector: '[data-casabero-theme="editorial"]'
mode_attribute: data-theme
modes: [light, dark]
preset: standard
colors:
  canvas: "#FFFFFF"
  ink: "#191919"
  ink-secondary: "#4D4D4A"
  ink-muted: "#6B6B67"
  line: "#D9D9D4"
  line-strong: "#A7A7A0"
  surface: "#F7F7F4"
  surface-quiet: "#FBFBF9"
dark:
  canvas: "#161614"
  ink: "#F2F1EC"
typography:
  font-display: '"Source Serif 4", Georgia, "Times New Roman", serif'
  font-body: '"Source Serif 4", Georgia, "Times New Roman", serif'
  font-sans: '"Source Sans 3", Arial, Helvetica, sans-serif'
  font-meta: '"Source Sans 3", Arial, Helvetica, sans-serif'
  font-mono: SFMono-Regular, Consolas, "Liberation Mono", monospace
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
rounded: { none: 0, sm: 2, md: 4 }
shadow: none
nav:
  height: 52px
  min-target: 44px
---

# AURA — contrato visual Editorial 1.2

AURA es un espacio de trabajo para auditar un CSV, decidir con evidencia y exportar. No es un dashboard, no es una gaceta y no es una consola.

Tema único: **Casabero Editorial 1.2**. Cero Ink. Cero Warm. Claro y oscuro son `data-theme="light|dark"` sobre el mismo tema.

El catálogo `showcase-editorial.html` demuestra patrones. No se copia su serif extra al chrome, ni su contenido predial, ni `showcase-editorial-gaceta.html`.

## Personalidad

Riguroso, sereno, legible. Emoción: poder defender un hallazgo. Marca: wordmark AURA y tres elipses (`AuraMark`, `currentColor`, `stroke-width: 1.55`). UNIR y el TFM viven en la memoria, no en la nav.

## Roles tipográficos

| Rol | Familia | Dónde |
|---|---|---|
| Lectura | serif | Títulos, conclusiones, cuerpo de inicio e informe |
| Operación | sans meta | Nav, botones, formularios, ayudas |
| Datos | sans tabular | Tablas, cifras, NPN, porcentajes |
| Técnico | mono | Código, hashes |

`--font-sans` permanece sans. `--font-body` y `--font-display` son serif.

## Composición

Documento operativo: sección + filete. Una primaria outline por contexto. Nav 52 px. Móvil: marca y utilidades en la primera línea; Auditoría y Laboratorio en la segunda. Configuración y Ayuda abren drawer, no sustituyen la vista.

Inicio es operativo: reanudar o cargar. Sin hero de estadísticas ni tres tarjetas de proceso.

## Foco y movimiento

- Enlaces y botones: anillo 2 px con hueco de canvas.
- Campos: un filete inset de 2 px. Nunca borde + outline.
- Botones con etiqueta de estado: geometría estable (el ancho es el verbo más largo).
- Movimiento: `transform` y `opacity`; 150 / 220 / 280 ms; `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`. Progreso con `scaleX`. Confirmación: shake 2 px / 280 ms.
- `prefers-reduced-motion` conserva mensaje y estado.

## Qué no hacer

- No Inter como serif. No Playfair. No parchment. No `#F6F8FB`. No teal Ink.
- No cards operativas, pills, glass, gradiente, bounce, hero métrico.
- No Lucide como personalidad.
- No publicar un híbrido. LOOP-01 cubre shell y carga; el resto hereda tokens hasta su loop.

## Archivos de implementación

- `src/styles/casabero-editorial.tokens.css`
- `src/styles/editorial-foundations.css`
- `src/styles/editorial-shell.css`
- `src/index.css` — legado en retirada por familia; no añadir overrides al final.
