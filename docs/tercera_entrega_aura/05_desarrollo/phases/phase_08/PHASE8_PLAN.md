# Phase 8 — Plan

## Propósito

Phase 8 continúa el fortalecimiento de AURA como producto técnico controlado, generando evidencia adicional antes de redactar la cuarta entrega. El foco es validar AURA bajo escenarios más cercanos al uso real, sin romper fronteras congeladas ni inflar claims.

## Alcance

- Definir el protocolo de dataset controlado ampliado
- Blindar el boundary entre modo demo/evidencia y modo producción
- Ejecutar corridas controladas con clasificación de evidencia
- Validar proveedores reales en modo opt-in separado
- Consolidar paquete de evidencia exportable

## Fuera de Alcance

- No modificar Phase 3, Phase 4, Phase 5, Phase 6 ni Phase 7
- No tocar FREEZE_PHASE5.md, FREEZE_PHASE6.md ni FREEZE_PHASE7.md
- No modificar contratos v2
- No modificar servicios
- No modificar componentes
- No modificar tests
- No preparar cuarta entrega
- No afirmar production-ready

## Relación con Fases Anteriores

| Phase | Estado | Relación con Phase 8 |
|-------|--------|---------------------|
| Phase 3 | Cerrada y congelada | Base de UI HealthDelta |
| Phase 4 | Cerrada y congelada | Base de QA E2E |
| Phase 5 | Cerrada y congelada | Base de métricas de calidad |
| Phase 6 | Cerrada y congelada | Base de integración de proveedores |
| Phase 7 | Cerrada y congelada | Base de mejora controlada |
| Phase 8 | En ejecución | Ampliación de evidencia técnica |

## Riesgos Técnicos

1. **Dependencia de proveedores externos**: Chrome AI/Gemini Nano pueden no estar disponibles en todos los entornos
2. **Datos sintéticos vs reales**: Evidencia generada con datos controlados puede no reflejar comportamiento en producción
3. **Clasificación de evidencia**: El criterios de "formal_valid" requiere protocolo riguroso
4. **Falsos positivos**: Corridas exitosas no garantizan rendimiento en otros escenarios

## Riesgos Académicos

1. **Claims inflados**: Riesgo de afirmar resultados más sólidos de lo demostrado
2. **Generalización excesiva**: Evidencia controlada no equivale a validación externa
3. **Cuarta entrega prematura**: Rumbo a documentación sin evidencia suficiente

## Reglas Operativas

- Trabajar en main
- No crear ramas
- No abrir PR
- No modificar fases congeladas
- No modificar contratos, servicios, componentes ni tests
- No afirmar production-ready
- No afirmar mejora sobre dataset real
- No ejecutar Python dentro de AURA (Python es externo/delegado)
- No usar datos personales reales
- No depender de Chrome AI/Gemini Nano real en E2E estándar
- No descargar modelos en CI
- No preparar cuarta entrega

## Regla E2E Chrome AI / Gemini Nano

Los E2E estándar no deben depender de Gemini Nano real ni descargar modelos. Si se requiere validar Chrome AI real, crear un spec opt-in separado usando Google Chrome real con perfil persistente dedicado. No usar el perfil personal del usuario ni ejecutar estos tests en CI normal.

## Estrategia de Evidencia

1. Dataset controlado sintético o público sin PII
2. Corridas clasificadas: attempted_failed, preliminary_valid, formal_valid
3. Evidencia exportable en formato audit JSON, issues CSV, notebook
4. Documentation de limitaciones y contexto de cada corrida

## Roadmap L0-L7

| Loop | Nombre | Objetivo | Evidencia esperada | Estado |
|------|--------|----------|---------------------|--------|
| L0 | Phase 8 Plan + Evidence Ledger | Definir alcance, riesgos, dataset protocol y matriz de evidencia | PHASE8_PLAN.md, PHASE8_EVIDENCE_LEDGER.md | En ejecución |
| L1 | Demo/Prod Boundary Hardening | Blindar visual harness y separar modo demo/evidencia de modo normal | tests, documentación de flags, no-regression | Pendiente |
| L2 | Controlled Dataset Protocol | Definir dataset controlado ampliado, sin PII, con ground truth documentado | dataset protocol, schema, ground truth, claims | Pendiente |
| L3 | Controlled Pilot Run | Ejecutar flujo completo sobre dataset controlado ampliado | audit JSON, issues CSV, script, notebook, improvement run JSON | Pendiente |
| L4 | Provider Validation Opt-in | Validar proveedores reales solo en modo opt-in, separados de CI | Chrome AI/Ollama/cloud diagnostics, no CI dependency | Pendiente |
| L5 | Benchmark Evidence Classification | Clasificar corridas como attempted_failed, preliminary_valid o formal_valid | benchmark JSON, tabla comparativa, limitaciones | Pendiente |
| L6 | Evidence Package Export | Consolidar artefactos exportables para futura entrega | paquete de evidencia Phase 8 | Pendiente |
| L7 | Freeze Phase 8 | Congelar Phase 8 si la evidencia queda completa | FREEZE_PHASE8.md | Pendiente |

## Criterios de Cierre de Phase 8

- Todos los loops L1-L6 completados con evidencia documentada
- Clasificación de corridas según nivel de validación alcanzado
- Paquete de evidencia exportable consolidado
- Evidencia ledger completa con SHA asociado
- Documento FREEZE_PHASE8.md aprobado
- Sin claims inflados ni promises de producción

## Claims Permitidos

- AURA cuenta con fases congeladas de mejora controlada, UI HealthDelta y QA E2E
- Phase 8 busca ampliar evidencia técnica
- Los datasets usados deben ser controlados, sintéticos o públicos sin PII
- Las corridas con proveedores reales deben clasificarse según evidencia
- Los resultados preliminares no equivalen a producción final

## Claims Prohibidos

- No decir que AURA está production-ready
- No decir que AURA corrigió datasets reales
- No decir que AURA ejecuta Python internamente
- No decir que Chrome AI/Gemini Nano siempre está disponible
- No decir que existe benchmark formal definitivo si no hay protocolo, repeticiones y resultados exportados
- No decir que hay validación externa independiente
- No decir que la cuarta entrega ya está en construcción
