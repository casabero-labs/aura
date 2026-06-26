# Decisiones de diseño — Phase 4

> **Versión:** 2.1.0 · **Fecha:** 2026-06-25 · **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191` · **Loop 5:** `c0e4e6a`

---

## D1: Separación estricta de capas

**Decisión:** El builder de script v2 (`scriptBuilderV2.ts`) NO importa código de UI, componentes React, ni servicios de ejecución. Solo depende de `types.ts`, `scriptBuildContext.ts`, `scriptColumnResolver.ts`, `scriptRendererV2.ts`, `placeholderVocabulary.ts`, y `hash.ts`.

**Justificación:** El contrato y el renderer deben ser auditables sin arrastrar dependencias de browser. El mismo builder debe funcionar en Node.js (tests, CI) y en browser (Vite).

**Consecuencias:**
- `scriptBuilderV2.ts` está en `src/contracts/llm/` (capa de contratos, no de UI)
- No puede importar `react`, `react-dom`, `lucide-react`
- No puede importar servicios de `src/services/` salvo `hash.ts`

---

## D2: El LLM no escribe código

**Decisión:** En ningún punto de Phase 4 el LLM genera, corrige o completa código Python/Pandas. Todo el script se construye con plantillas deterministas a partir de `actionType` y `parameters`.

**Justificación:** Regla de oro del TFM. La separación limpia entre diagnóstico (LLM) y remediación/script (determinista) es el claim central. Si el LLM toca el código, se pierde la auditabilidad.

**Consecuencias:**
- El renderer tiene exactamente una plantilla por `actionType`
- Las variaciones vienen de `parameters` (ej: `collapseInternalWhitespace: true|false`)
- Ningún template string contiene `${aiOutput}` o similar

---

## D3: `scriptHash` sin `generatedAt`, con `placeholderVocabularyVersion`

**Decisión:** El `scriptHash` se calcula con `canonicalJson()` incluyendo `placeholderVocabularyVersion` pero excluyendo `generatedAt`. Misma función de hashing que `planId` en Phase 3.

**Justificación:** `generatedAt` cambia en cada ejecución — incluirlo rompe la estabilidad del hash. `placeholderVocabularyVersion` es necesario porque un cambio en el vocabulario de placeholders altera el comportamiento del renderer.

**Consecuencias:**
- `scriptHash` incluye: `remediationRef`, `datasetFingerprint`, `acceptedActionIds`, `columnRefs`, `rendererVersion`, `placeholderVocabularyVersion`, `scriptText`, `cleanDatasetFn`
- `scriptHash` NO incluye: `generatedAt`, `validationResult`, `rejectedActionIds`, `excludedActionIds`
- Dos ejecuciones del mismo builder con los mismos inputs producen el mismo hash

---

## D4: Columnas se operan por posición en duplicados

**Decisión:** Las columnas duplicadas (`isDuplicate === true`) se operan por **posición** y **duplicateOrdinal**, no por nombre. `pythonLiteral` pertenece a `ColumnRef` (no a `RemediationContextColumnV2`) y se construye con helpers `buildPythonLiteral`/`readColumn`/`writeColumn`.

**Justificación:** Nombres de columna duplicados son indistinguibles por nombre. La posición (`columnId` + `duplicateOrdinal`) es determinista y no ambigua. `RemediationContextColumnV2` no tiene `pythonLiteral` porque ese campo pertenece al `ColumnRef` del envelope original.

**Consecuencias:**
- `pythonLiteral` se obtiene de `ColumnRef` (envelope) o se construye en `ScriptBuildContextV2`
- Columnas duplicadas se referencian por posición: `df_clean.iloc[:, _c["columnId"]["position"]]`
- `drop_exact_duplicates` acepta `columnRef === null` (opera a nivel dataset)
- Los helpers `readColumn`/`writeColumn`/`accessColumn` encapsulan toda la lógica de acceso

---

## D5: Preservación del sistema legacy v1

**Decisión:** El código legacy (`deterministicScriptBuilder.ts`, `scriptValidationService.ts`, `LegacyScriptGenerationStepV1`, `ReviewStep`) NO se elimina ni se modifica sustancialmente en Phase 4.

**Justificación:** Compatibilidad hacia atrás. El sistema v1 sigue funcionando para usuarios que no activan `CONTRACTS_V2_ENABLED`. El ruteo en `ScriptGenerationStep` decide qué camino tomar.

**Consecuencias:**
- `ScriptGenerationStepV2` es un componente nuevo, no un reemplazo
- `ReviewStep` recibe props opcionales para contrato v2 (sin romper v1)
- Los tests legacy siguen pasando

---

## D6: `cleanDatasetFn` fijo a `clean_dataset`

**Decisión:** El nombre de la función de limpieza es fijo: `clean_dataset`. No se parametriza.

**Justificación:** Simplicidad. Si el usuario necesita un nombre diferente, puede renombrar la función después de exportar. Un nombre fijo facilita la validación y la referencia en Phase 5 (ejecución).

**Consecuencias:**
- `cleanDatasetFn: 'clean_dataset'` siempre
- La validación verifica que `def clean_dataset(df):` existe en `scriptText`

---

## D7: Partición única sin solapamiento

**Decisión:** Las acciones del plan se particionan en tres conjuntos disjuntos:
- `acceptedActionIds`: solo `approved` Y renderizables
- `rejectedActionIds`: ÚNICAMENTE `rejected`
- `excludedActionIds`: `pending` O `approved` no renderizables

Una acción `rejected` NUNCA aparece en `excludedActionIds`. Los conjuntos son mutuamente excluyentes por construcción.

**Justificación:** Claridad semántica. `rejected` es una decisión HITL explícita; `excluded` es una limitación técnica (columna ambigua, `requires_human_review`, pendiente de decisión). Mezclarlos en la misma lista oscurece la trazabilidad.

**Consecuencias:**
- `excludedActionIds[].reason` nunca es `'rejected'`
- `rejectedActionIds` es `string[]` (sin motivo adicional — siempre es "rechazado por HITL")
- La validación verifica `rejectedActionIds ∩ excludedActionIds = ∅` con `SCRIPT_PARTITION_INVALID`

---

## D8: Sintaxis Python como tri-state

**Decisión:** La validación de sintaxis Python tiene tres estados: `'passed'`, `'failed'`, `'not_run'`. Solo `'passed'` es validación formal aprobada.

**Justificación:** En entornos sin Python (CI, browser), no se puede ejecutar `compile()`. `not_run` no debe bloquear la finalización del contrato, pero debe registrarse explícitamente para que el consumidor sepa que la sintaxis no fue verificada.

**Consecuencias:**
- `PythonSyntaxState = 'passed' | 'failed' | 'not_run'`
- `'failed'` → `SCRIPT_SYNTAX_INVALID`, bloquea finalización
- `'not_run'` → warning, no bloquea
- El badge UI muestra "Contrato válido" (no "Seguro") cuando `valid === true`

---

## D9: No hay ejecución de scripts en Phase 4

**Decisión:** Phase 4 genera y valida el script, pero NO lo ejecuta. La ejecución, reauditoría y delta pertenecen a Phase 5.

**Justificación:** Alcance definido en el roadmap. Phase 4 entrega un script validado y un contrato firmado. Phase 5 se encarga de ejecutarlo (posiblemente vía Pyodide en browser o Python en backend).

**Consecuencias:**
- No se importa Pyodide en Phase 4
- No se crea `ImprovementRun` desde el script v2 (eso es Phase 5)
- `ReviewStep` no ejecuta simulación con script v2

---

## D10: No hay regresión de Phase 3

**Decisión:** Ningún cambio en Phase 4 modifica archivos congelados de Phase 3. Si un cambio requiere tocar un archivo de Phase 3, se discute y registra como excepción.

**Justificación:** Phase 3 está congelada con evidencia documental. Modificar sus archivos invalidaría las capturas, el manifiesto y el paquete de evidencia.

**Archivos protegidos:**
- `remediationBuilderV2.ts`
- `remediationValidatorV2.ts`
- `remediationApprovalV2.ts`
- `remediationPolicyV2.ts`
- `Phase3EvidenceHarness.ts`
- `third-delivery-evidence.spec.ts`
- Capturas 01–06
- `CAPTURAS_MANIFEST.md`
- `PAQUETE_EVIDENCIA_PHASE3.md`

---

## D11: Flujo candidate → validate → finalize

**Decisión:** El contrato se construye en tres fases separadas:
1. `buildScriptCandidateV2()` → `ScriptContractCandidateV2` (sin hash ni validación)
2. `validateScriptCandidateV2()` → `ValidationResultV2`
3. `finalizeScriptContractV2()` → `ScriptContractV2` (con hash y validación, solo si `valid === true`)

**Justificación:** Separación de concerns. El builder no debe conocer la validación. El hash solo se calcula una vez que el candidato es válido. Esto permite iterar sobre el candidato (corregir, re-validar) sin recalcular hashes innecesariamente.

**Consecuencias:**
- `ScriptContractCandidateV2` no tiene `scriptHash` ni `validationResult`
- `finalizeScriptContractV2()` es la única función que produce `ScriptContractV2`
- El hash es estable porque no incluye `generatedAt`

---

## D12: Validación por reconstrucción exacta

**Decisión:** El validador re-renderiza el candidato desde el plan y contexto original, y compara `scriptText`, `acceptedActionIds`, `columnRefs`, y `cleanDatasetFn`. Cualquier diferencia produce `SCRIPT_RENDER_MISMATCH`.

**Justificación:** Defensa contra drift entre builder y validator. Si el builder y el validator usan versiones diferentes del renderer o tienen bugs sutiles, la reconstrucción los detecta.

**Consecuencias:**
- El validator importa y usa exactamente las mismas funciones del builder
- `SCRIPT_RENDER_MISMATCH` es un código de error nuevo
- La reconstrucción no compara `rejectedActionIds` ni `excludedActionIds` (son independientes del renderer)

---

## D13: PLACEHOLDER_VOCABULARY_V2 cerrado y versionado

**Decisión:** El vocabulario de placeholders es una constante `ReadonlyArray<string>` congelada con `Object.freeze`, versionada con string semántico (`'1.0.0'`), y sin valores provenientes del LLM.

**Justificación:** `normalize_placeholders` reemplaza valores por `np.nan`. La lista de valores debe ser determinista, auditable y versionada. Si cambia, debe reflejarse en `placeholderVocabularyVersion` y por tanto en `scriptHash`.

**Consecuencias:**
- 17 placeholders en la versión 1.0.0 (longitud calculada vía `.length`)
- Cualquier adición requiere bump de `placeholderVocabularyVersion`
- El vocabulario se importa como constante, nunca se construye dinámicamente

---

## D14: Script con cero acciones es una función Python completa

**Decisión:** Cuando `acceptedActionIds` está vacío, el script contiene `def clean_dataset(df):` que copia y retorna el dataframe sin transformaciones.

**Justificación:** El contrato debe ser ejecutable incluso sin transformaciones. Una función vacía o un script sin función no es un artefacto usable. Phase 5 necesita una función `clean_dataset` para ejecutar.

**Consecuencias:**
- `scriptText` nunca está vacío
- Mínimo: imports + `def clean_dataset(df): df_clean = df.copy(); return df_clean`
- La validación verifica que `def clean_dataset(df):` existe en `scriptText`

---

## D15: Riesgo de falsos positivos en PLACEHOLDER_VOCABULARY_V2

**Decisión:** Los valores `-`, `--` y `...` pueden ser valores legítimos en columnas de texto y no deben asumirse universalmente como placeholders nulos.

**Justificación:** En datasets reales, `-` puede representar "no aplica" o "sin datos", `...` puede ser texto legítimo o elipsis. `normalize_placeholders` no debe aplicarse sin una acción determinista autorizada que confirme el contexto semántico.

**Consecuencias:**
- `normalize_placeholders` solo podrá aplicarse cuando exista una acción determinista autorizada
- Phase 4 no debe afirmar que todo valor del vocabulario es universalmente nulo
- La política será reevaluada antes de cerrar el renderer (Loop 2)
- El vocabulario no se modifica en Loop 1R

---

## D16: Fresh verification antes de aprobación humana

**Decisión:** `ReviewStep` v2 ejecuta `verifyScriptContractV2()` una segunda vez (fresca) antes de registrar la aprobación. Si falla → bloqueo con error visible.

**Justificación:** El contrato podría haber sido invalidado por cambios en datos/diagnóstico/plan entre la generación y la revisión. Una verificación fresca garantiza que el contrato aprobado es válido en el momento del approve.

**Consecuencias:**
- `ReviewStep` v2 tiene estado `v2VerifyResult` y `v2VerifyError`
- La verificación es async (maneja errores de red/timeout)
- Si la verificación falla, el botón "Aprobar" queda deshabilitado

---

## D17: Invalidation por clave compuesta

**Decisión:** El contrato se invalida cuando cambia cualquiera de los inputs base: `fingerprint`, `envelopeRef`, `planId`, `csvFields`. La clave es un string compuesto `f:{fingerprint}#d:{envelopeRef}#p:{planId}#c:{csvFields.join(',')}`.

**Justificación:** Re-calcular el contrato ante cada cambio de input evita aprobaciones de contratos obsoletos. La clave compuesta es determinista y se calcula en un solo efecto `useEffect`.

**Consecuencias:**
- Un cambio en `csvFields` invalida el contrato (porque cambia el column registry)
- Un cambio en `planId` invalida el contrato (porque cambia las acciones aceptadas)
- Si algún input es `null`, el efecto no se ejecuta (esperando datos)

---

## D18: ScriptGenerationStepV2 como componente de una sola dirección

**Decisión:** `ScriptGenerationStepV2` solo genera contratos. No permite editar el script, re-generar parcialmente, ni modificar el plan. El usuario puede generar o ir atrás, pero no editar inline.

**Justificación:** El script es determinista a partir del plan. Permitir edits inline rompería la trazabilidad del contrato. Si el usuario quiere cambiar algo, modifica el plan (loop anterior).

**Consecuencias:**
- No hay textarea editable en Vista B
- El script mostrado es siempre `contract.scriptText` exactamente
- `ScriptReview` recibe `readOnly=true`, `hideEditAction=true`
- Copiar y descargar están disponibles como alternativa a la edición

---

## D19: Routing por Contracts v2 flag

**Decisión:** El routing entre `ScriptGenerationStepV2` y `ScriptGenerationStep` se basa en `isContractsV2Enabled() && !!structuredDiagnosis?.remediationContext`. Si falta el contexto de remediación, cae al legacy aunque el flag esté activo.

**Justificación:** El flag de feature es necesario pero no suficiente. Sin `remediationContext`, el builder v2 no puede construir el contexto de columnas. Fallback al legacy es la opción segura.

**Consecuencias:**
- Si el usuario tiene Contracts v2 activado pero sin remediation plan, ve el legacy
- Si desactiva Contracts v2, pierde el contrato v2 existente (se limpia)
- El routing es monotónico: una vez en v2, no se regresa a legacy en la misma sesión
