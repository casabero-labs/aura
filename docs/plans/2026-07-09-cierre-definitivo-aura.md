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
```

El laboratorio operativo anterior fue retirado el 10 de julio de 2026 porque no
usaba el protocolo formal OE4. No se considera una pérdida de evidencia: la
consola formal nueva y su recorrido E2E recuperable quedaron cerrados en las
Tasks 10–11 sobre las campañas persistidas.

La brecha ya no es de diseño ni de recorrido humano. Task 11 ya demostró
recuperación y descargas reales; falta ejecutar la evaluación comparativa LLM
reproducible y congelar su evidencia sin contradicciones.

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
| OE4 | **Parcial — brecha principal** | Protocolo, corredor, persistencia, evaluación, puente HITL, consola formal y recorrido E2E recuperable implementados | Preparar Ollama, ejecutar la matriz real y congelar el expediente |
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

**Estado:** cerrado el 10 de julio de 2026.

**Fuente canónica:**

- `experiments/results/final_deterministic_evidence.json`: datos completos y reproducibles.
- `experiments/results/final_deterministic_evidence.md`: lectura académica derivada del mismo JSON.
- `npm run evidence:deterministic`: regenerador único.
- `src/__tests__/finalDeterministicEvidence.test.ts`: consistencia exacta entre motor, JSON y Markdown.

| Dataset | Alcance puntuado | TP | FP | FN | Precisión | Recall | F1 |
|---|---|---:|---:|---:|---:|---:|---:|
| `synthetic_ground_truth` | 13 reglas, incluida una negativa conocida | 12 | 1 | 0 | 92,31 % | 100,00 % | 96,00 % |
| `titanic` | 3 reglas positivas; ground truth parcial | 3 | 0 | 0 | 100,00 %* | 100,00 % | 100,00 % |
| `controlled_customers_phase8` | 29 claves deterministas canónicas | 16 | 0 | 13 | 100,00 %* | 55,17 % | 71,11 % |

`*` La precisión es condicional porque Titanic y Phase 8 no contienen etiquetas negativas exhaustivas. Las detecciones no anotadas se reportan aparte y no se convierten automáticamente en FP.

**Decisiones de validez:**

- TP, FP y FN se calculan por activación binaria de regla; los conteos de ocurrencias se conservan aparte y pueden solaparse.
- Phase 8 conserva tres advertencias `TooManyFields` por comas no citadas en filas congeladas; no se alteró el CSV para esconderlas.
- Las 51 incidencias deterministas de Phase 8 se agregan en 29 claves regla-columna; 16 fueron detectadas y 13 quedaron omitidas.
- `experiments/results/deterministic_validation.json` queda histórico y no debe citarse como resultado actual.
- El score de salud AURA es descriptivo y no equivale a precisión, recall ni F1.

**Gate cumplido:** un solo JSON reproducible contiene hashes, commit del motor, métricas, alcances y limitaciones; Markdown se deriva y se compara exactamente contra él.

**Validación del cierre:** 15/15 pruebas focales, typecheck y build verdes; suite completa con 1600 pruebas aprobadas y 6 omitidas.

### Bloque 3 — Ejecutar la evaluación comparativa LLM

**Objetivos:** OE3, OE4 y OE6; OE4 es la brecha académica principal.

**Diseño definitivo aprobado el 10 de julio de 2026:**

- Fuente de diseño: `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm-design.md`.
- Plan ejecutable: `docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md`.
- Consolidador oficial: el Laboratorio de AURA guarda campañas, no resultados aislados. Conserva configuración, contratos, prompts y hashes, diagnóstico, script, métricas, revisión humana, ejecución controlada, reauditoría y artefactos.
- Dataset único: `controlled_customers_phase8.csv`, 50 filas, 15 columnas y SHA-256 `7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf`.
- Oráculos previos: preservar el ground truth histórico, registrar su discrepancia 50/3/2 declarada frente a 51/2/2 real, normalizar a `ruleId + columnId + scope` y congelar una política de remediaciones esperadas, permitidas, prohibidas y sujetas a HITL.
- Modelos locales exactos, todos Unsloth `UD-Q4_K_XL`: `Qwen3-8B`, `gemma-3-4b-it-qat` y `DeepSeek-R1-0528-Qwen3-8B`.
- Modos formales: `prompt_libre`, `smart_sample` y `recommended`. `enhanced_registry` y `copy_paste_bad_samples` quedan disponibles fuera de la campaña, pero se excluyen por redundancia experimental.
- Matriz V2: tres modelos × tres modos × cinco repeticiones = 45 diagnósticos evaluados; 15 calentamientos excluidos producen 60 llamadas reales en total.
- Pipeline común: todos los modos usan la misma fábrica de entrada y `aura.diagnosis.v2`; los scripts no usan LLM y se generan de forma determinista solo para los nueve representantes aprobados.
- Configuración común: temperatura 0.2, `top_p` 0.9, contexto 16384 y máximo 1600 tokens por llamada, con versiones y digests congelados.
- Persistencia: IndexedDB append-only, pausa y reanudación; fallos y reintentos nunca se sobrescriben.
- Evaluación dinámica: las 45 corridas reciben métricas automáticas y rúbrica humana. Se selecciona por regla de mediana F1 un representante por celda modelo–entrada, 9 scripts en total, para HITL y ejecución externa sobre copias.

**Checkpoint del 11 de julio de 2026 — Tasks 1–10 cerradas:**

- base congelada en `experiments/final-evaluation/` con hashes exactos de dataset, esquema y ground truth;
- 32 claves canónicas: 16 `engine_exposed`, 7 `engine_supported_not_exposed` y 9 `out_of_engine_scope`;
- F1 primario con denominador común de 16 claves en los tres modos; fidelidad de evidencia separada por visibilidad real;
- remediaciones limitadas a `RemediationActionTypeV2`; unicidad de `customer_id` y toda capacidad no soportada pasan por HITL;
- protocolo JSON y constante TypeScript semánticamente idénticos, con orden balanceado y 15 warm-ups excluidos;
- validación del checkpoint: 23/23 pruebas focales y suite completa con 1597 pruebas aprobadas y 6 omitidas;
- contratos `aura.experiment-campaign.v1` y `aura.experiment-run.v1` ligados al protocolo congelado, con snapshots completos y valores dinámicos nulos explícitos;
- historial de intentos append-only: coordenadas, entorno, entrada y eventos previos no pueden sobrescribirse;
- estados posteriores exigen evaluación automática, rúbrica humana, decisión HITL y evidencia de reauditoría coherentes;
- validación de Task 2: 12/12 pruebas focales; suite completa con 1612 pruebas aprobadas y 6 omitidas;
- registro formal único para los tres modelos Unsloth, sin retirar `qwen2.5:3b` ni las demás alternativas operativas;
- telemetría Ollama nativa: tokens de entrada/salida y duraciones de carga, evaluación del prompt, generación y total; `thinking` queda separado del contenido final;
- preflight formal de tres modelos con identidad exacta, digest, versiones cliente/servidor, espacio libre, smoke no vacío y recibo JSON;
- validación de Task 3: 23/23 pruebas focales, suite completa con 1620 pruebas aprobadas y 6 omitidas, typecheck y build correctos; el preflight real bloqueó correctamente por cliente `0.31.1` frente a servidor `0.20.3`;
- tres snapshots formales, deterministas e inmutables, con una sola instrucción y un solo schema `aura.diagnosis.v2`; únicamente cambia la evidencia visible;
- `prompt_libre` conserva un baseline mínimo controlado, `smart_sample` añade evidencia estructurada y `recommended` añade registro, gobernanza y anclajes explícitos;
- referencia de evidencia corregida a `env:<sha256>` para coincidir con el validador de diagnóstico y evitar una incompatibilidad antes de campaña;
- validación de Task 4: 21/21 pruebas focales, 75/75 dependientes, suite completa con 1629 pruebas aprobadas y 6 omitidas, typecheck y build correctos;
- calendario formal determinista de 45 IDs únicos, cinco repeticiones por celda modelo–modo, orden de modelos según la rotación congelada y 15 warm-ups explícitos excluidos de las métricas;
- corredor OE4 separado del benchmark operativo: todos los modos ejecutan diagnóstico `aura.diagnosis.v2` y script `aura.script.v2`, persisten cuatro eventos cuando completan y cortan el flujo si falla el diagnóstico;
- reanudación por etapa: un fallo de script conserva el diagnóstico completado y el reintento no repite la primera llamada; la pausa solo ocurre entre unidades;
- validación de Task 5: 67/67 pruebas dependientes, suite completa con 1639 pruebas aprobadas y 6 omitidas, typecheck y build correctos;
- contrato único de almacenamiento implementado tanto en memoria como en IndexedDB nativo, sin dependencia adicional;
- creación atómica de campaña y 45 corridas, append atómico de evento más snapshot, rechazo de IDs duplicados, conservación de fallos y reintentos, reconstrucción del almacén y selección de la siguiente unidad pendiente;
- el corredor ya persiste el primer cambio junto con el primer evento, evitando un estado `running` sin evidencia si la aplicación se interrumpe en ese punto;
- validación de Task 6: 15/15 pruebas directas, 37/37 dependientes, suite completa con 1654 pruebas aprobadas y 6 omitidas, typecheck y build correctos;
- evaluación diagnóstica primaria con TP, FP, FN, precisión, recall y F1 sobre las 16 claves `engine_exposed`, sin penalizar descubrimientos extendidos correctos;
- cobertura del motor calculada sobre incidencias fuente, fidelidad según la evidencia visible, anclaje explícito y registro separado de columnas, reglas, claves o claims inventados;
- evaluación de scripts con contrato, sintaxis, seguridad, columnas válidas, acciones cubiertas, faltantes o sin soporte y elegibilidad para revisión humana;
- operación separada en latencia, tokens, fallos y estabilidad; rúbrica humana 0–4 con revisor y fecha obligatorios, y nota justificativa para valores extremos;
- el score compuesto del export quedó renombrado como `exploratoryCompositeScore` y no determina un ganador;
- validación de Task 7: 43/43 pruebas focales y dependientes, suite completa con 1669 pruebas aprobadas y 6 omitidas, typecheck y build correctos;
- selección determinista de una mediana F1 por cada celda modelo–modo, con desempate por menor repetición y exactamente nueve representantes para una campaña completa;
- un representante inseguro permanece bloqueado; no se sustituye por una corrida más favorable después de observar los resultados;
- puente OE4 con estados `reviewed → awaiting_hitl → approved/rejected/blocked`; no prepara ejecución sin aprobación explícita;
- preflight o sandbox fallido persiste el representante como `blocked`; un aprobado genera únicamente un notebook para ejecución externa;
- importación del CSV externo con hash exacto, fuente inmutable, reauditoría, reglas resueltas/persistentes/nuevas y resultado `improved`, `unchanged`, `worsened` o `inconclusive`;
- validación de Task 8: 81/81 pruebas focales y dependientes, suite completa con 1681 pruebas aprobadas y 6 omitidas, typecheck y build correctos;
- el exportador de Task 9 deriva `campaign.json`, `runs.csv`, `report.md`, `report.pdf` y `manifest.json` desde una sola fuente, calcula hashes sobre bytes reales y no declara un ganador universal;
- validación de Task 9: 6/6 pruebas focales, typecheck, build y revisión visual del PDF correctos;
- `Laboratorio de evaluación LLM` sobre el store formal: matriz 3 × 3, pausa entre corridas, salidas crudas, métricas, rúbrica, HITL, importación externa y gates de reporte;
- validación de Task 10: 33/33 pruebas focales, suite completa con 1690 pruebas aprobadas y 6 omitidas, typecheck, build y revisión visual en escritorio/móvil correctos;
- validación de Task 11: recorrido controlado Chromium aprobado con persistencia IndexedDB, recarga, reanudación, rúbrica, HITL, importación, reauditoría y cinco descargas; el smoke real está implementado pero omitido por ausencia del CLI y de los modelos formales;
- OE4 no se considera cerrado: falta Task 12, preparar el runtime/modelos, ejecutar la campaña real y congelar sus artefactos formales.

**Corrección del 11 de julio de 2026 — issues 26 y 27:** los puntos históricos
de este checkpoint que describen 90 llamadas, una secuencia LLM
diagnóstico→script o una consola sin dependencias productivas quedan
reemplazados por el protocolo `aura.oe4.final-evaluation.v2`. Producto y OE4
usan ahora el mismo snapshot canónico; el runner verifica método, prompt,
modelo, digest y parámetros mediante un recibo persistido, ejecuta los 15
calentamientos y valida el diagnóstico completo. La consola crea y evalúa la
campaña real después del preflight. V1 permanece solo como evidencia histórica.

**Checkpoint del 12 de julio de 2026 — cierre UX y preparación Ollama:**

- Los tres modelos Unsloth congelados son también las únicas recomendaciones de Ollama para el diagnóstico normal; las alternativas históricas siguen disponibles, pero no se presentan como recomendadas.
- El asistente de Ollama vive dentro de AURA: verifica conexión, consulta modelos instalados, descarga mediante `/api/pull`, muestra porcentaje y bytes reales y conserva un registro técnico visible con el patrón Syntax display.
- El patrón Syntax display ya no es una consola oscura: se implementó como componente común basado en `showcase-ink`, con cabecera blanca, cuerpo gris claro, JetBrains Mono, borde y sombra sutil y control de copia. Se usa en Ollama, diagnóstico, expediente técnico, reporte, historial LLM, scripts y salidas del Laboratorio.
- La antigua implementación de `ollama-setup.html` fue sustituida por una redirección segura hacia el mismo asistente React; el lanzador que interceptaba Configuración fue retirado para conservar el flujo dentro de AURA. Configuración ya no enlaza a configuración avanzada ni a un laboratorio experimental inexistentes.
- La trazabilidad del diagnóstico identifica método solicitado y efectivo, secciones, modelo observado y hashes. El JSON técnico conserva ese recibo; el CSV es una vista tabular complementaria sin recibo.
- El reporte normal muestra valores medidos y usa `No medido` cuando una métrica formal no existe, sin convertir ausencias en ceros.
- El preflight exige Ollama `>= 0.5.0`, los tres identificadores exactos y un digest local válido. El digest de Ollama se captura como identidad del entorno y no se confunde con el SHA-256 de referencia del GGUF.
- Validación: 1740 pruebas Vitest aprobadas, 6 omitidas, typecheck y build correctos, y 10/10 E2E focales aprobados en Chromium. La prueba visual verifica colores, tipografía, sombra, cabecera y copia del componente real en el asistente de Ollama.
- El build aislado de Coolify ya no importa archivos fuera de `src`: una copia desplegable del oráculo se verifica byte a byte contra `experiments/final-evaluation/oracles/diagnostic-oracle.v1.json`.
- La campaña de 45 corridas continúa bloqueada únicamente por los smokes reales y la ejecución manual del investigador.

**Métricas obligatorias:**

- cobertura del motor frente a las 55 incidencias, separada del TP, FP, FN, precisión, recall y F1 primarios del LLM sobre hallazgos `engine_exposed` realmente presentes en la auditoría congelada;
- fidelidad a la evidencia visible en cada modo y descubrimiento extendido reportado como métrica secundaria;
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

**Gate:** las 45 unidades fueron intentadas, toda salida completada tiene evaluación automática y humana, los 9 representantes tienen resolución explícita, no existe drift de configuración y los cinco artefactos son consistentes. Si un modelo falla, se registra; no se reemplaza por mock ni se oculta.

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
- evaluación real de tres LLM y tres modos de entrada cerrada con resultados y limitaciones;
- PDF, JSON y CSV descargados y revisados;
- issues #19–#24 cerrados o reclasificados explícitamente;
- documento final redactable sin depender de claims no demostrados.

Hasta entonces, la formulación correcta es: **AURA tiene el producto y la arquitectura necesarios; falta cerrar su evidencia comparativa y de entrega.**
