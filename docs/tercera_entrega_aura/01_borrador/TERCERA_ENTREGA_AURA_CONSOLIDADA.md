# Tercera entrega TFM AURA — documento consolidado hasta Phase 4

> **Proyecto:** AURA, Auditoría Unificada de Riesgos Algorítmicos  
> **Autor:** Joseph David Gari Bustos  
> **Estado:** consolidado académico hasta Phase 4  
> **Fecha:** 2026-06-27  
> **Evidencia vigente Phase 4:** `aa167995316962a70ff41a3970326d4824d980c0`  
> **Freeze final Phase 4:** `05878e4a960afd11d564a60f4924bfb8f0b527e7`

## Nota de alcance

Este documento consolida la tercera entrega con la evidencia actualmente cerrada: Phase 1, Phase 2, Phase 3 y Phase 4. No incorpora ejecución real de scripts, reauditoría ni cálculo de HealthDelta, porque esas actividades pertenecen a Phase 5. La entrega se presenta como una frontera técnica defendible: AURA llega hasta la generación, validación, verificación y aprobación humana de un contrato de script, sin ejecutar transformaciones sobre el dataset.

---

## 1. Introducción

La calidad de los datos es una condición crítica para la analítica, la inteligencia artificial y la toma de decisiones. Sin embargo, los datasets usados en entornos reales suelen contener valores nulos, duplicados, inconsistencias de formato, variaciones categóricas, columnas sensibles, tipos ambiguos y señales de riesgo que no siempre son evidentes para el usuario final. Frente a este problema, muchas herramientas automatizan detecciones o limpiezas, pero no siempre ofrecen trazabilidad suficiente sobre qué se detectó, con qué evidencia, qué acción se propone y quién autoriza la transformación.

AURA responde a este desafío mediante una arquitectura local-first de auditoría asistida. Su principio central no es delegar la limpieza a un modelo de lenguaje, sino gobernar el flujo completo mediante contratos, evidencia reproducible y revisión humana. En lugar de permitir que un LLM opere libremente sobre los datos, AURA separa cinco responsabilidades: hechos deterministas, interpretación restringida, decisión de remediación, aprobación humana y ejecución posterior.

La tercera entrega consolida el avance técnico alcanzado hasta Phase 4. El sistema ya permite cargar un CSV, generar evidencia local, estructurar un diagnóstico, producir un plan de remediación determinista, controlar decisiones HITL y generar un contrato de script verificable antes de su aprobación humana. La ejecución del script y la medición de mejora quedan fuera de esta entrega y se plantean como siguiente fase.

---

## 2. Problema

Las organizaciones pueden disponer de datos suficientes, pero no necesariamente de datos confiables. Los errores de calidad pueden propagarse hacia reportes, modelos predictivos, decisiones administrativas o procesos de negocio. En particular, aparecen cuatro tensiones técnicas:

1. Las reglas deterministas son reproducibles, pero pueden ser rígidas y generar falsos positivos.
2. Los LLM pueden interpretar contexto, pero pueden alucinar columnas, exagerar conclusiones o proponer acciones no autorizadas.
3. La limpieza automática puede introducir cambios destructivos si no se controla mediante aprobación humana.
4. Las soluciones cloud pueden aumentar la exposición de datos o metadatos si no existe una arquitectura local-first clara.

El problema de investigación se formula así:

> ¿Cómo consolidar una arquitectura local-first de auditoría de calidad de datos que combine evidencia determinista, diagnóstico asistido por LLM, remediación gobernada, validación contractual de scripts y revisión humana, manteniendo trazabilidad, privacidad operativa y control sobre las afirmaciones generadas?

---

## 3. Objetivos

### 3.1 Objetivo general

Consolidar AURA como una arquitectura local-first para auditoría inteligente de calidad del dato, capaz de perfilar datasets CSV en navegador, generar evidencia determinista reproducible, estructurar diagnósticos restringidos por evidencia, construir planes de remediación deterministas, producir contratos de script verificables y someterlos a revisión humana antes de cualquier ejecución.

### 3.2 Objetivos específicos

**OE1. Ingesta local y evidencia reproducible.**  
Consolidar la carga, perfilamiento y fingerprint de datasets CSV en navegador, manteniendo la evidencia técnica vinculada al archivo procesado.

**OE2. Diagnóstico restringido por evidencia.**  
Separar la capa factual determinista de la interpretación asistida, evitando que el modelo opere sin contexto controlado.

**OE3. Remediación determinista y HITL.**  
Transformar hallazgos en acciones de remediación mediante una política cerrada, clasificando cada acción como aceptada, rechazada, pendiente o excluida según reglas reproducibles y decisión humana.

**OE4. Contrato de script verificable.**  
Generar un `ScriptContractV2` a partir del plan aprobado, validando referencias de columnas, partición HITL, hash del script, estado sintáctico y consistencia contractual.

**OE5. Evidencia navegable y cierre formal.**  
Demostrar mediante pruebas E2E y capturas que el flujo llega hasta revisión humana read-only y aprobación, sin ejecutar Python, sin aplicar transformaciones y sin calcular HealthDelta.

---

## 4. Enfoque metodológico

La metodología de AURA se organiza como un flujo incremental por fases. Cada fase introduce una responsabilidad y deja evidencia técnica antes de avanzar. El criterio de cierre no es solo que exista código, sino que existan pruebas, documentación, limitaciones explícitas y trazabilidad con los objetivos.

La cadena metodológica actual es:

```text
CSV
→ fingerprint y auditoría local
→ evidencia limitada
→ diagnóstico restringido
→ plan determinista
→ aprobación HITL
→ contrato de script validado
→ revisión humana read-only
→ aprobación sin ejecución
```

Phase 5 ampliará esa cadena con ejecución controlada, reauditoría y HealthDelta, pero esos resultados no se afirman en esta tercera entrega.

---

## 5. Arquitectura AURA

AURA está diseñada como una arquitectura por contratos. Cada contrato delimita qué información entra, qué información sale y qué afirmaciones pueden hacerse.

### 5.1 EvidenceEnvelopeV2

El `EvidenceEnvelopeV2` agrupa la evidencia producida por la auditoría local. Incluye fingerprint del dataset, metadatos de columnas, hallazgos, límites y referencias verificables. Su función es impedir que las fases posteriores trabajen sobre afirmaciones no ancladas.

### 5.2 DiagnosisResponseV2

El diagnóstico se interpreta como una respuesta restringida por evidencia. Puede explicar hallazgos, agrupar observaciones y proponer atención, pero no tiene autoridad para ejecutar ni para inventar columnas fuera del contexto.

### 5.3 RemediationPlanV2

El plan de remediación convierte issues en acciones deterministas mediante una política cerrada. La acción no la decide libremente el LLM: se obtiene de reglas y registros internos. Cada acción puede quedar como `auto_safe`, `review_only` o `not_actionable`, y la decisión humana la puede aprobar, rechazar o dejar pendiente.

### 5.4 ScriptContractV2

El contrato de script representa la frontera cerrada de Phase 4. Se genera desde acciones aprobadas y excluye acciones rechazadas o pendientes. Incluye:

- hash contractual del script;
- renderer version;
- placeholder vocabulary version;
- referencias de columnas validadas;
- partición accepted/rejected/excluded;
- estado de sintaxis `not_run` cuando Python no está disponible en navegador;
- verificación fresca antes de aprobación.

### 5.5 Revisión humana read-only

La revisión humana no permite editar el script arbitrariamente. El usuario revisa el contrato y aprueba o rechaza, pero el sistema mantiene la integridad contractual. Si el hash es manipulado, la aprobación queda bloqueada.

---

## 6. Desarrollo por fases

### 6.1 Phase 1 — EvidenceEnvelopeV2

La primera fase consolidó la evidencia local como base del sistema. El objetivo fue crear una unidad reproducible que vincule dataset, fingerprint, columnas y hallazgos. Esta fase estableció el principio de que todo diagnóstico posterior debe quedar atado a evidencia.

**Resultado:** cerrada.

### 6.2 Phase 2 — DiagnosisResponseV2

La segunda fase estructuró el diagnóstico asistido por evidencia. La contribución fue limitar la interpretación del modelo mediante contratos, evitando respuestas libres no verificables.

**Resultado:** cerrada.

### 6.3 Phase 3 — RemediationPlanV2 + HITL

La tercera fase introdujo la planificación determinista de remediaciones y la gobernanza HITL. El sistema clasifica acciones, muestra decisiones al usuario y evita que una acción destructiva avance sin autorización.

**Freeze Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`.

**Resultado:** congelada.  
**Límite:** Phase 3 no genera ni ejecuta Python.

### 6.4 Phase 4 — ScriptContractV2 + renderer

La cuarta fase completó la generación de contratos de script. A partir del `RemediationPlanV2`, AURA construye un candidato, valida columnas y acciones, finaliza un contrato con hash y verifica de manera fresca antes de revisión humana.

**Evidencia vigente:** `aa167995316962a70ff41a3970326d4824d980c0`.  
**Freeze final:** `05878e4a960afd11d564a60f4924bfb8f0b527e7`.

**Resultado:** cerrada y congelada.  
**Límite:** no ejecuta Python, no transforma el dataset y no calcula HealthDelta.

---

## 7. Evidencia de Phase 4

Phase 4 se cerró con evidencia E2E navegable en Chromium headless. Se ejecutaron 8 escenarios contractuales en dos corridas consecutivas.

| Escenario | Propósito | Evidencia |
|---|---|---|
| E2E-01 | Plan HITL | planId preservado, aprobar/rechazar visibles |
| E2E-02 | Contrato válido | hash completo, `not_run`, sin indicadores de seguridad artificial |
| E2E-03 | Partición exacta | accepted/rejected/excluded contra el plan |
| E2E-04 | Script determinista | comparación exacta línea por línea con `expectedContract.scriptText` |
| E2E-05 | Revisión y aprobación | navegación real, ReviewStep, aprobación visible |
| E2E-06 | Contrato manipulado | bloqueo fail-closed ante hash alterado |
| E2E-07 | Invalidación HITL | volver al plan, hash anterior distinto del nuevo |
| E2E-08 | Contrato no-op | accepted = 0 y script exacto sin transformaciones |

Resultados reportados:

| Verificación | Resultado |
|---|---|
| E2E corrida 1 | 8 passed |
| E2E corrida 2 | 8 passed |
| Tests unitarios | 1116 passed, 6 skipped |
| Typecheck | 0 errores |
| Build | PASS |
| Contracts v2 | 3/3 PASS, `sourceTreeDirty=false` |
| Python | No ejecutado |
| HealthDelta | No calculado |

---

## 8. Capturas de evidencia

Las seis capturas de Phase 4 quedan documentadas en `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/CAPTURAS_MANIFEST.md`.

| Captura | Archivo | Qué demuestra |
|---|---|---|
| 07 | `07_phase4_remediation_hitl.png` | Plan de remediación con decisión HITL |
| 08 | `08_phase4_script_contract_valid.png` | Contrato válido y hash disponible |
| 09 | `09_phase4_script_contract_code.png` | Código determinista y partición contractual |
| 10 | `10_phase4_script_review_readonly.png` | Revisión humana read-only |
| 11 | `11_phase4_script_approved_hitl.png` | Aprobación humana sin ejecución |
| 12 | `12_phase4_tampered_contract_blocked.png` | Bloqueo ante contrato manipulado |

Estas capturas no demuestran inferencia LLM real, ejecución de Python, mejora de dataset ni HealthDelta. Su valor es evidenciar navegación, contrato y gobernanza hasta la aprobación.

---

## 9. Resultados consolidados

### R1. Arquitectura local-first operativa

AURA demuestra un flujo local-first donde el CSV se procesa en navegador, se genera fingerprint y se produce evidencia auditable. La arquitectura evita afirmar privacidad absoluta, especialmente en configuraciones cloud, pero sí establece una preferencia clara por ejecución local y minimización de exposición.

### R2. Separación entre hechos, interpretación y acción

La arquitectura impide que el LLM tenga autoridad directa sobre transformaciones. El motor determinista produce hechos; el diagnóstico interpreta bajo evidencia; el plan define acciones mediante política cerrada; la persona decide; el contrato valida el script.

### R3. Gobernanza HITL demostrada

Phase 3 y Phase 4 demuestran que las acciones pueden aprobarse o rechazarse, que el `planId` se preserva durante decisiones HITL y que cambiar decisiones invalida contratos previos.

### R4. Contrato de script verificable

`ScriptContractV2` permite generar un script determinista, calcular hash, validar columnas y bloquear manipulación. El sistema no presenta el script como seguro de forma absoluta, sino como válido conforme a reglas contractuales v2.

### R5. Frontera honesta con Phase 5

La entrega no afirma mejora real del dataset. La mejora solo podrá sostenerse cuando Phase 5 ejecute el script, reaudite el resultado y calcule HealthDelta.

---

## 10. Discusión

AURA no intenta sustituir la supervisión humana, sino organizarla. La aportación principal consiste en construir una cadena de confianza donde cada fase tiene una responsabilidad limitada. Esta separación reduce riesgos comunes en sistemas asistidos por LLM: alucinaciones, scripts no verificables, acciones destructivas y afirmaciones no respaldadas.

La decisión de no ejecutar Python en Phase 4 es metodológicamente importante. Aunque limita el alcance de los resultados actuales, evita confundir contrato validado con limpieza efectiva. Esta distinción fortalece la trazabilidad: un script aprobado todavía no equivale a un dataset mejorado.

El enfoque también reconoce límites. El estado `syntax not_run` indica que el entorno de navegador no ejecutó Python. La aprobación humana no garantiza que el script produzca una mejora, solo que el contrato fue revisado y aprobado bajo reglas visibles. La evidencia E2E demuestra navegación y validación contractual, no rendimiento de limpieza.

---

## 11. Claims permitidos

Con base en la evidencia cerrada, se pueden afirmar los siguientes puntos:

- AURA implementa una arquitectura local-first de auditoría CSV con evidencia determinista.
- El sistema separa evidencia, diagnóstico, remediación, contrato y aprobación humana.
- Phase 3 permite planificación determinista de remediaciones con HITL.
- Phase 4 genera `ScriptContractV2` desde acciones aprobadas.
- El contrato incluye hash verificable y referencias de columnas validadas.
- La UI permite revisión humana read-only.
- El sistema bloquea aprobación si el contrato es manipulado.
- La evidencia E2E cubre 8 escenarios contractuales en navegador.

---

## 12. Claims no permitidos

No deben afirmarse todavía:

- Que AURA ejecuta el script en Phase 4.
- Que AURA corrige efectivamente el dataset.
- Que existe mejora real medida por HealthDelta.
- Que el sistema elimina alucinaciones.
- Que un modelo LLM es superior por benchmark formal.
- Que existe privacidad absoluta en cualquier configuración.
- Que el contrato validado equivale a limpieza aplicada.

---

## 13. Limitaciones

1. Phase 4 no ejecuta Python.
2. `syntax not_run` no equivale a sintaxis verificada por intérprete real.
3. Las capturas E2E usan harness determinista, no inferencia LLM real.
4. La aprobación humana exige revisión visual, pero no mide impacto posterior.
5. La mejora del dataset queda pendiente de ejecución y reauditoría.
6. Los resultados de tests y build son locales reportados cuando no hay checks remotos asociados.
7. El benchmark LLM no debe tratarse como formal si no existen corridas controladas con ground truth y repeticiones.

---

## 14. Conclusiones

La tercera entrega consolida AURA como una arquitectura gobernada para auditoría de calidad de datos. El avance principal no es la limpieza automática, sino la construcción de una cadena auditable que transforma evidencia en diagnóstico, diagnóstico en plan, plan en contrato y contrato en revisión humana.

Phase 4 marca una frontera sólida: AURA puede generar un script contractual desde acciones aprobadas, verificar su integridad, exponer su hash completo, mantener la revisión humana en modo read-only y bloquear manipulación. Esta frontera evita exagerar los resultados y prepara el terreno para Phase 5.

La contribución técnica y metodológica de esta entrega es demostrar que la asistencia de LLM puede integrarse en un flujo de calidad de datos sin ceder control sobre los datos, las acciones o las afirmaciones. AURA no promete que el modelo limpie por sí mismo; propone un sistema donde cada decisión deja evidencia.

---

## 15. Siguientes pasos

El siguiente paso permitido no es ejecutar directamente Phase 5, sino diseñarla. Phase 5 deberá definir:

- runtime de ejecución controlada;
- sandbox y límites de seguridad;
- entrada basada exclusivamente en `ScriptContractV2` aprobado;
- ejecución de `clean_dataset(df)` sobre copia del dataset original;
- reauditoría posterior;
- cálculo de HealthDelta;
- exportación de dataset limpio y reporte;
- evidencia E2E de ejecución y mejora real.

Hasta completar ese diseño, Phase 5 permanece pendiente.

---

## 16. Referencias internas de evidencia

- `docs/tercera_entrega_aura/00_MAPA_MAESTRO_TFM.md`
- `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md`
- `docs/tercera_entrega_aura/05_desarrollo/phases/phase_04/CIERRE_PHASE4.md`
- `docs/tercera_entrega_aura/05_desarrollo/phases/phase_04/loop_06_e2e.md`
- `docs/tercera_entrega_aura/03_evidencia/screenshots/phase4/CAPTURAS_MANIFEST.md`
- `experiments/contracts-v2/local-validation-results/validation-results.json`
