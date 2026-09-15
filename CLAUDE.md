# AURA — contexto para agentes

Este archivo persiste el contrato de diseño para Impeccable y sesiones futuras. No sustituye `GEMINI.md`, `DESIGN.md` ni el paquete Editorial del 14 de septiembre de 2026.

El código actual (`src/index.css`, `DESIGN.md`) todavía describe Ink/Warm. **El destino obligatorio es Casabero Editorial 1.2 exclusivo.** Este contexto describe ese destino, no el CSS vigente.

Fuentes que mandan para interfaz:

1. `docs/plans/2026-09-14-aura-editorial-orden-ejecucion.md` — secuencia (LOOP-01 → 02 → 03).
2. `docs/plans/2026-09-14-aura-editorial-ux-design.md` — U01–U09.
3. `docs/plans/2026-09-14-aura-migracion-editorial-integral.md` — invariantes, F0–F9, J01–J20.
4. `docs/plans/2026-09-14-editorial-showcase-brechas.md` — EC/RC.
5. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/themes/EDITORIAL.md`
6. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/frontend/DESIGN_SYSTEM_EDITORIAL.md`
7. Catálogo: `estandar-casabero/examples/frontend/showcase-editorial.html` (patrones, no identidad de producto).

Skills Impeccable a usar en cada loop: `frontend-design`, `polish`, `quieter`, `animate`. No `bolder` ni `colorize` salvo instrucción explícita.

---

## Design Context

### Users

AURA lo usa una misma persona en tres oficios, no tres roles de cuenta:

- **Revisar un CSV** antes de explotarlo: carga local, perfil determinista, informe, exportación. A menudo sin proveedor LLM.
- **Aprobar una corrección** sobre una copia: ver acción, columna, consecuencia; autorizar; ejecutar fuera; verificar con recibo.
- **Comparar diagnósticos** en Laboratorio: protocolo, matriz, límites, transferencia de configuración. No inicia un diagnóstico al aplicar.

Contexto: trabajo local-first, datos que no deben salir sin decisión, evidencia que hay que defender (TFM, revisión, auditoría). La interfaz debe dejar terminar la tarea, no presentar el producto.

Trabajo a completar: entender el análisis, decidir con evidencia, salir con un artefacto. La remediación es rama opcional.

### Brand Personality

Tres palabras: **riguroso, sereno, legible**.

Voz: precisa, en español, sin jerga de dashboard. El mismo verbo nombra la misma acción en entrada y resultado (iniciar, generar, aprobar, aplicar, verificar, descargar). No usar «Continuar» cuando oculta la consecuencia.

Tono: confianza verificable. La calma editorial sirve para que un hallazgo se pueda sostener: conclusión primero, evidencia al alcance, límites visibles. No urgencia de SaaS, no calidez de Warm, no frialdad de consola Ink.

Emoción objetivo: «puedo defender esto». No deleite, no prisa, no solemnidad académica de gaceta.

Marca de producto: wordmark **AURA** y exactamente tres elipses (`AuraMark`, `currentColor`, `stroke-width: 1.55`). Favicon alineado a esa marca. UNIR, el TFM y el autor viven en la memoria; no en nav, lockup ni PDF operativo.

### Aesthetic Direction

**Tema:** Casabero Editorial 1.2. Selector `[data-casabero-theme="editorial"]`. Claro y oscuro son modos (`data-theme="light|dark"`), no temas distintos. Cero Ink y cero Warm en el entregable.

**Visual:** blanco puro `#FFFFFF`, tinta `#191919`, secundaria `#4D4D4A`, metadata `#6B6B67`, líneas `#D9D9D4` / `#A7A7A0`, superficies puntuales `#F7F7F4` / `#FBFBF9`. Oscuro `#161614` / `#F2F1EC`. Preset Web estándar: Source Serif 4 en títulos y conclusiones; Source Sans 3 en nav, botones, formularios, tablas y metadata. Mono solo para código y hashes. `--font-sans` permanece sans.

**Composición:** documento operativo (sección + filete), no tarjetas. Una primaria por contexto, outline. Nav 52 px; targets 44 px. Lectura 17–19 px, 55–75 caracteres. Tablas a ancho útil, sans tabular.

**Movimiento:** `transform` y `opacity`; 150 / 220 / 280 ms; `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`. Progreso con `scaleX`. Botones de estado con geometría estable. Campos: un filete inset de 2 px, nunca borde + outline. Configuración en **drawer**, no modal que cubre la tarea. `prefers-reduced-motion` conserva mensaje y estado.

**Referencia:** el catálogo Editorial del estándar, y Karta solo como evidencia de un producto Editorial. No copiar el serif extra del catálogo al chrome de Aura, ni el número predial, ni `showcase-editorial-gaceta.html`.

**Anti-referencias:** Ink (`#F6F8FB`, Inter-as-serif, sombras, teal); Warm (parchment, Playfair, Terminal + Archive); gaceta / predial / escudos; hero de estadísticas; cards de métricas; paletas moradas/azules de «AI»; bounce, elastic, `scale` de press; pills; glass/blur/gradiente; Lucide como personalidad.

`DESIGN.md` prescribe Editorial 1.2. Este Design Context lo refuerza. `src/index.css` sigue conteniendo declaraciones Ink heredadas; los tokens Editorial mandan vía `[data-casabero-theme="editorial"]`.

### Design Principles

1. **Conclusión antes que maquinaria.** Identidad del archivo o campaña, resultado y siguiente acción preceden a invocación, hash, contrato y logs. El detalle técnico existe y se alcanza; no compite con la decisión.

2. **Autorizar no es seleccionar.** Checkbox, foco y fila activa no aprueban. Aprobar, ejecutar, descargar y verificar son verbos distintos. Un recibo válido no afirma integridad semántica. Preservar `001`, `120.00`, vacíos y acentos.

3. **Un sistema, dos destinos.** Auditoría y Laboratorio son el trabajo. Inicio es la marca. Configuración y Ayuda son utilidades etiquetadas con retorno al origen. Sin hero, sin tercer flujo principal, sin clonar el catálogo dentro del producto.

4. **Geometría y foco estables.** El layout no baila al cambiar de etiqueta. El campo tiene un solo perímetro de foco. El movimiento explica estado (progreso, overlay, confirmación), no adorna. Oscuro es Editorial, no inversión.

5. **El cierre es el recorrido humano.** Un loop no termina por archivos creados, screenshot o fixture inyectado. Termina cuando una persona completa el camino (J de esa fase) con E2E, feedback visible y estado persistido.

Impeccable en este repo: `quieter` y `polish` sobre cualquier tentación de densidad tipo dashboard; `animate` solo con el contrato de movimiento de arriba; `frontend-design` no inventa una dirección paralela a Editorial 1.2.
