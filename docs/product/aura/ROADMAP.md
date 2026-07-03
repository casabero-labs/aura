# Roadmap — AURA producto

## Naturaleza documental

Este roadmap pertenece al desarrollo continuo de producto. No representa una entrega académica cerrada.

## Frontera académica

La tercera entrega académica quedó consolidada hasta Phase 4.

Las fases posteriores se documentan aquí o en subcarpetas de `docs/product/aura/`.

## Estado por fases

| Fase | Estado | Observación |
|---|---|---|
| Phase 1 | Cerrada | EvidenceEnvelopeV2, código y tests |
| Phase 2 | Cerrada | DiagnosisResponseV2, código y tests |
| Phase 3 | Cerrada y congelada | RemediationPlanV2 + HITL |
| Phase 4 | Cerrada y congelada | ScriptContractV2 + renderer |
| Phase 5 | Cerrada y congelada | Ejecución delegada, reauditoría, HealthDelta e ImprovementRun sobre alcance controlado |
| Phase 6 | Cerrada y congelada | UI wrapper para ImprovementRun/HealthDelta |
| Phase 7 | Cerrada y congelada | QA, evidencia visual y readiness controlado |
| Phase 8 | Cerrada y congelada | Evidence expansion y clasificación de evidencia benchmark |
| Phase 9 | Cerrada y congelada | Limpieza de deuda TypeScript |
| Phase 10 | En organización | Calibración experimental opcional del antiguo laboratorio |

## Roadmap inmediato

### 1. Mantenimiento documental

Prioridad alta antes de nuevas features.

- Separar definitivamente Entrega 3 de producto posterior.
- Migrar Phase 8 y Phase 9 a `docs/product/aura/phases/`.
- Migrar Phase 5–7 en una fase posterior.
- Revisar documentos ambiguos de resultados, evidencia y futuras entregas.

### 2. Phase 10 — Calibración opcional

Objetivo:

- integrar el antiguo laboratorio como opción informada dentro del flujo principal;
- retirar el laboratorio como módulo visible principal;
- mantener el flujo base sin obligación de calibración.

Regla de experiencia:

- acción primaria: continuar diagnóstico normal;
- acción secundaria: activar comparación experimental.

### 3. Validación y evidencia

Cada fase nueva debe dejar:

- alcance explícito;
- claims permitidos y prohibidos;
- pruebas o verificación aplicable;
- limitaciones conocidas;
- ruta documental correcta.

## Regla de organización

- Entregas académicas cerradas: carpeta histórica correspondiente.
- Producto vivo: `docs/product/aura/`.
- Evidencia experimental de producto: `docs/product/aura/evidence/`.
- Fases de producto: `docs/product/aura/phases/` o carpeta específica de fase.

## No iniciar sin instrucción explícita

No preparar una cuarta entrega académica ni memoria final desde este roadmap sin instrucción directa del usuario.
