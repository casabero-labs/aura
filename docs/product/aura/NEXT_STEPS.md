# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica queda como carpeta histórica en `docs/tercera_entrega_aura/`.

## Estado de referencia

| Fase | Estado | Referencia |
|---|---|---|
| Phase 3 | Cerrada y congelada | `d3774dd5ac98d89ca4454c693b1b0a30856cd191` |
| Phase 4 | Cerrada y congelada | `05878e4a960afd11d564a60f4924bfb8f0b527e7` |
| Phase 5 | Cerrada y congelada | `40a376929fcaad13b1809bd0c8ba895011ceb8cb` |
| Phase 6 | Cerrada y congelada | `b689cce5012edf33d27e2e85bb325878ab79125a` |
| Phase 7 | Cerrada y congelada | `58891c215604d7a140774370d133ce06460691d5` |
| Phase 8 | Cerrada y congelada | `7fc32409160e5e9ee84d38bbe56db2fb4e504af4` |
| Phase 9 | Cerrada y congelada | `1344935ff9bb87f73b24b8f90d8cb15052228328` |

## Regla de frontera

La evolución del producto debe documentarse aquí, no dentro de `docs/tercera_entrega_aura/`.

No preparar una entrega académica futura sin instrucción explícita del usuario.

## Phase 10 — Calibración experimental opcional

Ruta principal: `docs/product/aura/phase_10/`.

Objetivo: integrar el antiguo laboratorio como opción informada dentro del flujo principal de AURA, sin convertirlo en requisito ni en promesa de benchmark formal.

Regla UX:

- acción principal: `Continuar diagnóstico normal`;
- acción secundaria: `Activar comparación experimental`.

## Próximo frente recomendado

### Documentation Maintenance L3 — Migrar Phase 9 y Phase 8

Motivo: Phase 9 y Phase 8 son posteriores a la tercera entrega y no deben vivir dentro de `docs/tercera_entrega_aura/`.

Acciones recomendadas:

1. Mover `docs/tercera_entrega_aura/05_desarrollo/phases/phase_09/` a `docs/product/aura/phases/phase_09/`.
2. Mover `docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/` a `docs/product/aura/phases/phase_08/`.
3. Mover `docs/tercera_entrega_aura/03_evidencia/phase_08/` a `docs/product/aura/evidence/phase_08/`.
4. Actualizar referencias internas.
5. Dejar notas de migración si alguna ruta antigua queda referenciada.

## Frente funcional pendiente

### Phase 10 L2 — Integrar opt-in al pipeline

Pendiente hasta estabilizar la deuda documental.

Cambios esperados:

1. Agregar estado `calibration` al pipeline.
2. Mostrar `CalibrationOptInExplainer` después de perfilamiento.
3. Mantener como acción primaria `Continuar diagnóstico normal`.
4. Retirar el laboratorio como módulo visible de navegación principal.
5. Mantener `BenchmarkLab` internamente hasta reemplazarlo por una experiencia embebida.

## Claims de producto

Permitido:

- AURA tiene fases técnicas congeladas y documentadas hasta Phase 9.
- AURA conserva límites explícitos para ejecución, evidencia, proveedores y claims.
- Las comparaciones de proveedores requieren evidencia clasificada y no deben venderse como veredicto absoluto.

No permitido:

- declarar AURA lista para producción general;
- decir que AURA corrige datasets reales sin revisión humana;
- presentar comparaciones como benchmark definitivo sin protocolo formal;
- afirmar que la cuarta entrega ya empezó;
- decir que el laboratorio determina el mejor modelo universal.

## Nota de migración

Este documento reemplaza el uso vivo de `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md`.

La versión dentro de `tercera_entrega_aura` debe quedar como nota congelada de frontera, no como guía activa.
