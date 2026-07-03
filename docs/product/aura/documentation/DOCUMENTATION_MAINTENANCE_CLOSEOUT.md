# Cierre operativo — mantenimiento documental AURA

## Estado

Cierre operativo para volver a Phase 10 sin seguir desviando esfuerzo.

## Fecha

2026-07-03

## Qué quedó corregido

1. Se creó una raíz documental de producto en `docs/product/aura/`.
2. Se movió Phase 10 fuera de `docs/tercera_entrega_aura/`.
3. Se creó `docs/product/aura/NEXT_STEPS.md` como bitácora viva.
4. Se creó `docs/product/aura/ROADMAP.md` como roadmap vivo.
5. Se agregó `docs/tercera_entrega_aura/README_BOUNDARY.md` para proteger la tercera entrega.
6. Se reemplazó `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md` por nota congelada.
7. Se reemplazó `docs/tercera_entrega_aura/05_desarrollo/ROADMAP_FASES_RESTANTES.md` por nota congelada.
8. Se reemplazó `docs/tercera_entrega_aura/05_desarrollo/phases/README.md` por índice histórico congelado.
9. Se creó `docs/product/aura/phases/README.md` como índice canónico de fases de producto.
10. Se agregaron punteros básicos de producto para fases posteriores.

## Qué queda como deuda fina no bloqueante

Los archivos históricos de Phase 5 a Phase 9 pueden seguir existiendo temporalmente bajo `docs/tercera_entrega_aura/05_desarrollo/phases/` hasta ejecutar una migración física archivo por archivo.

Esa deuda ya no bloquea Phase 10 porque:

- la ruta viva está definida en `docs/product/aura/`;
- la carpeta de tercera entrega quedó marcada como histórica;
- los índices vivos fueron extraídos;
- las reglas de frontera quedaron explícitas.

## Regla desde este cierre

No crear trabajo nuevo dentro de `docs/tercera_entrega_aura/`.

Todo desarrollo posterior debe ir a:

```text
docs/product/aura/
```

## Próximo trabajo prioritario

Volver a Phase 10:

1. integrar `CalibrationOptInExplainer` dentro del pipeline;
2. retirar el laboratorio de la navegación principal;
3. mantener la calibración como opción secundaria;
4. preservar el flujo normal de diagnóstico;
5. no hacer claims de benchmark formal.

## Veredicto

La deuda documental crítica queda contenida. No conviene seguir invirtiendo más ciclos en migración física antes de avanzar Phase 10, salvo que aparezca una referencia rota concreta.
