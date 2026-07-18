# 06 — Consistencia con el estándar Casabero

## Fuente de verdad aplicada

- `estandar-casabero/examples/frontend/showcase.html`
- `estandar-casabero/standards/frontend/UX_UI_AUDIT.md`
- `estandar-casabero/standards/frontend/HUMAN_FIRST_UX.md`

El contraste se limita a reglas observables y evita convertir preferencias
estéticas en defectos.

## Divergencias con consecuencia UX

| Elemento | Patrón Casabero | Estado observado en AURA | Consecuencia | Hallazgo |
|---|---|---|---|---|
| Marca | Tres elipses horizontales; centro rojo y laterales oscuros | Símbolo cuadrado compuesto por nueve formas tipo tablero | La familia visual no se reconoce por la marca | `AURA-UI-002` |
| Acción primaria | Controles ligeros, outline y jerarquía sobria | `Empezar auditoría` usa fondo oscuro relleno | La prioridad se expresa con un lenguaje de control distinto al showcase | `AURA-UI-002` |
| Declaración de identidad | La interfaz y su documentación deben describir el mismo estado | Historial afirma que la marca sigue el estándar Casabero | La afirmación y la evidencia visible se contradicen | `AURA-UI-002` |
| Navegación global | Conjunto estable de destinos entre viewports | `Trazabilidad` aparece solo en móvil | La arquitectura de información depende del ancho | `AURA-IA-001` |

## Evidencia de interfaz

- Marca global: [`src/App.tsx`](../../../../src/App.tsx), contenedor
  `nav-brand` alrededor de la línea 685.
- Ruta móvil `Trazabilidad`: [`src/App.tsx`](../../../../src/App.tsx), alrededor
  de la línea 780.
- Estilos observados de marca y CTA: [`src/index.css`](../../../../src/index.css).
- Declaración de historial: [`src/components/ChangelogModal.tsx`](../../../../src/components/ChangelogModal.tsx), versión `v1.0`.

## Límite de interpretación

No se asignó severidad por gusto visual. La prioridad deriva de dos relaciones
verificables: estándar normativo ↔ interfaz y afirmación del Historial ↔ marca
renderizada.
