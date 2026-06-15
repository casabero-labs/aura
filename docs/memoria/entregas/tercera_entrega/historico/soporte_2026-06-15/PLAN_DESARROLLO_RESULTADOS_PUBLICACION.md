# Plan de desarrollo, resultados y publicacion

> Proposito: priorizar el trabajo desde ahora hasta una tercera entrega solida y un articulo publicable.

## 1. Norte del trabajo

La prioridad no es agregar mas pantallas ni mas documentos. La prioridad es producir evidencia:

1. Reproducible.
2. Exportable.
3. Vinculada a objetivos.
4. Util para la memoria.
5. Reutilizable en articulo.

## 2. Sprints recomendados

### Sprint 1 - Protocolo y limpieza documental

Objetivo: cerrar el marco experimental y dejar la documentacion respirable.

Entregables:

- Carpeta `tercera_entrega/` como fuente viva.
- Segunda entrega compactada con historico archivado.
- Plan ejecutable en `docs/plans/2026-06-06-aura-tercera-entrega-resultados.md`.
- Matriz OE -> evidencia -> resultado.

### Sprint 2 - Motor determinista formal

Objetivo: convertir el resultado preliminar del motor en tabla defendible.

Acciones:

- Ampliar validacion por regla.
- Documentar ground truth.
- Explicar umbrales.
- Generar tabla APA-ready.

Comandos objetivo:

```bash
cd /Users/casabero/Documents/GitHub/aura/experiments
npx tsx benchmarks/validate_deterministic.ts
```

Resultado esperado:

- `experiments/results/deterministic_validation.json`
- `docs/tablas/resultados_motor_determinista_por_regla.md`

### Sprint 3 - Benchmark LLM formal

Objetivo: producir resultados comparativos objetivos para OE4.

Protocolo operativo:

- `docs/experiments/PROTOCOLO_BENCHMARK_AURA_2026-06.md`

Configuracion minima:

- Dataset: `synthetic_ground_truth.csv` y un dataset sucio operacional.
- Input modes: `smart_sample` y `prompt_libre`.
- Temperatura: 0.1 como base.
- Modelos minimos: un cloud disponible y un local disponible, o documentar local como `attempted_failed` si WebGPU/modelo no inicializa.
- Repeticiones: minimo 3 por configuracion si el tiempo/costo lo permite.

Metricas:

- latencia;
- cumplimiento de contrato (`contractCompliance`);
- JSON real solo cuando `hallucinationReport.jsonCompliance` sea verdadero;
- columnas alucinadas;
- claims sin soporte;
- script incluido;
- validez de script;
- score compuesto;
- estado de evidencia.

### Sprint 4 - Ciclo HITL y delta de salud

Objetivo: demostrar que AURA no solo diagnostica, sino que ayuda a seleccionar una intervencion.

Flujo:

1. Cargar dataset.
2. Perfilar.
3. Diagnosticar con LLM.
4. Generar script.
5. Validar script.
6. Aprobar o marcar HITL.
7. Simular mejora.
8. Exportar improvement run.

Resultado esperado:

- `aura_audit_*.json`
- `aura_issues_*.csv`
- `aura_script_aprobado_*.py`
- `aura_improvement_run_*.json`
- tabla de delta de salud.

### Sprint 5 - Escritura academica

Objetivo: insertar resultados sin prometer mas de lo medido.

Capitulos a reforzar:

- Cap. 2: estado del arte critico.
- Cap. 3: diseno experimental.
- Cap. 5: arquitectura y evidencia.
- Resultados: tablas formales.
- Discusion: impacto aplicado.
- Conclusiones: avance por objetivo y limites.

### Sprint 6 - Articulo

Objetivo: convertir el TFM en paper de arquitectura y evaluacion.

Titulo recomendado:

> AURA: A Hybrid Deterministic-Cognitive Architecture for Browser-Native Data Quality Diagnosis with Hallucination-Resistant LLM Integration

Contribuciones del articulo:

1. Arquitectura hibrida local-first para diagnostico de calidad del dato.
2. Motor determinista reproducible con evaluacion precision/recall.
3. Contrato LLM anclado a smart sample para mitigar alucinaciones.
4. Benchmark local/cloud y prompt libre/smart sample.
5. Ciclo HITL de generacion, validacion y simulacion de scripts.

Resultados imprescindibles para someter:

- tabla formal del motor;
- benchmark LLM;
- estudio de ablacion smart sample vs prompt libre;
- evidencia de script validation;
- delta de salud;
- repositorio o paquete de replicacion.

## 3. Figuras y tablas requeridas

| Tipo | Nombre | Fuente |
|---|---|---|
| Figura | Arquitectura de 4 capas | `MainPipeline`, `aiProvider`, `benchmarkService` |
| Figura | Flujo end-to-end AURA | captura o diagrama derivado del pipeline |
| Tabla | Estado del arte comparativo | Cap. 2 + fuentes verificadas |
| Tabla | Motor por regla | `deterministic_validation_by_rule.json` |
| Tabla | Benchmark LLM | `benchmark_llm_formal.json` |
| Tabla | Delta de salud | `ImprovementRun` |
| Tabla | Objetivos vs evidencia | `MATRIZ_EVIDENCIA_RESULTADOS.md` |

## 4. Decision de producto

Desarrollar solo lo que produce evidencia. Cualquier mejora visual o funcional debe responder a una de estas preguntas:

- Ayuda a generar resultado formal?
- Ayuda a exportar evidencia?
- Ayuda a reproducir el experimento?
- Ayuda a sostener el articulo?

Si la respuesta es no, queda para despues de la tercera entrega.
