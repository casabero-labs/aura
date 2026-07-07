# Protocolo de Validación Manual — Notebook Colab para Incidentes Policiales

> Loop: AURA-COLAB-REAL-VALIDATION-01
> Fecha: 2026-06-19
> Estado: **pendiente de ejecución manual** (requiere usuario con cuenta Google y navegador)
> Notebook generado: `experiments/tests/results/incidentes_notebook_exportado.ipynb`

---

## 1. Contexto

El notebook `.ipynb` fue generado por AURA usando `src/services/colabExporter.ts` con el script v2 de limpieza del fixture de Incidentes Policiales.

**Lo que se puede verificar automáticamente:**
- El notebook tiene estructura nbformat 4.5 válida.
- Contiene advertencia de privacidad.
- Contiene el script `clean_dataset` con las columnas auxiliares (`crimeid_original`, `crimeid_corrupted`, `crimeid_correction_note`).
- No contiene datos crudos del CSV.
- Contiene checklist post-ejecución.

**Lo que NO se puede verificar automáticamente (requiere Colab real):**
- El notebook ejecuta sin errores en Google Colab.
- El CSV corregido se descarga correctamente.
- El delta de salud real (score re-auditado post-limpieza) coincide o difiere del delta simulado.

---

## 2. Por qué no se ejecuta automáticamente

El notebook usa `from google.colab import files` para subir el CSV y descargar el resultado. Esto requiere:
1. Un runtime de Google Colab (navegador con sesión Google activa).
2. Interacción manual del usuario para seleccionar el archivo.
3. Acceso a internet para comunicarse con los servidores de Google.

Este entorno de desarrollo (macOS local, sin Google authentication token, sin acceso programático a Colab API) no puede ejecutar celdas de Colab automáticamente.

---

## 3. Protocolo para ejecución manual

### Requisitos

- Navegador web (Chrome, Edge, Firefox).
- Cuenta Google con acceso a Google Colab.
- Archivo CSV: `experiments/tests/incidentes_semantic_sample.csv` (10 filas).

### Pasos

#### Paso 1: Descargar el notebook

```bash
# El notebook está en:
ls experiments/tests/results/incidentes_notebook_exportado.ipynb
```

O desde la interfaz de AURA:
1. Abrir AURA (`npm run dev` en `src/`)
2. Cargar `experiments/tests/Incidentes_Policiales.csv` (o el CSV de prueba)
3. Completar el flujo hasta Exportar
4. Descargar Notebook Colab

#### Paso 2: Subir a Google Colab

1. Ir a [https://colab.research.google.com](https://colab.research.google.com)
2. Hacer clic en "Subir" y seleccionar `incidentes_notebook_exportado.ipynb`
3. Verificar que el kernel sea Python 3

#### Paso 3: Ejecutar las celdas en orden

**Celda 1 — Subir CSV:**
- Cuando solicite seleccionar archivo, subir `experiments/tests/incidentes_semantic_sample.csv`
- Verificar que el archivo se carga correctamente

**Celda 2 — Leer CSV:**
- Verificar que se leen 10 filas
- Verificar que las columnas incluyen `CrimeId`, `Disposition`, etc.

**Celda 3 — Script de limpieza:**
- Esta celda define `clean_dataset()` y las constantes auxiliares
- No debería producir errores

**Celda 4 — Ejecutar limpieza:**
- Al ejecutar, debería:
  - Mostrar "Limpieza completada en X.XXs"
  - Mostrar "Filas procesadas: 10"
  - Mostrar hash SHA256 del resultado (16 caracteres)
  - Iniciar descarga automática de `dataset_corregido.csv`

#### Paso 4: Capturar evidencia

Capturar screenshot de:
1. La salida de la Celda 4 (log de ejecución: tiempo, hash, filas).
2. El archivo descargado `dataset_corregido.csv` (verificar que tiene 12 columnas: 7 originales + 3 auxiliares + CrimeId corregido).

#### Paso 5: Comparar con resultado conocido

El resultado esperado para el fixture de 10 filas:

| Dato | Valor esperado |
|---|---|
| Filas | 10 |
| Columnas | 12 (7 originales + crimeid_corrupted + crimeid_original + crimeid_correction_note + CrimeId corregido) |
| CrimeId corregido | "CORRUPTED_ID_REQUIRES_SOURCE_REVIEW" para las 5 filas contaminadas |
| City | lowercase (san francisco, no "San Francisco" ni "SAN FRANCISCO") |
| crimeid_corrupted | True para filas 2, 3, 4, 5, 7, 9, 11 (índices 1-based) |

#### Paso 6: Re-auditar en AURA (opcional, para comparar delta real vs simulado)

1. En AURA, cargar `dataset_corregido.csv` descargado de Colab.
2. Ejecutar auditoría y comparar score con el delta fixture original (score esperado ~26 según resultado local con runAudit).

---

## 4. Resultado esperado de la ejecución en Colab

Basado en el runner local `run_colab_delta_fixture.mjs` que usa Python 3.14 local + runAudit vía tsx:

| Métrica | Resultado local (referencia) |
|---|---|
| Score antes | 65 |
| Score después | 26 |
| Score delta | −39 |
| Execution time | Depende de la máquina |

**Nota:** La ejecución en Colab puede producir resultados ligeramente diferentes si la versión de Pandas o Python difiere, pero el patrón de datos corregidos debería ser idéntico.

---

## 5. Delta de salud real vs delta simulado (comparación post-ejecución)

| Fuente del delta | Score antes | Score después | Delta |
|---|---|---|---|
| Simulación JS (AURA) | 65 | ~58 (solo City normalizado) | −7 (estimado) |
| Python externo fixture (referencia) | 65 | 26 | −39 |
| **Colab real (pendiente)** | 65 | **? ? ?** | **? ? ?** |

Si el delta real en Colab difiere significativamente de la referencia local (−39), documentar la diferencia y el posible motivo (versión de Pandas, diferencias de dtype, etc.).

---

## 6. Comandos para verificar el notebook generado

```bash
# Verificar estructura nbformat
python3 -c "
import json
nb = json.load(open('experiments/tests/results/incidentes_notebook_exportado.ipynb'))
print(f'nbformat: {nb[\"nbformat\"]}.{nb[\"nbformat_minor\"]}')
print(f'cells: {len(nb[\"cells\"])}')
print('cell_types:', [c['cell_type'] for c in nb['cells']])
"

# Verificar contenido clave
python3 -c "
import json
nb = json.load(open('experiments/tests/results/incidentes_notebook_exportado.ipynb'))
text = ' '.join([' '.join(c.get('source',[])) for c in nb['cells']])
checks = [
  ('ADVERTENCIA DE PRIVACIDAD', 'Privacy warning'),
  ('google.colab', 'Colab API import'),
  ('def clean_dataset', 'clean_dataset function'),
  ('CORRUPTED_ID_REQUIRES_SOURCE_REVIEW', 'Placeholder strategy'),
  ('crimeid_original', 'Auxiliary column evidence'),
  ('Checklist', 'Post-execution checklist'),
  ('Vuelve a AURA', 'Re-audit instruction'),
]
for pattern, label in checks:
  print(f'  {\"OK\" if pattern in text else \"MISSING\"}: {label}')
"
```

---

## 7. Artefactos generados en este loop

| Artefacto | Ubicación |
|---|---|
| Notebook exportado (.ipynb) | `experiments/tests/results/incidentes_notebook_exportado.ipynb` |
| Fixture CSV | `experiments/tests/fixtures/incidentes_semantic_sample.csv` |
| Script Python v2 | `experiments/tests/fixtures/incidentes_clean_script.py` |
| Delta fixture JSON | `experiments/tests/results/incidentes_colab_delta_fixture.json` |
| Protocolo manual | `docs/.../PROTOCOLO_VALIDACION_COLAB_REAL.md` |

---

## 8. Estado de evidencia

| Aspecto | Estado |
|---|---|
| Notebook generado automáticamente | ✅ Listo |
| Estructura nbformat verificada | ✅ 4.5, 8 cells |
| Contenido verificado (script, privacidad, checklist) | ✅ Todos los checks pasan |
| Ejecución en Google Colab real | ⏳ **Pendiente — requiere ejecución manual** |
| Delta salud real de Colab vs local | ⏳ Pendiente |

**Claim permitido tras ejecución manual:**
> "El notebook exportado por AURA se ejecutó exitosamente en Google Colab. El CSV corregido fue descargado y re-auditado. Delta real: score X→Y."

**Claim NO permitido sin ejecución real:**
> "AURA valida en Colab real." ❌ (sin evidencia de ejecución)
> "El notebook fue probado en Colab." ❌ (sin evidencia)
