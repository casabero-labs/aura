# Decisión: Ejecución Python en AURA

> Loop 5: AURA-PYTHON-EXECUTION-DECISION-01
> Fecha: 2026-06-19
> Estado: `decision_document` — no implementación definitiva

---

## 1. Situación actual

AURA genera un script Python/Pandas (`clean_dataset(df)`) aprobado por revisión humana, pero **no lo ejecuta**. La etapa "review" ejecuta una **simulación determinista en JavaScript** (`remediationSimulator.ts`) que aplica acciones básicas (trim, casing, placeholder null) a una copia en memoria y re-audita con `runAudit()`. El script aprobado se puede descargar como `.py`.

El delta de salud reportado es producto de esa simulación determinista, no de la ejecución real del script generado por el modelo.

---

## 2. Tres opciones evaluadas

### Opción A: Pyodide en navegador

Ejecutar Python 3.12 completo + Pandas dentro del navegador mediante WebAssembly.

| Factor | Evidencia |
|---|---|
| **Valor demo/TFM** | Alto. Demostración integrada: carga CSV → audita → genera script → ejecuta → descarga corregido. Cierra el ciclo completo sin salir del navegador. |
| **Riesgo técnico** | Alto. Pyodide requiere SharedArrayBuffer (cabeceras COOP/COEP), añade ~10 MB de WebAssembly + ~10 MB de paquetes Python en cold start, y ~150-300 MB de RAM. |
| **Privacidad** | Máxima. 100% local, sin red (salvo primera descarga de paquetes). |
| **Performance** | Cold start: 10-25 segundos (descarga + compilación WASM + import pandas). Warm execution: ~0.5-2s para 5.000 filas. |
| **Bundle size** | +~20 MB en primera carga (WASM + pandas). No va en el bundle de Vite (carga CDN diferida). |
| **Tests** | Alta complejidad. Requiere mock de Pyodide en tests unitarios, o tests E2E con navegador real. |
| **Compatibilidad** | Chrome 91+, Firefox 89+, Edge 91+, Safari 16.4+. Requiere cabeceras HTTP `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`. |
| **Claims permitidos** | "AURA ejecuta scripts Python/Pandas en el navegador sin enviar datos a servidores externos." |
| **Evidencia faltante** | Medición real de latencia en entorno Coolify (requiere COOP/COEP en proxy). Validación con CSV de 10.000 filas. |

**Spike Pyodide:** Intentado en headless Chromium vía Playwright. La carga desde CDN no completó dentro del timeout de 30s. Pyodide npm v0.26.4 disponible. WASM core: ~10 MB (jsDelivr CDN). Paquetes adicionales (pandas): ~10-15 MB. Tiempo estimado documentado de cold start: 10-25s en banda ancha.

### Opción B: Exportar notebook para Colab

Generar un archivo `.ipynb` (Jupyter notebook) preconfigurado con el script aprobado y celdas de documentación automática.

| Factor | Evidencia |
|---|---|
| **Valor demo/TFM** | Medio. Flujo claro: AURA audita y genera script → humano descarga notebook → ejecuta en Colab con un clic. Menos "integrado" pero más familiar para el público académico. |
| **Riesgo técnico** | Bajo. Solo se necesita generar JSON con formato `.ipynb`. Sin dependencias nuevas. |
| **Privacidad** | Media. El usuario decide si sube datos a Colab (Google Cloud). AURA no fuerza el envío. |
| **Performance** | Instantáneo. La generación del `.ipynb` es una serialización JSON ligera (~5-20 KB). |
| **Bundle size** | 0 KB adicional. |
| **Tests** | Baja complejidad. Test unitario verifica estructura `.ipynb` válida (cells, metadata, kernel). |
| **Compatibilidad** | Universal. Cualquier navegador puede descargar un archivo. Colab requiere navegador moderno y cuenta Google. |
| **Claims permitidos** | "AURA exporta un notebook reproducible para Google Colab con trazabilidad completa del script aprobado." |
| **Evidencia faltante** | Validación de que el notebook generado ejecuta correctamente en Colab con el dataset de prueba. |

### Opción C: Mantener solo script descargable + simulación

Status quo: script `.py` descargable + simulación determinista en JS.

| Factor | Evidencia |
|---|---|
| **Valor demo/TFM** | Bajo. La simulación no ejecuta el script real. El revisor ve acciones deterministas que no reflejan fielmente el script generado por el LLM. |
| **Riesgo técnico** | Ninguno. Ya implementado. |
| **Privacidad** | Máxima. |
| **Performance** | Instantáneo. |
| **Bundle size** | 0 KB adicional. |
| **Tests** | Ya cubiertos en `improvementLoop.test.ts`. |
| **Compatibilidad** | Universal. |
| **Claims permitidos** | "AURA simula acciones de remediación deterministas sobre una copia en memoria." No se puede afirmar que el script fue ejecutado. |
| **Evidencia faltante** | N/A (opción descartada como camino principal). |

---

## 3. Tabla comparativa

| Criterio | Pyodide (A) | Colab Notebook (B) | Script-only (C) |
|---|---|---|---|
| Valor demo/TFM | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Riesgo técnico | Alto | Bajo | Nulo |
| Privacidad | Máxima | Media | Máxima |
| Cold start | 10-25s | Instantáneo | Instantáneo |
| Peso adicional | ~20 MB CDN | 0 KB | 0 KB |
| Complejidad tests | Alta | Baja | Ya cubierta |
| Cobertura navegadores | Chrome/Firefox/Safari COOP/COEP | Universal | Universal |
| Ejecución real del script | ✅ Sí | ✅ Sí (en Colab) | ❌ No |
| Delta de salud real | ✅ Sí | ✅ Sí (en Colab) | ❌ Solo simulado |
| Dataset corregido descargable | ✅ Sí | ✅ Sí (en Colab) | ❌ No |

---

## 4. Recomendación

### Camino recomendado: **Opción B (Exportar notebook para Colab) como próximo paso inmediato. Opción A (Pyodide) como objetivo a medio plazo.**

#### Justificación

1. **La opción B cierra el ciclo completo con riesgo mínimo.** Un notebook `.ipynb` exportado desde AURA permite que el usuario ejecute el script real en Colab sin salir del ecosistema Python/Pandas. El archivo es pequeño (~5-20 KB), no añade dependencias, y es testeable con tests unitarios simples.

2. **Pyodide requiere infraestructura que AURA no controla hoy.** Las cabeceras COOP/COEP son necesarias para `SharedArrayBuffer` y deben configurarse en el proxy/CDN de despliegue (Coolify/Cloudflare). Esto añade una dependencia de infraestructura que conviene resolver con calma, no en este loop.

3. **La opción C no es defendible académicamente.** Decir que "AURA ejecuta scripts" cuando solo simula acciones deterministas que no reflejan el script generado por el LLM debilita los claims del TFM.

4. **Roadmap propuesto:**
   - **Loop 5b (inmediato):** implementar exportación de `.ipynb` con script aprobado + dataset empaquetado + celdas de documentación. Escribir tests que validen estructura de notebook. Añadir botón "Exportar a Colab" en sección de exportación.
   - **Loop 6 (post-entrega 3):** prototipo de Pyodide como feature flag (`?pyodide=1`), resolviendo COOP/COEP, midiendo latencia real, y comparando contra Colab.

### Opción descartada por ahora: **Opción C (mantener solo script + simulación) como camino único.**

La simulación determinista se conserva como fallback y herramienta de comparación, pero el flujo principal debe incluir ejecución real del script, aunque sea delegada a Colab.

---

## 5. Contrato de ejecución Python (futuro)

Independientemente de si la ejecución ocurre en Pyodide o en Colab, el contrato de entrada/salida es el mismo:

### Entrada
- `csvOriginal`: string con el CSV cargado por el usuario completo; `previewRows` solo aplica si el usuario solicita una ejecución parcial controlada.
- `scriptAprobado`: string con el script Python/Pandas validado y aprobado en etapa HITL.
- `config`: `{ previewRows?: number, timeoutMs?: number }`.

### Salida
- `csvCorregido`: string con el CSV resultante de ejecutar `scriptAprobado(csvOriginal)`.
- `logEjecucion`: `{ stdout: string, stderr: string, wallTimeMs: number, memoryPeakBytes?: number }`.
- `hash`: `{ inputHash: string, outputHash: string, scriptHash: string }` (SHA-256).
- `deltaAuditado`: `HealthDelta` (ejecutando `runAudit` sobre `csvCorregido`).

### Seguridad
- No permitir operaciones de red (`import requests`, `urllib`).
- No permitir acceso a filesystem arbitrario (`open()`, `os.system()`).
- Lista blanca de imports: `pandas`, `numpy`, `json`, `csv`, `io`, `hashlib`, `re`, `math`, `datetime`, `collections`, `itertools`, `typing`.
- Timeout de ejecución: 30 segundos.
- Sandbox: en Pyodide es inherente (no hay filesystem real ni red). En Colab es responsabilidad del usuario.

### UX
- Botón separado **"Ejecutar script (Colab)"** o **"Ejecutar en entorno experimental"**.
- NUNCA mezclar con el botón de simulación actual.
- Mostrar progreso: "Generando notebook..." / "Ejecutando en Pyodide..."
- Resultado: descarga de CSV corregido + log de ejecución + delta auditado.

---

## 6. Riesgos restantes

| Riesgo | Mitigación |
|---|---|
| Pyodide cold start frustra al usuario (10-25s) | Mostrar progress bar explícita; ofrecer Colab como alternativa inmediata |
| Cabeceras COOP/COEP rompen otros recursos en Coolify | Feature flag; probar en staging primero |
| Notebook de Colab no ejecuta correctamente en todos los casos | Incluir celda de validación automática; documentar dependencias |
| Usuario sube datos sensibles a Colab sin saberlo | Advertencia explícita en UI antes de exportar; opción Pyodide para datos sensibles |
| Delta de salud entre simulación JS y ejecución Python difiere | Mostrar ambos deltas en UI; explicar que la simulación es una aproximación |

---

## 7. Evidencia del spike Pyodide

- Pyodide npm package: v0.26.4 disponible (`npm view pyodide@0.26.4`).
- WASM core size: 10,088,051 bytes (~10 MB, jsDelivr CDN).
- JS loader size: 14,761 bytes (~15 KB).
- Spike en headless Chromium vía Playwright: timeout a 30s cargando desde CDN (posible bloqueo de red en entorno headless o lentitud de descarga).
- Spike teórico (documentación): cold start 10-25s en banda ancha; warm ~0.5-2s para 5k filas.
- Requisito de infraestructura: cabeceras COOP/COEP necesarias para SharedArrayBuffer.

---

## 8. Próximo loop propuesto

**Loop 5b: AURA-COLAB-EXPORT-01**

Objetivo: implementar exportación de notebook `.ipynb` desde la sección de exportación de AURA.

Tareas:
1. Crear `src/services/colabExporter.ts` — generador de notebook JSON con:
   - Celda markdown: metadata del dataset, score, issues detectados.
   - Celda código: carga del CSV empaquetado como string.
   - Celda código: script aprobado (`clean_dataset`).
   - Celda código: validación (re-auditoría con `runAudit` traducida a Python o checks básicos).
   - Celda markdown: instrucciones de uso.
2. Añadir botón "Exportar a Colab" en `src/App.tsx` (sección exportación).
3. Tests unitarios en `src/__tests__/colabExporter.test.ts`.
4. Ampliar E2E para verificar descarga de `.ipynb`.

---

## 9. Referencias

- Pyodide: https://pyodide.org/en/stable/
- COOP/COEP: https://web.dev/articles/coop-coep
- Google Colab: https://colab.research.google.com/
- nbformat (notebook JSON): https://nbformat.readthedocs.io/
- Simulador actual: `src/services/remediationSimulator.ts`
- Mejora actual: `src/services/improvementService.ts`
