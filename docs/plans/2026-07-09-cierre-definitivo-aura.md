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

La fuente académica prevalente es `docs/tercera_entrega_aura/Tercera_Entrega_TFM_Joseph_Gari_AURA.docx.pdf`, última entrega evaluada positivamente antes del depósito final. La formulación aparece en la página 9 y se confirma como OE1–OE6 en la tabla de evidencia de la página 27.

Estas formulaciones se conservan sin reagrupar objetivos. Sustituyen los resúmenes derivados de 4, 5 u 8 objetivos que aparecen en documentos históricos.

### Objetivo general

Consolidar AURA como una arquitectura local-first, reproducible y evaluable para auditoría inteligente de calidad del dato, capaz de generar evidencia determinista, restringir el diagnóstico asistido mediante paquetes de evidencia, producir planes de remediación gobernados, habilitar revisión humana y preparar una ejecución controlada y trazable.

### Objetivos específicos

**OE1. Arquitectura local-first.** Consolidar una arquitectura local-first que cargue, procese y audite datasets CSV en el navegador, generando trazas y minimizando la información compartida con proveedores externos.

**OE2. Motor determinista.** Diseñar y evaluar un motor determinista basado en reglas explícitas, heurística de tipos y estadística descriptiva, documentando verdaderos positivos, falsos positivos, falsos negativos, precisión, recall y F1.

**OE3. Diagnóstico asistido restringido.** Implementar una capa de diagnóstico asistido restringida a evidencia estructurada, evitando que el modelo opere sobre el dataset completo o genere transformaciones sin control.

**OE4. Laboratorio de comparación de modelos.** Implementar un laboratorio de comparación de modelos bajo un contrato común, diferenciando claramente pruebas operativas, resultados experimentales y benchmark formal.

**OE5. Gobernanza human-in-the-loop.** Implementar gobernanza human-in-the-loop mediante revisión y aprobación humana antes de generar o ejecutar cualquier script de limpieza.

**OE6. Scripts revisables y trazables.** Preparar scripts Python/Pandas revisables a partir de acciones aprobadas, manteniendo trazabilidad entre hallazgos, decisiones y código propuesto.

## 4. Alineación objetivo por objetivo

| Objetivo | Estado | Evidencia actual | Brecha de cierre |
|---|---|---|---|
| OE1 | **Alineado** | Carga y auditoría en navegador, fingerprint, trazas, políticas `local_full`, `cloud_minimized` y `cloud_no_samples` | Validar el flujo humano final y describir con precisión qué información sale del navegador |
| OE2 | **Alineado con evidencia por refrescar** | `auditEngine.ts`, `deterministicValidation.ts`, datasets controlados y tests con macro F1 ≥ 0.90 | Regenerar un único artefacto de métricas actual; los JSON históricos contienen valores contradictorios |
| OE3 | **Alineado con límites** | Contratos de evidencia, prompt budget, diagnóstico estructurado, detectores de alucinación y fallback determinista | Ejecutar corridas reales bajo protocolo y medir anclaje, referencias inválidas y claims sin soporte |
| OE4 | **Parcial — brecha principal** | Laboratorio y cinco modos de entrada implementados; L18–L20 usan fixture y proveedor mock | Ejecutar la matriz real con tres modelos, cinco modos, repeticiones y conclusiones acotadas |
| OE5 | **Alineado** | `RemediationPlanV2`, decisiones approve/reject, revisión HITL y bloqueo fail-closed | Aplicar una rúbrica humana explícita a los scripts representativos del experimento final |
| OE6 | **Alineado con validación controlada** | `ScriptContractV2`, renderer, validación de columnas, hash y scripts revisables | Ejecutar scripts aprobados sobre copias controladas, reauditar y medir el resultado sin afirmar corrección automática universal |

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

- El conteo válido es **un objetivo general y seis objetivos específicos**, según la última entrega evaluada positivamente.
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

**Objetivos:** OE3, OE4 y OE6; OE4 es la brecha académica principal.

**Diseño definitivo aprobado el 10 de julio de 2026:**

- Fuente de diseño: `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm-design.md`.
- Plan ejecutable: `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md`.
- Consolidador oficial: el Laboratorio de AURA guarda campañas, no resultados aislados. Conserva configuración, contratos, prompts y hashes, diagnóstico, script, métricas, revisión humana, ejecución controlada, reauditoría y artefactos.
- Dataset único: `controlled_customers_phase8.csv`, 50 filas, 15 columnas y SHA-256 `7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf`.
- Oráculos previos: normalizar el ground truth histórico a `ruleId + columnId + scope` y congelar una política de remediaciones esperadas, permitidas, prohibidas y sujetas a HITL.
- Modelos locales exactos, todos Unsloth `UD-Q4_K_XL`: `Qwen3-8B`, `gemma-3-4b-it-qat` y `DeepSeek-R1-0528-Qwen3-8B`.
- Modos de entrada: `prompt_libre`, `smart_sample`, `enhanced_registry`, `copy_paste_bad_samples` y `recommended`.
- Matriz: tres modelos × cinco modos × cinco repeticiones = 75 corridas; cada corrida produce diagnóstico y script, hasta 150 llamadas LLM evaluadas.
- Pipeline simétrico: todos los modos usan `aura.diagnosis.v2` y la misma etapa `aura.script.v2`; solo cambia la composición de evidencia de entrada.
- Configuración común: temperatura 0.2, `top_p` 0.9, contexto 16384 y máximo 1600 tokens por llamada, con versiones y digests congelados.
- Persistencia: IndexedDB append-only, pausa y reanudación; fallos y reintentos nunca se sobrescriben.
- Evaluación dinámica: las 75 corridas reciben métricas automáticas y rúbrica humana. Se selecciona por regla de mediana F1 un representante por celda modelo–entrada, 15 scripts en total, para HITL y ejecución externa sobre copias.

**Métricas obligatorias:**

- TP, FP, FN, precisión, recall y F1 del diagnóstico contra el oráculo normalizado;
- cumplimiento del contrato y schema, columnas o reglas inventadas y claims sin soporte;
- anclaje a reglas, columnas, evidencias y bad samples reales;
- latencia y tokens por etapa, errores, timeouts, estabilidad y recuperación;
- validez, seguridad y cobertura del script frente al oráculo de remediación;
- score, issues, forma y celdas antes/después para representantes aprobados y ejecutados;
- claridad, trazabilidad y accionabilidad en escala humana 0–4;
- modelo, cuantización, digest, runtime, prompts, hashes y configuración de cada intento.

**Artefactos:**

- Crear `experiments/final-evaluation/results/<campaign-id>/campaign.json` como fuente canónica.
- Derivar `runs.csv`, `report.md`, `report.pdf` y `manifest.json` desde esa fuente.
- Reportar mejores resultados por dimensión; el score compuesto queda como indicador exploratorio y no elige un ganador universal.

**Gate:** las 75 unidades fueron intentadas, toda salida completada tiene evaluación automática y humana, los 15 representantes tienen resolución explícita, no existe drift de configuración y los cinco artefactos son consistentes. Si un modelo falla, se registra; no se reemplaza por mock ni se oculta.

### Bloque 4 — Cierre humano, evidencia visual y documento final

**Objetivos:** OE1, OE5 y OE6.

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

- objetivo general y seis objetivos específicos congelados en este documento;
- typecheck, build y Vitest verdes;
- E2E focal completamente verde y flujo humano validado;
- cifras deterministas regeneradas y consistentes;
- evaluación real de al menos tres LLM y cinco modos de entrada cerrada con resultados y limitaciones;
- PDF, JSON y CSV descargados y revisados;
- issues #19–#24 cerrados o reclasificados explícitamente;
- documento final redactable sin depender de claims no demostrados.

Hasta entonces, la formulación correcta es: **AURA tiene el producto y la arquitectura necesarios; falta cerrar su evidencia comparativa y de entrega.**
