# Borrador base de tercera entrega - AURA

> Proyecto: AURA - Auditoria Unificada de Riesgos Algoritmicos  
> Uso: documento base para continuar el desarrollo y redactar la tercera entrega  
> Estado: borrador vivo, no cierre final  
> Fecha de reorganizacion: 2026-06-19

## 1. Sentido de la tercera entrega

La tercera entrega consolida AURA como una arquitectura hibrida para diagnostico de calidad del dato. La contribucion no consiste en prometer que un LLM limpia datos automaticamente, sino en demostrar un flujo gobernado:

```text
CSV local -> evidencia determinista -> diagnostico LLM restringido -> script validado -> revision humana -> simulacion/exportacion
```

La segunda entrega dejo un prototipo funcional y una linea conceptual clara. Esta tercera entrega debe convertir eso en una base defendible con objetivos, evidencia, limites y resultados esperados.

La regla de redaccion de aqui en adelante es sencilla: ninguna afirmacion fuerte entra en la memoria si no tiene evidencia, estado de evidencia o limite explicito.

## 2. Problema refinado

Las organizaciones usan datasets con nulos, duplicados, formatos inconsistentes, columnas sensibles, outliers, valores categoricos mal normalizados y errores de tipado. Las reglas deterministas son reproducibles, pero pueden producir ruido o falsos positivos. Los LLM pueden interpretar contexto y proponer acciones, pero tambien pueden inventar columnas, exagerar conclusiones o generar scripts inseguros.

AURA responde a ese problema con una arquitectura local-first y auditada:

- primero genera evidencia reproducible con reglas deterministas;
- despues limita el LLM a esa evidencia;
- valida scripts antes de aprobarlos;
- exige revision humana;
- registra resultados exportables.

## 3. Pregunta orientadora

Como consolidar una arquitectura local-first de auditoria de calidad de datos que combine evidencia determinista, diagnostico asistido por LLM, validacion de scripts y revision humana, manteniendo trazabilidad, privacidad y control sobre las afirmaciones generadas?

## 4. Objetivo general

Consolidar AURA como una arquitectura local-first para auditoria inteligente de calidad del dato, capaz de perfilar datasets CSV en navegador, detectar anomalias mediante un motor determinista reproducible, generar diagnosticos y scripts asistidos por LLM bajo contratos de evidencia, validar esos scripts antes de su aprobacion humana y preparar resultados experimentales trazables para la memoria y un posible articulo.

## 5. Objetivos especificos de tercera entrega

### OE1. Arquitectura local-first e ingestion verificable

Consolidar la carga, parseo y perfilamiento local de datasets CSV desde navegador, reduciendo exposicion de datos sensibles y generando evidencia tecnica de ingestion.

Resultado esperado:

- contrato de ingestion con filas, columnas, delimitador, truncamiento, fingerprint y tiempos;
- evidencia visible en interfaz y exportable en JSON;
- explicacion clara de que el archivo completo permanece local salvo configuracion cloud explicita.

Limite:

- en modo cloud puede enviarse un resumen estructurado o smart sample; no debe afirmarse privacidad absoluta.

### OE2. Motor determinista reproducible y auditable

Fortalecer el motor determinista como capa factual. La tercera entrega debe presentar reglas, umbrales, conteos, porcentajes afectados, severidad y muestras de evidencia.

Resultado esperado:

- catalogo de reglas actualizado;
- glosario auditable R01-R28;
- tabla de precision/recall/F1 por regla y dataset;
- evidencia de correcciones recientes como R07 "Caos de Capitalizacion", que ahora agrupa variantes reales y no dispara en columnas datetime.

Limite:

- el motor puede generar falsos positivos. Ese ruido no invalida AURA; justifica la capa cognitiva y la revision humana.

### OE3. Diagnostico cognitivo restringido y scripts validables

Usar LLM local o cloud solo despues de tener evidencia determinista. El diagnostico debe partir del smart sample, hallazgos y muestras observadas. Los scripts generados deben validarse antes de usarse.

Resultado esperado:

- diagnostico anclado a hallazgos reales;
- reporte de columnas inventadas, claims sin soporte y cumplimiento de contrato;
- script Python/Pandas con validacion de columnas, operaciones destructivas y cobertura de hallazgos;
- fallback determinista cuando el proveedor LLM no este disponible.

Limite:

- si no hay API key, WebGPU, Ollama o Chrome AI funcional, no se declara diagnostico LLM formal.

### OE4. Laboratorio LLM como calibrador experimental

Mantener el Lab como modulo experimental para comparar configuraciones bajo el mismo contrato. No debe venderse como benchmark formal si no hay corridas validas.

Resultado esperado:

- comparacion `smart_sample` vs `prompt_libre`;
- configuraciones con modelo, proveedor, temperatura, modo de entrada y repeticion;
- estados `planned`, `attempted_failed`, `preliminary_valid` y `formal_valid`;
- tabla de latencia, cumplimiento de contrato, alucinaciones, script valido y utilidad para mejora.

Limite:

- no se puede afirmar que un modelo es superior sin corridas `formal_valid`, ground truth y repeticiones.

### OE5. Gobernanza HITL, simulacion y exportacion

Demostrar que AURA no automatiza acciones destructivas: propone, valida, exige revision humana y simula sobre copia.

Resultado esperado:

- checklist HITL;
- decision de aprobacion o rechazo;
- delta de salud antes/despues;
- export JSON, CSV de hallazgos, script aprobado y reporte PDF;
- manifest de evidencia con claims permitidos y limitaciones.

Limite:

- la simulacion puede tener delta cero. Ese resultado es valido como evidencia de que la propuesta no mejora el dataset, no como fracaso tecnico.

## 6. Contribucion especifica

AURA se posiciona entre tres familias:

| Familia | Fortaleza | Limite | Respuesta AURA |
|---|---|---|---|
| Herramientas rule-based | Reproducibles y explicables | Rigidas, bajo contexto semantico | Mantenerlas como Capa 1 factual |
| Observabilidad cloud | Monitoreo continuo e integracion empresarial | Coste, dependencia cloud, exposicion de metadatos | Priorizar ejecucion local-first y evidencia exportable |
| Data cleaning con LLM | Interpretacion y generacion de acciones | Alucinacion, variabilidad, poca trazabilidad | Restringir el LLM a evidencia determinista y validar scripts |

La contribucion no es detectar todos los errores ni garantizar limpieza automatica. La contribucion es gobernar el diagnostico: separar hechos, interpretacion, decision humana y evidencia exportable.

## 7. Metodologia de resultados esperados

La tercera entrega debe producir resultados en cinco bloques.

| Bloque | Resultado esperado | Estado permitido |
|---|---|---|
| Motor determinista | Tabla por regla con TP, FP, FN, precision, recall y F1 | Formal si hay ground truth |
| Reglas auditables | Catalogo + glosario con activacion, evidencia y limites | Formal si esta sincronizado con codigo/tests |
| Diagnostico LLM | Corridas con contrato, claims y alucinaciones medidos | Preliminar o formal segun proveedor y ground truth |
| Script/HITL | Safety score, cobertura, decision humana y simulacion | Formal si el flujo exporta evidencia |
| Impacto aplicado | Delta de salud y discusion de utilidad | Formal solo sobre casos ejecutados |

## 8. Resultados esperados para redactar

### R1. Validacion determinista

Se espera presentar una tabla por dataset y por regla. La tabla debe incluir:

- regla;
- columna o unidad evaluada;
- esperado;
- detectado;
- TP/FP/FN;
- precision;
- recall;
- F1;
- observacion metodologica.

El resultado debe interpretarse con cautela: alta sensibilidad puede traer falsos positivos, y esos falsos positivos son parte del argumento para usar una capa cognitiva restringida.

### R2. R07 y glosario auditable

R07 queda como ejemplo de maduracion del motor: antes generaba evidencia pobre y porcentaje 0; ahora agrupa variantes reales, calcula filas afectadas y excluye columnas temporales o identificadores.

Este caso debe usarse para defender que el motor no es una lista estatica de checks, sino una capa determinista en mejora continua, con pruebas unitarias y glosario.

### R3. Benchmark LLM

El resultado esperado no es "modelo ganador" por defecto. El resultado esperado es una tabla honesta:

- corridas fallidas como `attempted_failed`;
- corridas preliminares como `preliminary_valid`;
- corridas defendibles como `formal_valid`;
- comparacion `smart_sample` vs `prompt_libre`;
- alucinaciones y scripts invalidos como evidencia negativa util.

### R4. Script y HITL

La tercera entrega debe mostrar que AURA separa generacion de accion. Un script solo puede pasar si:

- usa columnas existentes;
- evita operaciones destructivas no aprobadas;
- cubre hallazgos reales;
- tiene safety score interpretable;
- es revisado por una persona.

### R5. Exportacion y trazabilidad

El cierre debe mostrar que AURA produce un paquete auditable:

- `aura_audit_*.json`;
- `aura_issues_*.csv`;
- script aprobado;
- reporte PDF;
- tabla de delta de salud;
- manifest con claims permitidos.

## 9. Estructura sugerida de la tercera entrega

1. Introduccion y problema.
2. Respuesta a la retroalimentacion recibida.
3. Estado del arte critico.
4. Arquitectura AURA.
5. Metodologia experimental.
6. Resultados esperados y resultados disponibles.
7. Discusion: privacidad, gobernanza, limites y utilidad aplicada.
8. Conclusiones y siguientes pasos.

## 10. Claims permitidos hoy

- AURA implementa un flujo local-first de auditoria CSV con motor determinista reproducible.
- El motor genera hallazgos por regla, columna, conteo, severidad, porcentaje afectado y evidencia.
- La capa LLM esta restringida por smart sample y hallazgos deterministas.
- AURA valida scripts antes de permitir aprobacion humana.
- El laboratorio LLM esta implementado como calibrador, pero sus resultados son formales solo si las corridas cumplen el protocolo.
- La revision humana y la simulacion sobre copia reducen el riesgo de automatizacion destructiva.

## 11. Claims no permitidos todavia

- "AURA elimina las alucinaciones".
- "El benchmark demuestra que un modelo es superior" sin corridas formales.
- "AURA garantiza privacidad absoluta" en configuraciones cloud.
- "La simulacion mejora siempre el dataset".
- "El motor determinista tiene precision perfecta".

## 12. Cierre operativo

El desarrollo desde aqui debe seguir una regla practica:

> Solo se implementa o documenta lo que mejora la evidencia de la tercera entrega.

El siguiente avance debe partir de `05_desarrollo/NEXT_STEPS.md`, ejecutar una tarea pequena, validar con tests o evidencia exportable y actualizar este borrador si cambia el estado de los resultados.
