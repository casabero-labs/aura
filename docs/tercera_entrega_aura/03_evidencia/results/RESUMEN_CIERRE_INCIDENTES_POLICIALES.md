# Resumen de Cierre — Incidentes Policiales (Loops 1–7)

> Fecha: 2026-06-19
> Agente: 2 (ejecutor)
> Loop final: AURA-SOURCE-DEBT-GOVERNANCE-01
> Estado: **cerrado para commit**

---

## 1. Problema probado

Dataset: `experiments/tests/Incidentes_Policiales.csv` (10,048 filas, 7 columnas).
Fuente: San Francisco Police Department — portal de datos abiertos.

**Hallazgo central:** 319 de 10,048 filas (3.17%) tienen `CrimeId` no numérico. Los 319 valores coinciden exactamente con vocabulario de la columna `Disposition`: `Handled/Advised`, `Not Recorded`, `Arrest/Citation`, `Gone/Unable to Locate`. Probable column shift, coalescencia o error ETL en el sistema fuente.

---

## 2. Gemini Nano — Hallazgo

Modelo: `gemini-nano` (Chrome built-in), temperatura 0.1, 5,000 filas preview.
Fuente: `experiments/tests/2. diagnostico gemini reporte pdf.pdf`

| Lo que hizo bien | Lo que omitió |
|---|---|
| Detectó outliers en CrimeId | **No identificó la contaminación cruzada CrimeId←Disposition** |
| Detectó caos de capitalización en City | Repitió 3 falsos positivos del motor pre-Loop 2 |
| Detectó slashes en CrimeId y OriginalCrimeTypeName | Treató Disposition como URL (falso positivo) |

**Omisión principal:** Gemini Nano dijo que "CrimeId puede estar codificada o contener información adicional" sin detectar que los 319 valores no numéricos son vocabulario de `Disposition`.

---

## 3. AURA post-Loop 2 — Hallazgo

Regla nueva: `Contaminación Semántica de ID` (`auditEngine.ts`, ~línea 1047).
Falsos positivos corregidos: CallDateTime ISO como números, Disposition como URL, OriginalCrimeTypeName con `/`.

| Aspecto | Pre-Loop 2 | Post-Loop 2 |
|---|---|---|
| Score (5,000 filas) | 79 | ~75 (score empeora por regla nueva) |
| Falsos positivos | 3 | 0 |
| Contaminación CrimeId detectada | No | **Sí** |
| Reglas activas | 8 | 5 |

---

## 4. Flujo Notebook Colab (Loop 5b)

Implementado: `src/services/colabExporter.ts` + botón "Notebook Colab" en UI.

**Contrato:**
- Entrada: CSV + script aprobado → Notebook `.ipynb` preconfigurado
- El notebook incluye: carga CSV, ejecución `clean_dataset(df)`, descarga CSV corregido, checklist post-ejecución
- Formato: nbformat 4, kernel Python 3
- Privacidad: advertencia de que datos se suben a Google Colab bajo control del usuario

**Claim permitido:** "AURA exporta un notebook reproducible para Google Colab con trazabilidad completa del script aprobado."

**Claim no permitido:** "AURA ejecuta Python internamente." / "AURA valida en Colab real sin intervención."

---

## 5. Delta real runAudit — Loop 5c/5d

**Fixture:** `experiments/tests/fixtures/incidentes_semantic_sample.csv` (10 filas, CrimeId contaminado).
**Script:** `experiments/tests/fixtures/incidentes_clean_script.py` v2 — placeholder `"CORRUPTED_ID_REQUIRES_SOURCE_REVIEW"`, auxiliary columns `crimeid_original`, `crimeid_corrupted`, `crimeid_correction_note`.
**Motor de re-auditoría:** `runAudit` oficial vía `npx tsx` + `src/services/auditEngine.ts` (no simulación JS).

### Resultado re-auditado con runAudit oficial

| Métrica | Antes | Después | Delta |
|---|---|---|---|
| Score | 65 | 26 | **−39** |
| Issues | 5 | 7 | +2 |
| Critical | 1 | 3 | +2 |

### Reglas corregidas, sin cambios, nuevas

| Regla | Antes | Después | Estado |
|---|---|---|---|
| Caos de Capitalización (City) | ✓ Detectada | Corregida | **Mejorada** |
| Contaminación Semántica de ID | ✓ CrimeId | Migró a `crimeid_original` | Preservada, no eliminada |
| Tipos Mixtos | ✓ CrimeId | CrimeId + `crimeid_original` | Empeoró |
| Valores Nulos / Vacíos | — | `crimeid_correction_note` | Nueva (crítica) |

### Estrategia probadas

| Estrategia | Score | Veredicto |
|---|---|---|
| v2 script (placeholder + aux columns) | 26 | No mejora; aux columns introducen deuda |
| v1 script (np.nan CrimeId) | 41 | Menos peor pero viola constraint de no nulls en CrimeId |
| Solo normalizar City + trim | ~58 | Mejor score pero sin trazabilidad de CrimeId |
| Baseline sin script | 65 | Score más alto pero sin remediación |

**Ninguna estrategia probada mejora el score.** La remediación a nivel de CSV no puede resolver CrimeId sin inventar datos o introducir deuda equivalente.

---

## 6. Clasificación source_debt_preserved — Loop 7

**Regla de clasificación:**
```
scoreDelta > 0 && criticalDelta <= 0  →  'improvement'
else                                    →  'source_debt_preserved'
```

**Delta fixture → `remediationClassification: "source_debt_preserved"`** (score 65→26, critical 1→3).

**Cambios en código:**
- `evidenceManifest.ts`: parámetro `remediationClassification`, artifact `sourceDebtEvidence (delta JSON)`, limitaciones específicas de deuda de fuente
- `pdfGenerator.ts`: sección "Preservacion de Deuda de Fuente" cuando `scoreDelta <= 0` (caja roja)
- `ReviewStep.tsx`: warning cuando `scoreDelta < 0 || criticalDelta > 0`
- `App.tsx`: pasa `healthDelta` al generador PDF
- `colabDeltaFixture.test.ts`: 19 tests (4 nuevos para `remediationClassification`)
- `evidenceManifest.test.ts`: 16 tests (2 nuevos para source debt)

---

## 7. Claims permitidos y no permitidos

### Permitidos

- "AURA post-Loop 2 detecta contaminacion semantica de ID en Incidentes Policiales (CrimeId ← Disposition) que Gemini Nano no identifico."
- "Gemini Nano replico tres falsos positivos del motor determinista pre-Loop 2."
- "AURA exporta un notebook .ipynb ejecutable en Google Colab con el script aprobado."
- "Se ejecuto Python externo sobre fixture controlado y el resultado fue re-auditado con el motor determinista oficial de AURA (runAudit via tsx). La remediacion preserva trazabilidad, pero el score oficial no mejora. Deuda de fuente presente."
- "La remediacion preserva deuda de fuente: el score no mejora bajo runAudit porque la deuda de CrimeId es de origen (columna contaminada en el sistema fuente)."

### No permitidos

- "AURA ejecuta Python internamente." ❌
- "El script mejora el score cuando delta es negativo." ❌
- "Validado en Colab real." ❌
- "El script elimina la contaminacion de CrimeId." ❌
- "AURA reduce data downtime con medicion real." ❌ (sin metric real en entorno prod)
- "Elimina alucinaciones." ❌

---

## 8. Comandos de reproduccion

```bash
# Tests de la regla Contaminacion Semantica de ID
cd src && npm test -- auditEngine

# Suite completa
cd src && npm test

# Build
cd src && npm run build

# Graphify
cd .. && graphify update .

# Ejecutar delta fixture (requiere Python 3 + pandas)
node experiments/tests/run_colab_delta_fixture.mjs

# Abrir app y cargar Incidentes_Policiales.csv
cd src && npm run dev
# http://127.0.0.1:3000
# Cargar experiments/tests/Incidentes_Policiales.csv
# Completar flujo: perfil → diagnostico → script → revisar → exportar
```

---

## 9. Archivos creados o modificados en loops 1–7

| Archivo | Loop | Cambio |
|---|---|---|
| `src/services/auditEngine.ts` | 2 | +Contaminacion Semantica de ID, correccion FP |
| `src/services/pdfGenerator.ts` | 1, 4, 7 | Refactor save callback, seccion source debt |
| `src/services/pipelineSession.ts` | 1 | Snapshot/restore/destroy session |
| `src/services/colabExporter.ts` | 5b | Export .ipynb notebook |
| `src/services/evidenceManifest.ts` | 7 | remediationClassification, sourceDebtEvidence |
| `src/components/ReviewStep.tsx` | 7 | Warning source debt |
| `src/App.tsx` | 1, 7 | Session restore, healthDelta al PDF |
| `src/__tests__/auditEngine.test.ts` | 2 | Tests regla Contaminacion |
| `src/__tests__/colabDeltaFixture.test.ts` | 5c, 5d, 7 | 19 tests delta fixture |
| `src/__tests__/evidenceManifest.test.ts` | 7 | 16 tests, source debt tests |
| `experiments/tests/run_colab_delta_fixture.mjs` | 5c, 5d | Runner Python externo + runAudit |
| `experiments/tests/run_audit_wrapper.ts` | 5c | Thin TS wrapper para runAudit |
| `experiments/tests/fixtures/incidentes_semantic_sample.csv` | 5c | Fixture 10 filas |
| `experiments/tests/fixtures/incidentes_clean_script.py` | 5c, 5d | Script v1+v2 |
| `experiments/tests/results/incidentes_colab_delta_fixture.json` | 5c, 5d | Delta JSON con reAudit |
| `experiments/tests/results/incidentes_notebook_exportado.ipynb` | 5b, COLAB-REAL-01 | Notebook .ipynb generado con script v2, fixture 10 filas, score 65 |

---

## 10. Limitaciones pendientes

- Fixture de 10 filas; no representa datasets de produccion
- Python externo ejecutado localmente, no en Google Colab real (requiere ejecucion manual por el usuario)
- Score no mejora bajo ninguna estrategia probada; la remediacion a nivel CSV no puede resolver CrimeId sin inventar datos
- La solucion real para CrimeId requiere intervencion en el sistema fuente
- Una sola corrida de Gemini Nano; sin repeticiones ni contraste con otros modelos
- **Ejecucion en Google Colab real pendiente:** el notebook fue generado (`incidentes_notebook_exportado.ipynb`) y verificado automaticamente (nbformat 4.5, script completo, privacidad, checklist), pero la ejecucion real en Colab requiere interaccion manual del usuario. Protocolo disponible en `PROTOCOLO_VALIDACION_COLAB_REAL.md`. Delta real de Colab: sin verificar.

---

## 11. Proxima decision recomendada

**Protocolo de validacion Colab disponible en:** `PROTOCOLO_VALIDACION_COLAB_REAL.md`.

El siguiente paso es la **ejecucion manual del notebook en Google Colab** para obtener el delta real de salud y cerrar la brecha "Python local vs Colab real". Alternativa: implementar Pyodide como feature flag (`?pyodide=1`) para cierre automatico del ciclo.

Opcion Pyodide: feature flag `?pyodide=1`, medir latencia real en Coolify, comparar con Colab.

Opcion Colab formal: incluir evidencia de ejecucion real en Colab con screenshot/log y atualizar delta JSON con resultado real.
