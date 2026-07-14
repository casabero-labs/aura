# Hoja de ruta definitiva de AURA

Última actualización: 14 de julio de 2026, 06:27 (America/Bogota).

Este documento es la única referencia operativa para cerrar el TFM. La entrega
académica vence el **miércoles 15 de julio de 2026 a las 15:00**. Hasta entregar,
la prioridad es producir evidencia diagnóstica real, consolidar resultados y
terminar el documento. El desarrollo adicional de AURA continuará después.

## Objetivo de cierre académico

Entregar evidencia suficiente y honesta de que AURA:

1. ingiere y perfila un CSV localmente;
2. detecta problemas mediante reglas deterministas;
3. restringe el diagnóstico LLM a la evidencia observada;
4. permite comparar modelos y métodos de entrada;
5. conserva resultados, métricas y trazabilidad para análisis;
6. genera un informe defendible y exportable.

Estos son los **seis objetivos específicos definitivos**. No se reformulan en
esta fase; en el documento se verificará su grado de cumplimiento con evidencia.

## Estado congelado al inicio del cierre

| Área | Estado para el TFM |
|---|---|
| Motor determinista | Cerrado y utilizable. |
| Diagnóstico normal V2 | **Contexto mínimo** (`prompt_libre`) y **Evidencia completa** (`recommended`) produjeron diagnósticos válidos. El piloto de **Evidencia equilibrada** (`smart_sample`) descubrió una contradicción del contrato: la entrada oculta `actionability` y `authorized`, pero el validador exige responder conforme a esos datos. Las corridas de Qwen y Gemma se conservan como evidencia del defecto y no como resultados comparables de los modelos. |
| Informe PDF y exportación | El ZIP completo quedó validado en una corrida humana. **Los tres defectos visuales del PDF quedaron corregidos** (porcentajes `0.00%` en gráficos de distribución/impacto, etiquetas humanas ausentes y fondo incompleto en las páginas 4 y 6). El informe se regeneró desde el `report JSON` real del ZIP, se renderizaron sus siete páginas y se verificó fondo blanco completo, porcentajes correctos, etiquetas visibles y ausencia de regresiones. |
| Plan y script | Implementados de forma determinista con revisión humana. El LLM no escribe código ejecutable. |
| Aplicar y verificar | Cerrado y validado por una corrida humana real: runner Python, recibo, CSV corregido, reauditoría antes/después y ZIP completo. |
| Laboratorio | Preparado para piloto y campaña real. |
| Evaluación formal | Pendiente de ejecutar. Es la prioridad inmediata. |
| Documento final | Pendiente de resultados y consolidación. |

## Decisiones vigentes para la prueba piloto

Estas decisiones se validarán con las tres corridas de Qwen. El protocolo
formal V2.1 todavía referencia Phase 8 y **no debe ejecutarse**. Si el piloto
termina correctamente, se creará una única versión nueva del protocolo con el
dataset, hashes, oracle, 27 diagnósticos y 9 calentamientos definitivos.

- Dataset de cierre: `synthetic_ground_truth.csv` (15 filas, 9 columnas y ground truth explícito).
- `controlled_customers_phase8.csv` se conserva como prueba de estrés posterior;
  no será el dataset de la campaña del TFM porque su salida estructurada excedió
  la capacidad práctica del modelo local probado.
- Modelos:
  - `hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL`.
- Métodos definitivos:
  - **Contexto mínimo** (`prompt_libre`);
  - **Evidencia equilibrada** (`smart_sample`);
  - **Evidencia completa** (`recommended`).
- Prueba previa: Qwen x 3 métodos x 1 ejecución = **3 diagnósticos exploratorios**.
- Campaña formal prevista: 3 modelos x 3 métodos x 3 repeticiones = **27 diagnósticos**.
- La reducción de 45 a 27 conserva tres observaciones por combinación y reduce
  el tiempo de ejecución. Se declarará como evaluación descriptiva de muestra pequeña.
- El score y los hallazgos pertenecen al motor determinista; el LLM no los modifica.
- Un fallo se conserva como resultado. No se repite silenciosamente para ocultarlo.
- `done_reason=length` se conserva como `DIAGNOSIS_RESPONSE_TRUNCATED`; no se
  intenta reparar ni certificar un JSON incompleto.
- No se cambia dataset, modelo, método o parámetros después de iniciar la campaña formal.

## Plan urgente hasta el depósito

### Lunes 13, 18:00-21:00 — prueba previa y control de evidencia

1. Confirmar que Ollama y los tres modelos estén disponibles.
2. Ejecutar con Qwen un diagnóstico normal por cada método de entrada.
3. Guardar los ZIP en `experiments/tests/flujo5/`, `flujo6/` y `flujo7/`, y
   verificar que cada uno conserve prompt, respuesta, modelo observado, recibo,
   latencia y errores.
4. Corregir cualquier bloqueo común antes de congelar el protocolo formal.
5. Corregir únicamente bloqueos que impidan una corrida real. No pulir UI ni
   añadir contratos o métricas nuevas.

Condición de salida: las tres entradas de Qwen terminan y sus ZIP permiten
compararlas sin evidencia faltante.

El primer intento con **Evidencia equilibrada** (`smart_sample`) de `flujo5`
con Phase 8 alcanzó el límite de salida de 4096 tokens y produjo un JSON
incompleto. No fue un fallo del motor
determinista. No se recortará la evidencia para forzar la prueba: el smoke se
repetirá con `synthetic_ground_truth.csv`, cuyo perfil completo genera 15
hallazgos, y Phase 8 quedará documentado como prueba de estrés y limitación.

### Lunes noche / martes mañana — campaña formal

Si la prueba previa confirma que la ejecución y exportación funcionan:

1. congelar la configuración;
2. ajustar y congelar el protocolo en 27 diagnósticos evaluados y 9 calentamientos;
3. ejecutar los diagnósticos y calentamientos definidos por el protocolo;
4. exportar la campaña completa;
5. verificar denominadores, combinaciones y corridas fallidas;
6. conservar una copia inmutable de los artefactos.

Si la campaña completa queda bloqueada, no se inventarán resultados: se usará
el piloto como evaluación exploratoria y se declarará la limitación.

### Martes 14 — consolidación y redacción

1. Generar la tabla modelo x método.
2. Consolidar precisión, recall, F1, cumplimiento del contrato, claims sin
   soporte, anclaje, latencia, errores y estabilidad.
3. Redactar resultados del objetivo experimental.
4. Contrastar los seis objetivos específicos con la evidencia disponible.
5. Redactar discusión, limitaciones, amenazas a la validez y conclusiones.
6. Incorporar figuras y tablas al documento final.

### Miércoles 15, 08:00-12:00 — cierre del documento

1. Revisión completa de coherencia entre objetivos, método, resultados y conclusiones.
2. Revisar numeración, referencias, tablas, figuras y anexos.
3. Exportar PDF final y verificarlo visualmente.
4. Preparar carpeta de entrega y copia de respaldo.
5. Congelar cambios a las 12:00 para conservar tres horas de margen.

## Cierre técnico alcanzado el 13 de julio

La rama opcional de remediación quedó conectada de extremo a extremo:

1. el diagnóstico LLM queda limitado a evidencia observada;
2. AURA construye el plan y el script Python de forma determinista;
3. la persona aprueba las acciones y el script;
4. el runner local valida sintaxis y ejecuta Python/Pandas sobre una copia;
5. AURA valida `corrected.csv` y `receipt.json`;
6. AURA reaudita el resultado con el mismo motor determinista;
7. el ZIP incorpora script, bundle, recibo, CSV corregido, reauditoría y resumen antes/después.

Gates repetidos por el orquestador sobre `48f302d`:

- 195/195 pruebas focalizadas;
- typecheck y build correctos;
- 3/3 E2E con runner y ZIP reales;
- recibo alterado rechazado;
- ausencia de `source.csv`, tamper y `force:true`.

### Recorrido humano final validado

El 13 de julio, entre las 22:08 y las 22:30, se completó el flujo publicado en
`https://aura.casabero.com` con `synthetic_ground_truth.csv`, Qwen3.5 4B y el
método **Evidencia completa** (`recommended`):

- diagnóstico válido sobre 15 hallazgos;
- 4 acciones aprobadas y 11 rechazadas;
- script determinista aprobado por revisión humana;
- sintaxis Python validada por el runner (`passed`);
- ejecución sobre una copia: 15 a 14 filas, 9 columnas conservadas;
- reauditoría: 15 a 11 hallazgos, 4 hallazgos corregidos, 0 reglas nuevas;
- ZIP con 28 archivos; sus 27 entradas declaradas coinciden en SHA-256 y tamaño;
- `corrected.csv` coincide con el hash del recibo y el CSV original no está en el ZIP;
- no se encontraron API keys en el expediente.

El primer intento de esta misma sesión con **Evidencia equilibrada**
(`smart_sample`) fue rechazado con `DIAGNOSIS_REVIEW_DOWNGRADE`. La revisión
posterior con dos modelos mostró que esta corrida está afectada por una
contradicción del contrato de entrada y no debe presentarse como resultado
negativo atribuible únicamente al modelo.

### Prueba exploratoria de Contexto mínimo validada

El 14 de julio se validó el ZIP de `experiments/tests/flujo6/` con Qwen3.5 4B y
**Contexto mínimo** (`prompt_libre`):

- método solicitado, efectivo y snapshot: `prompt_libre`;
- únicamente tres secciones visibles: resumen del dataset, esquema y registro
  mínimo de hallazgos;
- 15 bloques y 15 issues, con cobertura exacta;
- 0 referencias de evidencia y revisión humana obligatoria en los 15 issues,
  comportamiento esperado porque este método no expone muestras;
- diagnóstico y recibo válidos, sin errores de contrato;
- latencia: 166.199 ms; salida: 3.195 tokens;
- ZIP diagnóstico con 20 archivos totales: 19 declarados en el manifiesto y el
  propio `manifest.json`; hashes y tamaños verificados;
- dataset original y API keys ausentes.

Comparado con **Evidencia completa**, esta observación exploratoria tardó un
42,1 % menos y generó un 20,5 % menos de tokens. No se interpreta todavía como
resultado general: faltan las repeticiones formales.

El PDF incluido en ese ZIP fue generado desde una pestaña que mantenía el bundle
anterior y conserva el defecto visual `0.0%` en un gráfico. El diagnóstico, el
prompt, la respuesta y el recibo son válidos y no se repetirán. El mismo report
JSON regenerado con `main` actual produce etiquetas y porcentajes correctos.
Antes de la siguiente prueba se debe abrir una pestaña nueva o hacer recarga
forzada para cargar el bundle publicado más reciente.

### Bloqueo descubierto en Evidencia equilibrada

El 14 de julio se ejecutó **Evidencia equilibrada** (`smart_sample`) con
`synthetic_ground_truth.csv` en Qwen3.5 4B y Gemma 4 E4B:

- ambas respuestas fueron JSON completos con 15 bloques y 15 issues;
- Qwen marcó correctamente revisión humana en los 5 issues sin muestras, pero
  la redujo en los otros 10;
- Gemma marcó `requiresHumanReview: false` en los 15 issues, incluidos los 5
  que no tenían `evidenceRefs`;
- Qwen tardó 229 segundos y Gemma 206,6 segundos;
- AURA rechazó correctamente ambas respuestas con
  `DIAGNOSIS_REVIEW_DOWNGRADE`.

### Secuencia real de corridas Gemma

La secuencia exacta de corridas con Gemma 4 E4B, `smart_sample` y
`synthetic_ground_truth.csv`:

1. **Pre-contrato-fix (14 jul)**: 15/15 `requiresHumanReview: false` — todos
   los valores de revisión obligatoria fueron falsos. El contrato aún no
   exponía `issueIdsRequiringHumanReview` en el prompt.
2. **Post-contrato-fix (14 jul)**: 15/15 `requiresHumanReview: true` — el
   contrato corregido indujo el comportamiento correcto, pero la corrida falló
   por el falso rechazo de referencias `sha256:...` (AURA-CIERRE-PRIVACY-REFERENCE-01).
3. **Post-privacy-fix (14 jul)**: 5/15 `true`, 10/15 `false` — el validador
   ya aceptaba referencias de privacidad, pero el modelo presentó drift
   estocástico y volvió a marcar 10 issues como revisión no requerida. Esta
   corrida produjo `DIAGNOSIS_REVIEW_DOWNGRADE` y es la fixture que prueba
   la separación RAW vs EFFECTIVE.

Esta secuencia demuestra que el cumplimiento del prompt es estocástico y que
la gobernanza no puede delegarse al modelo.

La causa común no puede atribuirse solo a los modelos. La composición actual de
`smart_sample` expone estadísticas, activaciones y muestras, pero no expone
`actionabilityPolicy` ni `authorizationEvidence`. Sin embargo, la instrucción y
el validador exigen que `requiresHumanReview` respete exactamente esa gobernanza
oculta. Esto hace que la entrada esté subespecificada y sesga la comparación.

Las dos corridas deben conservarse como evidencia de ingeniería, pero quedan
excluidas de las conclusiones sobre rendimiento de los modelos. La campaña
formal queda bloqueada hasta hacer visible, como mínimo, la lista determinista
de issues que requieren revisión humana y validar una sola corrida de humo.

Defectos observados que requieren seguimiento:

- ~~el PDF muestra `0.00%` en gráficos cuyos valores no son cero~~ **corregido**: la
  causa raíz fue que la selección de visualización del diagnóstico sobrescribe el
  `kind` del gráfico pero conserva los `xKey`/`yKey` deterministas; los renderers
  asumían una convención de ejes fija, por lo que leían el valor de la columna de
  texto (`0`) y la etiqueta de la columna numérica. El render ahora resuelve el eje
  de valor por tipo de dato, sin tocar el motor ni el contenido estadístico;
- ~~las páginas 4 y 6 del PDF dejan parte del fondo en negro~~ **corregido**: solo
  la portada pintaba blanco; ahora todo camino que crea una página (incluido
  `jspdf-autotable`) pinta un rectángulo A4 blanco completo;
- `script-verification.json` conserva correctamente el estado del navegador
  (`not_run`), mientras `execution/receipt.json` acredita después la sintaxis
  real (`passed`); la diferencia es correcta pero debe explicarse mejor en la UI;
- la interfaz dice `0 evidencias` cuando realmente significa `0 muestras
  adjuntas`;
- la pantalla de ejecución necesita presentar con más claridad los pasos
  descargar, ejecutar y subir.

## Trabajo diferido después del depósito

No bloquea el documento del miércoles:

- #34: QA integral y pulido final;
- mejoras adicionales de hashes, contratos y recibos que no bloqueen corridas;
- pulido visual menor de la rama opcional;
- nuevas reglas, datasets, proveedores o modelos;
- recomendación de modelo y método después del perfil, basada en columnas,
  hallazgos, tamaño estimado de entrada/salida y recursos locales disponibles;
- mejoras productivas previstas para el mes de desarrollo restante.

## Métricas que sí deben llegar al TFM

- precisión, recall y F1 del diagnóstico;
- cumplimiento del contrato;
- columnas inventadas y claims sin soporte;
- anclaje a reglas y muestras problemáticas;
- latencia, tokens, errores y estabilidad;
- claridad, trazabilidad y accionabilidad humana cuando se mida;
- score e issues antes/después únicamente si existe ejecución verificada.

No se declarará un ganador universal. Las conclusiones se limitarán al dataset,
los modelos, los métodos y las condiciones realmente evaluadas.

## Próxima acción exacta

Desplegar el contrato corregido y ejecutar una sola corrida de humo con
Qwen3.5 4B, `synthetic_ground_truth.csv` y **Evidencia equilibrada**
(`smart_sample`). Solo si el diagnóstico supera el contrato sin relajar el
validador se congela el protocolo formal.

### Cierre del contrato de `smart_sample` (AURA-CIERRE-SMART-SAMPLE-HITL-01)

**Causa raíz.** La composición visible de `smart_sample` solo exponía
`dataset_summary`, `dataset_schema`, `issue_registry_minimal`,
`column_statistics`, `rule_activations` y `evidence_samples`. La gobernanza que
exige el validador (`actionability`, `automaticAuthorization.authorized` y
`isAmbiguous`/`isDuplicate` por columna) quedaba oculta, de modo que el modelo
no podía derivar qué `issueId`s necesitaban `requiresHumanReview: true` salvo
que adivinara. Por eso Qwen redujo revisión en 10 de 15 casos y Gemma la
redujo en los 15. Las dos corridas anteriores se conservan como evidencia de
la contradicción del contrato, **no** como resultados comparables de modelos.

**Solución aplicada.** Se extrajo la política a una única función pura en
`src/contracts/llm/humanReviewPolicyV2.ts`
(`requiresReviewFromEnvelopeV2` + `computeIssueIdsRequiringHumanReview`) que
comparte constructor y validador. El constructor embebe el resultado en el
`task` del prompt como `issueIdsRequiringHumanReview` (misma lista para los
tres modos, en orden canónico del envelope, solo IDs, sin governance). El
validador importa los mismos predicados compartidos; ya no existe la copia
local duplicada.
La instrucción del sistema y el `task.humanReviewInstruction` dejan claro que
todo ID en la lista exige `requiresHumanReview: true`, pero el modelo sigue
libre de marcar más cuando dude. `DIAGNOSIS_PROMPT_VERSION_V2` sube de
`1.4.0` a `1.5.0` porque cambia el prompt efectivo. Las tres secciones
visibles de cada modo no cambian: Contexto mínimo 3, Evidencia equilibrada 6,
Evidencia completa 12. `smart_sample` sigue sin contener `actionabilityPolicy`,
`authorizationEvidence`, `columnRegistry` ni `badSampleAnchors`.

**Pruebas realizadas (1925 unitarias + 4 E2E + typecheck + build).**

- `src/__tests__/humanReviewPolicyV2.test.ts` (14 casos, TDD): los tres modos
  reciben la misma lista determinista; `smart_sample` no expone la gobernanza
  prohibida; las secciones no cambian; todos los issues sin `evidenceRefs`
  aparecen; `review_only`, no autorizados y con columnas ambiguas aparecen;
  un issue realmente seguro y autorizado puede quedar fuera; el validador
  rechaza `false` para cualquier ID obligatorio; una respuesta correcta pasa;
  dos construcciones idénticas producen los mismos `userPayload`, `promptHash`,
  `inputHash` y `responseSchemaHash`; el orden canónico del envelope se
  preserva; la política compartida exige revisión cuando `evidenceRefs` está
  vacío aunque la gobernanza diga `auto_safe` + `authorized`.
- `src/__tests__/controlledDatasetDiagnosisInputs.test.ts` añade la regresión
  con `experiments/datasets/synthetic_ground_truth.csv`: comprueba que
  `integrity-dupes` tiene `evidenceRefs: []`, es `auto_safe` y está
  autorizado, aun así aparece en `issueIdsRequiringHumanReview`; la lista
  contiene los 15 `issueId` obligatorios; una respuesta con
  `integrity-dupes.requiresHumanReview=false` produce `DIAGNOSIS_REVIEW_DOWNGRADE`;
  una respuesta correcta para los 15 pasa.
- `src/__tests__/diagnosisSystemInstructionV2.test.ts` (6 casos): el builder
  canónico (`buildDiagnosisInputPackageV2`) sí incluye la lista; los builders
  histórico (`buildDiagnosisPromptV2`) y compacto (`buildCompactDiagnosisPromptV2`)
  no la incluyen y la instrucción global no afirma su presencia de forma
  incondicional; la protección contra prompt injection (regla 1, contenido
  no confiable) sigue intacta.
- 1892 unitarias superadas y 6 omitidas, 0 regresiones; 172/172 pruebas
  focalizadas superadas; typecheck y build limpios.
- 4/4 E2E (`oe4-final-evaluation.spec.ts` × 1, `apply-verify-e2e.spec.ts` × 3):
  recibo alterado rechazado; `execution/corrected.csv` incluido en la corrida
  verificada; `source.csv` excluido del ZIP; ZIP estable.
- `git diff --check` sin observaciones.
- `graphify update .` regenerado sin perder el contrato.
- Hashes y recibos siguen deterministas; las dos pruebas humanas previas
  (Contexto mínimo y Evidencia completa) y el laboratorio siguen validándose.

**Corrección R1.** La política compartida ahora contempla la regla completa
de revisión humana: gobernanza (columna ambigua/duplicada, `review_only`,
`auto_safe` no autorizado, actionability desconocida) **o** ausencia de
`evidenceRefs` en el envelope. La lista que el constructor envía al modelo
incluye `integrity-dupes` (`auto_safe` + `authorized` + `evidenceRefs: []`)
y los otros 14 `issueId`s del dataset de cierre. La instrucción global del
sistema se reformuló para afirmar la presencia de la lista solo cuando el
payload proviene del constructor canónico; los builders histórico y compacto
siguen produciendo payloads sin esa metadata y la regla no les aplica.

**Campaña todavía bloqueada hasta un único smoke humano con Qwen3.5 4B.**
El contrato ya está corregido y validado por los gates, pero el piloto formal
de 27 diagnósticos no se ejecutará hasta que una sola corrida humana real con
`synthetic_ground_truth.csv`, Qwen3.5 4B y `smart_sample` complete el flujo
normal. La corrida puede terminar sin normalización si el modelo cumple, o con
normalización explícita si el único incumplimiento crudo es
`DIAGNOSIS_REVIEW_DOWNGRADE`. En ese segundo caso deben quedar visibles y
exportados el diagnóstico crudo inválido, el diagnóstico efectivo válido, el
recibo de ambos planos y `governance-normalization.json`. Cualquier otro error
sigue bloqueando. Las corridas anteriores con Qwen y Gemma se conservan como
evidencia de la contradicción original, no como comparación formal de modelos.

## Cierre AURA-CIERRE-DETERMINISTIC-HITL-02 — separación RAW vs EFFECTIVE

**Causa raíz.** El contrato de `smart_sample` ya obliga al modelo a marcar
los IDs de la lista determinista con `requiresHumanReview: true`, pero
la decisión de revisión humana es un acto de gobernanza de AURA, no de
estocasticidad del modelo. Aunque el prompt sea perfecto, el LLM puede
omitir el flag (como ocurrió con Gemma en el piloto: 15/15 falsos) y el
sistema caía completo. Un solo paso de prompt no es solución suficiente;
la gobernanza debe ser computada por AURA y no delegada al modelo.

**Solución aplicada.** El diagnóstico normal de AURA ahora separa dos
vistas claramente diferenciadas:

1. **RAW model result** — la respuesta exacta del modelo con sus
   `requiresHumanReview` originales. El `ExecutionReceiptV1` certifica
   tanto la validación efectiva como la cruda (campos
   `rawValidationStatus`, `rawValidationErrorCodes`).
   `rawResponseHash` es inmutable y apunta a la respuesta exacta del
   proveedor. El Laboratorio evalúa la respuesta cruda sin pasar por
   el pipeline de normalización; el `DiagnosisExecutionResult` expone
   la respuesta cruda en `rawDiagnosis`.

2. **EFFECTIVE product diagnosis** — copia inmutable con `requiresHumanReview`
   forzado a `true` para cada `issueId` de la lista determinista
   (`computeIssueIdsRequiringHumanReview`). Solo se modifica ese campo;
   ningún otro campo del LLM se repara (refs, IDs, ruleIds, columnIds,
   unsupported claims, coverage, JSON malformado). La respuesta efectiva
   se re-valida con el validador estricto antes de continuar.

**Evidencia de normalización.** Cada corrida que requiera normalización
lleva `DiagnosisNormalizationEvidenceV2` con: `applied`, `field: "requiresHumanReview"`,
`reason: "AURA_GOVERNANCE_ENFORCED"`, `policy: "aura.human-review-policy.v2"`,
`policyVersion`, `normalizedIssueIds[]`, `originalValuesByIssueId`,
`effectiveValuesByIssueId`. Se exporta como `diagnosis/governance-normalization.json`
dentro del ZIP técnico y se renderiza en el diagnostic report con el
mensaje:

> "AURA aplicó revisión humana obligatoria a N hallazgos según su política
> determinista de gobernanza. La respuesta original del modelo se conserva en
> la evidencia técnica."

**Resultados reales Gemma (piloto 14 de julio).** Las dos corridas de
Gemma 4 E4B y Qwen 3.5 4B con `smart_sample` y `synthetic_ground_truth.csv`
mostraron dos perfiles de fallo opuestos: Qwen acertó en 5/15 y se equivocó
en 10/15; Gemma falló los 15. Ninguno de los dos pudo ser atribuido a un
defecto del modelo sin más contexto: ambos modelos devolvieron JSON válido,
cobertura exacta, IDs y referencias correctas — el único campo que
incumplió sistemáticamente el contrato fue `requiresHumanReview`. La
decisión de revisión humana no puede depender del LLM.

**Pruebas realizadas (1925 unitarias + 4 E2E + typecheck + build).**

- `src/__tests__/humanReviewNormalizerV2.test.ts` (14 tests, R1–R12 +
  dos integraciones): la fixture Gemma balanced reproduce el fallo real
  con 15 issues, 10 con `requiresHumanReview: false` y 5 con `true`. Las
  pruebas demuestran:
  1. raw validation reporta `DIAGNOSIS_REVIEW_DOWNGRADE`;
  2. raw compliance queda fallido y `downgradeCount > 0` para el
     Laboratorio;
  3. la normalización solo toca `requiresHumanReview`;
  4. los 10 IDs obligatorios quedan en `true` en la respuesta efectiva;
  5. el diagnóstico efectivo pasa validación estricta;
  6. la evidencia lista exactamente los 10 IDs modificados;
  7. raw response y `rawResponseHash` quedan inalterados;
  8. un `evidenceRef` inventado sigue bloqueando el producto
     (`DIAGNOSIS_REFERENCE_INVALID`);
  9. un valor entre comillas sin soporte sigue bloqueando
     (`DIAGNOSIS_REFERENCE_INVALID`);
  10. JSON inválido nunca se normaliza (`DIAGNOSIS_JSON_INVALID`);
  11. cobertura faltante nunca se normaliza (`DIAGNOSIS_REFERENCE_INVALID`);
  12. dos inputs idénticos producen evidencia idéntica.

- `src/contracts/llm/humanReviewNormalizerV2.ts` (nuevo): normalizer puro,
  `computeMandatoryReviewIssueIds`, `captureRawResponse`,
  `normalizeHumanReview`, `onlyRequiresHumanReviewDiffers`.

- `src/contracts/llm/diagnosisPipelineV2.ts`: el pipeline ahora aplica
  normalización exclusivamente cuando el fallo es `DIAGNOSIS_REVIEW_DOWNGRADE`
  puro. Cualquier otro error (schema, referencia, ejecutable, claim sin
  soporte, cobertura faltante) sigue siendo bloqueante sin reparación.

- `src/contracts/llm/diagnosisSelector.ts` +
  `src/contracts/llm/executionReceiptV1.ts` +
  `src/contracts/llm/types.ts`: el recibo y el `DiagnosisExecutionResult`
  propagan `rawDiagnosis`, `rawValidation`, `normalizationEvidence`. El
  recibo añade `normalizationApplied?: boolean` opcional.

- `src/services/evidenceArchive.ts`: el ZIP técnico incluye
  `diagnosis/governance-normalization.json` cuando la normalización
  efectivamente se aplicó.

- `src/services/diagnosticReport/diagnosticReportBuilder.ts`: el
  diagnostic report muestra el mensaje AURA_GOVERNANCE_ENFORCED en
  `limitations` cuando la evidencia indica normalización.

- Gates finales documentados al cierre de R2: `1925 passed`, 6 skipped;
  `typecheck` limpio; `build` correcto; E2E 4/4
  (`oe4-final-evaluation.spec.ts` × 1,
  `apply-verify-e2e.spec.ts` × 3).

**Por qué AURA es dueña de la gobernanza.** `requiresHumanReview` no es
una afirmación del modelo: es una decisión contractual sobre qué hallazgos
pueden automatizarse y cuáles requieren revisión humana. Esa decisión la
toma AURA leyendo el envelope (actionability, autorización, ambigüedad
de columna, ausencia de evidencia). Un LLM puede equivocarse; la
gobernanza debe ser determinista y reproducible. Esto NO se logra con
otro prompt: se logra con una capa de normalización explícita y auditable
que el Laboratorio sigue viendo en su forma cruda.

**Laboratorio vs producto.** El Laboratorio evalúa la respuesta cruda
(`run.diagnosis.parsedOutput`); el producto usa la respuesta efectiva
(`runStructuredDiagnosis().diagnosis`). Un único `ExecutionReceiptV1`
contiene tanto `validationStatus`/`validationErrorCodes` (efectivos) como
`rawValidationStatus`/`rawValidationErrorCodes` (crudos). El Laboratorio
lee `run.diagnosis.validationErrors` para mantener el conteo de
`DIAGNOSIS_REVIEW_DOWNGRADE` exactamente igual que antes. Los modelos NO
reciben crédito artificial por cumplimiento que AURA tuvo que imponer; el
cumplimiento del modelo se reporta por separado.

## Cierre AURA-CIERRE-DETERMINISTIC-HITL-02-R2 — auditoría honesta

### Correcciones aplicadas

1. **Eliminado `RawExecutionReceiptV1`**: el contrato `aura.raw-execution-receipt.v1`
   no existía en runtime (solo como tipo). Se removió de `types.ts`. Un único
   `ExecutionReceiptV1` ahora documenta ambos planos de validación.

2. **Semántica honesta del recibo**: `validationStatus`/`validationErrorCodes`
   reflejan la validación del diagnóstico EFECTIVO (producto). Los nuevos campos
   opcionales `rawValidationStatus`/`rawValidationErrorCodes` reflejan la
   validación de la respuesta CRUDA del proveedor. Cuando hay normalización:
   `validationStatus = "valid"`, `rawValidationStatus = "invalid"`,
   `normalizationApplied = true`.

3. **Entrada al normalizador asegurada**: el guard ahora exige
   `errors.length > 0 && errors.every(...)`. `Array.every()` devuelve `true`
   para arrays vacíos; sin el guard adicional, un validador roto que
   reportara `{valid: false, errors: []}` dispararía normalización.

4. **Aviso visible en la UI**: el diagnóstico normal muestra un texto en español:
   "AURA aplicó revisión humana obligatoria a N hallazgos según su política
   determinista de gobernanza. La respuesta original del modelo se conserva en
   la evidencia técnica."

5. **Prueba directa del ZIP**: `evidenceArchive.test.ts` verifica que
   `diagnosis/governance-normalization.json` existe con todos los campos
   requeridos, que `provider-response.raw.json` no se modifica, y que una
   ejecución sin normalización no inventa el archivo.

6. **Prueba de que el Laboratorio puntúa RAW**: `formalDiagnosisEvaluator.test.ts`
   demuestra que una respuesta con 10 valores falsos de revisión obligatoria
   produce `contractCompliant: false` con `DIAGNOSIS_REVIEW_DOWNGRADE`, sin
   normalización ni crédito artificial.

7. **Alcance estricto del normalizador confirmado**: 12 pruebas en
   `humanReviewNormalizerV2.test.ts` demuestran que solo se modifica
   `requiresHumanReview` (false → true), nunca se reparan IDs, ruleIds,
   columnIds, evidenceRefs, claims sin soporte, JSON malformado ni cobertura.

### Cierre de referencias de privacidad (AURA-CIERRE-PRIVACY-REFERENCE-01)

La corrida posterior con Gemma superó la revisión humana obligatoria para los
15 issues, pero fue rechazada porque el modelo resumió un valor anonimizado
como `"sha256:..."`. El validador buscaba literalmente los tres puntos dentro
del hash SHA-256 completo y produjo `DIAGNOSIS_REFERENCE_INVALID`. Era un falso
rechazo: el texto describía una transformación de privacidad visible, no un
valor inventado del CSV.

La validación ahora acepta la abstracción `sha256:...` únicamente cuando la
evidencia del mismo `issueId` contiene un SHA-256 concreto de 64 caracteres.
Sigue rechazándola cuando el issue no contiene ese hash, por lo que no se
relaja la protección frente a claims inventados. El prompt `1.6.0` también
explica que hashes y valores enmascarados no son valores originales y prohíbe
interpretarlos como el defecto de calidad. La corrida fallida se conserva como
evidencia de regresión, no como resultado formal de modelo.

Validación del cierre: 64/64 pruebas focalizadas, 1925 unitarias superadas y
6 omitidas, typecheck y build limpios, y 4/4 recorridos E2E superados.

## Documentos vigentes relacionados

- [Plan de cierre del diagnóstico normal y PDF](../../plans/2026-07-12-cierre-diagnostico-normal-y-reporte-pdf.md)
- [Contrato del paquete completo de evidencia](contracts/aura-evidence-package-v1.md)
- [Protocolo del Laboratorio](../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md)
- [Texto para limitaciones del LLM local en el TFM](documentation/TFM_LIMITACIONES_LLM_LOCAL.md)
