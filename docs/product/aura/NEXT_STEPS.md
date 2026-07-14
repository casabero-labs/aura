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

**Pruebas realizadas.**

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
`synthetic_ground_truth.csv`, Qwen3.5 4B y `smart_sample` produzca una
respuesta con `requiresHumanReview: true` para los IDs obligatorios y sea
aceptada por el validador sin necesidad de tocar la regla. Esa única corrida
se comparará contra la nueva lista determinista; las dos corridas anteriores
con Qwen y Gemma **no deben presentarse** como comparación válida de modelos,
solo como evidencia de la contradicción original.

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

Validación del cierre: 110/110 pruebas focalizadas, 1895 unitarias superadas
y 6 omitidas, typecheck y build limpios, y 4/4 recorridos E2E superados.

## Documentos vigentes relacionados

- [Plan de cierre del diagnóstico normal y PDF](../../plans/2026-07-12-cierre-diagnostico-normal-y-reporte-pdf.md)
- [Contrato del paquete completo de evidencia](contracts/aura-evidence-package-v1.md)
- [Protocolo del Laboratorio](../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md)
- [Texto para limitaciones del LLM local en el TFM](documentation/TFM_LIMITACIONES_LLM_LOCAL.md)
