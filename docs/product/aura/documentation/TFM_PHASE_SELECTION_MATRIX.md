# Matriz de selección documental por fases — TFM AURA

## Estado

Documento de trabajo para decidir qué tomar de cada fase de AURA al redactar el TFM o una memoria final.

No pertenece a una entrega académica específica.

## Propósito

Evitar dos errores:

1. meter todo el historial técnico en el documento y convertirlo en una bodega ilegible;
2. perder evidencia útil por miedo a mezclar fases.

La regla es simple: cada fase puede aportar, pero no toda fase aporta como resultado principal. Algunas fases son metodología, otras resultados, otras limitaciones y otras trabajo futuro.

## Regla de frontera

La tercera entrega quedó consolidada hasta Phase 4. Phase 5 en adelante debe tratarse como desarrollo posterior de producto, validación controlada, evidencia complementaria o trabajo futuro según corresponda.

## Matriz ejecutiva

| Fase | Qué aporta al documento | Dónde usarlo | Nivel de fuerza | Qué no afirmar |
|---|---|---|---|---|
| Phase 1 | Modelo de evidencia determinista y trazabilidad inicial | Metodología / arquitectura | Núcleo fuerte | No venderlo como solución completa |
| Phase 2 | Diagnóstico LLM restringido por evidencia | Metodología / diseño de IA gobernada | Núcleo fuerte | No afirmar razonamiento libre ni inferencia no controlada |
| Phase 3 | Plan de remediación y gobernanza HITL | Metodología / resultados de diseño | Núcleo fuerte | No afirmar ejecución ni corrección del dataset |
| Phase 4 | ScriptContractV2, validación, hash y revisión humana read-only | Resultado principal de Entrega 3 / arquitectura de confianza | Núcleo fuerte | No afirmar ejecución Python ni HealthDelta |
| Phase 5 | Ejecución delegada, reauditoría, HealthDelta e ImprovementRun sobre alcance controlado | Evolución del prototipo / validación controlada / trabajo posterior | Complementario fuerte | No afirmar validación externa general ni dataset real corregido |
| Phase 6 | UI wrapper para visualizar ImprovementRun/HealthDelta | Diseño de interfaz / extensión funcional | Complementario | No afirmar integración definitiva en flujo principal si era workspace aislado |
| Phase 7 | QA, evidencias visuales, límites demo/producto y no-regresión | Validación técnica / madurez del prototipo | Complementario | No afirmar production-ready |
| Phase 8 | Evidence expansion, proveedor opt-in, clasificación de evidencia benchmark | Discusión experimental / limitaciones de evaluación LLM | Complementario con cautela | No afirmar benchmark formal definitivo |
| Phase 9 | Limpieza de deuda TypeScript, typecheck y build | Calidad técnica / mantenibilidad | Complementario técnico | No afirmar que mejora funcionalmente el producto |
| Phase 10 | Reorganización del laboratorio como calibración opcional | Trabajo en curso / mejora de UX / diseño futuro | Pendiente | No afirmar integración completada hasta implementarla |

## Uso recomendado por capítulo

### 1. Introducción

Tomar de:

- Phase 1–4 para explicar el problema: auditoría de calidad de datos con apoyo de IA, pero controlada por evidencia.
- Phase 5–10 solo como alcance evolutivo, no como núcleo de la entrega cerrada.

### 2. Marco conceptual

Tomar de:

- Phase 1: trazabilidad, evidencia reproducible, fingerprint.
- Phase 2: IA restringida por evidencia.
- Phase 3: revisión humana HITL.
- Phase 4: contratos verificables, hash y control de manipulación.
- Phase 8: clasificación de evidencia LLM, pero como discusión crítica.

### 3. Metodología

Tomar de:

- Phase 1–4 como método principal.
- Phase 5 si se describe una extensión controlada para medir antes/después.
- Phase 7 y Phase 9 como metodología de aseguramiento técnico.

### 4. Desarrollo del sistema

Tomar de:

- Phase 1: ingestión, perfilamiento y evidencia.
- Phase 2: diagnóstico estructurado.
- Phase 3: plan de remediación y decisión humana.
- Phase 4: generación y validación contractual de script.
- Phase 5–6: módulo posterior de ejecución delegada y visualización de delta.
- Phase 10: rediseño de experiencia para no aislar el laboratorio.

### 5. Resultados

Usar con jerarquía:

1. Resultados fuertes: Phase 3–4 si están congelados y evidenciados.
2. Resultados complementarios: Phase 5–7 si se aclara que son controlados.
3. Resultados experimentales: Phase 8 si se clasifica evidencia como preliminary, attempted o formal según corresponda.
4. Resultados técnicos: Phase 9 como mantenibilidad, no como mejora funcional.

### 6. Limitaciones

Tomar de:

- Phase 4: no ejecución Python, no HealthDelta en tercera entrega.
- Phase 5: escenarios controlados, no dataset real general.
- Phase 7: no production-ready.
- Phase 8: no benchmark formal si no hay protocolo suficiente.
- Phase 9: typecheck limpio no garantiza corrección semántica total.
- Phase 10: integración en curso.

### 7. Trabajo futuro

Tomar de:

- Phase 8: validación con proveedores reales bajo protocolo.
- Phase 10: calibración experimental integrada al flujo.
- Migración documental: separar producto vivo de entregas académicas.

## Qué usar por fase

### Phase 1 — EvidenceEnvelopeV2

Usar como base metodológica.

Aporta:

- evidencia determinista;
- trazabilidad;
- fingerprint del dataset;
- separación entre hechos observados e interpretación.

Ubicación sugerida:

- metodología;
- arquitectura;
- diseño de evidencia.

### Phase 2 — DiagnosisResponseV2

Usar para explicar la capa LLM controlada.

Aporta:

- diagnóstico estructurado;
- interpretación restringida por evidencia;
- separación entre motor determinista e IA.

Ubicación sugerida:

- metodología;
- arquitectura IA;
- control de alucinaciones desde el diseño.

### Phase 3 — RemediationPlanV2 + HITL

Usar como eje de gobernanza.

Aporta:

- plan de remediación estructurado;
- intervención humana;
- límites de automatización;
- decisión auditada.

Ubicación sugerida:

- metodología;
- gobernanza;
- resultados de diseño.

No afirmar:

- que el dataset fue corregido;
- que la recomendación fue ejecutada automáticamente.

### Phase 4 — ScriptContractV2

Usar como resultado fuerte.

Aporta:

- contrato de script;
- hash verificable;
- validación de columnas;
- revisión humana read-only;
- bloqueo ante manipulación.

Ubicación sugerida:

- resultados principales;
- arquitectura de confianza;
- discusión de seguridad y trazabilidad.

No afirmar:

- ejecución Python;
- cálculo de HealthDelta;
- dataset corregido.

### Phase 5 — ImprovementRun y HealthDelta controlado

Usar como evolución posterior o validación controlada.

Aporta:

- ejecución delegada;
- reauditoría;
- medición antes/después;
- ImprovementRun como paquete de evidencia.

Ubicación sugerida:

- desarrollo posterior;
- validación controlada;
- anexos técnicos.

No afirmar:

- validación externa independiente;
- mejora general sobre datos reales;
- corrección automática universal.

### Phase 6 — UI wrapper

Usar como evidencia de interfaz y observabilidad.

Aporta:

- visualización del ImprovementRun;
- exportación JSON;
- logs visibles;
- navegación técnica.

Ubicación sugerida:

- desarrollo del sistema;
- interfaz;
- anexos de implementación.

No hacerlo eje central del TFM.

### Phase 7 — QA y readiness controlado

Usar como evidencia de madurez técnica.

Aporta:

- pruebas E2E;
- capturas visuales;
- pruebas de claims visibles;
- separación demo/producto;
- no-regresión.

Ubicación sugerida:

- validación técnica;
- aseguramiento de calidad;
- limitaciones.

No afirmar:

- production-ready;
- uso real generalizado.

### Phase 8 — Evidence expansion y clasificación benchmark

Usar con máxima cautela.

Aporta:

- protocolo de evidencia ampliada;
- clasificación de corridas LLM;
- límites de proveedores reales;
- diferencia entre attempted, preliminary y formal.

Ubicación sugerida:

- discusión;
- evaluación experimental;
- limitaciones;
- trabajo futuro.

No afirmar:

- benchmark formal definitivo;
- mejor modelo universal;
- proveedores siempre disponibles.

### Phase 9 — Technical Debt Cleanup

Usar como calidad técnica y mantenibilidad.

Aporta:

- baseline de deuda TypeScript;
- resolución por loops;
- typecheck en cero;
- build y tests verificados;
- disciplina de no modificar comportamiento funcional.

Ubicación sugerida:

- aseguramiento técnico;
- mantenibilidad;
- anexos técnicos.

No afirmar:

- mejora funcional;
- validación total del producto;
- eliminación de todos los riesgos.

### Phase 10 — Calibración experimental opcional

Usar como trabajo en curso o decisión de diseño futuro.

Aporta:

- decisión UX: laboratorio no debe ser módulo principal;
- calibración como opt-in;
- continuidad del flujo base;
- límites contra claims de benchmark.

Ubicación sugerida:

- trabajo futuro;
- mejora de experiencia;
- diseño de evaluación LLM.

No afirmar:

- integración completada si no está implementada;
- benchmark formal;
- mejor modelo universal.

## Recomendación narrativa

La narrativa más sólida para el documento es:

```text
AURA no nace como una IA que corrige datos automáticamente, sino como un sistema de auditoría asistida por IA con evidencia determinista, contratos verificables, revisión humana y medición controlada posterior.
```

## Regla final

Usar fases como capas, no como lista cronológica exhaustiva.

El documento debe contar una arquitectura de confianza:

1. hechos deterministas;
2. interpretación restringida;
3. decisión humana;
4. contrato verificable;
5. medición controlada;
6. evaluación experimental limitada;
7. mejora continua del producto.
