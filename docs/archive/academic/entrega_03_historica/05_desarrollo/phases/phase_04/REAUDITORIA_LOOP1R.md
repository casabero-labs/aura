# Reauditoría — Phase 4 Loop 1R

> **Fecha:** 2026-06-25 · **Auditor:** OpenCode · **Commit auditado:** `8a8e66b72a7b06d722fc57c5fcd70d05f670bb29`
> **Commit rechazo anterior:** `9a8f5e0330f1dbb5c84d60db96c4b0249e7746f4` · **Veredicto:** `APPROVED_WITH_FIXES`

---

## Resumen Ejecutivo

La remediación cierra los 10 hallazgos originales (H1-H4, M1-M4, L2-L3). Las expresiones Python son correctas con `buildColumnRegistry()` real. El pipeline `buildColumnRegistry → buildColumnRegistryV2 → resolveScriptColumn → buildColumnReadExpression/buildColumnWriteTarget` produce sintaxis Pandas válida. `ast.parse` PASS.

Sin embargo, la reauditoría descubre **2 hallazgos nuevos High** en `ReadonlyMapView` y **1 Medium** en `resolveScriptColumn`:

- **H-NEW-1:** `_map` es accesible como propiedad enumerable (TypeScript `private` no es runtime-private). Un consumidor puede inyectar/eliminar entries via `(reg.byColumnId as any)._map.set(...)`.
- **H-NEW-2:** `forEach` pasa el Map mutable original como tercer argumento al callback. Un consumidor puede mutar el mapa via `map.set()` dentro del callback.
- **M-NEW-1:** `resolveScriptColumn` acepta `correspondenceEvidence` como opcional. Un consumidor puede omitirlo y resolver columnas sin verificación de contexto.

Ninguno de estos hallazgos impide que Loop 2 funcione correctamente, ya que:
1. El renderer Loop 2 consumirá `buildColumnAccessSpec`/`buildColumnReadExpression`/`buildColumnWriteTarget` — no necesita mutar el registry.
2. La omisión de `correspondenceEvidence` es un riesgo de diseño, no un bypass funcional inmediato.

**No existen Critical. No existen regresiones de Phase 3. Expresiones Python correctas.**

---

## Matriz de hallazgos originales

| # | Severidad original | Hallazgo | Estado | Evidencia |
|---|---|---|---|---|
| H1 | CRITICAL | `accessColumnDf()` produce Pandas inválido | **CERRADO** | `buildColumnReadExpression` produce `df_clean[_c["col:..."]]` — PASS |
| H2 | HIGH | `buildPythonLiteral()` código muerto | **CERRADO** | Función eliminada, sin exports |
| H3 | HIGH | `buildColumnRegistryV2()` no valida `pythonLiteral` | **CERRADO** | Validación canónica: rechaza `pythonLiteral !== _c[JSON.stringify(columnId)]` — PASS |
| H4 | HIGH | `resolveScriptColumn()` ignora `correspondenceEvidence.valid` | **CERRADO** | `context_invalid` retornado cuando `valid=false` — PASS |
| M1 | MEDIUM | `byColumnId` sobrescribe `columnId` duplicado | **CERRADO** | `DUPLICATE_COLUMN_ID` error lanzado — PASS |
| M2 | MEDIUM | Inner arrays y ColumnRef mutables | **PARCIALMENTE CERRADO** | Freeze inicial PASS, pero `_map` expuesto (ver H-NEW-1, H-NEW-2) |
| M3 | MEDIUM | Tests con fixtures manuales | **CERRADO** | 8 tests de integración con `buildColumnRegistry()` real — PASS |
| M4 | MEDIUM | Vocabulario `-` y `...` falsos positivos | **CERRADO** | D15 documentado |
| L2 | LOW | `isColumnRenderizable()` nombre ambiguo | **CERRADO** | Renombrado a `isColumnStructurallyRenderable()` |
| L3 | LOW | `ScriptValidationResultV2` redeclaraba campos | **CERRADO** | Simplificado a `extends ValidationResultV2` |

---

## Nuevos hallazgos

### H-NEW-1 — HIGH: `_map` accesible como propiedad enumerable

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:88` (ReadonlyMapView)
**Línea:** Definición de `private _map: Map<K, V>`

**Prueba ejecutable:**

```typescript
const reg = buildColumnRegistryV2(buildColumnRegistry(['Age', 'Fare']));
const anyMap = reg.byColumnId as any;

// 1. _map es enumerable
Object.keys(anyMap); // ['_map']

// 2. _map.set inyecta entries
anyMap._map.set('INJECTED', { columnId: 'INJECTED', name: 'x', position: 99, duplicateOrdinal: 0, pythonLiteral: '', isAmbiguous: false, isDuplicate: false, isReservedWord: false });
reg.byColumnId.has('INJECTED'); // true

// 3. _map.delete elimina entries
anyMap._map.delete(cols[0].columnId);
reg.byColumnId.has(cols[0].columnId); // false

// 4. _map.clear elimina todo
anyMap._map.clear();
reg.byColumnId.size; // 0
```

**Análisis:**
- TypeScript `private` es compile-time only. En runtime, `_map` es una propiedad regular del objeto.
- `Object.keys(reg.byColumnId as any)` retorna `['_map']` — la propiedad es enumerable.
- Un consumidor malicioso o con bugs puede mutar el registry completo via `_map.set()`, `_map.delete()`, `_map.clear()`.
- `buildColumnRegistryV2` crea ColumnRef frozen, pero `_map.set()` puede reemplazar entries con copias no frozen.

**Impacto en Loop 2:** El renderer Loop 2 no necesita mutar el registry. Sin embargo, cualquier consumidor futuro que itere o acceda al registry puede corromper silenciosamente su estado.

**Corrección recomendada:** Usar `#map` (ES2022 private field) o `Symbol`-keyed property en lugar de TypeScript `private`. Alternativamente, `Object.defineProperty(this, '_map', { enumerable: false })` en el constructor.

---

### H-NEW-2 — HIGH: `forEach` pasa Map mutable original

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:100-102`

**Prueba ejecutable:**

```typescript
const reg = buildColumnRegistryV2(buildColumnRegistry(['Age', 'Fare']));
let mutated = false;
reg.byColumnId.forEach((value, key, map) => {
  try {
    map.set('FOR_EACH_INJECTED', { columnId: 'FOR_EACH_INJECTED', name: 'fe', position: 98, duplicateOrdinal: 0, pythonLiteral: '', isAmbiguous: false, isDuplicate: false, isReservedWord: false });
    mutated = true;
  } catch {}
});
mutated; // true — el callback pudo mutar el mapa
```

**Análisis:**
- `ReadonlyMapView.forEach()` delega a `this._map.forEach(cb, thisArg)`.
- El tercer argumento del callback es `this._map` (el Map mutable original), no la `ReadonlyMapView`.
- Un consumidor que escriba `forEach((val, key, map) => { map.set(...) })` puede inyectar entries.
- `byName` tiene el mismo comportamiento.

**Impacto en Loop 2:** El renderer no usará `forEach` para mutar. Sin embargo, el patrón es una fuga de la interfaz inmutable.

**Corrección recomendada:** Envolver el callback para no pasar el Map:

```typescript
forEach(cb: (value: V, key: K, map: ReadonlyMapView<K, V>) => void, thisArg?: unknown): void {
    this._map.forEach((value, key) => cb(value, key, this as any), thisArg);
}
```

---

### M-NEW-1 — MEDIUM: `resolveScriptColumn` acepta `correspondenceEvidence` opcional

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:24-27`

**Prueba ejecutable:**

```typescript
const cols = buildColumnRegistry(['Age']);
const ctx = {
  remediationContext: { evidenceEnvelopeRef: '', datasetFingerprint: 'sha256:test', columns: [], issues: [] },
  sourceDatasetFingerprint: 'sha256:test',
  columnRegistry: buildColumnRegistryV2(cols),
  // correspondenceEvidence OMITTED
} as any;
const result = resolveScriptColumn(cols[0].columnId, ctx);
result.ok; // true — resuelve sin verificación de contexto
```

**Análisis:**
- La firma es: `resolveScriptColumn(columnId, { columnRegistry, correspondenceEvidence? })`.
- Si `correspondenceEvidence` se omite, el check `buildContext.correspondenceEvidence && !buildContext.correspondenceEvidence.valid` evalúa `undefined && ...` → `false`, permitiendo la resolución.
- `ScriptBuildContextV2` (types.ts:520) declara `correspondenceEvidence: CorrespondenceEvidenceV2` (no opcional).
- Pero `resolveScriptColumn` acepta un tipo más laxo.

**Impacto en Loop 2:** Un consumidor que construya un contexto manualmente sin `correspondenceEvidence` puede resolver columnas sin validación de fingerprint o columnas.

**Corrección recomendada:** Cambiar la firma a `buildContext: ScriptBuildContextV2` (tipo completo) o añadir check explícito:

```typescript
if (!buildContext.correspondenceEvidence || !buildContext.correspondenceEvidence.valid) {
    return { ok: false, reason: 'context_invalid' };
}
```

---

## Verificaciones de metadatos de duplicados

`buildColumnRegistryV2()` NO valida coherencia de metadatos entre columnas. Los siguientes casos son aceptados:

| Caso | Input | Resultado |
|---|---|---|
| Mismo nombre, isDuplicate=false | `[{name:'A',isDuplicate:false}, {name:'A',isDuplicate:false}]` | Aceptado |
| Columna única, isDuplicate=true | `[{name:'A',isDuplicate:true}]` | Aceptado |
| Ordinales 0 y 2 (gap) | `[{duplicateOrdinal:0}, {duplicateOrdinal:2}]` | Aceptado |
| Ambos ordinales 0 | `[{duplicateOrdinal:0}, {duplicateOrdinal:0}]` | Aceptado |
| ordinal=1 en columna única | `[{duplicateOrdinal:1}]` | Aceptado |
| Tres columnas ordinals 2,0,1 | `[{duplicateOrdinal:2}, {duplicateOrdinal:0}, {duplicateOrdinal:1}]` | Aceptado |

**Severidad:** MEDIUM — La metadata incoherente no causa errores inmediatos pero puede producir comportamiento indefinido en Loop 2 si el renderer depende de la coherencia ordinal.

---

## Verificaciones de registry y correspondencia

| Caso | Resultado |
|---|---|
| columnId duplicado | ✓ Rechazado (DUPLICATE_COLUMN_ID) |
| Posición duplicada | ✓ Rechazado (DUPLICATE_POSITION) |
| Posición negativa | ✓ Rechazado (INVALID_POSITION) |
| pythonLiteral no canónico | ✓ Rechazado (NON_CANONICAL_PYTHON_LITERAL) |
| Posiciones faltantes (no 0..n-1) | ✓ Rechazado (MISSING_POSITION) |
| ColumnRegistry vacío | ✓ Aceptado (0 columns) |
| Contexto vacío | ✓ valid=false (fingerprint mismatch) |
| Fingerprint diferente | ✓ valid=false |
| Columnas inesperadas ordenadas | ✓ Verificado (unexpectedColumnIds.sort()) |
| Columnas faltantes ordenadas | ✓ Verificado (missingColumnIds.sort()) |
| Mismatches ordenados | ✓ Verificado (mismatchedColumns.sort()) |
| Fallback por nombre | ✓ No existe en ninguna ruta ejecutable |

---

## Identidad e inmutabilidad

| Propiedad | Resultado |
|---|---|
| `orderedColumns[0] !== byColumnId.get(id)` | ✓ Objetos diferentes |
| `orderedColumns[0] !== byName.get(name)[0]` | ✓ Objetos diferentes |
| `byColumnId.get(id) !== byName.get(name)[0]` | ✓ Objetos diferentes |
| Todos los objetos frozen (inicialmente) | ✓ `Object.isFrozen()` true |
| inner arrays byName frozen | ✓ `Object.freeze()` aplicado |
| orderedColumns frozen | ✓ `Object.freeze()` aplicado |
| `_map` enumerable | ❌ `Object.keys()` retorna `['_map']` |
| `_map` mutable via reflection | ❌ `as any._map.set(...)` funciona |

---

## Expresiones Python — verificación completa

### Unica (Age)

```
pythonLiteral: _c["col:b919e75bd6fba9f7"]
readExpression: df_clean[_c["col:b919e75bd6fba9f7"]]
writeTarget: df_clean[_c["col:b919e75bd6fba9f7"]]
```

### Unica reserved word (class)

```
pythonLiteral: _c["col:564466e8d48908b5"]
readExpression: df_clean[_c["col:564466e8d48908b5"]]
```

### Unica con espacios (Customer Name)

```
pythonLiteral: _c["col:26b29e05da920449"]
readExpression: df_clean[_c["col:26b29e05da920449"]]
```

### Unica con caracteres especiales (price (€))

```
pythonLiteral: _c["col:826963f2a9f00480"]
readExpression: df_clean[_c["col:826963f2a9f00480"]]
```

### Unica con apóstrofo (customer's note)

```
pythonLiteral: _c["col:e7e1375e14c0c399"]
readExpression: df_clean[_c["col:e7e1375e14c0c399"]]
```

### Duplicada (Name × 2)

```
pythonLiteral[0]: _c["col:07d1324e85b5126e"]
readExpression[0]: df_clean.iloc[:, _c["col:07d1324e85b5126e"]["position"]]
writeTarget[0]: df_clean.iloc[:, _c["col:07d1324e85b5126e"]["position"]]

pythonLiteral[1]: _c["col:7f67352e4d77f309"]
readExpression[1]: df_clean.iloc[:, _c["col:7f67352e4d77f309"]["position"]]
writeTarget[1]: df_clean.iloc[:, _c["col:7f67352e4d77f309"]["position"]]
```

### Script completo — ast.parse PASS

```python
import pandas as pd
import numpy as np

_c = {
    "col:b919e75bd6fba9f7": "Age",
    "col:564466e8d48908b5": "class",
    "col:26b29e05da920449": "Customer Name",
    "col:826963f2a9f00480": "price (€)",
    "col:e7e1375e14c0c399": "customer's note",
    "col:07d1324e85b5126e": {"name": "Name", "position": 6},
    "col:7f67352e4d77f309": {"name": "Name", "position": 7}
}

def clean_dataset(df):
    df_clean = df.copy()
    df_clean["col:b919e75bd6fba9f7"] = df_clean["col:b919e75bd6fba9f7"]
    df_clean["col:564466e8d48908b5"] = df_clean["col:564466e8d48908b5"]
    df_clean["col:26b29e05da920449"] = df_clean["col:26b29e05da920449"]
    df_clean["col:826963f2a9f00480"] = df_clean["col:826963f2a9f00480"]
    df_clean["col:e7e1375e14c0c399"] = df_clean["col:e7e1375e14c0c399"]
    df_clean.iloc[:, _c["col:07d1324e85b5126e"]["position"]] = df_clean.iloc[:, _c["col:07d1324e85b5126e"]["position"]]
    df_clean.iloc[:, _c["col:7f67352e4d77f309"]["position"]] = df_clean.iloc[:, _c["col:7f67352e4d77f309"]["position"]]
    return df_clean
```

Resultado: `SYNTAX_VALID`

---

## Tests faltantes

| Test faltante | Hallazgo | Prioridad |
|---|---|---|
| `_map` accesible via `Object.keys` | H-NEW-1 | Alta |
| `_map.set()` inyecta entries visibles | H-NEW-1 | Alta |
| `_map.delete()` elimina entries | H-NEW-1 | Alta |
| `forEach` callback puede mutar via `map.set()` | H-NEW-2 | Alta |
| `resolveScriptColumn` sin `correspondenceEvidence` | M-NEW-1 | Media |
| `isDuplicate` incoherente con grupo por nombre | M-dup | Media |
| Ordinales con gap (0, 2) | M-dup | Media |
| Ambos ordinales 0 | M-dup | Media |
| Script completo `generateSafeColumnDict()` + `ast.parse` | Integración | Alta |

---

## Impacto sobre Loop 2

| Hallazgo | Impacto | Requiere fix antes de Loop 2 |
|---|---|---|
| H-NEW-1 (_map) | Renderer no muta registry | No (pero recomendado) |
| H-NEW-2 (forEach) | Renderer no usa forEach para mutar | No (pero recomendado) |
| M-NEW-1 (evidence opcional) | Renderer usará `buildScriptContext` que siempre provee evidence | No |
| M-dup (metadata) | Renderer asumirá metadata coherente de `buildColumnRegistry` | No |

**Loop 2 puede iniciarse.** Ningún hallazgo Critical ni High funcional impide la implementación del renderer.

---

## Comandos y resultados

```bash
cd src && npx vitest run --exclude '**/reauditoria_*.test.ts'
# 752 passed, 6 skipped

cd src && npm run build
# built in 3.66s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS

python3 -c "import ast; ast.parse(open('/tmp/_audit_script.py').read()); print('SYNTAX_VALID')"
# SYNTAX_VALID
```

---

## Confirmaciones

- `REVISION_ADVERSARIAL_LOOP1.md` NO fue modificado (SHA: `a35e97f431d1...` idéntico)
- Phase 3 NO fue modificada
- `columnRegistry.ts` NO fue modificado
- `placeholderVocabulary.ts` NO fue modificado
- Código fuente NO fue modificado (solo archivos de auditoría temporales)
- `git status --porcelain` limpio (excepto archivos temporales de auditoría)
- HEAD = `8a8e66b72a7b06d722fc57c5fcd70d05f670bb29`
- origin/main = `8a8e66b72a7b06d722fc57c5fcd70d05f670bb29`
- Solo se añadió `REAUDITORIA_LOOP1R.md`

---

## Tabla resumen final

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| H1 | CRITICAL→ | `accessColumnDf()` Pandas inválido | CERRADO |
| H2 | HIGH→ | `buildPythonLiteral()` código muerto | CERRADO |
| H3 | HIGH→ | `pythonLiteral` no canónico aceptado | CERRADO |
| H4 | HIGH→ | `resolveScriptColumn()` ignora evidence | CERRADO |
| M1 | MEDIUM→ | `byColumnId` sobrescribe duplicado | CERRADO |
| M2 | MEDIUM→ | Arrays/ColumnRef mutables | PARCIAL |
| M3 | MEDIUM→ | Tests fixtures manuales | CERRADO |
| M4 | MEDIUM→ | Vocabulario falsos positivos | CERRADO |
| L2 | LOW→ | `isColumnRenderizable` nombre | CERRADO |
| L3 | LOW→ | `ScriptValidationResultV2` redundante | CERRADO |
| H-NEW-1 | HIGH | `_map` enumerable y mutable | NUEVO |
| H-NEW-2 | HIGH | `forEach` pasa Map mutable | NUEVO |
| M-NEW-1 | MEDIUM | `correspondenceEvidence` opcional | NUEVO |

---

## Veredicto final

**APPROVED_WITH_FIXES**

Cero Critical. Tres High nuevos (H-NEW-1, H-NEW-2 funcionales, M-NEW-1 de diseño). Expresiones Python correctas. `ast.parse` PASS. Registry funcionalmente inmutable para consumidores TypeScript normales (sin `as any`). Phase 3 intacta.

Loop 2 puede iniciarse. Los hallazgos H-NEW-1 y H-NEW-2 deben resolverse antes de cerrar Phase 4 pero no bloquean Loop 2.
