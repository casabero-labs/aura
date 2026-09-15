# Aura Editorial · diario de ejecución

**Loop en curso: LOOP-03 — Laboratorio.** Arranque: 15 de septiembre de 2026. F9 no declara exclusividad total: `src/index.css` conserva declaraciones Ink cubiertas por tokens Editorial.

Especificación: [orden de ejecución](2026-09-14-aura-editorial-orden-ejecucion.md). Design Context: `CLAUDE.md`. Impeccable: `frontend-design` (dirección Editorial, no paralela), `quieter`, `polish`, `animate` (filete / geometría estable). No `bolder` ni `colorize`.

## Línea base (F0)

| Repo | SHA |
|---|---|
| Aura | `96a03b67f8f07f0e061ed917e94b8ceb7c6de276` (`main`, ahead 2 vs origin al arrancar) |
| Estándar | `db8c6ae4b4e30043b778e90fd93188cde26c76e5` |
| Showcase Editorial | blob `351c426b998b9bf8e0d8c005fa9bd0761cc9f49d` · sha256 `186d16014f4bd9eeefef11f0f8ad3a49756db7fbbadb9224e21eb82de74cfc1b` |

`DESIGN.md` al arrancar: Warm Terminal + Archive, `showcase.html`. `src/index.css:1` declara Ink. Piloto `editorial-pilot` en informe/exportación. Favicon distinto a `AuraMark`. Fuentes: Inter, Playfair, JetBrains, Source.

## Estado

| Pieza | Estado |
|---|---|
| F0 diario y SHA | IMPLEMENTADO_SIN_VALIDAR |
| Catálogo EC-01/03/05/14/17 · RC-01/04/06 | IMPLEMENTADO_SIN_VALIDAR |
| F2 tokens + DESIGN.md | IMPLEMENTADO_SIN_VALIDAR |
| F3 shell / U01 / drawer | IMPLEMENTADO_SIN_VALIDAR |
| F4 carga U02 | IMPLEMENTADO_SIN_VALIDAR |
| J01 J02 J14 J15 + tema | VERIFICADO (`editorial-loop01.spec.ts`, 5/5) |
| J11 recarga/reimportación | PENDIENTE |
| LOOP-02 perfil/diagnóstico/informe/exportación | IMPLEMENTADO_SIN_VALIDAR humana |
| J03 J04 J07 | VERIFICADO (`editorial-loop02.spec.ts`, 3/3) |
| U06 remediación | IMPLEMENTADO_SIN_VALIDAR humana (hitos, aprobar sin color de autorización, cierre sin cambios) |
| EC-15 PDF auditoría | IMPLEMENTADO_SIN_VALIDAR (paleta Editorial en `createPdfTheme`) |
| LOOP-03 Laboratorio U08 | IMPLEMENTADO_SIN_VALIDAR humana |
| U09 standalone Ollama | IMPLEMENTADO_SIN_VALIDAR |
| F9 exclusividad | IMPLEMENTADO_SIN_VALIDAR humana: `:root` Editorial, piloto retirado, sombras/radios/fuentes alineados. Layout histórico en `index.css` lee esas variables. 15 componentes sin camino no se borraron. |

## Decisiones de este loop

- Tokens Editorial en archivos propios, importados después de `index.css`. No un bloque al final de las 16.400 líneas.
- Nav: marca = Inicio; destinos = Auditoría y Laboratorio; Configuración y Ayuda = utilidades en drawer. Móvil en dos líneas, sin esconder destinos en hamburguesa.
- Inicio operativo: título de tarea, no hero de 148 px ni tres tarjetas.
- Impeccable no inventa paleta: `#FFFFFF` / `#191919` mandan sobre el “no pure white” genérico de la skill.

## Evidencia

Directorio: `docs/product/aura/evidence/editorial-migration/`
