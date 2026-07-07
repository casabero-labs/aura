# Frontera documental — Tercera Entrega AURA

## Estado

Esta carpeta debe tratarse como espacio histórico de la tercera entrega académica de AURA.

La tercera entrega quedó consolidada hasta Phase 4:

```text
CSV → fingerprint y auditoría local → evidencia limitada → diagnóstico restringido → plan determinista → aprobación HITL → script validado → revisión humana read-only → aprobación sin ejecución
```

## Regla principal

No agregar nuevas fases de producto dentro de `docs/tercera_entrega_aura/`.

El desarrollo continuo posterior debe documentarse en:

```text
docs/product/aura/
```

## Qué pertenece aquí

Puede permanecer en esta carpeta:

- documento académico consolidado de Entrega 3;
- mapa maestro de claims de Entrega 3;
- metodología usada por la entrega;
- evidencias Phase 3 y Phase 4;
- capturas asociadas a Entrega 3;
- glosario o resultados directamente usados por el documento académico.

## Qué no debe crecer aquí

No crear ni ampliar aquí documentación viva de:

- Phase 5: ejecución, reauditoría, HealthDelta, ImprovementRun;
- Phase 6: UI wrapper de HealthDelta;
- Phase 7: production readiness o QA posterior;
- Phase 8: evidence expansion, provider validation o benchmark classification;
- Phase 9: technical debt cleanup;
- Phase 10: calibración experimental del laboratorio;
- preparación de cuarta entrega sin instrucción explícita.

## Nota de deuda documental

Actualmente existen documentos posteriores a Phase 4 dentro de esta carpeta. No deben borrarse ni moverse masivamente sin una migración controlada.

Plan rector de migración:

```text
docs/product/aura/documentation/L0_THIRD_DELIVERY_INVENTORY_AND_MIGRATION_PLAN.md
```

## Claims de frontera

La tercera entrega no debe afirmar:

- ejecución real de Python dentro de AURA;
- dataset corregido por el pipeline formal;
- HealthDelta real sobre dataset de usuario;
- production readiness;
- benchmark formal definitivo;
- modelo ganador universal.

## Veredicto

Esta carpeta queda protegida como evidencia académica cerrada. Cualquier evolución futura del producto debe vivir fuera de ella.
