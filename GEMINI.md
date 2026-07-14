# AURA — instrucciones vigentes del repositorio

## Identidad

- Proyecto: AURA — Entorno de diagnóstico de calidad del dato con evaluación comparativa de LLM.
- Tipo: Trabajo Fin de Máster, desarrollo de software.
- Autor: Joseph David Gari Bustos.
- Universidad: Universidad Internacional de La Rioja (UNIR).

## Fuentes que mandan

1. `docs/product/aura/NEXT_STEPS.md` — estado técnico y experimental vigente.
2. `docs/tfm/memoria_final/README.md` — mapa de fuentes canónicas para redactar el documento final.
3. Artefactos exportados, código y tests del commit de trabajo.
4. `docs/plans/2026-07-09-cierre-definitivo-aura.md` — línea base histórica del cierre, no bitácora operativa reciente.
5. `docs/archive/academic/` — entregas históricas y antecedentes; no define trabajo nuevo.

Cuando dos documentos se contradicen, prevalece la evidencia reproducible más reciente y después `NEXT_STEPS.md`.

## Objetivo de trabajo actual

Cerrar la evidencia y preparar la memoria final. No abrir Phase 11, nuevas funcionalidades, roadmaps paralelos ni otra entrega intermedia.

## Flujo vigente del producto

```text
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
                                 └→ Remediación opcional → revisión HITL → ejecución controlada y reauditoría
```

El Laboratorio OE4 es una capacidad experimental separada. Conserva campañas, corridas válidas y fallidas, prompts, respuestas, métricas, recibos y revisiones humanas.

## Objetivos específicos definitivos

- OE1 — Arquitectura local-first: carga, procesamiento y auditoría CSV en navegador con trazabilidad y minimización de datos compartidos.
- OE2 — Motor determinista: reglas explícitas y evaluación TP, FP, FN, precisión, recall y F1.
- OE3 — Diagnóstico asistido restringido: LLM limitado por evidencia estructurada y sin modificar el score determinista.
- OE4 — Laboratorio de comparación: modelos y métodos bajo un contrato común, distinguiendo piloto, resultado experimental y benchmark formal.
- OE5 — Gobernanza HITL: aprobación humana antes de generar o ejecutar remediaciones.
- OE6 — Scripts revisables y trazables: Python/Pandas derivado de acciones aprobadas, con recibos, hashes y reauditoría.

No reagrupar estos seis objetivos usando versiones históricas de cuatro, cinco u ocho objetivos.

## Arquitectura vigente

- Motor determinista en TypeScript ejecutado sobre el CSV en el navegador.
- Contratos V2 y paquetes de evidencia para restringir la capa LLM.
- Proveedores principales: Ollama local, Chrome AI opt-in y proveedores cloud configurables.
- WebLLM puede permanecer como compatibilidad o experimento, pero no debe describirse como proveedor principal de producción.
- Plan y script de remediación generados bajo reglas deterministas y decisiones humanas.
- Runner Python externo/local sobre una copia controlada; AURA no ejecuta Python dentro del navegador.
- Exportaciones PDF, JSON, CSV, ZIP, recibos y manifiestos verificables.

## Reglas de desarrollo durante el cierre

1. No añadir features salvo que reparen un bloqueo real de evidencia o depósito.
2. No alterar dataset, modelos, métodos, parámetros o contratos después de iniciar una campaña formal.
3. Conservar fallos, pausas, truncamientos e incumplimientos contractuales; no repetir silenciosamente para mejorar resultados.
4. El score y los hallazgos pertenecen al motor determinista. El LLM interpreta, no recalcula ni corrige la evidencia primaria.
5. Ningún script se ejecuta sin aprobación humana y validación fail-closed.
6. No usar datasets con PII real para la evidencia del TFM.
7. No afirmar `production-ready`, corrección automática universal, benchmark definitivo o modelo ganador sin evidencia suficiente.
8. Cada claim del documento final debe enlazar con un artefacto, hash, recibo, test o commit verificable.
9. La redacción final se organiza únicamente bajo `docs/tfm/memoria_final/`.
10. Los scripts específicos de primera, segunda o tercera entrega no deben reutilizarse para modificar el documento final.

## Evidencia canónica mínima

- `experiments/results/final_deterministic_evidence.json`
- `experiments/results/final_deterministic_evidence.md`
- campañas y expedientes bajo `experiments/final-evaluation/` y `experiments/tests/`
- protocolo OE4 bajo `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm*.md`
- estado actualizado en `docs/product/aura/NEXT_STEPS.md`

## Validaciones habituales

Desde `src/`, según el alcance del cambio:

```bash
npm run typecheck
npm run build
npm test -- --run
```

Los E2E estándar no dependen de proveedores reales ni descargan modelos. Las pruebas reales de Chrome AI son opt-in, usan Google Chrome y un perfil persistente dedicado, nunca el perfil personal ni CI normal.
