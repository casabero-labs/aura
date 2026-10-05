# AURA — Plan de evaluación del pipeline con varios datasets

Fecha: 2026-10-05. Ejecutor: un agente con acceso a Claude in Chrome (Chrome 154+ con Gemini Nano), terminal en el repo y Python 3.13 con pandas.
Antecedentes: `docs/plans/2026-10-03-aura-recorrido-ux-ui-pipeline.md` (recorrido y arreglos) y `AGENTS.md` § «Invariantes del pipeline» (reglas que no se pueden romper).

## 0. Objetivo y alcance

Demostrar, con evidencia y por dataset, que una persona puede terminar cada recorrido de AURA:

- **Recorrido A, no completo (informe):** Carga → Perfil → Diagnóstico → Reporte → Exportación. Se ejecuta en dos variantes:
  - **A0, sin LLM:** «Ir al reporte sin diagnóstico» / «Continuar sin diagnóstico».
  - **A1, con Gemini Nano.**
- **Recorrido B, completo (corrección):** A1, luego Corregir una copia → plan → aprobación → script → bundle → ejecución externa con el runner → importar salida y recibo → verificación → reauditoría → exportación con `corrected.csv`.
- **Laboratorio (opcional, L):** solo si hay Ollama local. Crear una campaña con el dataset ya auditado y comprobar que no reinicia el diagnóstico.

No forma parte del alcance:

- Rediseñar la UI. Los hallazgos de UX se anotan, no se arreglan, salvo que bloqueen el recorrido.
- Cambiar umbrales de reglas para que «salga bien».

Un caso termina cuando se cumplen las cuatro condiciones:

1. El recorrido se completa en la UI.
2. Hay feedback visible en cada paso.
3. El estado sobrevive a una recarga.
4. La evidencia exportada es coherente (sección 5).

Un screenshot o un fixture inyectado no cierran un caso (Design Principle 5 de `CLAUDE.md`).

## 1. Preparación (una vez)

1. **Código.** `git pull` en `main`. Confirmar que `production` apunta al último commit con CI verde: `git ls-remote origin production` y `gh run list --limit 3`.
2. **Entorno local:**
   ```bash
   cd src && npm ci && npm run verify
   ```
   Debe pasar completo. Si no pasa, **parar** y reportar: no evaluar sobre una base rota.
3. **Barrera local:**
   ```bash
   ./scripts/install-git-hooks.sh
   ```
4. **Servidor de desarrollo.** `preview_start` con `aura-dev` (puerto 3000). La evaluación principal corre en `http://localhost:3000` y la sección 6 repite Titanic en `https://aura.casabero.com`.
5. **Chrome con Nano:**
   - Claude in Chrome, pestaña nueva del grupo MCP.
   - En consola, `await LanguageModel.availability()` debe devolver `available`.
   - Anotar la versión de Chrome y `contextWindow` de `LanguageModel.create()`.
6. **Python del runner:**
   ```bash
   python3 -c "import pandas; print(pandas.__version__)"
   ```
   Versión fijada en `experiments/runners/requirements.txt`.
7. **Carpeta de resultados:** `experiments/evaluation/2026-10-05-multidataset/` con:
   - `datasets/` (los sintéticos de la sección 2);
   - `runs/<dataset>/<recorrido>/` (artefactos de cada ejecución);
   - `results.json`;
   - `REPORT.md`.

   Los CSV generados se versionan, salvo que contengan datos personales reales.
8. **Sesión limpia antes de cada caso.** En consola: `localStorage.removeItem('aura_pipeline_session_v1')`, recargar y pulsar «Empezar auditoría». Si el primer clic no responde, anotarlo como hallazgo UX-CLICK-1: ya se observó una vez.

## 2. Matriz de datasets

| ID | Archivo | Filas | Qué estresa | Recorridos |
|---|---|---:|---|---|
| D1 | `experiments/datasets/titanic.csv` | 891 | Caso base, real y público. Nulos (Cabin 77 %), atípicos, espacios | A0, A1, **B**, L |
| D2 | `experiments/datasets/synthetic_ground_truth.csv` | 15 | Verdad conocida: 12 reglas esperadas (`synthetic_ground_truth.json`) | A0, A1, B |
| D3 | `experiments/final-evaluation/datasets/controlled_customers_phase8.csv` | 50 | ~28 hallazgos, por encima del límite del envelope (24); tiempo de Nano; PII (emails, nombres) | A0, A1, B |
| D4 | `experiments/datasets/adult_income.csv` | 48.842 (5 MB, **no versionado**, se usa la copia local) | Rendimiento: tiempo de carga y perfil, bloqueo de la pestaña, tamaño de la sesión, memoria | A0, A1 (B si A1 termina) |
| D5 | `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv` | 6 | Dataset mínimo con problemas; fixture usado por e2e | A0, A1, B |
| D6 | `src/tests/e2e/fixtures/aura_l9_dataset_control.csv` | 5 | Control limpio: debe dar pocos o ningún hallazgo, sin inventar problemas | A0, A1 |
| D7 | `datasets/latin1_semicolon.csv`, **a generar** | ~30 | windows-1252, delimitador `;`, CRLF; valores `001`, `120.00`, `120`, `-0`, vacíos, «Bogotá», «Ñandú», «São» | A0, A1, **B** |
| D8 | `datasets/utf8_bom_quoted.csv`, **a generar** | ~30 | UTF-8 con BOM, comillas con comas y saltos de línea dentro, emojis, celdas que empiezan con `=`, `+`, `-`, `@` | A0, B |
| D9 | `datasets/broken_ragged.csv`, **a generar** | ~10 | Filas con distinto número de columnas y una comilla sin cerrar | Solo carga: debe fallar claro |
| D10 | `datasets/empty_and_header_only.csv`, **a generar** (dos archivos) | 0 | Archivo vacío y archivo con solo cabecera | Solo carga: debe fallar claro |
| D11 | `datasets/wide_40cols.csv`, **a generar** | ~200 | 40 columnas, por encima del límite del envelope (16); tipos mixtos; columna constante; IDs con ceros a la izquierda | A0, A1 |

**Generación de D7–D11.** Un script versionado en `experiments/evaluation/2026-10-05-multidataset/generate_datasets.py`:

- semilla fija y sin dependencias externas;
- escribe los bytes exactos (D7 con `encoding='cp1252'` y `newline='\r\n'`);
- guarda junto a cada CSV un `.expected.json` con lo que la evaluación debe comprobar: codificación detectada, delimitador, valores que deben preservarse literalmente y el error esperado en D9/D10.

Orden de ejecución: **D1 completo primero (A0 → A1 → B)**, luego D7, D2, D3, D5, D6, D8, D11, D4, D9 y D10. D1 y D7 son los casos que más pueden romper el recorrido completo.

## 3. Procedimiento por recorrido

En cada paso hay que registrar:

- tiempo de reloj;
- texto de la conclusión visible;
- errores de consola (`read_console_messages` con `onlyErrors`);
- peticiones de red a hosts que no sean `localhost` (`read_network_requests`): **debe haber cero durante Carga, Perfil y Diagnóstico con Nano**;
- un screenshot por etapa en `runs/<id>/<recorrido>/NN-etapa.png`.

### 3.1 Carga

1. Subir con `file_upload` sobre el input `type=file`. No hacer clic en «Seleccionar archivo», porque abre un diálogo nativo.
2. Comprobar:
   - **filas y columnas** iguales a las del archivo (contarlas fuera, con Python);
   - **codificación** mostrada o registrada en la evidencia: `utf-8` o `windows-1252`;
   - **SHA-256 de la evidencia** igual a `shasum -a 256 <archivo>`, calculado sobre los bytes originales.
3. **D9 y D10:** debe aparecer un error en español que diga qué falla (fila o tipo de problema). No debe aparecer un Perfil ni un informe con puntuación.

### 3.2 Perfil base

1. **Conclusión primero:** etiqueta, puntuación y número de hallazgos.
2. **Coherencia interna:** el número de hallazgos coincide en el resumen, en «Prioridades» y en la lista de columnas afectadas.
3. **Estadísticas por columna** (abrir 3 columnas):
   - longitud mínima y máxima calculadas sobre todos los valores (comprobar con Python);
   - atípicos «n/a» cuando IQR = 0;
   - formato es-ES (coma decimal).
4. **D7:** `001` aparece como `001` en las muestras. `120` y `120.00` cuentan como 2 distintos. Los acentos se ven bien, sin `�`.
5. **D2:** las 12 reglas esperadas aparecen; contrastar con `synthetic_ground_truth.json`.
6. **D6:** no aparecen hallazgos críticos inventados.
7. **D4:** medir el tiempo hasta ver el Perfil y si la pestaña dejó de responder. Ejecutar `await new Promise(r=>setTimeout(r,0))` y medir la latencia durante el procesamiento. Medir también el tamaño de `localStorage['aura_pipeline_session_v1']`.

### 3.3 Diagnóstico

- **A0:** pulsar «Continuar sin diagnóstico» y pasar al Reporte.
- **A1 (Nano):**
  1. Confirmar «Proveedor: Chrome AI / Gemini Nano (Disponible)».
  2. Pulsar «Generar diagnóstico asistido».
  3. Comprobar que el progreso muestra «Diagnosticando hallazgo X de N» y el stream en vivo.
  4. Al terminar, comprobar «Diagnóstico completado · Contrato validado · Ns».
  5. En «Trazabilidad técnica»:
     - el recibo dice `Estado: valid`;
     - aparece «Una solicitud por hallazgo» con N solicitudes;
     - hay un panel `fragment-NN-*` por hallazgo con la solicitud y la respuesta literal;
     - `02-evidence-payload.json` trae estadísticas no nulas (por ejemplo `nullPercentage` de la columna con más nulos);
     - los nombres de persona aparecen hasheados.
  6. Registrar:
     - tiempo total y tiempo por hallazgo;
     - intentos por fragmento (`intentos: 1|2`);
     - si algún fragmento repitió por JSON inválido.
  7. **D3 y D11 (más hallazgos o columnas que el límite):** comprobar que el recorte se declara (`truncationManifest`, o el texto de límites) y no se oculta.
  8. **Cancelación:** en un solo caso (D1), pulsar «Cancelar diagnóstico» a mitad de proceso. Debe mostrarse «La solicitud al modelo se detuvo» y no deben llegar más chunks. Después, «Generar» otra vez debe funcionar.
  9. **Fallo:** si el contrato no valida, **no reintentar a ciegas**. Exportar la evidencia de fallo (sección 3.6) y pasar a la sección 4.

### 3.4 Reporte

1. **Lectura principal coherente con el diagnóstico.** Comprobar que la «Observación principal» corresponde a un hallazgo crítico o de severidad máxima. Si no, es el hallazgo conocido REP-1.
2. **Conteos:** «N hallazgos», «hallazgos únicos» y «Ver K más» deben cuadrar. Anotar los números exactos aunque no cuadren: es el hallazgo conocido REP-2.
3. **Estado de «Corregir una copia»:**
   - en A0 aparece deshabilitado y explica por qué;
   - en A1 válido aparece habilitado.

### 3.5 Recorrido B: corregir una copia

1. **Plan.** Abrir «Corregir una copia». Revisar el plan V2: acciones, columna y consecuencia. Debe distinguir lo automático de lo que solo se revisa. Ningún checkbox ni fila seleccionada equivale a aprobar (Design Principle 2).
2. **Aprobación.** Aprobar explícitamente las acciones permitidas. Anotar cuáles quedan como «solo revisión».
3. **Script.** «Generar contrato de script», luego «Descargar script .py». Comprobar que el script solo contiene acciones aprobadas y que el validador no lo rechaza.
4. **Bundle.** Descargar `execution-bundle.json` y comprobar que trae:
   - `beforeDatasetSha256` igual al SHA del archivo;
   - `sourceEncoding` (D7 = `windows-1252`);
   - `inputReceiptRef` igual al `receiptHash` del diagnóstico.
5. **Ejecución externa**, desde la raíz del repo:
   ```bash
   node experiments/runners/run-aura-remediation.mjs \
     --bundle runs/<id>/B/execution-bundle.json \
     --input <dataset original> \
     --output runs/<id>/B/corrected.csv \
     --receipt runs/<id>/B/receipt.json
   ```
   Debe terminar con código 0. **Comprobar fuera de AURA:**
   - el original no cambió (mismo SHA antes y después);
   - `corrected.csv` mantiene delimitador, finales de línea, BOM y codificación del original (D7: `;`, CRLF, cp1252; D8: BOM);
   - las columnas no tocadas son idénticas byte a byte. Usar un diff por columna con Python leyendo todo como `str`.
6. **Importar y verificar.** En AURA, «Importar salida Python externa»: `corrected.csv` y `receipt.json`. Si la sesión se recargó, AURA pide volver a seleccionar el CSV fuente y comprueba su SHA-256; probarlo en D1 recargando a propósito antes de importar. Debe verse «verificado».
   **Prueba negativa (solo D1):** importar un `corrected.csv` con un byte cambiado en una columna no aprobada. **Debe rechazarse.**
7. **Reauditoría.** Comparar puntuación y hallazgos antes y después. Las acciones aprobadas deberían reducir sus hallazgos, y no deben aparecer hallazgos nuevos sin explicación.
8. **Exportación.** Descargar el ZIP con la opción de incluir `corrected.csv` activada y comprobar la sección 5.

### 3.6 Exportación (todos los recorridos)

1. Descargar el ZIP («Descargar evidencia completa»), el PDF, el JSON y el CSV de hallazgos. Moverlos de `~/Downloads` a `runs/<id>/<recorrido>/`.
2. **Recarga.** Recargar la página, «Reanudar análisis» y confirmar que vuelve a la misma etapa con los mismos números. En `localStorage`, `rawData` debe tener longitud 0.
3. **Cierre.** «Cerrar sesión y destruir datos locales» debe pedir confirmación; la clave de sesión debe desaparecer. Hacerlo solo en el último recorrido de cada dataset.

### 3.7 Laboratorio (L, opcional, solo D1)

Requiere Ollama corriendo en `localhost:11434` con al menos un modelo. Pasos:

1. Desde una auditoría hecha, abrir Laboratorio.
2. Crear una campaña.
3. Comprobar que transfiere la configuración sin iniciar un diagnóstico en Auditoría.
4. Comprobar que un `ollamaBaseUrl` no local se rechaza antes de enviar nada.

Si no hay Ollama, marcar L como «no ejecutado», con el motivo.

## 4. Protocolo cuando algo falla

1. **No arreglar en caliente sin entender.** Reproducir con el menor dataset posible y guardar la evidencia de fallo: ZIP o, como mínimo, el recibo y la respuesta cruda o los fragmentos.
2. **Clasificar:**
   - **P0**: bloquea el recorrido o miente (afirma algo falso);
   - **P1**: resultado incorrecto que el usuario no detecta;
   - **P2**: degradación (tiempo, claridad);
   - **UX**: solo presentación.
3. **Para P0 y P1:**
   - escribir primero el test que falla, en `src/__tests__/` o como invariante si protege una promesa del producto;
   - luego el arreglo;
   - luego `npm run verify`.
4. **Reglas:**
   - **Prohibido** debilitar el parser estricto, reparar JSON del modelo, editar a mano el fixture de Nano o subir umbrales para que pase.
   - Si se cambia la evidencia o los prompts, el invariante INV-5 fallará: hay que recapturar el fixture con Nano real siguiendo `AGENTS.md`.
5. **Commits:**
   - en `main`, pequeños y uno por defecto;
   - el pre-push corre `npm run verify`;
   - **no** usar `--no-verify`;
   - producción solo se actualiza cuando el CI promueve a `production`.
6. Al cambiar el motor de reglas, regenerar la evidencia determinista con el commit real:
   ```bash
   AURA_EVIDENCE_COMMIT=$(git rev-parse HEAD) npm run evidence:deterministic
   ```
7. **Detenerse y preguntar al usuario** cuando:
   - un arreglo cambia la puntuación o el número de hallazgos de D1/D2/D3;
   - un arreglo cambia una promesa de privacidad;
   - hace falta tocar Coolify, secretos o la API desplegada.

## 5. Coherencia de la evidencia exportada (checklist por ZIP)

Escribir un script `experiments/evaluation/2026-10-05-multidataset/check_zip.py` que, por cada ZIP, verifique y vuelque el resultado en `results.json`:

- [ ] El `sha256` de cada archivo en `manifest.json` coincide con el archivo real.
- [ ] `manifest.datasetSha256` es igual al SHA del CSV original.
- [ ] `privacy.rawDatasetIncluded` es `false`; el CSV original no está dentro.
- [ ] `diagnosis/execution-receipt.json`:
  - `validationStatus` coincide con la UI;
  - en Nano, `fragmentedExecution.requestCount` es mayor o igual que el número de hallazgos;
  - los `promptHash` de `fragmentedExecution.fragments` coinciden con `diagnosis/fragments/*.json`.
- [ ] El `rawResponseHash` de cada fragmento es igual a `sha256(rawResponse)`.
- [ ] El recibo de inferencia de Chrome no declara temperatura ni contexto (`null`).
- [ ] `findings/issues.csv` no tiene celdas que empiecen con `= + - @` sin el prefijo `'`. Probarlo en D8.
- [ ] La descripción del ZIP no promete archivos que no están (hallazgo conocido EXP-1).
- [ ] **Solo en B:**
  - `corrected.csv` presente;
  - `receipt.json` válido;
  - la cadena `beforeDatasetSha256 → afterDatasetSha256` es coherente con los archivos.
- [ ] No hay valores de filas completas en el ZIP, salvo muestras de evidencia. Buscar 3 valores únicos del dataset, por ejemplo nombres de D1: deben aparecer como mucho en las muestras de los hallazgos, y hasheados si son nombres.

## 6. Producción

Al terminar la matriz local, repetir **D1 con A1 y B** en `https://aura.casabero.com`, en una pestaña limpia:

- confirmar que el SHA del build servido es igual al de `production`: está dentro de `/assets/index-*.js`;
- registrar las diferencias con local.

## 7. Entregables

1. **`results.json`**, una entrada por dataset × recorrido con:
   ```text
   { dataset, recorrido, completado: bool, etapaFallida, tiemposMs: {carga, perfil, diagnostico, porHallazgo[], reaudit},
     puntuacion: {antes, despues}, hallazgos: {antes, despues}, nano: {solicitudes, reintentos, valido},
     redExterna: n, erroresConsola: n, sessionBytes, zip: {checks pasados/total}, defectos: [ids] }
   ```
2. **`REPORT.md`:**
   - tabla resumen de la matriz (✔ / ✖ / no ejecutado, con motivo);
   - defectos por severidad, con reproducción mínima, commit del arreglo y test que lo protege;
   - límites medidos (filas máximas cómodas, tiempo de Nano por hallazgo, hallazgos máximos útiles);
   - hallazgos UX nuevos.
3. **Commits** con los arreglos y sus tests. El CI debe quedar verde y `production` promovida.
4. **Actualizar** `docs/plans/2026-10-03-aura-recorrido-ux-ui-pipeline.md` § «Estado» con lo resuelto.

## 8. Hallazgos ya conocidos (no redescubrir; confirmar si siguen)

- **REP-1:** la «Observación principal» toma el primer hallazgo del registro y no el más grave.
- **REP-2:** los conteos del Reporte no cuadran (10 / 15 / 4 / «11 más» en D1 antes de los arreglos).
- **EXP-1:** el ZIP promete «plan, contrato, verificación, script» aunque no existan.
- **UX-CLICK-1:** el primer clic en «Empezar auditoría» tras cargar a veces no responde.
- **PERF-1:** la auditoría corre en el hilo principal; se espera bloqueo con D4.
- **NANO-1:** las cifras sin comillas no se validan; Nano dijo «3 filas» donde había 16. Contrastar en D1, D3 y D7 las cifras de cada fragmento con `affectedRows`.
- **E2E-1:** las specs `aura-development-loops`, `aura-qa-screenshots` y `aura-qa-audit` usan la pantalla V1 eliminada.

## 9. Estimación

| Bloque | Tiempo |
|---|---|
| Preparación y generación de datasets | 1 h |
| D1 completo (A0, A1, B y producción) | 1,5 h |
| D7 | 1 h |
| D2, D3, D5, D6, D8, D11 | ~3 h, incluidos los ~2–6 min de Nano por caso |
| D4 | 1 h |
| D9 y D10 | 0,5 h |

Los arreglos van aparte. Si un P0 bloquea, priorizar el arreglo de ese P0 sobre seguir la matriz.
