# Mapa maestro del TFM AURA

> Brújula única del proyecto. Ante contradicciones prevalecen: artefactos reproducibles, código vigente, este mapa, documentación de fase y, al final, borradores históricos.

## Norte

AURA separa cinco responsabilidades: hechos deterministas, interpretación LLM restringida, decisión de remediación determinista, aprobación humana y ejecución/medición posterior.

Cadena narrativa: CSV → fingerprint y auditoría local → evidencia limitada → diagnóstico restringido → plan determinista → aprobación HITL → script validado → ejecución y delta.

## Estado

| Fase | Estado | Fuente |
|---|---|---|
| Phase 1: EvidenceEnvelopeV2 | Cerrada | código y tests |
| Phase 2: DiagnosisResponseV2 | Cerrada | código y tests |
| Phase 3: RemediationPlanV2 + HITL | **Congelada** | `03_evidencia/PAQUETE_EVIDENCIA_PHASE3.md` |
| Phase 4: ScriptContractV2 + renderer | **Siguiente** | `05_desarrollo/ROADMAP_FASES_RESTANTES.md` |
| Phase 5: ejecución, reauditoría y delta | Pendiente | roadmap |
| Phase 6: experimento y memoria final | Pendiente | roadmap |

Freeze Phase 3: `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.

## Protegido

No modificar capturas 01–06, harness E2E, Contracts v2 cerrados, validation results, `CAPTURAS_MANIFEST.md` ni `PAQUETE_EVIDENCIA_PHASE3.md`.

Capturas 01–03 muestran perfilamiento real. Capturas 04–06 usan harness determinista. Ollama quick run es smoke test, no benchmark formal.

## Documentos vivos

- `00_MAPA_MAESTRO_TFM.md`: estado y jerarquía.
- `05_desarrollo/NEXT_STEPS.md`: próxima tarea.
- `05_desarrollo/ROADMAP_FASES_RESTANTES.md`: alcance Phase 4–6.
- `05_desarrollo/PLANTILLA_CIERRE_FASE.md`: documentación obligatoria.
- `03_evidencia/MATRIZ_EVIDENCIA_RESULTADOS.md`: OE → evidencia → resultado → límite.

## Regla de cierre

Cada loop deja código, tests/build, artefacto reproducible, métrica o tabla, vínculo con objetivos, limitaciones/claims y actualización de `NEXT_STEPS.md`. Una fase no se cierra solo con código.

## Claims aún no permitidos

No afirmar inferencia LLM real en capturas 04–06, ScriptContractV2 terminado, ejecución real en navegador, mejora sin delta, modelo ganador sin benchmark formal ni eliminación de alucinaciones.
