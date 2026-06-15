# Borrador unico de tercera entrega - AURA

> Autor: Joseph Gari  
> Proyecto: AURA - Auditoria Unificada de Riesgos Algoritmicos  
> Estado: borrador vivo para tercera entrega del TFM  
> Fecha de consolidacion: 2026-06-15

## 0. Criterio de continuidad con la segunda entrega

La tercera entrega no reemplaza la segunda entrega. La toma como base y la hace mas rigurosa. La segunda entrega dejo definida la linea oficial de AURA como una arquitectura hibrida determinista-cognitiva para diagnostico de calidad del dato. La idea central se mantiene:

> El motor determinista genera evidencia reproducible; el LLM interpreta esa evidencia bajo restricciones; el humano valida las acciones finales.

El cambio principal de esta tercera entrega es que AURA debe pasar de "prototipo funcional con evidencia preliminar" a "arquitectura evaluable con metodologia experimental, trazabilidad de resultados, limites claros y evidencia exportable".

Por tanto, esta entrega se orienta a cuatro tareas:

1. responder de forma directa a la retroalimentacion del profesor;
2. consolidar el flujo real de AURA como producto minimo defendible;
3. formalizar la validacion determinista, la validacion de scripts y el laboratorio LLM;
4. preparar resultados que puedan usarse tanto en la memoria como en un articulo academico.

## 1. Respuesta a la retroalimentacion del profesor

El profesor valoro la pertinencia de AURA en calidad de datos, gobernanza de IA, ingenieria de datos, privacidad local-first, trazabilidad y control humano. Tambien destaco la originalidad de combinar auditoria determinista con diagnostico asistido por modelos de lenguaje.

La observacion principal no fue cambiar el tema, sino elevar el rigor. En particular, se solicito:

- ampliar la discusion critica del estado del arte;
- diferenciar con mas precision AURA frente a herramientas existentes;
- complementar fuentes tecnicas y preprints con literatura indexada;
- detallar el diseno experimental;
- explicar ground truth, criterios de etiquetado, umbrales y metricas;
- formalizar el benchmark LLM;
- discutir impacto potencial en entornos reales;
- vincular objetivos especificos con evidencia obtenida.

La tercera entrega responde a esto con una regla de redaccion: ninguna afirmacion fuerte se presenta sin evidencia, estado de evidencia o limite explicito.

| Observacion recibida | Respuesta adoptada en AURA |
|---|---|
| Falta mayor discusion critica del estado del arte | Reorganizar el analisis por familias: rule-based, observabilidad cloud, data cleaning con LLM y arquitecturas hibridas gobernadas |
| Falta posicionar la contribucion cientifica | Defender AURA como arquitectura hibrida local-first con evidencia determinista, LLM restringido, HITL y Lab opcional |
| Falta metodologia experimental detallada | Separar validacion determinista, validacion LLM, validacion de script y simulacion HITL |
| Benchmark todavia inmaduro | Tratar el Lab como modulo experimental de calibracion y no como resultado formal hasta tener corridas validas |
| Falta impacto aplicado | Discutir reduccion potencial de data downtime, eficiencia de auditoria, privacidad y gobernanza como impactos esperados, no como metricas productivas ya probadas |
| Falta vinculo entre objetivos y evidencia | Cada objetivo queda asociado a componentes, pruebas, artefactos y limitaciones |

## 2. Problema de investigacion refinado

Las organizaciones dependen de datos confiables para analitica, automatizacion y sistemas de inteligencia artificial. Sin embargo, la calidad del dato suele deteriorarse por valores nulos, duplicados, formatos inconsistentes, outliers, errores de tipado, columnas sensibles o convenciones internas mal documentadas.

Los enfoques tradicionales basados en reglas son reproducibles, pero pueden ser rigidos y generar falsos positivos. Los enfoques basados en LLM tienen capacidad interpretativa, pero introducen riesgos de alucinacion, variabilidad, opacidad y dependencia de proveedores externos. En este contexto, AURA propone una solucion intermedia:

- primero auditar con reglas deterministas;
- luego restringir el LLM a la evidencia observada;
- despues validar cualquier script propuesto;
- finalmente exigir revision humana antes de simular acciones.

La pregunta que orienta esta tercera entrega es:

> Como consolidar una arquitectura local-first de auditoria de calidad de datos que combine evidencia determinista, diagnostico asistido por LLM, validacion de scripts y revision humana, manteniendo trazabilidad, privacidad y control sobre las afirmaciones generadas?

## 3. Objetivo general

Consolidar AURA como una arquitectura local-first para auditoria inteligente de calidad del dato, capaz de perfilar datasets CSV en navegador, detectar anomalias mediante un motor determinista reproducible, generar diagnosticos y scripts asistidos por LLM bajo contratos de evidencia, validar dichos scripts antes de su aprobacion humana y comparar configuraciones LLM mediante un laboratorio experimental trazable.

## 4. Objetivos especificos

### OE1. Arquitectura local-first

Desarrollar una arquitectura local-first que permita cargar, procesar y auditar datasets desde el navegador, reduciendo la exposicion de datos sensibles y habilitando la ejecucion de componentes deterministas y cognitivos en entornos locales o cloud.

Evidencia actual:

- carga CSV local;
- parseo en navegador;
- fingerprint de dataset;
- contrato de ingestion;
- export JSON tecnico.

Limite:

- en modo cloud, no se envia el CSV completo, pero si puede enviarse un resumen estructurado o smart sample al proveedor configurado.

### OE2. Motor determinista

Diseñar e implementar un motor de auditoria determinista basado en reglas explicitas, expresiones regulares, heuristicas de tipos y estadistica descriptiva, capaz de generar hallazgos reproducibles sobre anomalias estructurales del dataset.

Evidencia actual:

- `AuditReport`;
- score de calidad;
- hallazgos por regla, columna, severidad y porcentaje afectado;
- ground truth para dataset sintetico y Titanic;
- validacion por regla con precision, recall y F1.

Limite:

- el motor puede generar falsos positivos. Este punto no invalida AURA; justifica la capa cognitiva y la revision humana.

### OE3. Diagnostico y generacion de scripts con LLM

Implementar una capa cognitiva basada en LLM, local o cloud, que reciba los hallazgos estructurados del motor determinista, diagnostique causas probables y genere scripts Python/Pandas orientados a corregir o asistir el proceso de limpieza del dataset.

Evidencia actual:

- prompts con smart sample, enhanced registry, copy-paste bad samples y modo recomendado;
- selector de proveedor/modelo;
- generacion de script;
- safety score;
- cobertura de hallazgos;
- deteccion de columnas inexistentes y operaciones destructivas.

Limite:

- si WebGPU o API key no estan disponibles, no puede afirmarse diagnostico cognitivo real. En ese caso AURA puede continuar con script determinista, pero el resultado LLM queda pendiente.

### OE4. Laboratorio experimental de configuracion LLM

Implementar un modulo de comparacion experimental integrado como opcion del flujo de AURA para evaluar modelos LLM locales y cloud bajo el mismo esquema de entrada, midiendo latencia, cumplimiento de contrato, presencia de alucinaciones, validez de scripts generados y utilidad para la mejora del dataset.

Evidencia actual:

- `BenchmarkLab`;
- selector de proveedor, modelo, temperatura y modo de entrada;
- ejecucion de corrida;
- comparacion de modos de entrada;
- export JSON de benchmark;
- estados `attempted_failed`, `preliminary_valid` y `formal_valid`.

Limite:

- el Lab esta implementado, pero solo produce benchmark formal si existen proveedor disponible, corrida completa, contrato cumplido, cero columnas fantasma, script valido y ground truth asociado.

### OE5. Gobernanza, revision humana y exportacion

Incorporar mecanismos de revision humana y exportacion de evidencia que permitan controlar las acciones propuestas por AURA antes de simular o documentar una remediacion.

Evidencia actual:

- checklist HITL;
- decision de aprobacion;
- simulacion sobre copia;
- delta de salud;
- manifest de evidencia;
- PDF, JSON tecnico, CSV de hallazgos y script aprobado.

Limite:

- la simulacion no modifica el archivo original y puede producir delta cero. Ese caso debe comunicarse como resultado valido, no como mejora.

## 5. Estado del arte y posicionamiento de AURA

Para responder a la retroalimentacion del profesor, el estado del arte debe abandonar la comparacion superficial por funcionalidades y organizarse por riesgos que cada familia de soluciones resuelve o deja abiertos.

| Familia | Fortalezas | Limites | Posicion de AURA |
|---|---|---|---|
| Calidad rule-based | Reproducibilidad, bajo costo, explicabilidad | Rigidez, falsos positivos, baja sensibilidad semantica | AURA conserva esta base como Capa 1 |
| Observabilidad cloud | Monitoreo continuo, integracion empresarial, alertas | Dependencia cloud, costo, exposicion de metadatos | AURA prioriza ejecucion local-first y evidencia exportable |
| Data cleaning con LLM | Interpretacion semantica, generacion de recomendaciones | Alucinacion, variabilidad, recomendaciones no trazables | AURA restringe el LLM a evidencia determinista |
| Arquitecturas hibridas y gobernadas | Balance entre automatizacion y control | Requieren metodologia de evaluacion | AURA integra validacion determinista, Lab y HITL |

La contribucion especifica de AURA no es "detectar mas errores" de forma aislada. La contribucion es gobernar un flujo completo:

```text
CSV local -> perfil determinista -> hallazgos reproducibles -> diagnostico LLM restringido -> script validado -> revision humana -> simulacion/exportacion
```

## 6. Arquitectura de AURA

AURA se organiza por capas.

| Capa | Rol | Entrada | Salida | Riesgo mitigado |
|---|---|---|---|---|
| Capa 0. Ingestion local-first | Cargar y perfilar CSV en navegador | Archivo CSV | Datos parseados, fingerprint, metadatos | Exposicion innecesaria de datos |
| Capa 1. Motor determinista | Generar evidencia factual reproducible | Dataset parseado | `AuditReport`, score, hallazgos | Diagnostico sin base verificable |
| Capa 2. Diagnostico cognitivo controlado | Interpretar hallazgos bajo contrato | Smart sample / registry / bad samples | Diagnostico y script | Alucinacion y variabilidad LLM |
| Capa 3. Validacion y HITL | Validar script y exigir revision humana | Script propuesto | Safety score, decision HITL | Automatizacion opaca o destructiva |
| Capa 4. Laboratorio experimental | Comparar configuraciones LLM | Dataset perfilado + configuracion | Resultados de benchmark | Eleccion arbitraria de modelo/prompt |
| Capa 5. Exportacion | Generar evidencia tecnica y ejecutiva | Resultados del flujo | PDF, JSON, CSV, script | Falta de trazabilidad academica |

## 7. Flujo funcional consolidado

El flujo principal de AURA debe mantenerse minimalista y directo.

### 7.1 Subir CSV

El usuario carga un CSV. La interfaz debe mostrar que el archivo fue recibido, que el procesamiento ocurre localmente y que se genero un contrato de ingestion. La evidencia tecnica queda disponible en detalles colapsados.

### 7.2 Perfilar

AURA caracteriza el dataset antes de interpretar causas. La pantalla muestra:

- score de calidad;
- numero de filas y columnas;
- hallazgos criticos y advertencias;
- principales columnas afectadas;
- boton para generar diagnostico.

El detalle tecnico incluye ingestion, estadisticas por columna, validacion determinista y paquete JSON.

### 7.3 Diagnostico

El diagnostico no debe saturar al usuario. Debe mostrar:

- principal senal de calidad;
- riesgo agregado;
- dataset evaluado;
- proveedor y modelo configurado;
- estado local/cloud;
- salida del LLM si el proveedor esta disponible.

Si el proveedor no esta disponible, AURA debe decirlo con claridad y permitir continuar con script determinista sin presentar eso como diagnostico LLM real.

### 7.4 Script

AURA propone un script y muestra de forma prioritaria:

- safety score;
- cobertura de hallazgos;
- columnas invalidas;
- operaciones destructivas;
- origen del script: modelo, deterministico o pendiente.

La matriz completa de validacion queda colapsada.

### 7.5 Revisar

El usuario revisa el script, lo aprueba o mantiene pendiente. La decision HITL debe registrar:

- aprobacion;
- fecha;
- safety score al aprobar;
- cobertura al aprobar;
- checklist;
- notas opcionales.

Si la simulacion no mejora el dataset, debe mostrarse como advertencia, no como exito.

### 7.6 Exportar

Exportar debe presentar un cierre claro:

- paquete completo/parcial/incompleto;
- cobertura de evidencia;
- artefactos disponibles;
- claims permitidos;
- limitaciones.

Los objetivos TFM y manifest completos deben permanecer en detalles tecnicos, no en primer plano.

### 7.7 Laboratorio

El Lab es opcional. Sirve para responder preguntas como:

- que pasa si uso local o cloud;
- que ocurre si cambio temperatura;
- que modo de entrada produce menos alucinaciones;
- que configuracion debe aplicarse al diagnostico principal.

El Lab no bloquea el flujo principal.

## 8. Metodologia experimental

La metodologia se divide en cuatro niveles.

### 8.1 Validacion determinista

Unidad de evaluacion:

- regla activada;
- columna;
- dataset;
- coincidencia con ground truth.

Metricas:

- precision;
- recall;
- F1;
- TP;
- FP;
- FN;
- estado por regla.

Datasets actuales:

- `synthetic_ground_truth.csv`;
- `titanic.csv`.

Nota importante:

El fixture `titanic.csv` del repositorio contiene 20 registros y conserva el esquema Titanic. El ground truth declarado conserva descripciones basadas en el dataset publico completo. Antes de publicar resultados formales, debe normalizarse esta diferencia o declararse que la validacion usa una muestra de Titanic con el esquema original.

### 8.2 Validacion LLM

Unidad de evaluacion:

- corrida;
- proveedor;
- modelo;
- temperatura;
- input mode;
- dataset;
- contrato de salida.

Estados de evidencia:

| Estado | Definicion |
|---|---|
| `attempted_failed` | El proveedor fallo, no hubo API key/WebGPU o la corrida no produjo salida valida |
| `preliminary_valid` | La corrida completo, pero no tiene ground truth o no alcanza condicion formal |
| `formal_valid` | La corrida completo, cumplio contrato, no tuvo columnas fantasma, genero script valido y tiene ground truth |

### 8.3 Validacion de scripts

Criterios:

- existencia de script;
- columnas existentes;
- cobertura de hallazgos;
- ausencia de operaciones destructivas;
- importacion/uso de Pandas;
- necesidad de revision humana.

Metricas:

- safety score;
- coverage percentage;
- invalid columns;
- destructive operations;
- covered/uncovered issue ids.

### 8.4 Simulacion HITL

La simulacion se ejecuta sobre una copia en memoria. No modifica el archivo original.

Metricas:

- score antes/despues;
- issues antes/despues;
- criticos antes/despues;
- reglas corregidas;
- reglas sin cambio;
- acciones bloqueadas por revision humana.

## 9. Benchmark LLM: discurso correcto

El benchmark es la parte mas delicada de la tercera entrega. Tener el Lab implementado no equivale a tener resultados experimentales fuertes.

Por eso se adopta esta formulacion:

> El laboratorio de AURA permite ejecutar comparaciones preliminares y formales. En esta entrega se reportan como resultados formales unicamente las corridas que cumplen validacion de contrato, ausencia de columnas alucinadas, script valido y correspondencia con ground truth.

Cambios tecnicos consolidados:

- `contractCompliance` reemplaza el discurso de "JSON compliance" cuando la salida evaluada es textual o markdown;
- `jsonCompliance` queda reservado a parseo JSON real;
- la penalizacion de alucinaciones usa columnas conocidas, no tokens generados;
- `Diagnosis Reliability Score` premia evidencia observada y no solo el modo seleccionado.

Metrica recomendada para alucinaciones:

```text
antiHallucinationScore = 1 - min(hallucinatedColumns / knownColumnCount, 1)
```

Tabla esperada para resultados:

| Dataset | Modelo | Proveedor | Entrada | Temp. | Latencia | Contrato OK | JSON real | Alucinaciones | Script valido | Estado evidencia | Score |
|---|---|---|---:|---:|---:|---|---|---:|---|---|---:|

## 10. Resultados actuales

### 10.1 Resultados funcionales

El flujo completo se verifico con Titanic:

- abrir AURA;
- subir CSV;
- perfilar;
- pasar a diagnostico;
- generar script;
- revisar;
- aprobar;
- simular;
- exportar;
- abrir Lab.

Evidencia:

- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.pdf`;
- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.md`;
- `docs/qa/titanic-audit-2026-06-14/aura_audit_1781480789856.json`.

Resultado honesto:

- el flujo principal funciona;
- el diagnostico LLM real no se ejecuto en esa corrida porque el proveedor estaba no disponible;
- el script determinista se genero y pudo revisarse;
- la simulacion no mejoro el score ni redujo issues en Titanic;
- el Lab esta disponible, pero sin proveedor activo no produjo corrida formal.

### 10.2 Resultados de UX

La app fue auditada contra criterios Casabero:

- human-first;
- estado claro;
- informacion progresiva;
- Lab opcional;
- no matrices internas en la app;
- detalles tecnicos colapsados;
- responsive sin overflow.

Se corrigio un overflow mobile observado en perfil Titanic. La verificacion posterior reporto:

```text
viewport = 390
scrollWidth = 390
overflow = false
```

Captura:

- `docs/qa/titanic-audit-2026-06-14/15-mobile-profile-after-ux-fix.png`.

### 10.3 Resultados de pruebas

Ultima validacion registrada:

| Comando | Resultado |
|---|---|
| `npm test` | 133/133 OK |
| `npm run build` | OK |
| `npm run test:e2e` | 5/5 OK |

Advertencia:

- el build mantiene warning de chunk grande por WebLLM/PDF. No es fallo funcional, pero queda como deuda tecnica.

## 11. Discusion preliminar

AURA demuestra que es posible construir un flujo de auditoria de calidad de datos donde la IA no actua como fuente primaria de verdad. El motor determinista genera evidencia reproducible; el LLM se usa como interprete restringido; el script se valida antes de revision; y el usuario mantiene control final mediante HITL.

La principal ventaja del enfoque es la trazabilidad. Cada resultado puede conectarse a:

- dataset;
- columnas;
- reglas;
- muestras;
- prompt/contrato;
- proveedor/modelo;
- script;
- decision humana;
- export JSON/PDF.

La principal debilidad actual es que el benchmark LLM aun necesita corridas formales. Por tanto, la tercera entrega debe evitar afirmar que un modelo o modo es superior hasta que existan ejecuciones validas y exportadas.

Tambien debe evitar presentarse como solucion que elimina alucinaciones. Lo correcto es afirmar que AURA implementa mecanismos de mitigacion y deteccion parcial, especialmente columnas fantasma, claims numericos sospechosos, contrato de salida y columnas invalidas en scripts.

## 12. Impacto aplicado esperado

Aunque aun no se ha medido en un entorno productivo real, AURA tiene impacto potencial en:

- reduccion de tiempo inicial de inspeccion de datasets;
- documentacion mas clara de problemas de calidad;
- menor exposicion de datos al priorizar procesamiento local;
- mejor trazabilidad de diagnosticos asistidos por IA;
- revision humana antes de ejecutar acciones;
- generacion de evidencia reutilizable para auditoria, gobernanza y TFM.

Estos impactos deben redactarse como potenciales o esperados, no como metricas ya demostradas en produccion.

## 13. Limitaciones

| Limitacion | Implicacion |
|---|---|
| Benchmark LLM sin proveedor activo | OE4 queda implementado, pero pendiente de resultados formales |
| Diagnostico LLM deshabilitado en auditoria Titanic | No se puede afirmar diagnostico cognitivo real para esa corrida |
| Delta de simulacion igual a cero en Titanic | La aprobacion HITL no implica mejora automatica |
| Ground truth reducido | Se necesitan mas datasets y criterios de etiquetado |
| Detector anti-alucinacion parcial | No cubre todas las afirmaciones semanticas posibles |
| Fixture Titanic reducido | Se debe aclarar si se usa muestra o dataset completo |
| CSS historico no visible | Deuda de mantenimiento, no bloqueo funcional |

## 14. Claims permitidos y no permitidos

### Permitido

- AURA implementa un flujo local-first de carga, perfilamiento y auditoria determinista.
- El motor determinista produce evidencia reproducible y puede evaluarse contra ground truth.
- La capa LLM interpreta hallazgos deterministas bajo contratos de entrada.
- El sistema valida scripts antes de revision humana.
- El Lab permite comparar configuraciones LLM bajo condiciones controladas.
- Las corridas fallidas del Lab se registran como intentos fallidos, no como resultados.

### No permitido

- Afirmar que AURA elimina alucinaciones.
- Afirmar que un modelo es superior sin benchmark formal.
- Afirmar que todo se procesa localmente si se usa proveedor cloud.
- Afirmar reduccion real de data downtime sin medicion en entorno productivo.
- Afirmar diagnostico LLM exitoso cuando el proveedor estuvo no disponible.

## 15. Trabajo pendiente para cerrar la tercera entrega

1. Mejorar mensaje inline cuando proveedor LLM no este disponible.
2. Advertir de forma mas fuerte cuando la simulacion no mejore score/issues.
3. Ejecutar corridas reales del Lab con proveedor disponible.
4. Generar tabla formal del benchmark.
5. Normalizar el caso Titanic: muestra vs dataset completo.
6. Generar tablas APA-ready de motor determinista, benchmark, scripts y delta de salud.
7. Redactar resultados y discusion desde evidencia, no desde aspiraciones.
8. Actualizar conclusiones una vez exista benchmark formal.

## 16. Conclusion preliminar

La tercera entrega consolida AURA como una arquitectura hibrida, trazable y evaluable para auditoria de calidad de datos asistida por IA. La contribucion principal no es reemplazar la auditoria humana ni delegar la verdad al LLM, sino ordenar un proceso donde la evidencia determinista, el diagnostico cognitivo restringido, la validacion automatica de scripts y la revision humana trabajan como controles sucesivos.

El estado actual permite defender la arquitectura, el flujo principal, la validacion de scripts, la exportacion de evidencia y la existencia de un laboratorio experimental. Sin embargo, las conclusiones sobre superioridad de modelos, reduccion de alucinaciones o impacto operativo real deben esperar a corridas formales y resultados exportados.
