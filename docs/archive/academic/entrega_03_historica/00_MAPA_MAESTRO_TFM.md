# Mapa maestro del TFM AURA

> Brújula única del proyecto. Ante contradicciones prevalecen: artefactos reproducibles, código vigente, este mapa, documentación de fase y, al final, borradores históricos.

## Norte

AURA separa cinco responsabilidades: hechos deterministas, interpretación LLM restringida, decisión de remediación determinista, aprobación humana y ejecución/medición posterior.

Cadena narrativa cerrada hasta Entrega 3:

```text
CSV → fingerprint y auditoría local → evidencia limitada → diagnóstico restringido → plan determinista → aprobación HITL → script validado → revisión humana read-only → aprobación sin ejecución
```

La ejecución del script, la reauditoría y el HealthDelta pertenecen a Phase 5.

## Estado

| Fase | Estado | Fuente |
|---|---|---|
| Phase 1: EvidenceEnvelopeV2 | Cerrada | código y tests |
| Phase 2: DiagnosisResponseV2 | Cerrada | código y tests |
| Phase 3: RemediationPlanV2 + HITL | **Congelada** | `03_evidencia/PAQUETE_EVIDENCIA_PHASE3.md` |
| Phase 4: ScriptContractV2 + renderer | **Cerrada y congelada** | `aa167995316962a70ff41a3970326d4824d980c0` |
| Entrega 3 | **Consolidada hasta Phase 4** | `01_borrador/TERCERA_ENTREGA_AURA_CONSOLIDADA.md` |
| Phase 5: ejecución, reauditoría y delta | Diseño pendiente | `05_desarrollo/phases/phase_05/` |
| Phase 6: experimento y memoria final | Pendiente | roadmap |

Freeze Phase 3: `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.
Freeze final Phase 4: `05878e4a960afd11d564a60f4924bfb8f0b527e7`.

## Protegido

No modificar capturas 01–06, harness E2E, Contracts v2 cerrados, validation results, `CAPTURAS_MANIFEST.md` ni `PAQUETE_EVIDENCIA_PHASE3.md` sin un loop documental explícito.

Capturas 01–03 muestran perfilamiento real. Capturas 04–06 usan harness determinista. Capturas 07–12 muestran evidencia contractual Phase 4 con harness determinista. Ollama quick run es smoke test, no benchmark formal.

## Documentos vivos

- `00_MAPA_MAESTRO_TFM.md`: estado y jerarquía.
- `00_LEEME.md`: entrada documental.
- `01_borrador/TERCERA_ENTREGA_AURA_CONSOLIDADA.md`: documento principal para Entrega 3.
- `05_desarrollo/NEXT_STEPS.md`: próxima tarea.
- `05_desarrollo/ROADMAP_FASES_RESTANTES.md`: alcance Phase 4–6.
- `05_desarrollo/phases/phase_04/CIERRE_PHASE4.md`: cierre formal Phase 4.
- `05_desarrollo/phases/phase_05/PHASE5_DESIGN.md`: diseño pendiente Phase 5.
- `05_desarrollo/phases/phase_05/IMPROVEMENT_RUN_CONTRACT.md`: contrato preliminar Phase 5.
- `05_desarrollo/phases/phase_05/PLAN_LOOPS_PHASE5.md`: loops propuestos Phase 5.
- `03_evidencia/MATRIZ_EVIDENCIA_RESULTADOS.md`: OE → evidencia → resultado → límite.

## Regla de cierre

Cada loop deja código o documento, tests/build cuando aplique, artefacto reproducible, métrica o tabla, vínculo con objetivos, limitaciones/claims y actualización de `NEXT_STEPS.md`. Una fase no se cierra solo con código.

## Claims permitidos para Entrega 3

- AURA implementa un flujo local-first de auditoría CSV con evidencia determinista.
- Phase 3 produce `RemediationPlanV2` con gobernanza HITL.
- Phase 4 produce `ScriptContractV2` validado, verificado y aprobado por revisión humana.
- El contrato incluye hash verificable y referencias de columnas validadas.
- La UI bloquea aprobación ante contrato manipulado.
- Phase 4 no ejecuta Python ni calcula HealthDelta.

## Claims aún no permitidos

No afirmar inferencia LLM real en capturas con harness, ejecución real de Python en navegador, dataset corregido, mejora sin delta, modelo ganador sin benchmark formal ni eliminación de alucinaciones.