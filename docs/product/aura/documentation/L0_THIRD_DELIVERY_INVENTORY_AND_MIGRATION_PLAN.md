# L0 — Inventario y plan de migración documental de `tercera_entrega_aura`

## Estado

Documento de mantenimiento documental. No forma parte de una entrega académica.

## Fecha

2026-07-03

## Objetivo

Auditar el contenido ubicado bajo `docs/tercera_entrega_aura/` para separar:

1. evidencia y redacción que sí pertenece a la tercera entrega;
2. desarrollo posterior del producto;
3. material potencialmente orientado a una entrega futura;
4. documentos históricos que deben conservarse pero no mezclarse con claims académicos cerrados.

## Advertencia metodológica

El conector GitHub usado para esta auditoría permite buscar y leer archivos, pero no expone un listado completo de árbol de directorios. Por tanto, este L0 no debe presentarse como inventario absoluto de filesystem. Es un inventario verificado por:

- búsquedas de rutas y términos;
- lectura de archivos rectores;
- lectura de documentos de estado;
- hallazgos explícitos de archivos localizados por búsqueda.

Antes de mover masivamente documentos, se debe ejecutar una verificación local o CI con comandos de listado reales.

Comandos recomendados para completar inventario local:

```bash
find docs/tercera_entrega_aura -type f | sort > /tmp/tercera_entrega_files.txt
find docs/product/aura -type f | sort > /tmp/product_aura_files.txt
```

## Fuentes rectoras revisadas

### `docs/tercera_entrega_aura/00_LEEME.md`

Declara que la carpeta es la documentación activa para la tercera entrega y que la lectura recomendada incluye el consolidado académico, mapa maestro, matriz de evidencia, paquete Phase 3 y cierre Phase 4.

Punto crítico: afirma que la Entrega 3 queda suficientemente consolidada hasta Phase 4 y que Phase 5 estaba preparada documentalmente como trabajo posterior.

### `docs/tercera_entrega_aura/00_MAPA_MAESTRO_TFM.md`

Define la cadena narrativa cerrada hasta Entrega 3 como:

```text
CSV → fingerprint y auditoría local → evidencia limitada → diagnóstico restringido → plan determinista → aprobación HITL → script validado → revisión humana read-only → aprobación sin ejecución
```

También establece que la ejecución del script, la reauditoría y HealthDelta pertenecen a Phase 5.

### `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md`

Actualmente mezcla estados de Phase 5, Phase 6, Phase 7, Phase 8 y Phase 9 dentro de la carpeta de tercera entrega.

Este archivo es útil como bitácora histórica, pero ya no debe seguir funcionando como índice rector de una entrega cerrada.

### `docs/tercera_entrega_aura/05_desarrollo/ROADMAP_FASES_RESTANTES.md`

Describe Phase 5 y Phase 6 como fases posteriores o pendientes respecto a la frontera original.

## Hallazgo principal

La carpeta `docs/tercera_entrega_aura/` contiene dos naturalezas mezcladas:

1. **Entrega 3 real:** material académico consolidado hasta Phase 4.
2. **Producto posterior:** fases y evidencias posteriores a Phase 4, incluyendo ejecución, HealthDelta, QA, evidence expansion, provider validation y technical debt cleanup.

Esta mezcla puede provocar claims inflados o confusión metodológica si alguien interpreta que todo lo contenido en `tercera_entrega_aura` pertenece a la entrega ya cerrada.

## Clasificación inicial

### A. Permanecer en `docs/tercera_entrega_aura/`

Estos archivos o familias de documentos pertenecen a la tercera entrega o a su contexto mínimo:

| Ruta | Clasificación | Acción |
|---|---|---|
| `00_LEEME.md` | Índice de la tercera entrega | Mantener, pero congelar o aclarar frontera |
| `00_MAPA_MAESTRO_TFM.md` | Mapa rector de claims de Entrega 3 | Mantener |
| `00_AUDITORIA_DOCUMENTAL.md` | Auditoría documental original para consolidar Entrega 3 | Mantener |
| `01_borrador/TERCERA_ENTREGA_AURA_CONSOLIDADA.md` | Documento académico principal | Mantener |
| `02_metodologia/*` | Metodología usada para sustentar Entrega 3 | Mantener si apunta a Phase 1–4 o frontera de claims |
| `03_evidencia/PAQUETE_EVIDENCIA_PHASE3.md` | Evidencia oficial Phase 3 | Mantener |
| `03_evidencia/MATRIZ_EVIDENCIA_RESULTADOS.md` | Trazabilidad objetivo-evidencia-resultado-límite | Mantener si refleja Entrega 3 |
| `03_evidencia/screenshots/phase3/*` | Capturas Phase 3 | Mantener |
| `03_evidencia/screenshots/phase4/*` | Capturas Phase 4 | Mantener |
| `03_evidencia/screenshots/entrega3_universidad/*` | Evidencia asociada a entrega universitaria | Mantener |
| `04_resultados/catalogo_reglas_motor_determinista.md` | Resultado/glosario técnico del motor determinista | Mantener si está citado por Entrega 3 |
| `10_glosario/*` | Glosario académico o técnico asociado | Mantener si alimenta documento académico |

### B. Mover a `docs/product/aura/`

Estos archivos o familias corresponden a desarrollo posterior del producto y no deben permanecer como si fueran parte de Entrega 3:

| Ruta actual | Motivo | Ruta sugerida |
|---|---|---|
| `05_desarrollo/phases/phase_05/*` | Ejecución, reauditoría, HealthDelta e ImprovementRun pertenecen a producto posterior | `docs/product/aura/phases/phase_05/` |
| `05_desarrollo/phases/phase_06/*` | UI wrapper de ImprovementRun/HealthDelta, posterior a Entrega 3 | `docs/product/aura/phases/phase_06/` |
| `05_desarrollo/phases/phase_07/*` | Production readiness, QA, visual harness y evidencias posteriores | `docs/product/aura/phases/phase_07/` |
| `05_desarrollo/phases/phase_08/*` | Evidence expansion, proveedor opt-in, benchmark classification | `docs/product/aura/phases/phase_08/` |
| `05_desarrollo/phases/phase_09/*` | Technical debt cleanup posterior | `docs/product/aura/phases/phase_09/` |
| `03_evidencia/phase_08/*` | Paquete de evidencia Phase 8, posterior a Entrega 3 | `docs/product/aura/evidence/phase_08/` |
| `05_desarrollo/NEXT_STEPS.md` | Ya opera como bitácora general y no como next steps de Entrega 3 | dividir entre `docs/product/aura/NEXT_STEPS.md` y nota congelada en Entrega 3 |
| `05_desarrollo/ROADMAP_FASES_RESTANTES.md` | Roadmap posterior a Phase 4 | `docs/product/aura/ROADMAP.md` o `docs/product/aura/phases/ROADMAP.md` |

### C. Revisar manualmente antes de mover

Algunos documentos pueden mezclar narrativa académica y producto posterior. No deben moverse sin lectura completa:

| Ruta o patrón | Riesgo | Acción |
|---|---|---|
| `04_resultados/resultados_benchmark_llm.md` | Puede ser resultado académico o experimento posterior según contenido | Revisar claims y fecha |
| `03_evidencia/results/incidentes_policiales_aura_vs_gemini.md` | Puede ser evidencia de Entrega 3 o experimento comparativo posterior | Revisar protocolo y si hay benchmark formal |
| `05_desarrollo/PLAN_*` | Puede contener planes históricos útiles o deuda | Clasificar uno por uno |
| documentos con `CUARTA_ENTREGA` en el nombre | No pertenecen a tercera entrega, pero podrían ser preparación futura | Mover a `docs/product/aura/future_delivery_candidates/` o esperar instrucción explícita |
| capturas posteriores a Phase 4 | Pueden contaminar evidencia de Entrega 3 | Mover si no sustentan la entrega cerrada |

### D. Ya corregido

Phase 10 fue removida de la carpeta de tercera entrega y movida a producto:

| Antes | Después |
|---|---|
| `docs/tercera_entrega_aura/05_desarrollo/phases/phase_10/L1_CALIBRATION_MODE_OPT_IN.md` | `docs/product/aura/phase_10/L1_CALIBRATION_MODE_OPT_IN.md` |
| `docs/tercera_entrega_aura/05_desarrollo/phases/phase_10/L2_AGENT_ORCHESTRATION.md` | `docs/product/aura/phase_10/L2_AGENT_ORCHESTRATION.md` |

## Riesgos por prioridad

### Riesgo crítico

`docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md` mezcla Entrega 3 con fases posteriores y puede inducir a creer que la carpeta completa representa el estado actual de una entrega académica.

Acción recomendada:

- reemplazarlo en Entrega 3 por una nota congelada;
- mover su contenido vivo a `docs/product/aura/NEXT_STEPS.md`.

### Riesgo alto

`05_desarrollo/phases/phase_05` a `phase_09` están dentro de tercera entrega aunque sus objetivos superan la frontera declarada de Phase 4.

Acción recomendada:

- migrar por fase, empezando por Phase 9 y Phase 8, porque son claramente posteriores.

### Riesgo alto

Documentos con `CUARTA_ENTREGA` dentro de `tercera_entrega_aura` pueden sugerir que se empezó una entrega futura sin instrucción explícita.

Acción recomendada:

- mover a una carpeta de producto o futuros candidatos, con nota: `no constituye entrega académica preparada`.

### Riesgo medio

Resultados comparativos con LLM o proveedores pueden parecer benchmark formal.

Acción recomendada:

- revisar claims y mover a producto experimental si no formaron parte del cuerpo consolidado de Entrega 3.

## Plan de migración por loops

### L1 — Congelar frontera de Entrega 3

Objetivo:

- dejar `tercera_entrega_aura` como carpeta histórica de entrega cerrada.

Acciones:

1. Crear o actualizar `docs/tercera_entrega_aura/README_BOUNDARY.md`.
2. Indicar que Entrega 3 se consolidó hasta Phase 4.
3. Indicar que Phase 5+ es producto posterior y será migrado.
4. No mover archivos todavía.

### L2 — Extraer bitácora viva

Objetivo:

- mover `NEXT_STEPS.md` y roadmap posterior a producto.

Acciones:

1. Crear `docs/product/aura/NEXT_STEPS.md` desde el contenido vivo actual.
2. Crear `docs/product/aura/ROADMAP.md` desde roadmap de fases restantes.
3. Reemplazar `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md` por una nota congelada o redirect documental.

### L3 — Migrar Phase 9 y Phase 8

Objetivo:

- sacar technical debt cleanup y evidence expansion de la carpeta académica.

Acciones:

1. Mover `05_desarrollo/phases/phase_09/*` a `docs/product/aura/phases/phase_09/`.
2. Mover `05_desarrollo/phases/phase_08/*` a `docs/product/aura/phases/phase_08/`.
3. Mover `03_evidencia/phase_08/*` a `docs/product/aura/evidence/phase_08/`.
4. Actualizar referencias internas.

### L4 — Migrar Phase 5–7

Objetivo:

- sacar ejecución, HealthDelta, UI wrapper y production readiness de tercera entrega.

Acciones:

1. Mover `phase_05`, `phase_06`, `phase_07` a producto.
2. Revisar documentos con `CUARTA_ENTREGA`.
3. Mantener redirects o notas de migración.

### L5 — Revisar resultados y anexos ambiguos

Objetivo:

- evitar que resultados experimentales parezcan evidencia de Entrega 3.

Acciones:

1. Revisar `04_resultados/*`.
2. Revisar `03_evidencia/results/*`.
3. Clasificar cada archivo como Entrega 3, producto experimental o futura memoria.

### L6 — Verificación final

Objetivo:

- asegurar que la carpeta de Entrega 3 solo contenga entrega cerrada y contexto mínimo.

Comandos:

```bash
grep -R "Phase 5\|Phase 6\|Phase 7\|Phase 8\|Phase 9\|Phase 10\|CUARTA_ENTREGA\|HealthDelta\|production readiness" docs/tercera_entrega_aura || true
find docs/tercera_entrega_aura -type f | sort
find docs/product/aura -type f | sort
```

Criterio:

- si aparecen términos post-Phase 4 dentro de Entrega 3, deben estar en notas de frontera, no en documentos vivos de producto.

## No hacer todavía

- No mover masivamente sin actualizar referencias.
- No borrar freezes históricos.
- No alterar contenido académico de `TERCERA_ENTREGA_AURA_CONSOLIDADA.md`.
- No renombrar evidencias cerradas sin redirect o nota.
- No iniciar cuarta entrega por accidente.

## Definition of Done de mantenimiento documental

La limpieza se considerará completa cuando:

1. `docs/tercera_entrega_aura/` quede como carpeta histórica de Entrega 3 cerrada.
2. Phase 5+ viva en `docs/product/aura/`.
3. Los documentos de producto no dependan de rutas antiguas.
4. Los claims académicos de Entrega 3 no incluyan ejecución, HealthDelta, production readiness ni benchmark formal posterior.
5. Las referencias internas queden actualizadas o tengan notas de migración.

## Veredicto L0

Sí hay desorden estructural. La tercera entrega contiene documentos posteriores a su propia frontera metodológica. Phase 10 ya fue corregida. La siguiente intervención debe congelar la frontera de Entrega 3 y mover la bitácora viva a `docs/product/aura/` antes de seguir integrando nuevas funcionalidades.
