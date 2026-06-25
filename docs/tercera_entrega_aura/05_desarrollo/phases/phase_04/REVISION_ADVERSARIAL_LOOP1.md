# Revisión Adversarial — Phase 4 Loop 1

> **Fecha:** 2026-06-25 · **Auditor:** OpenCode · **Commit:** `53df16a332ce863c8c559177dc210c498e02ae83`
> **Base:** `c048a7e601088cb7f433085748f489f01b81b91d` · **Veredicto:** `REJECTED`

---

## Resumen Ejecutivo

Loop 1 implementa tipos base, ScriptBuildContextV2, column resolver y vocabulario de placeholders. Los 59 tests pasan, el build es exitoso y Phase 3 no cambió.

Sin embargo, la revisión adversarial revela un **defecto crítico de diseño** y varios hallazgos high/medium que impiden avanzar a Loop 2 sin corrección. El defecto crítico es que las funciones de resolución de columnas (`accessColumnDf`, `writeColumnLiteral`, `buildColumnAccessSpec`) producen **expresiones Python inválidas** cuando consumen `ColumnRef.pythonLiteral` real de `buildColumnRegistry()`. Los tests no detectan esto porque usan fixtures manuales con `pythonLiteral` sintético, no datos reales del sistema.

**Hallazgos por severidad:** 1 Critical · 3 High · 4 Medium · 3 Low

---

## H1 — CRITICAL: `accessColumnDf()` produce sintaxis Python inválida

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:50-52`
**Prueba ejecutable:**

```typescript
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { accessColumnDf } from '../contracts/llm/scriptColumnResolver';

const registry = buildColumnRegistry(['Age', 'Name']);
const col = registry[0]; // pythonLiteral: _c["col:b919e75bd6fba9f7"]
const result = accessColumnDf(col);
// result: df_clean["_c[\"col:b919e75bd6fba9f7\"]"]
// EXPECTADO (Pandas válido): df_clean[_c["col:b919e75bd6fba9f7"]]
```

**Análisis:**
- `buildColumnRegistry()` (columnRegistry.ts:69) genera `pythonLiteral = _c[${JSON.stringify(columnId)}]`
- `accessColumnDf()` envuelve el literal en `JSON.stringify()`, produciendo `df_clean["_c[\"col:...\"]"]`
- Esto genera Pandas syntax para buscar una columna con nombre literal `_c["col:..."]`, no una referencia al diccionario `_c`
- El `pythonLiteral` de `columnRegistry` es un acceso posicional/diccionario en el script generado (usado en `generateSafeColumnDict`), **no** un identificador Python directo

**Impacto en Loop 2:** Cualquier renderer que use `accessColumnDf()` o `writeColumnLiteral()` con datos reales producirá scripts Python inválidos. Esto invalida la cadena `ColumnRef → accessColumnDf → scriptText`.

**Corrección recomendada:** `accessColumnDf()` debe devolver `df_clean[${col.pythonLiteral}]` sin `JSON.stringify()` cuando el literal es un diccionario lookup `_c["..."]`. Alternativamente, `pythonLiteral` debe separarse en dos conceptos: `identifier` (nombre Python seguro) y `dictLookup` (referencia al diccionario `_c`).

**Tests faltantes:** Test que invoque `accessColumnDf()` con `ColumnRef` producido por `buildColumnRegistry()` y verifique que la salida sea Pandas-válido.

---

## H2 — HIGH: `buildPythonLiteral()` es código muerto sin consumidores

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:58-71`
**Prueba ejecutable:**

```bash
rg "buildPythonLiteral" src/ --include="*.ts" | grep -v __tests__ | grep -v index.ts
# Solo retorna: scriptColumnResolver.ts:58  (la definición)
```

**Análisis:**
- `buildPythonLiteral()` está exportada y testeada, pero **nunca es llamada** por ningún módulo de producción
- `buildColumnRegistry()` (columnRegistry.ts) tiene su propia generación de `pythonLiteral` inline (línea 69)
- `buildColumnRegistryV2()` (scriptColumnResolver.ts:73) no la invoca
- Las funciones `accessColumnDf`, `writeColumnLiteral`, `buildColumnAccessSpec` tampoco la usan

**Impacto en Loop 2:** El renderer (Loop 2) necesita una función para generar identificadores Python válidos a partir de nombres de columna. `buildPythonLiteral()` existe pero nadie la conecta. Loop 2 la importará directamente, pero la semántica es ambigua: ¿produce un identificador raw o un acceso bracket notation?

**Corrección recomendada:** Conectar `buildPythonLiteral()` con el pipeline. `buildColumnRegistry()` debería usarla para generar `pythonLiteral` en lugar de `_c[...]`. O bien, renombrar a `buildPythonIdentifier()` y clarificar que produce identificadores Python (no acceso por diccionario).

---

## H3 — HIGH: `buildColumnRegistryV2()` no transforma `pythonLiteral` de entrada

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:73-93`
**Prueba ejecutable:**

```typescript
const col = {
  columnId: 'col:A', name: 'A', position: 0, duplicateOrdinal: 0,
  pythonLiteral: 'LITERAL_ORIGINAL', isAmbiguous: false, isDuplicate: false, isReservedWord: false
};
const reg = buildColumnRegistryV2([col]);
reg.byColumnId.get('col:A')!.pythonLiteral === 'LITERAL_ORIGINAL'; // true
```

**Análisis:**
- `buildColumnRegistryV2()` copia los `ColumnRef[]` recibidos **sin transformar** `pythonLiteral`
- Si el input viene de `buildColumnRegistry()` (columnRegistry.ts), `pythonLiteral` es `_c[...]`
- Si el input viene de un envelope/manual, `pythonLiteral` podría ser `Age` o `df['class']`
- No hay validación ni normalización del formato de `pythonLiteral`

**Impacto en Loop 2:** El renderer asumirá un formato consistente de `pythonLiteral` pero recibirá formatos mixtos dependiendo del origen. La semántica de `accessColumnDf()` y `writeColumnLiteral()` varía según la fuente del `ColumnRef`.

**Corrección recomendada:** `buildColumnRegistryV2()` debe normalizar `pythonLiteral` a un formato canónico, o rechazar entradas con formato inesperado. Alternativamente, Documentar que `ColumnRef` puede tener dos formatos de `pythonLiteral` y que las funciones del resolver solo son válidas con el formato canónico esperado.

---

## H4 — HIGH: `resolveScriptColumn()` no valida `correspondenceEvidence.valid`

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:19-38`

**Análisis:**
- `resolveScriptColumn()` resuelve columnas sin importar si `buildContext.correspondenceEvidence.valid === false`
- Un contexto con fingerprint mismatch, columnas faltantes o adicionales permite resolver columnas individuales
- No hay ningún test que verifique este comportamiento

**Impacto en Loop 2–3:** El builder (Loop 3) llamará `resolveScriptColumn()` sobre un contexto potencialmente inválido. Las acciones se renderizarán con datos inconsistentes.

**Corrección recomendada:** Añadir check `buildContext.correspondenceEvidence.valid === false → { ok: false, reason: 'missing_column' }` o añadir un reason adicional como `'context_invalid'`.

**Tests faltantes:** Test que cree un contexto con `correspondenceEvidence.valid = false` y verifique que `resolveScriptColumn()` lo rechaza.

---

## M1 — MEDIUM: `buildColumnRegistryV2()` sobrescribe silenciosamente entradas duplicadas por `columnId`

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:76-79`
**Prueba ejecutable:**

```typescript
const col1 = { columnId: 'col:dup', name: 'A', position: 0, duplicateOrdinal: 0, pythonLiteral: 'A', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
const col2 = { columnId: 'col:dup', name: 'B', position: 1, duplicateOrdinal: 1, pythonLiteral: 'B_1', isAmbiguous: false, isDuplicate: true, isReservedWord: false };
const reg = buildColumnRegistryV2([col1, col2]);
reg.byColumnId.size === 1; // true — col2 sobreescribió a col1
```

**Análisis:**
- El loop `for (const col of columnRefs) { byColumnId.set(col.columnId, col) }` sobrescribe silenciosamente
- No hay detección ni error si dos `ColumnRef` tienen el mismo `columnId` pero diferentes propiedades
- `orderedColumns` sí contiene ambos, pero `byColumnId` solo el último

**Impacto en Loop 2–3:** Si un envelope contiene `ColumnRef` con `columnId` duplicado (posible en datos corruptos), el registry perderá información sin advertencia.

**Corrección recomendada:** Lanzar error o registrar warning si se detecta `columnId` duplicado en input.

---

## M2 — MEDIUM: Inner arrays de `byName` y `ColumnRef` objects son mutables en runtime

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:88-92`
**Prueba ejecutable:**

```typescript
const reg = buildColumnRegistryV2(cols);
// byName inner array es mutante:
reg.byName.get('A')!.push(someCol); // funciona sin error
// ColumnRef dentro del map es mutante:
reg.byColumnId.get('col:A')!.name = 'MUTATED'; // funciona sin error
// orderedColumns es inmutable (Object.freeze funciona):
(reg.orderedColumns as any).push(x); // lanza TypeError
```

**Análisis:**
- `Object.freeze(byColumnId)` congela la estructura del Map (no permite `.set()/.delete()`), pero **no** congela recursivamente los valores
- `Object.freeze(byName)` tiene el mismo comportamiento
- Los arrays internos de `byName` son arrays planos, no congelados
- `orderedColumns` sí está congelado correctamente (nuevo array con `Object.freeze`)

**Impacto en Loop 2–3:** Un bug puede mutar silenciosamente el registry, causando inconsistencias difíciles de diagnosticar.

**Corrección recomendada:** Usar `Object.freeze()` recursivo sobre cada `ColumnRef` en el registry, o documentar que el registry es "shallow-frozen" y la responsabilidad de no mutar es del consumidor.

**Tests faltantes:** Test que verifique que `reg.byName.get('A')!.push(x)` lanza error, y que `reg.byColumnId.get('col:A')!.name = 'x'` lanza error.

---

## M3 — MEDIUM: Tests usan fixtures manuales, no `buildColumnRegistry()` real

**Archivo:** `src/__tests__/scriptColumnResolver.test.ts:17-28`, `src/__tests__/scriptBuildContext.test.ts:13-25`

**Análisis:**
- Todos los tests usan `makeCol()` con `pythonLiteral` sintético (`'test'`, `'A'`, `'Name'`)
- Ningún test alimenta `ColumnRef` producido por `buildColumnRegistry()` a las funciones del resolver
- Los tests de `scriptBuildContext.test.ts` tampoco usan `buildColumnRegistry()` real
- Esto oculta la incompatibilidad entre los dos sistemas de `pythonLiteral`

**Impacto:** Los tests pasan pero no certifican que el sistema funcione end-to-end con datos reales.

**Corrección recomendada:** Añadir tests de integración que usen `buildColumnRegistry()` → `buildColumnRegistryV2()` → `resolveScriptColumn()` / `accessColumnDf()`.

---

## M4 — MEDIUM: Vocabulario incluye valores como `-` y `...` con riesgo de falsos positivos

**Archivo:** `src/contracts/llm/placeholderVocabulary.ts:10-28`

**Análisis:**
- `'-'` y `'...'` podrían ser valores legítimos en columnas de texto
- `'...'` es el spread operator en Python — si aparece como valor de columna, `normalize_placeholders` lo reemplazará por `np.nan`
- No hay evidencia de que estos valores sean siempre placeholders en datasets del dominio

**Impacto en Loop 2:** El renderer de `normalize_placeholders` reemplazará estos valores sin distinción de contexto.

**Corrección recomendada:** Registrar como decisión de política (D15) con justificación documentada. No es un bug, pero requiere que el usuario sea consciente del riesgo.

---

## L1 — LOW: Vocabulario tiene 17 entradas, documentación dice "19 placeholders" en D13

**Archivo:** `docs/.../DECISIONES.md:185`, `src/contracts/llm/placeholderVocabulary.ts`

**Análisis:**
- D13 dice "17 placeholders en la versión 1.0.0" — esto es correcto después de la corrección
- La tabla en `IMPLEMENTACION.md:26` dice "17 placeholders" — correcto
- No hay contradicción actual, pero la confusión previa (19 vs 17) sugiere que el conteo no fue verificado

---

## L2 — LOW: `isColumnRenderizable()` solo verifica `isAmbiguous`

**Archivo:** `src/contracts/llm/scriptColumnResolver.ts:95-97`

**Análisis:**
- La función solo retorna `!col.isAmbiguous`
- No verifica si `pythonLiteral` es válido ni si la columna tiene datos consistentes
- Para Loop 2, el renderer necesitará verificaciones adicionales (actionType compatible, columnId no null, etc.)

**Corrección recomendada:** Documentar que esta función es solo una verificación parcial y que Loop 2/3 añadirán validaciones adicionales.

---

## L3 — LOW: `ScriptValidationResultV2` extiende `Omit<ValidationResultV2, 'errors' | 'warnings'>` pero redefine los mismos campos

**Archivo:** `src/contracts/llm/types.ts:531-540`

**Análisis:**

```typescript
interface ScriptValidationResultV2 extends Omit<ValidationResultV2, 'errors' | 'warnings'> {
  valid: boolean;
  errors: ValidationErrorV2[];
  warnings: ValidationErrorV2[];
  pythonSyntax: { ... };
}
```

- `Omit` remueve `errors` y `warnings`, pero luego se redeclaran con el mismo tipo
- Funciona correctamente, pero la declaración es redundante
- `valid` se redeclara (ya existe en `ValidationResultV2`)

---

## Tests faltantes (resumen)

| Test faltante | Hallazgo |
|---|---|
| `accessColumnDf()` con `ColumnRef` de `buildColumnRegistry()` | H1 |
| `writeColumnLiteral()` con `ColumnRef` de `buildColumnRegistry()` | H1 |
| `resolveScriptColumn()` con `correspondenceEvidence.valid = false` | H4 |
| `buildColumnRegistryV2()` con `columnId` duplicado | M1 |
| Mutación de `byName` inner array | M2 |
| Mutación de `ColumnRef` dentro de `byColumnId` | M2 |
| `buildColumnRegistry()` → `buildColumnRegistryV2()` → `accessColumnDf()` pipeline completo | M3 |

---

## Comandos ejecutados

```bash
cd src && npm test -- scriptContractV2.types scriptBuildContext scriptColumnResolver placeholderVocabulary
# 59 passed

cd src && npm test
# 733 passed, 6 skipped

cd src && npm run build
# built in 3.72s

cd src && npm run contracts:v2:validate-local
# 3/3 PASS
```

---

## Tabla resumen de hallazgos

| # | Severidad | Hallazgo | Archivo:Línea |
|---|---|---|---|
| H1 | CRITICAL | `accessColumnDf()` produce Pandas inválido con `ColumnRef` real | scriptColumnResolver.ts:50-52 |
| H2 | HIGH | `buildPythonLiteral()` es código muerto sin consumidores | scriptColumnResolver.ts:58-71 |
| H3 | HIGH | `buildColumnRegistryV2()` no normaliza `pythonLiteral` | scriptColumnResolver.ts:73-93 |
| H4 | HIGH | `resolveScriptColumn()` ignora `correspondenceEvidence.valid` | scriptColumnResolver.ts:19-38 |
| M1 | MEDIUM | `byColumnId` sobrescribe silenciosamente `columnId` duplicado | scriptColumnResolver.ts:76-79 |
| M2 | MEDIUM | `byName` inner arrays y `ColumnRef` objects son mutables | scriptColumnResolver.ts:88-92 |
| M3 | MEDIUM | Tests usan fixtures manuales, no `buildColumnRegistry()` real | scriptColumnResolver.test.ts:17-28 |
| M4 | MEDIUM | Vocabulario incluye `-` y `...` con riesgo de falsos positivos | placeholderVocabulary.ts:10-28 |
| L1 | LOW | Vocabulario 17 entradas (documentación previa decía 19) | DECISIONES.md:185 |
| L2 | LOW | `isColumnRenderizable()` solo verifica `isAmbiguous` | scriptColumnResolver.ts:95-97 |
| L3 | LOW | `ScriptValidationResultV2` redeclara campos de padre redundante | types.ts:531-540 |

---

## Decisión final

**REJECTED**

El defecto crítico H1 (expresiones Python inválidas) impide que Loop 2 produzca scripts funcionales. Los hallazgos H2-H4 son de diseño y deben resolverse antes de avanzar. Loop 2 no debe iniciarse hasta que H1-H4 estén cerrados.

**Condición de reapertura:** Cerrar H1, H2, H3, H4 con tests de integración que demuestren pipeline `buildColumnRegistry() → buildColumnRegistryV2() → resolveScriptColumn() / accessColumnDf()` produciendo expresiones Pandas válidas.
