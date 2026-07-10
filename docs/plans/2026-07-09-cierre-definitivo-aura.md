# Cierre definitivo de AURA — Implementation Plan

> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Cerrar AURA sin añadir nuevas fases y producir evidencia suficiente, coherente y reproducible para redactar el documento final del TFM.

**Architecture:** Conservar el flujo principal de cinco pasos y tratar calibración, proveedores y remediación como capacidades auxiliares. La entrega se sostendrá en evidencia determinista, evaluación LLM acotada, validación humana y artefactos exportables.

**Tech Stack:** React, TypeScript, Vitest, Playwright, Ollama, Chrome AI, PDF/JSON/CSV y documentación Markdown.

---

## 1. Decisión definitiva

Este es el único documento vivo para decidir qué falta en AURA y cuándo puede comenzar la redacción final.

- Phase 10 está cerrada como fase de producto. No se abrirá Phase 11.
- No se añadirán funcionalidades que no estén vinculadas a un objetivo del TFM o a un criterio de entrega.
- La tercera entrega permanece histórica; el siguiente hito académico es el documento final del TFM.
- Los closeouts, freezes y borradores anteriores conservan valor como evidencia, pero no definen el estado actual.
- `CURRENT_STATE.md`, `ROADMAP.md` y `NEXT_STEPS.md` son rutas de compatibilidad hacia este documento.

## 2. Veredicto de alineación

**AURA está alineada en arquitectura, pero todavía no está cerrada en evidencia académica.**

El producto ya implementa la cadena necesaria:

```text
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
                                 └→ Remediación opcional → HITL

Configuración → Laboratorio avanzado / Calibración experimental
```

La brecha ya no es de diseño. Faltan una evaluación comparativa LLM reproducible, evidencia actualizada sin contradicciones y una validación E2E final que demuestre el recorrido de una persona y las descargas reales.

## 3. Objetivos definitivos del TFM

Estas formulaciones sustituyen las variantes históricas de 4, 5 u 8 objetivos. Los ocho objetivos antiguos quedan absorbidos en cinco objetivos medibles.

### Objetivo general

Diseñar, implementar y evaluar AURA como una arquitectura local-first para el diagnóstico de calidad de datos, combinando evidencia determinista reproducible, análisis asistido por modelos de lenguaje restringido por contratos, remediación opcional gobernada por revisión humana y resultados exportables y trazables.

### Objetivos específicos

**OE1. Auditoría local y reproducible.** Implementar la ingesta, el perfilamiento, el fingerprint y la detección determinista de problemas de calidad sobre datasets CSV, manteniendo trazabilidad entre archivo, reglas y hallazgos.

**OE2. Diagnóstico cognitivo controlado.** Generar explicaciones y recomendaciones mediante LLM limitados por evidencia verificable, registrando proveedor, configuración, errores, referencias inválidas y posibles alucinaciones.

**OE3. Gobernanza de la remediación.** Producir planes y scripts opcionales verificables, bloquear acciones no autorizadas y conservar la decisión HITL antes de cualquier ejecución o afirmación de mejora.

**OE4. Evaluación comparativa de LLM.** Comparar de forma reproducible al menos dos modelos o proveedores sobre datasets controlados, usando el mismo contrato, configuración registrada, repeticiones y métricas técnicas y humanas, sin declarar un ganador universal.

**OE5. Validación y comunicación de resultados.** Demostrar el flujo completo mediante pruebas y evidencia visual, y exportar un informe PDF y artefactos JSON/CSV suficientes para reproducir, revisar y redactar los resultados del TFM.

## 4. Alineación objetivo por objetivo

| Objetivo | Estado | Evidencia actual | Brecha de cierre |
|---|---|---|---|
| OE1 | **Alineado** | `auditEngine.ts`, `deterministicValidation.ts`, datasets controlados y tests con macro F1 ≥ 0.90 | Regenerar un único artefacto de métricas actual; los JSON históricos contienen valores contradictorios |
| OE2 | **Alineado con límites** | Contratos LLM, proveedores Chrome AI/Ollama/cloud, prompt budget, diagnóstico estructurado y fallback determinista | Ejecutar corridas reales bajo protocolo y consolidar errores/alucinaciones por proveedor |
| OE3 | **Alineado** | `RemediationPlanV2`, `ScriptContractV2`, validación, hash, HITL, rama opcional e `ImprovementRun` controlado | No afirmar corrección automática ni mejora general; conservar ejecución como controlada/delegada |
| OE4 | **Parcial — brecha principal** | Laboratorio y contratos de experimento existen; L18–L20 comparan una fixture con proveedor mock | Ejecutar comparación real con dos LLM, dos datasets y repeticiones; producir matriz y conclusiones acotadas |
| OE5 | **Parcial** | PDF/JSON/CSV, 1574 tests unitarios y flujo E2E principal implementado | Corregir el único E2E focal fallido, validar producción/descargas y capturar evidencia visual final |

## 5. Línea base verificada el 9 de julio de 2026

| Verificación | Resultado actual |
|---|---|
| Git | `main` alineada con `origin/main`; HEAD inicial auditado `630c477` |
| TypeScript | `npm run typecheck` ✅ |
| Build | `npm run build` ✅, con advertencias de tamaño de chunks no bloqueantes |
| Vitest | 80 archivos ✅; 1574 tests pasaron y 6 quedaron omitidos |
| E2E focal | 20/21 pasaron |
| Fallo E2E | `L13G-03` espera el texto antiguo “rama opcional” en Exportación; el flujo llega a exportar, pero la aserción quedó desalineada con la UI simplificada |
| Producción + Chrome AI | Smoke real documentado; flujo completo aún presenta brecha de reset/selector de carga en producción |
| GitHub | Issues #19–#24 siguen abiertos; no deben darse por cerrados solo porque exista código |
| Grafo | Código regenerado con 6085 nodos y 9430 relaciones; la versión de habilidad Graphify debe sincronizarse con el paquete antes de futuros rebuilds completos |

## 6. Contradicciones documentales resueltas por esta hoja

- El conteo válido es **un objetivo general y cinco objetivos específicos**, no las variantes históricas de 4, 5 u 8.
- La tercera entrega está archivada; no es el espacio vivo de trabajo.
- Phase 10 está congelada, pero eso no equivale a entrega académica final terminada.
- Los 1574 tests unitarios pasan hoy; la cifra histórica de nueve fallos ya no describe el repositorio actual.
- `experiments/results/deterministic_validation.json` es un artefacto antiguo y no debe citarse como resultado actual hasta regenerarlo.
- Los resultados L18–L20 son útiles para validar contratos, pero usan proveedor mock y no constituyen comparación formal de LLM.
- La evidencia de producción y los issues solo se consideran cerrados cuando la ejecución o el estado remoto lo demuestran.

## 7. Hoja de ruta final

Solo existen cuatro bloques. Se ejecutan en orden y no se abre trabajo nuevo fuera de ellos.

### Bloque 1 — Congelar objetivos y documentación

**Estado:** cerrado con este documento.

**Archivos:**

- Fuente única: `docs/plans/2026-07-09-cierre-definitivo-aura.md`
- Rutas simplificadas: `docs/README.md`, `docs/product/aura/README.md`, `CURRENT_STATE.md`, `ROADMAP.md`, `NEXT_STEPS.md`
- Presentación del proyecto: `README.md`

**Gate:** no quedan dos documentos vivos con objetivos o roadmaps distintos.

### Bloque 2 — Regenerar evidencia cuantitativa

**Objetivos:** OE1 y OE2.

**Archivos a crear o actualizar:**

- Crear `experiments/results/final_deterministic_evidence.json`.
- Crear `experiments/results/final_deterministic_evidence.md`.
- Añadir un test de consistencia que regenere o compare las métricas con `src/services/deterministicValidation.ts`.

**Ejecución mínima:**

1. Calcular métricas actuales sobre `synthetic_ground_truth.csv`, `titanic.csv` y el dataset controlado de Phase 8.
2. Separar métricas binarias por regla de métricas por fila; no mezclar niveles de agregación.
3. Registrar dataset, hash, commit, reglas evaluadas, TP, FP, FN, precisión, recall, F1 y limitaciones.
4. Invalidar en la redacción cualquier cifra histórica que no coincida con el artefacto final.

**Gate:** un solo artefacto reproducible contiene todas las cifras deterministas que usará el TFM.

### Bloque 3 — Ejecutar la evaluación comparativa LLM

**Objetivo:** OE4; es la brecha académica principal.

**Diseño cerrado:**

- Datasets: Titanic controlado y `synthetic_ground_truth.csv` o `controlled_customers_phase8.csv`.
- LLM mínimos: Chrome AI/Gemini Nano y Ollama `qwen2.5:3b`.
- Corridas: cinco repeticiones por combinación dataset-modelo.
- Contrato: misma versión de prompt, evidence envelope, temperatura y límites de salida.
- Cloud: opcional; no bloquea el cierre si los dos proveedores locales producen corridas válidas.

**Métricas obligatorias:**

- tasa de ejecución válida y latencia;
- cumplimiento del contrato JSON;
- hallazgos esperados/detectados, TP, FP, FN, precisión, recall y F1 cuando el ground truth lo permita;
- columnas o reglas inventadas;
- claridad, trazabilidad y accionabilidad en escala humana 0–4;
- errores, reintentos, versión de modelo, prompt y configuración.

**Artefactos:**

- Crear `experiments/results/final_llm_evaluation.csv`.
- Crear `experiments/results/final_llm_evaluation.json`.
- Crear `experiments/results/final_llm_evaluation.md` con método, resultados y límites.

**Gate:** existen corridas reales, reproducibles y comparables. Si un proveedor no funciona, se registra como resultado fallido; no se reemplaza por mock ni se oculta.

### Bloque 4 — Cierre humano, evidencia visual y documento final

**Objetivo:** OE5.

**Trabajo técnico mínimo:**

1. Decidir si `L13G-03` debe comprobar comportamiento o copy; actualizar la aserción o restaurar el mensaje y lograr 21/21 en el conjunto focal.
2. Validar en navegador real: carga → perfil → diagnóstico → reporte → descarga PDF/JSON/CSV.
3. Validar la rama opcional: reporte → remediación → revisión HITL → regreso/exportación.
4. Corregir o documentar el reset de sesión y selector de carga en producción; ejecutar `CD-02` sin harness.
5. Capturar 1440, 1024, 768 y 390 px, sin overflow ni errores de consola.
6. Revisar y cerrar o reclasificar los issues #19–#24 con evidencia enlazada.

**Documento de entrega:**

- Crear un solo documento bajo `docs/tfm/memoria_final/` cuando los bloques 2–4 estén cerrados.
- Redactar desde los artefactos finales, no desde cifras copiadas de borradores históricos.
- Incluir método, resultados, discusión, amenazas a la validez, limitaciones y trabajo futuro.

**Gate final:** una persona completa el flujo, descarga los tres formatos, la evidencia cuantitativa es reproducible y cada afirmación del documento apunta a un artefacto verificable.

## 8. Fuera de alcance antes de la entrega

- Phase 11 o nuevas funcionalidades.
- Declarar AURA `production-ready`.
- Corregir datasets automáticamente sin HITL.
- Elegir un “mejor modelo universal”.
- Convertir resultados mock o smoke en benchmark formal.
- Publicar el repositorio: la higiene de historia Git y licencias es un frente separado y no bloquea el depósito académico mientras el repositorio permanezca privado.
- Optimización del tamaño de bundles, salvo que impida la demo.

## 9. Orden exacto de ejecución

```text
1. Evidencia determinista final
2. Evaluación LLM real
3. E2E + producción + evidencia visual
4. Cierre de issues y congelación de artefactos
5. Redacción del documento final
```

## 10. Definición de “AURA cerrada”

AURA queda cerrada para redactar la entrega cuando se cumplan simultáneamente estas condiciones:

- objetivos general y específicos congelados en este documento;
- typecheck, build y Vitest verdes;
- E2E focal completamente verde y flujo humano validado;
- cifras deterministas regeneradas y consistentes;
- evaluación real de dos LLM cerrada con resultados y limitaciones;
- PDF, JSON y CSV descargados y revisados;
- issues #19–#24 cerrados o reclasificados explícitamente;
- documento final redactable sin depender de claims no demostrados.

Hasta entonces, la formulación correcta es: **AURA tiene el producto y la arquitectura necesarios; falta cerrar su evidencia comparativa y de entrega.**
