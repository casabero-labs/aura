# Auditoría de frontera documental — AURA

## Fecha

2026-07-03

## Motivo

Se detectó que documentación de desarrollo posterior fue ubicada dentro de `docs/tercera_entrega_aura/`, lo que puede mezclar entregas académicas cerradas con evolución continua del producto.

El caso inmediato corregido fue Phase 10, que no pertenece a la tercera entrega.

## Evidencia de frontera original

La propia carpeta `docs/tercera_entrega_aura/` declara que la Entrega 3 estaba consolidada hasta Phase 4.

Fuentes internas:

- `docs/tercera_entrega_aura/00_LEEME.md` indica que la Entrega 3 está suficientemente consolidada hasta Phase 4 y que Phase 5 queda preparada como trabajo futuro.
- `docs/tercera_entrega_aura/00_MAPA_MAESTRO_TFM.md` define la cadena narrativa cerrada hasta Entrega 3 como auditoría local, diagnóstico restringido, plan determinista, aprobación HITL y script validado sin ejecución.
- `docs/tercera_entrega_aura/00_MAPA_MAESTRO_TFM.md` también establece que ejecución del script, reauditoría y HealthDelta pertenecen a Phase 5.

## Hallazgo principal

La carpeta `docs/tercera_entrega_aura/` dejó de funcionar únicamente como evidencia de Entrega 3 y se convirtió progresivamente en bitácora general de desarrollo.

Esto genera tres riesgos:

1. **Riesgo académico:** parecería que Entrega 3 contiene resultados posteriores que no forman parte de esa entrega.
2. **Riesgo metodológico:** se mezclan claims cerrados de Entrega 3 con fases posteriores como Phase 5, Phase 6, Phase 7, Phase 8 y Phase 9.
3. **Riesgo operativo:** futuras decisiones de producto pueden terminar enterradas en una carpeta histórica y generar confusión.

## Corrección inmediata realizada

Se creó una zona neutral de producto:

- `docs/product/aura/README.md`
- `docs/product/aura/phase_10/README.md`
- `docs/product/aura/phase_10/L1_CALIBRATION_MODE_OPT_IN.md`
- `docs/product/aura/phase_10/L2_AGENT_ORCHESTRATION.md`

Se eliminaron de `docs/tercera_entrega_aura/05_desarrollo/phases/phase_10/` los documentos de Phase 10.

## Clasificación recomendada

### Debe permanecer en `docs/tercera_entrega_aura/`

Contenido directamente relacionado con la entrega académica ya cerrada:

- borrador consolidado de Entrega 3;
- mapa maestro de claims permitidos para Entrega 3;
- evidencias Phase 3 y Phase 4;
- capturas asociadas a Entrega 3;
- metodología usada para sustentar la entrega;
- glosarios o tablas que alimentan directamente el documento de Entrega 3.

### Debe moverse a `docs/product/aura/`

Contenido posterior o de evolución continua:

- Phase 5: ejecución, reauditoría, HealthDelta e ImprovementRun;
- Phase 6: UI wrapper de ImprovementRun/HealthDelta;
- Phase 7: production readiness, visual harness y QA posterior;
- Phase 8: evidence expansion, provider validation, benchmark evidence classification;
- Phase 9: technical debt cleanup;
- Phase 10: integración del laboratorio como calibración opcional;
- cualquier plan futuro que no sea parte explícita de una entrega académica cerrada.

### Debe moverse a una carpeta académica futura solo si existe instrucción explícita

Contenido orientado a una cuarta entrega, memoria final, anexos futuros o publicación:

- consolidaciones tituladas como cuarta entrega;
- paquetes de evidencia para entregas futuras;
- redacción académica posterior a Entrega 3.

Ruta recomendada si se autoriza en el futuro:

- `docs/entregas/entrega_04/`
- `docs/tfm/memoria_final/`

## Regla nueva

No volver a crear fases nuevas dentro de `docs/tercera_entrega_aura/`.

A partir de esta auditoría:

- desarrollo continuo de producto: `docs/product/aura/`;
- entrega académica específica: `docs/entregas/<entrega>/` o carpeta histórica ya existente;
- memoria final: `docs/tfm/memoria_final/`;
- evidencia experimental no asociada a entrega: `docs/product/aura/evidence/` o subcarpeta de fase correspondiente.

## Próxima acción recomendada

No mover masivamente Phase 5–Phase 9 sin una migración controlada, porque esos documentos están referenciados por `NEXT_STEPS.md`, freezes y evidencia histórica.

La migración correcta debe hacerse como una fase de mantenimiento documental:

1. Crear índice de archivos bajo `docs/tercera_entrega_aura/`.
2. Clasificar cada archivo como Entrega 3, producto continuo, futura entrega o histórico.
3. Mover primero documentos post-Entrega 3 a `docs/product/aura/phases/`.
4. Reescribir referencias internas.
5. Dejar redirects documentales o notas de migración.
6. Ejecutar grep de rutas antiguas.
7. Validar que el documento de Entrega 3 no cambie de contenido académico.

## Veredicto

Phase 10 ya fue corregida de forma inmediata. El problema mayor no es solo Phase 10: la carpeta `tercera_entrega_aura` contiene documentación posterior a la frontera declarada de Entrega 3. Debe tratarse como deuda documental y migrarse por lotes pequeños, con trazabilidad y sin tocar evidencia cerrada.
