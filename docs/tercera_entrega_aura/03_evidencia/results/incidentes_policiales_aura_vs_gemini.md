# AURA vs Gemini Nano — Incidentes Policiales

> Artefacto comparativo reproducible. Generado tras Loop 2 (AURA-INCIDENTES-SEMANTIC-01).
> Fecha: 2026-06-19. Código: `src/services/auditEngine.ts`, tests en `src/__tests__/auditEngine.test.ts`.

---

## 1. Ficha del dataset

| Campo | Valor |
|---|---|
| Archivo | `experiments/tests/Incidentes_Policiales.csv` |
| Origen | Portal de datos abiertos — San Francisco Police Department |
| Filas totales | 10,048 |
| Columnas | 7 |
| Columnas | `Address`, `AddressType`, `CallDateTime`, `City`, `CrimeId`, `Disposition`, `OriginalCrimeTypeName` |
| Delimitador | `,` (coma) |
| Preview de app | 5,000 filas (límite fijado en `csvService.ts`) |

### Hecho relevante sobre CrimeId

- **319 de 10,048 filas (3.17%)** tienen un `CrimeId` no numérico.
- Los 319 valores son exactamente 4 strings: `Handled/Advised`, `Not Recorded`, `Arrest/Citation`, `Gone/Unable to Locate`.
- Esos 4 strings **coinciden literalmente con vocabulario de `Disposition`**.

### Diferencia entre CSV completo y preview de app

Toda ejecución desde la interfaz de AURA procesa **5,000 filas** (`csvService.ts:preview=5000`). El CSV completo contiene 10,048 filas. Las cifras del motor determinista varían entre ambas cargas:

- **Preview 5,000 filas:** score 79, 8 issues, `truncated=true`.
- **Full 10,048 filas (simulado):** score 91, 7 issues, `truncated=false`.

La regla `Contaminación Semántica de ID` usa vocabulario categórico de columnas vecinas; al tener dos filas por cada patrón, los umbrales se satisfacen en ambas cargas.

---

## 2. Resultado AURA antes de Loop 2

**Contexto:** esta es la salida del motor determinista que Gemini Nano recibió como entrada para su diagnóstico.

| # | Severidad | Regla | Columna | Descripción |
|---|---|---|---|---|
| 1 | INFO | Cola Larga Categórica | Address | Alta dispersión, baja concentración |
| 2 | INFO | Cola Larga Categórica | CallDateTime | Alta dispersión, baja concentración |
| 3 | INFO | Números Disfrazados | CallDateTime | Columna texto 100% numérica (ISO timestamps) |
| 4 | INFO | Caos de Capitalización | City | Misma ciudad con distintas mayúsculas |
| 5 | WARNING | Símbolos Sospechosos | CrimeId | Caracteres `/` en columna ID |
| 6 | INFO | Outliers Leves (Tukey) | CrimeId | Valores desviados del rango IQR |
| 7 | WARNING | URL con Formato Erróneo | Disposition | Falso positivo: substring `sitio` |
| 8 | WARNING | Símbolos Sospechosos | OriginalCrimeTypeName | Caracteres `/` en columna con "name" |

**Score:** 79/100 · **Columnas afectadas:** 5 de 7 · **Reglas únicas:** 6

### Falsos positivos identificados antes de Loop 2

| Falso positivo | Causa raíz |
|---|---|
| `CallDateTime` como "Números Disfrazados" | ISO timestamps tratados como números |
| `Disposition` como "URL con Formato Erróneo" | `includes('sitio')` capturaba "Dispo**sitio**n" |
| `OriginalCrimeTypeName` con `/` como "Símbolos Sospechosos" | `isNameCol` capturaba cualquier columna con "name" |

### Lo que el motor NO detectaba antes de Loop 2

- La contaminación cruzada: `CrimeId` contenía valores del vocabulario de `Disposition`.
- Gemini Nano trató los slashes de `CrimeId` como caracteres especiales genéricos y mencionó que "CrimeId puede estar codificada o contener información adicional", sin identificar que esos valores pertenecen a otra columna.

---

## 3. Resultado AURA después de Loop 2

Tras implementar la regla `Contaminación Semántica de ID` y corregir los tres falsos positivos:

| Cambio | Archivo | Línea |
|---|---|---|
| Nueva regla: `Contaminación Semántica de ID` | `auditEngine.ts` | ~1047 |
| URL detection: token boundary `\b` | `auditEngine.ts` | ~580 |
| Symbol chaos: skip `isCategoricalTaxonomy` | `auditEngine.ts` | ~585, ~727 |
| Disguised numbers: skip `isDateTimeLikeColumn` | `auditEngine.ts` | ~630 |

### Issues después de Loop 2 (esperado sobre 5,000 filas)

| # | Severidad | Regla | Columna | Nota |
|---|---|---|---|---|
| 1 | INFO | Cola Larga Categórica | Address | Igual que antes |
| 2 | INFO | Cola Larga Categórica | CallDateTime | Igual que antes |
| 3 | INFO | Caos de Capitalización | City | Igual que antes |
| 4 | WARNING | **Contaminación Semántica de ID** | **CrimeId** | **NUEVA** |
| 5 | INFO | Outliers Leves (Tukey) | CrimeId | Igual que antes |

**Reglas activadas:** 5 (vs. 8 antes) · **Falsos positivos eliminados:** 3 · **Nueva regla:** 1

---

## 4. Resumen del diagnóstico de Gemini Nano

> Fuente: `experiments/tests/2. diagnostico gemini reporte pdf.pdf`
> Modelo: gemini-nano · Proveedor: chrome · Temperatura: 0.1
> Dataset procesado: 5,000 filas, score 79/100, 8 reglas activadas

### Lo que Gemini Nano detectó correctamente

- Cola larga categórica en `Address` y `CallDateTime`.
- Caos de capitalización en `City`.
- Valores atípicos en `CrimeId`.
- Presencia de slashes en `CrimeId` y `OriginalCrimeTypeName`.

### Lo que Gemini Nano interpretó incorrectamente

- Trató `CallDateTime` como "Números Disfrazados" — la columna contiene timestamps ISO, no números.
- Trató `Disposition` como "URL con Formato Erróneo" — la columna es vocabulario categórico, no URLs. Gemini Nano repitió el falso positivo del motor sin cuestionarlo.
- Trató los slashes de `OriginalCrimeTypeName` como caracteres sospechosos — la columna es una taxonomía categórica (`Violent Crime/Assault`, `Traffic/Parking/Sidewalk`), no un identificador corrupto.

### Lo que Gemini Nano no identificó

- **La contaminación semántica cruzada entre `CrimeId` y `Disposition`.** El diagnóstico menciona que "CrimeId puede estar codificada o contener información adicional" (hipótesis no validada), pero no detecta que los 319 valores no numéricos de `CrimeId` son exactamente vocabulario de `Disposition`. Esta es la omisión semántica principal.

---

## 5. Tabla comparativa AURA vs Gemini Nano

| Hallazgo | AURA pre-Loop 2 | Gemini Nano | AURA post-Loop 2 |
|---|---|---|---|
| Cola Larga Categórica (Address) | ✅ INFO | ✅ Detectado | ✅ INFO |
| Cola Larga Categórica (CallDateTime) | ✅ INFO | ✅ Detectado | ✅ INFO |
| Caos de Capitalización (City) | ✅ INFO | ✅ Detectado | ✅ INFO |
| Outliers Leves (CrimeId) | ✅ INFO | ✅ Detectado | ✅ INFO |
| CallDateTime como Números Disfrazados | ❌ FP | ❌ Repitió FP | ✅ Corregido |
| Disposition como URL | ❌ FP | ❌ Repitió FP | ✅ Corregido |
| OriginalCrimeTypeName slash como símbolos | ❌ FP | ❌ Repitió FP | ✅ Corregido |
| **Contaminación Semántica de ID (CrimeId ← Disposition)** | ❌ No detectado | ❌ No detectado | ✅ **WARNING** |

---

## 6. Claims defendibles

1. **AURA post-Loop 2 detecta un patrón semántico que Gemini Nano no identificó en la corrida analizada:** la contaminación de una columna identificadora con vocabulario de una columna categórica vecina, indicativa de probable column shift, coalescencia o error ETL.

2. **Gemini Nano reprodujo los tres falsos positivos del motor determinista pre-Loop 2** (URL en `Disposition`, números disfrazados en `CallDateTime`, símbolos en `OriginalCrimeTypeName`). Esto es esperable: el LLM recibió como entrada el reporte con esos falsos positivos y los trató como evidencia determinista.

3. **Una regla determinista nueva corrige la lectura de Gemini Nano sin depender del LLM.** La regla `Contaminación Semántica de ID` es reproducible, no alucina, y se verifica con test unitario (`auditEngine.test.ts:247-262`).

4. **El caso demuestra que el diagnóstico generativo (Gemini Nano) necesita un motor determinista afinado como precondición.** Un motor con falsos positivos produce un diagnóstico LLM que los replica; un motor corregido produce hallazgos que el LLM por sí solo no generaría.

---

## 7. Limitaciones metodológicas

- **Preview de 5,000 filas.** El CSV completo tiene 10,048 filas. Las cifras absolutas varían, pero el patrón de contaminación semántica se mantiene en ambas cargas porque los 319 valores anómalos se distribuyen a lo largo del dataset.
- **Una sola corrida de Gemini Nano.** El PDF analizado corresponde a una ejecución única con `gemini-nano` (Chrome built-in). No se realizaron repeticiones ni se probaron otros modelos.
- **Sin ejecución Python real.** El script de limpieza se generó pero no se ejecutó sobre el dataset. El delta de salud reportado es simulado.
- **La regla `Contaminación Semántica de ID` usa heurística de cardinalidad** (unique ≤ max(50, rows×0.2)) para identificar columnas categóricas vecinas. Esto puede producir falsos negativos en datasets con vocabulario muy extenso o falsos positivos si una columna ID comparte accidentalmente tokens con otra columna.
- **No se comparó contra Gemini 2.0 Flash o Gemini 1.5 Pro.** El caso está limitado a Gemini Nano (on-device).

---

## 8. Comandos para reproducir

```bash
# Ejecutar tests de la regla nueva
cd src && npm test -- auditEngine

# Ejecutar suite completa
cd src && npm test

# Abrir AURA y cargar el dataset (5,000 filas preview)
cd src && npm run dev
# → Abrir http://127.0.0.1:3000
# → Cargar experiments/tests/Incidentes_Policiales.csv
# → Completar flujo: perfil → diagnóstico → script → revisar → exportar

# Para análisis del CSV completo (fuera de la app)
# Usar Node.js con PapaParse + runAudit sobre las 10,048 filas
```

---

## 9. Referencias

- Plan de desarrollo: `docs/tercera_entrega_aura/05_desarrollo/PLAN_INCIDENTES_POLICIALES_DEV_LOOPS.md`
- Código del motor: `src/services/auditEngine.ts`
- Tests de la regla: `src/__tests__/auditEngine.test.ts` → bloque `Contaminación Semántica de ID`
- Gemini Nano PDF: `experiments/tests/2. diagnostico gemini reporte pdf.pdf`
- CSV dataset: `experiments/tests/Incidentes_Policiales.csv`
