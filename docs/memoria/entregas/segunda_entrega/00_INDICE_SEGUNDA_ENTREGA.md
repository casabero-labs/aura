# Indice operativo de segunda entrega

> Uso: empezar por este archivo cuando se trabaje la segunda entrega. La carpeta contiene documentos utiles, pero varios nacieron en momentos distintos; este indice define el orden de lectura para evitar contradicciones.

## 1. Linea oficial vigente

Leer primero:

- `LINEA_OFICIAL_AURA.md`

Rol:

- fija la tesis central de AURA;
- define los objetivos especificos reordenados;
- evita promesas no demostradas, especialmente "precision total";
- conecta objetivos, capas, benchmarks y evidencia de codigo.

## 2. Borrador base para el documento de segunda entrega

Leer y usar como base de escritura:

- `BORRADOR_SEGUNDA_ENTREGA_CORREGIDA.md`
- `ESTRUCTURA_DOCUMENTO_SEGUNDA_ENTREGA.md`

Rol:

- propone el objetivo general;
- formula los cuatro objetivos especificos en el nuevo orden;
- deja una estructura de capitulos para transformar la primera entrega en segunda entrega;
- indica que partes de la primera entrega se conservan y que partes se corrigen.
- convierte los requisitos de semana 10 en una estructura concreta para el Word.

## 3. Matriz de evidencia para anexos y resultados

Leer antes de capturar pantallas o exportar artefactos:

- `MATRIZ_EVIDENCIA_AURA_SEGUNDA_ENTREGA.md`

Rol:

- cruza OE1-OE4 con evidencia documental y evidencia generada por codigo;
- indica que artefactos debe producir AURA para anexar al documento;
- separa evidencia valida, evidencia preliminar e intentos fallidos.

## 4. Propuesta de mejora del flujo de AURA

Leer para alinear tesis y producto:

- `PROPUESTA_FLUJO_AURA_REORDENADO.md`

Rol:

- analiza el flujo actual del codigo;
- identifica el enredo entre pipeline, benchmark, scripts y exportacion;
- propone una estructura tecnica que satisfaga los nuevos objetivos.

## 5. Documentos de soporte ya existentes

Usar como respaldo, no como linea principal:

- `CORRECCION_OE1.md`: evidencia para corregir "precision total".
- `ANALISIS_OBJETIVOS_CAPAS_Y_EXPERIMENTACION.md`: analisis previo de capas, objetivos y experimentacion.
- `OBSERVACIONES_SECCION_3_3_3.md`: texto de apoyo para arquitectura de capas.
- `PROPUESTA_CICLO_MEJORA_GUIADO_EVIDENCIA.md`: antecedente del ciclo mejora-evidencia.
- `ALINEACION_DESARROLLO_CAPAS_BENCHMARK.md`: mapa entre desarrollo, capas y benchmark.
- `DIAGNOSTICO_TFM_AURA.md`: diagnostico general de riesgos de la memoria.
- `SINTESIS_RETROALIMENTACION_PRIMERA_ENTREGA.md`: continuidad con la primera entrega.
- `REPORTE_CONSISTENCIA_REPO.md`: inconsistencias conocidas entre repo, memoria y experimentos.
- `PLAN_SEGUNDA_ENTREGA_SEMANA_10.md`: plan de trabajo por capitulos.
- `SITUACIONES_DATASET_PARA_REFORZAR_AURA.md`: ideas para ampliar reglas, benchmarks o casos de prueba.

## 6. Criterio de orden

La segunda entrega debe contarse en este flujo:

1. Arquitectura local-first.
2. Motor determinista reproducible.
3. Diagnostico y generacion de scripts con LLM.
4. Comparacion experimental integrada y gobernanza HITL.

No conviene presentar benchmark, scripts y LLM como piezas separadas. El benchmark debe medir el comportamiento de la capa LLM cuando diagnostica y genera scripts sobre la misma evidencia determinista.
