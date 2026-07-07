# Plan vivo de trabajo — Tercera entrega AURA

> Propósito: desarrollar AURA y consolidar el documento académico al mismo tiempo. No se espera al final para redactar ni para reunir evidencia.

## 1. Regla operativa

Cada cierre técnico debe dejar seis productos:

1. código funcional;
2. pruebas y validación reproducible;
3. artefacto exportable;
4. métrica o tabla académica;
5. vínculo explícito con un objetivo específico;
6. actualización del borrador con resultado, interpretación y limitación.

Una fase no se considera cerrada para la tercera entrega si solo existen código y tests.

## 2. Documentos que se actualizan en paralelo

Después de cada fase se revisan estos archivos:

- `01_borrador/BORRADOR_TERCERA_ENTREGA_AURA.md`: narrativa académica y estado real del proyecto.
- `03_evidencia/MATRIZ_EVIDENCIA_RESULTADOS.md`: relación objetivo → evidencia → resultado → limitación.
- `04_resultados/`: tablas y resultados listos para memoria/artículo.
- `03_evidencia/results/`: JSON, CSV, manifiestos y salidas reproducibles.
- `05_desarrollo/NEXT_STEPS.md`: siguiente tarea concreta y criterio de cierre.

## 3. Cadencia por fase

### Antes de implementar

- definir qué objetivo específico sostiene la fase;
- definir la afirmación que podrá hacerse si el resultado es positivo;
- definir la limitación que se reportará si el resultado es negativo;
- fijar métricas, datasets y artefactos esperados.

### Durante la implementación

- registrar decisiones arquitectónicas relevantes;
- conservar hashes, configuración y versión de código;
- distinguir resultado válido, preliminar e intento fallido;
- evitar capturas o tablas sin fuente reproducible.

### Al cerrar la fase

- ejecutar tests, build y harness correspondiente;
- exportar evidencia;
- generar o actualizar tabla académica;
- actualizar la matriz objetivo-evidencia;
- incorporar un apartado breve al borrador;
- registrar limitaciones y claims permitidos/no permitidos.

## 4. Estrategia de datasets

No se espera hasta el final para probar todo con un único dataset.

Se usarán dos niveles:

### Validación controlada

- `synthetic_ground_truth.csv`
- propósito: ground truth conocido, TP/FP/FN, precision, recall, F1, cobertura y seguridad.

### Caso aplicado

- `titanic.csv` como caso principal reproducible;
- `adult_income.csv` como contraste adicional cuando aporte valor.

Cada fase usa fixtures pequeños o datasets controlados. Al completar el flujo se ejecuta un experimento end-to-end formal sobre el dataset sintético y un caso aplicado sobre Titanic.

## 5. Capturas que sí aportan valor

Las capturas se toman únicamente cuando la interfaz esté estable y el resultado sea reproducible:

1. carga/perfilamiento local-first con fingerprint y trazas;
2. diagnóstico estructurado y referencias de evidencia;
3. RemediationPlan con actionability y decisiones HITL;
4. ScriptContract/renderizado determinista;
5. simulación y delta antes/después;
6. paquete de exportación;
7. benchmark LLM formal, si existen corridas válidas.

Cada captura debe tener pie de figura, versión de código, dataset y explicación de qué demuestra.

## 6. Entregables por fase restante

### Cierre Phase 3 — RemediationPlanV2

- planes válidos para tres datasets;
- cero upgrades inseguros;
- cero referencias inválidas;
- tabla de acciones auto-safe, review-only y not-actionable;
- actualización de OE3/OE5 en la matriz;
- apartado de gobernanza y separación entre diagnóstico y decisión.

### Phase 4 — ScriptContractV2 y renderer determinista

- script derivado solo de acciones aprobadas;
- cero código producido por el LLM;
- validación sintáctica, estructural y de columnas;
- tabla de cobertura de acciones y scripts válidos;
- evidencia de que las acciones rechazadas no aparecen en el script.

### Phase 5 — Simulación, reauditoría y exportación

- flujo end-to-end;
- resultado antes/después;
- delta de salud;
- acciones bloqueadas o rechazadas;
- paquete JSON/CSV/script/reporte;
- discusión aplicada y limitaciones.

### Phase 6 — Consolidación experimental y académica

- resultados por regla y dataset;
- metodología de ground truth, etiquetado y umbrales;
- benchmark LLM formal o registro honesto de intentos fallidos;
- discusión de impacto aplicado;
- estado del arte crítico;
- referencias APA 7;
- conclusiones vinculadas a objetivos y evidencia.

## 7. Matriz de control de avance

| Hito | Código | Tests | Evidencia | Tabla | Borrador | Estado |
|---|---|---|---|---|---|---|
| Phase 3 | En cierre | En cierre | Pendiente de cierre formal | Pendiente | Pendiente | Activa |
| Phase 4 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Bloqueada por Phase 3 |
| Phase 5 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Phase 6 | Parcial | Parcial | Parcial | Parcial | Borrador vivo | Pendiente |

## 8. Información que puede requerir participación del autor

Se solicitará únicamente cuando sea necesaria:

- fecha límite exacta y rúbrica/formato institucional;
- confirmación de proveedor LLM disponible para corridas formales;
- ejecución local cuando se necesiten capturas o artefactos que dependan del entorno del autor;
- selección final del caso aplicado si cambia Titanic;
- validación de redacción académica antes del cierre.

## 9. Criterio de éxito

La tercera entrega debe demostrar, con evidencia reproducible, que AURA separa:

1. hechos deterministas;
2. interpretación LLM restringida;
3. decisión humana;
4. ejecución controlada;
5. medición del resultado.

La redacción, las tablas y los anexos avanzan al mismo ritmo que el software. No se deja la construcción documental para el final.
