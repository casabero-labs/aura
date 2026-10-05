# Evaluación multidataset del pipeline — 2026-10-05

Plan: `docs/plans/2026-10-05-aura-evaluacion-pipeline-multidataset.md`. Build evaluado: `main`/`production` `365dee6` (CI verde, `npm run verify`: 162 archivos, 2160 tests).
Entorno: Chrome 154.0.0.0, Gemini Nano `available` (contextWindow 9216), Node 22.22.3, Python 3.14.7 y pandas 3.0.3 (el plan decía 3.13). Datos y artefactos en esta carpeta; detalle en `results.json`.

## Resumen de la matriz

✔ completado · ✖ no completado · — no ejecutado

| Dataset | Carga/Perfil | A0 | A1 (Nano) | B | Notas |
|---|---|---|---|---|---|
| D1 titanic | ✔ | ✔ | ✔ 8 sol., 95,6 s | ✖ P1-B1 | Cancelación ✔, recarga ✔, destrucción de sesión ✔, 0 peticiones externas ✔, producción idéntica |
| D2 sintético | ✔ 9/9 familias esperadas | ✔ | ✔ 15 sol., 170 s | ✔ | Runner conserva columnas no aprobadas (solo cambian 3 celdas) |
| D3 customers (original) | ✖ falla clara, registro 13 | — | — | — | El fixture tiene 3 filas con campos de más (error del plan, no de AURA) |
| D3b (D3 reparado, 26 hallazgos) | ✔ | ✔ | ✖ P1-N1 (2/2) | ✖ | Recorte a 24 no declarado (P1-T1) |
| D4 adult_income | ✔ 48.842 filas, cifras exactas | ✔ | ✔ 12 sol., 149 s | — | Bloqueo máx ~1 s en carga, ~4,5 s al exportar ZIP; sesión 196 KB |
| D5 l9_issues | ✖ falla clara, registro 5 | — | — | — | Fixture con fila de 5 campos en cabecera de 4 |
| D6 control limpio | ✔ 100/100, 0 hallazgos | ✔ | ✖ P2-N2 | — | No inventa problemas |
| D7 latin1 `;` CRLF | ✔ cp1252, `001`, acentos | ✔ | ✔ 4 sol., 75,8 s | ✔ | Runner conserva cp1252, `;` y CRLF; prueba negativa ✔ |
| D8 BOM/comillas | ✔ BOM, multilínea | ✔ | ✖ P2-N2 | — | Sin hallazgos |
| D8b (D8 + fórmulas) | ✔ | ✔ | ✖ P1-N1 (2/2) | ✖ | `issues.csv` prefija `'`: inyección mitigada |
| D9 irregular | ✔ falla clara | — | — | — | Apunta al registro 8; la primera fila mala es la 5 (P2-L1) |
| D10 vacío / solo cabecera | ✔ falla clara | — | — | — | |
| D11 ancho 40 col. | ✔ 17 hallazgos | ✔ | ✔ 7 de 17, 78,7 s | — | Recorte no declarado (P1-T1) |
| L Laboratorio | parcial | | | | Abre; «Crear experimento» no inicia diagnóstico. Matriz de 27 corridas y URL no local en UI: no ejecutados |
| Producción D1 | ✔ idéntico | | ✔ 135 s | ✖ P1-B1 | Build servido contiene `365dee6` |

## Defectos

### P1
- **P1-B1 — La rama B se bloquea con columnas de nombre genérico.** `columnRegistry.ts` (`AMBIGUOUS_PATTERNS`, añadida en `397c814`) marca como ambiguas columnas llamadas `name`, `id`, `value`, `key`, `data`…. Una acción aprobada sobre esa columna se excluye (`ambiguous_column`) y el contrato queda con 0 aceptadas. Reproducción: D1, aprobar «Limpiar espacios del texto» en `Name` → «Sin acciones ejecutables». La única acción ejecutable de Titanic es esa. Las columnas se referencian por `columnId`+posición, así que el nombre genérico no genera ambigüedad real. Arreglo propuesto: quitar el patrón de palabras genéricas y conservar los confusables (`Il1|`, `0oO`, vacíos, símbolos). Cambia `isAmbiguous` en la evidencia → recapturar fixture de Nano (INV-5). **Pendiente de decisión.**
- **P1-N1 — Un fragmento rechazado hunde todo el diagnóstico. ARREGLADO.** El prompt del fragmento dice «si `mustRequireHumanReview` es true, debe ser true», pero `findUnsafeRecommendationsWithoutReview` (`diagnosisEvidenceReview.ts`, usado en `diagnosisValidatorV2.ts:984`) exige `requiresHumanReview=true` si la recomendación contiene un verbo destructivo («eliminar»…), y eso no se le dice al modelo. Reproducción: D8b (1 hallazgo, 2/2 fallos); D3b (24 hallazgos, 2/2 fallos, 2–3 fragmentos). Pasó en D1, D2, D7, D11 y D4 (no determinista). Tras ~5 min el usuario ve `DIAGNOSIS_REVIEW_DOWNGRADE` y solo puede reintentar. Opciones: (a) añadir la regla al prompt (cambia prompts → recapturar fixture INV-5); (b) reintentar el fragmento una vez ante violación de política, con el motivo; (c) mensaje en español y «regenerar solo fragmentos rechazados». No se tocó el validador ni se reparó la respuesta (prohibido por el plan).
  - **Arreglo aplicado (a + b):** (a) la instrucción del fragmento nombra los mismos verbos que el validador (lista única `DESTRUCTIVE_RECOMMENDATION_VERBS`); (b) un fragmento bien formado que deja `requiresHumanReview=false` donde la política exige `true` se pide una vez más (`fragmentBreaksReviewPolicy`), con el intento contado en el recibo y sin reparar nada. Solo con (a) D3b seguía fallando (1 fragmento ignoró la regla); con (a)+(b) D3b completa (335 s, 1 reintento) y D8b pasa (11 s). Tests: `fragmentPromptReviewRule.test.ts` y dos casos nuevos en `diagnosisFragmentsV2.test.ts`. El fixture de Nano (INV-5) se recapturó con Nano real (8 fragmentos, 1 intento cada uno).
- **P1-T1 — El recorte de hallazgos no se declara.** Con más hallazgos que el límite del envelope (24 en D3b, 7 de 17 en D11) el Reporte dice «construido sobre 17 hallazgo(s)» y los límites solo dicen «cada hallazgo se diagnosticó en una solicitud independiente». El ZIP no trae manifiesto de recorte (`truncated:false` es el del parseo). Falta declarar «N de M hallazgos con diagnóstico asistido».

### P2
- **P2-N2.** Con 0 hallazgos (D6, D8) A1 falla en 2 s con `DIAGNOSIS_MODEL_MISMATCH` («Error del proveedor de IA… observed null»): sin solicitudes no hay modelo observado (`diagnosisSelector.ts:~430`). Debería saltarse el diagnóstico con un mensaje claro.
- **P2-R1.** Reauditoría D2: tras normalizar `NULL`→vacío en `email`, `invalid-email` pasa de 1 a 2 y `null-values` se queda en 1.
- **P2-L1.** D9: el error cita el «registro 8» aunque la primera fila irregular es la 5 (a confirmar con un archivo sin comilla abierta).
- **P2-PERF.** D4: bloqueo del hilo ~1 s al cargar y hasta ~4,5 s al generar el ZIP.
- **SEM-1.** D7 B: aprobar «Convertir números almacenados como texto» en `codigo` transforma `001`→`1` (`to_numeric(errors="coerce")`) sin avisar de la pérdida de ceros; la reauditoría lo cuenta como «resuelto».

### Conocidos del plan
- **REP-1 confirmado** (D1 A1 y producción): la «Observación principal» es `Name` 0,2 % y no `Cabin` crítico. En D11 tampoco es la más grave.
- **REP-2 confirmado**: «hallazgos únicos» 13 (D1, 8 reales), 9 (D7, 4), 17 (D2, 15), 21 (D11, 17); la lista muestra 4 y «Ver N más». En D4 cuadra (12).
- **EXP-1 confirmado** en todos los ZIP A0/A1: la descripción promete plan, contrato, verificación y script.
- **UX-CLICK-1**: se reprodujo una vez con clic real justo tras recargar; no con clic programático.
- **NANO-1**: en D1, D7 y D11 las cifras de los fragmentos coinciden con Python (177 nulos, 687, 53, 608/209, 26 `ok`); no se encontró discrepancia.
- **PERF-1**: acotado; D4 no congela la pestaña de forma apreciable en la carga.

### UX nuevos (no se arreglan en este loop)
- **UX-A0-1**: «Continuar sin diagnóstico» solo aparece tras un fallo; con Nano disponible A0 se alcanza únicamente por el stepper.
- **UX-VOSEO**: «Podés», «Descargá», «Seleccioná», «arrastrá» en la rama de corrección; el resto usa «tú».
- **UX-STATS**: el detalle de columna en Perfil solo muestra tipo y nulos; no hay longitud mín./máx., atípicos ni muestras (§3.2.3 no verificable).
- **UX-STEPPER-ERR**: en un fallo de carga el stepper marca «Perfil base» como activo.
- **UX-HITL**: «afecta - columnas y - filas» con guiones de relleno en la revisión del script.
- **UX-ERR-EN**: «Detalle verificable: A potentially destructive recommendation requires human review» en inglés.
- La aprobación del script exige llegar al final del código («Revisa hasta el final…»): buen comportamiento; hay que scrollear el visor.

## Lo que sí funciona (verificado)
- Carga: SHA-256 del ZIP = `shasum`; codificación y delimitador correctos (utf-8, windows-1252, `;`, BOM); `001`, acentos y celdas multilínea se preservan.
- Perfil: cifras coinciden con Python en D1, D2, D4, D7; D6 no inventa hallazgos; D2 cubre las 9 familias inyectadas.
- Nano: 0 peticiones externas; una solicitud por hallazgo; 1 intento por fragmento en las corridas válidas; cancelación correcta.
- Recibos: `inputReceiptRef` del bundle = `receiptHash` del diagnóstico; recibo `valid`; `promptHash`/`rawResponseHash` coinciden con fragmentos.
- Runner: código 0, original intacto, formato (cp1252, `;`, CRLF) conservado, columnas no aprobadas idénticas.
- Verificación: una celda alterada en `ciudad` se rechaza («output CSV hash mismatch»).
- Persistencia: recarga reanuda; `rawData` vacío; «Destruir datos locales» pide confirmación y borra la clave.
- ZIP: `manifest` coherente, el CSV original no está incluido (`check_zip.py`: 10–13 checks; el único fallo es EXP-1).

## Límites medidos
- Nano: ~9–19 s por hallazgo (media ~12 s); 4→76 s, 7→79 s, 8→96 s, 12→149 s, 15→170 s, 24→~5,5 min.
- Límite de envelope: 24 hallazgos, 16 columnas; el recorte no se declara (P1-T1).
- D4 (48.842 filas, 5 MB): perfil casi inmediato, sesión 196 KB, heap 51–82 MB.

## No ejecutado
- D1 B, D3b A1/B, D8b B: bloqueados por P1-B1 / P1-N1.
- D4 B: tiempo (A1 terminó).
- L completo y rechazo de `ollamaBaseUrl` no local desde la UI (menú de Configuración por hover).
- Medición de red externa en cada caso: solo D1 A1 (0 peticiones); en el resto no se midió.
- Comprobaciones por columna del §3.2.3 (longitudes, IQR=0): la UI no las expone (UX-STATS).

## Arreglos
P1-N1 aplicado (ver arriba). Pendientes de decisión: P1-T1 y P1-B1 (cambian evidencia y requieren otra recaptura del fixture de Nano). Con P1-N1 resuelto quedan desbloqueados D3b B y D8b B, aún sin ejecutar.
