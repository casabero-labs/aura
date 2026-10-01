# AURA sin rellenos tintados — plan del 1 de octubre de 2026

**Decisión del usuario:** Editorial en AURA no admite superficies grises. Ni tarjetas `#F7F7F4`, ni cajas de estado mezcladas con tinta, ni botones secundarios rellenos, ni bandas. El fondo es siempre el lienzo. La estructura se marca con filete y el estado con texto y peso.

Esto sustituye las «superficies puntuales `#F7F7F4` / `#FBFBF9`» del contexto de diseño. Coincide con `DESIGN_SYSTEM_EDITORIAL.md`: «Cero cards operativas» y «El estado se lee por texto + filete/icono».

## Inventario de partida

| Origen | Cantidad |
|---|---|
| Declaraciones `background` con superficie, mezcla, `rgba` o hex | ~370, en 407 selectores (casi todas en `index.css`) |
| Fondos `rgba(…)` / `color-mix(…)` escritos a mano en `index.css` | 78 |
| Hex fuera del archivo de tokens (`index.css`) | 84 |
| Fondos inline en TSX | 37 (18 en `ImprovementRunPanel`, paleta Tailwind) |

Familias con más rellenos: `diagnostic-report`, `benchmark-status`, `chrome-ai`, `family-badge`, `finding-card`, `export-delivery`, `oe4-run`, `settings-*`, `ollama-wizard`, `file-drop`, `audit-log`.

## Excepciones aceptadas

1. Inversión tinta/lienzo en el hover de botones (contrato del estándar).
2. Velo detrás de diálogos (selectores `overlay` / `backdrop` / `scrim`).
3. Barra de progreso, interruptor de tema y marcas de radio en tinta: son la señal, no un fondo.
4. Filetes dibujados con `background` en elementos de 0.5 a 2 px de alto o de ancho.

Los bloques de código, JSON y logs van sobre el lienzo con filete, sin fondo gris.

## Fases

**Fase 0. Contrato y control.** Actualizar `CLAUDE.md` y las reglas del estándar (`EDITORIAL.md`, `DESIGN_SYSTEM_EDITORIAL.md`). Añadir el test `__tests__/editorialNoFills.test.ts`:
- Los tokens de superficie resuelven al lienzo y los de estado son transparentes, en claro y en oscuro.
- Un trinquete de fondos literales en CSS y TSX inline que solo puede bajar, hasta llegar a 0 al cerrar la fase 2.

**Fase 1. Tokens.** Todas las superficies (`--editorial-surface`, `--surface`, `--surface2`, `--surface-raised`, `--surface-hover`, `--error-surface`, `--code-bg`) resuelven al lienzo. Los tintes de estado (`--green-bg`, `--warning-bg`, `--error-bg`) pasan a `transparent`. Elimina unas 250 declaraciones sin editar componentes.

**Fase 2. Colores escritos a mano.** Eliminar o tokenizar las 78 mezclas `rgba`/`color-mix` y los 84 hex de `index.css`. Pasar los 37 fondos inline de TSX a clases. El trinquete llega a 0.

**Fase 3. Recuperar la estructura.**
- Un elemento que solo se distinguía por su relleno gana un filete de 0.5 px.
- Las tarjetas anidadas pasan a secciones; primero Diagnóstico avanzado, luego tarjetas de estado, info-box, colapsables y tarjetas de hallazgo.
- Los badges pasan a texto de metadata.
- El hover usa subrayado o peso.
- `.btn-s` pasa a outline con filete suave y «Cancelar» a ghost.
- El pie pierde su banda gris.

**Fase 4. Verificación.** Barrido de estilos calculados en cada recorrido (J01–J20), en claro y oscuro, a 390 y 1280 px: cero fondos fuera de las excepciones. E2E de los recorridos y capturas de antes y después.

## Pendiente

- Lienzo del modo oscuro: `#161614` (contrato de AURA) o `#000000` (estándar). Sin decidir; se mantiene `#161614`.
