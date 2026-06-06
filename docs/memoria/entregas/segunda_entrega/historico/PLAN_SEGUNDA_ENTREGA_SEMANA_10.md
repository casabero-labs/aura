# Plan de segunda entrega - Semana 10

> Objetivo: convertir la primera entrega revisada en un borrador intermedio solido, sin alejarse de la narrativa aprobada.

## 1. Principio rector

La segunda entrega debe mostrar avance, cierre metodologico y madurez experimental. No es una version final ni una reescritura total. Es el punto donde:

- Capitulo 2 queda finalizado.
- Capitulo 3 queda finalizado.
- Capitulo 5 muestra avances significativos de implementacion.
- Resultados, introduccion y conclusiones empiezan a tomar forma con bocetos coherentes.

## 2. Trabajo por capitulo

### Capitulo 1. Introduccion

Estado esperado: refinamiento, no reescritura.

Acciones:

- Mantener la motivacion valorada positivamente por el profesor.
- Reducir frases demasiado extensas si dificultan lectura.
- Ajustar el planteamiento para reflejar que AURA ya tiene motor, proveedores IA y primeros experimentos.
- No convertir la introduccion en resultados.

### Capitulo 2. Contexto y estado del arte

Estado esperado: version final para semana 10.

Acciones:

- Integrar tabla comparativa herramientas vs AURA.
- Reforzar contraste entre:
  - herramientas rule-based;
  - plataformas cloud de observabilidad;
  - enfoques LLM-based;
  - propuesta hibrida local-first de AURA.
- Mantener fuentes actuales, pero verificar referencias nuevas antes de entrega final.
- Cerrar con gap claro: falta una solucion que combine evidencia determinista, diagnostico cognitivo, privacidad y gobernanza.

Evidencia disponible:

- `docs/tablas/tabla_comparativa_herramientas.md`
- `docs/referencias/registro_bibliografico.md`

### Capitulo 3. Objetivos y metodologia

Estado esperado: version final para semana 10.

Acciones:

- Mantener el objetivo general de la primera entrega.
- Ajustar objetivos especificos para que sean medibles y no prometan resultados no validados.
- Desarrollar CRISP-DM paso a paso aplicado a AURA.
- Desarrollar Scrum con sprints y entregables.
- Ajustar 3.3.3 sin perder la idea original de capas.

Punto clave:

3.3.3 debe explicar que las capas no son solo modulos tecnicos, sino una estrategia metodologica para controlar riesgos: privacidad, ruido determinista, alucinacion LLM y decisiones no auditadas.

Evidencia disponible:

- `docs/memoria/entregas/segunda_entrega/OBSERVACIONES_SECCION_3_3_3.md`
- `docs/memoria/entregas/segunda_entrega/ANALISIS_OBJETIVOS_CAPAS_Y_EXPERIMENTACION.md`

### Capitulo 5. Desarrollo especifico de la contribucion

Estado esperado: avance significativo.

Acciones:

- Sustituir placeholders de plantilla por contenido real de AURA.
- Incluir arquitectura de 4 capas.
- Describir requisitos funcionales y no funcionales.
- Documentar Capa 0: parsing local, WebLLM/WebGPU, minimizacion de datos enviados.
- Documentar Capa 1: `auditEngine.ts`, familias de reglas, score, `AuditReport`.
- Documentar Capa 2: `aiProvider.ts`, smart sample, GeminiProvider, WebLLMProvider, mecanismos anti-alucinacion.
- Documentar Capa 3: PDF, scripts Pandas, human-in-the-loop.
- Incluir capturas de pantalla de la UI.

Evidencia disponible:

- `src/services/auditEngine.ts`
- `src/services/csvService.ts`
- `src/services/aiProvider.ts`
- `src/services/providers/`
- `src/services/pdfGenerator.ts`
- `docs/tablas/catalogo_reglas_motor_determinista.md`
- `docs/tablas/diseno_capa_cognitiva.md`
- `docs/figuras/`

### Resultados preliminares

Estado esperado: boceto con primeras metricas.

Acciones:

- Presentar la validacion preliminar del motor determinista como experimento controlado, no como resultado final.
- Explicar precision, recall y F1.
- Indicar que el benchmark LLM esta preparado pero debe ejecutarse con credenciales validas y prueba local WebLLM.

Evidencia disponible:

- `experiments/results/deterministic_validation.json`
- `docs/tablas/resultados_motor_determinista.md`
- `docs/tablas/resultados_benchmark_llm.md`

### Conclusiones preliminares

Estado esperado: primer esbozo.

Acciones:

- Relacionar cada OE con avance actual.
- No cerrar conclusiones definitivas.
- Mostrar que los resultados preliminares ya justifican la arquitectura: reglas reproducibles + LLM anclado + HITL.

## 3. Checklist de entrega

| Bloque | Estado deseado semana 10 |
|---|---|
| Capitulo 2 | Finalizado |
| Capitulo 3 | Finalizado |
| Capitulo 5 | Avance sustancial |
| Resultados | Boceto con metricas preliminares |
| Introduccion | Refinada |
| Conclusiones | Esbozo inicial |
| Formato Word | Obligatorio |
| APA 7 | Citas nuevas integradas |
| Indices | Actualizados |
| Figuras/tablas | Con titulo y fuente |

## 4. Orden recomendado de trabajo

1. Crear documento Word de segunda entrega a partir de la primera entrega.
2. Integrar feedback del profesor en Cap. 2.
3. Ajustar objetivos y metodologia en Cap. 3.
4. Desarrollar Cap. 5 con evidencia de codigo y capturas.
5. Insertar resultados preliminares.
6. Ajustar introduccion y conclusiones preliminares.
7. Revisar formato, indices, tablas, figuras y APA.

