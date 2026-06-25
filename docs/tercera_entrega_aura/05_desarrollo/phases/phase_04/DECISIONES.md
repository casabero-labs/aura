# Decisiones de diseño — Phase 4

> **Versión:** 1.0.0 · **Fecha:** 2026-06-25 · **Commit Phase 3:** `d3774dd5ac98d89ca4454c693b1b0a30856cd191`

---

## D1: Separación estricta de capas

**Decisión:** El builder de script v2 (`scriptBuilderV2.ts`) NO importa código de UI, componentes React, ni servicios de ejecución. Solo depende de `types.ts`, `scriptColumnResolver.ts`, `scriptRendererV2.ts`, y `hash.ts`.

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

## D3: Uso de `canonicalJson` para hashes

**Decisión:** El `scriptHash` se calcula con `canonicalJson()` (keys ordenadas alfabéticamente, sin whitespace). Misma función que `planId` en Phase 3.

**Justificación:** Consistencia con el ecosistema de contratos. `canonicalJson` ya está probado y es estable.

**Consecuencias:**
- `scriptHash` no incluye `validationResult` (que es output de validación, no input)
- `scriptHash` incluye `scriptText`, `acceptedActionIds`, `columnRefs`, `rendererVersion`
- No incluye `rejectedActionIds` ni `excludedActionIds` (decisiones humanas, no afectan el cuerpo ejecutable)

---

## D4: Columnas se resuelven por `columnId`, no por nombre

**Decisión:** El renderer usa exclusivamente `columns[].columnId` del `RemediationContextV2` para obtener `pythonLiteral`. Nunca busca por `columns[].name`.

**Justificación:** Nombres de columna pueden ser ambiguos (duplicados, caracteres especiales, reserved words). `columnId` es determinista (hash del contenido + posición). El `ColumnRef` ya contiene `pythonLiteral` (nombre sanitizado con ordinal si es duplicado, notación `df['name']` si es reserved word).

**Consecuencias:**
- Si `columnId` no se encuentra en el contexto → error `SCRIPT_REFERENCE_INVALID`
- Si `isAmbiguous === true` → exclusión automática
- El renderer nunca hace `df[columnName]` directamente

---

## D5: Preservación del sistema legacy v1

**Decisión:** El código legacy (`deterministicScriptBuilder.ts`, `scriptValidationService.ts`, `LegacyScriptGenerationStepV1`, `ReviewStep`) NO se elimina ni se modifica sustancialmente en Phase 4.

**Justificación:** Compatibilidad hacia atrás. El sistema v1 sigue funcionando para usuarios que no activan `CONTRACTS_V2_ENABLED`. El ruteo en `ScriptGenerationStep` decide qué camino tomar.

**Consecuencias:**
- `ScriptGenerationStepV2` es un componente nuevo, no un reemplazo
- `ReviewStep` recibe props opcionales para contrato v2 (sin romper v1)
- Los tests legacy siguen pasando

---

## D6: `cleanDatasetFn` como identificador único

**Decisión:** El nombre de la función de limpieza es fijo: `clean_dataset`. No se parametriza.

**Justificación:** Simplicidad. Si el usuario necesita un nombre diferente, puede renombrar la función después de exportar. Un nombre fijo facilita la validación y la referencia en Phase 5 (ejecución).

**Consecuencias:**
- `cleanDatasetFn: 'clean_dataset'` siempre
- La validación verifica que `def clean_dataset(df):` existe en `scriptText`

---

## D7: `excludedActionIds` como array estructurado

**Decisión:** Las acciones excluidas se representan como `Array<{actionId: string, reason: string}>`, no como `string[]`.

**Justificación:** Cada exclusión tiene un motivo (pending, rejected, ambiguous_column, unsupported_action). Esto permite auditoría y explicabilidad. Un array plano de strings no captura el motivo.

**Consecuencias:**
- `excludedActionIds` es un array de objetos, no de strings
- `rejectedActionIds` sigue siendo `string[]` (el motivo siempre es "rechazado por HITL")
- La validación verifica que el `reason` sea uno de los valores permitidos

---

## D8: Validación best-effort de sintaxis Python

**Decisión:** La validación de sintaxis Python (`compile()`) es opcional y solo se ejecuta si el entorno tiene Python disponible.

**Justificación:** En CI (GitHub Actions), Python puede no estar instalado. La validación de seguridad (sin eval/exec/subprocess) es suficiente para garantizar que el script no es malicioso. La sintaxis se valida con regex de estructura básica.

**Consecuencias:**
- `validateScriptContractV2` tiene un parámetro `checkPythonSyntax?: boolean`
- Si `true` y Python no disponible → warning, no error
- La validación de estructura (imports, función, indentación) siempre se ejecuta

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
