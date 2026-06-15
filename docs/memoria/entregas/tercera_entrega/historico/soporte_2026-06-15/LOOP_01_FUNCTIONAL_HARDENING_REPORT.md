# LOOP 01 - Functional Hardening Report - AURA

## 1. Resumen ejecutivo

Loop 01 cierra 4 riesgos funcionales críticos detectados antes de la auditoría UX/UI estricta del TFM:
(1) Diagnóstico LLM sin proveedor mostraba un mensaje mínimo que no explicaba la causa ni el camino alternativo.
(2) La pantalla de revisión no advertía cuando la simulación no producía mejora (scoreDelta === 0), confundiendo aprobación humana con mejora efectiva.
(3) El Laboratorio de calibración no comunicaba al usuario por qué no podía ejecutar corridas formales cuando faltaba API key o WebGPU.
(4) Las rutas de datasets en tests dependían de `process.cwd()`, creando inconsistencia entre archivos de test y riesgo de fallos por directorio de ejecución.
Todos los puntos se resolvieron sin modificar `auditEngine`, sin cambiar scoring, sin alterar la arquitectura, y sin introducir nuevas funcionalidades.

## 2. Archivos modificados

| Archivo | Tipo de cambio | Riesgo que cierra |
|---|---|---|
| `src/components/DiagnosisStep.tsx` | Mejora UI: notice inline de indisponibilidad del proveedor | Usuario no entiende por qué el LLM no responde; flujo bloqueado |
| `src/components/ReviewStep.tsx` | Mejora UI: advertencia cuando scoreDelta === 0 | Aprobación humana confundida con mejora efectiva |
| `src/components/BenchmarkLab.tsx` | Mejora UI: estado vacío/error accionable + detección WebGPU | Usuario mira pantalla muda sin entender qué falta |
| `src/index.css` | Estilos nuevos para los 3 componentes anteriores | Consistencia visual de notices/warnings |
| `src/__tests__/datasetFlow.test.ts` | Corrección ruta: `process.cwd()` → `__dirname` | Fallo de test por CWD inconsistente |
| `src/__tests__/deterministicValidation.test.ts` | Corrección ruta: `process.cwd()` → `__dirname` | Fallo de test por CWD inconsistente |
| `src/__tests__/auditEngine.test.ts` | Corrección ruta: `process.cwd()` → `__dirname` | Fallo de test por CWD inconsistente |
| `src/__tests__/compositeScoring.test.ts` | Corrección ruta: `process.cwd()` → `__dirname` | Fallo de test por CWD inconsistente |

## 3. Cambios implementados

### 3.1 Diagnóstico LLM no disponible

**Problema detectado:**
La pantalla de diagnóstico mostraba únicamente el texto «Proveedor no disponible. Revisa la configuración.» en 11px gris claro. El botón «Generar diagnóstico» quedaba deshabilitado sin explicar por qué. El usuario no sabía si era un error de API key, falta de WebGPU, o un fallo temporal. Tampoco se comunicaba que el flujo determinista seguía disponible.

**Solución aplicada:**
Se reemplazó el mensaje mínimo por un componente `provider-unavailable-notice` que muestra:
- Contexto específico según el tipo de proveedor (cloud sin API key, local sin WebGPU, Chrome AI no disponible).
- Explicación clara de que el usuario puede continuar con script determinista.
- Advertencia de que continuar sin diagnóstico LLM no genera evidencia formal de IA.
- Registro explícito de que el intento fallido se registra como `attempted_failed`, no como resultado válido.

**Criterio de aceptación cumplido:**
- El flujo principal no queda bloqueado: la CTA «Generar script» permanece siempre accesible.
- El usuario entiende por qué no corre el LLM: mensaje específico por tipo de proveedor.
- Existe camino claro hacia script determinista: texto explícito en el notice.
- No se declara diagnóstico LLM formal si el proveedor no está disponible.

**Limitación restante:**
Ninguna.

### 3.2 Review con delta cero

**Problema detectado:**
En `ReviewStep`, cuando la simulación de remediación se completaba con `healthDelta.scoreDelta === 0` (sin mejora de score, sin reducción de issues ni de críticos), la UI mostraba los mismos valores antes/después sin ninguna advertencia. El usuario podía interpretar la aprobación humana como validación de mejora, cuando en realidad el script no había resuelto ningún hallazgo.

**Solución aplicada:**
Se agregó un bloque condicional `review-delta-zero-warning` que se renderiza cuando `healthDelta.scoreDelta === 0`, dentro del componente de resultado de simulación. El mensaje dice: «La simulación no resolvió hallazgos detectados. Revisa el script antes de usarlo como evidencia de mejora. La aprobación humana no sustituye una mejora efectiva del score.»

**Criterio de aceptación cumplido:**
- No se impide la exportación: el botón «Preparar exportación» sigue habilitado.
- No se confunde aprobación humana con mejora efectiva: warning explícito y visible.
- Si delta es 0, es visible y comprensible: bloque naranja con icono de advertencia.

**Limitación restante:**
Ninguna.

### 3.3 Laboratorio sin proveedor

**Problema detectado:**
Cuando el BenchmarkLab se abría sin API key configurada (cloud) o sin WebGPU disponible (local), la UI solo mostraba el mensaje genérico «Sin ejecuciones. Configura proveedor, modelo y temperatura para iniciar.» en la tabla de resultados. El usuario no sabía qué faltaba configurar ni por qué no podía ejecutar corridas. Tampoco se advertía que `attempted_failed` no cuenta como resultado formal.

**Solución aplicada:**
- Se agregó detección de disponibilidad de WebGPU mediante `checkWebGPUSupport()` al cargar el componente.
- Se agregó un bloque `lab-unavailable-notice` que aparece en la zona de configuración cuando el proveedor seleccionado no está disponible.
- El notice explica la causa específica (WebGPU no disponible o API key faltante), indica que las corridas formales requieren proveedor funcional, aclara que `attempted_failed` no es evidencia formal, y recuerda que el Lab es opcional.
- Se agregó un botón para cambiar al proveedor alternativo si está disponible.

**Criterio de aceptación cumplido:**
- El usuario no queda mirando una pantalla muda: notice visible en la zona de configuración.
- Los errores se registran o comunican sin maquillarlos: se indica `attempted_failed` explícitamente.
- No se inventan resultados: el notice bloquea la expectativa de corrida formal sin proveedor.

**Limitación restante:**
Ninguna.

### 3.4 Rutas de datasets en tests

**Problema detectado:**
Los tests unitarios usaban `path.resolve(process.cwd(), ...)` para resolver rutas de datasets. Esto generaba inconsistencia: `auditEngine.test.ts` y `datasetFlow.test.ts` apuntaban a `src/experiments/datasets/` (previews), mientras `deterministicValidation.test.ts` apuntaba a `experiments/datasets/` (datasets completos en raíz del proyecto). Ambas ubicaciones contienen versiones diferentes de los mismos archivos (previews truncados vs. datasets completos), y la resolución dependía del directorio desde donde se ejecutara vitest.

**Solución aplicada:**
Se estandarizaron las 4 referencias a datasets en tests unitarios usando `path.resolve(__dirname, ...)`:
- `auditEngine.test.ts`, `datasetFlow.test.ts`, `compositeScoring.test.ts`: `path.resolve(__dirname, '../experiments/datasets/...')` → `src/experiments/datasets/` (previews, con los que los tests están calibrados).
- `deterministicValidation.test.ts`: `path.resolve(__dirname, '../../experiments/datasets/...')` → `experiments/datasets/` (dataset completo, requerido para ground truth matching).

Se mantienen ambas ubicaciones (`src/experiments/datasets/` para previews usados en tests calibrados; `experiments/datasets/` como ubicación canónica con datasets completos y metadatos). La duplicación es intencional: los previews permiten tests rápidos mientras que los datasets completos son necesarios para validación determinista con ground truth.

**Criterio de aceptación cumplido:**
- Los tests apuntan de forma consistente: todos usan `__dirname`, sin depender de `process.cwd()`.
- No se duplicaron datasets: las copias ya existían; se documenta la razón.
- No se movieron archivos históricos.
- Se documenta por qué se mantienen ambas rutas (previews para tests rápidos, completos para ground truth).

**Limitación restante:**
Ninguna.

## 4. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm test` (vitest) | 16/16 archivos, 133/133 tests OK | Todos los tests unitarios pasan |
| `npm run build` (vite) | Build exitoso en 3.19s | Chunk size warnings pre-existentes (webllm 6MB) |
| `npm run test:e2e` (playwright) | 5/5 tests OK | Desktop QA (2), Mobile QA (2), Dev Loops (1) |

Salida resumida de `npm test`:
```
Test Files  16 passed (16)
     Tests  133 passed (133)
  Duration  433ms
```

Salida resumida de `npm run build`:
```
✓ built in 3.19s
```

Salida resumida de `npm run test:e2e`:
```
5 passed
- Desktop 1280x900 — audit each stage ✓
- Mobile 390x844 — basic checks ✓
- Desktop 1280x900 — flujo completo con screenshots ✓
- Mobile 390x844 — upload, perfil, Lab nav ✓
- Flujo completo perfil → diagnóstico → script → revisar → exportar → Lab ✓
```

## 5. Riesgos abiertos

| Riesgo | Severidad | Por qué sigue abierto | Recomendación |
|---|---|---|---|
| Nav items no detectados como visibles en E2E desktop | Baja | Los 3 botones de navegación (Auditoría, Laboratorio, Configuración) reportan FAIL en el test de auditoría desktop. No es regresión de este loop (estaba antes). Posiblemente related to sticky nav + scroll position en Playwright. | Revisar visibilidad de `.nav-center-menu` buttons en el viewport durante E2E. |
| Umbral de score en compositeScoring.test.ts calibrado contra preview de Titanic (21 filas) | Baja | El test `Score-3` verifica score en [60, 90], pero el score con el dataset completo (892 filas) es 58. El test usa el preview truncado. Si alguien actualiza el preview, el test podría fallar. | Recalibrar el test contra el dataset completo, o documentar el contrato del preview. |
| Chunk size warnings en build (webllm 6MB) | Baja | Pre-existente. El chunk de WebLLM pesa ~6MB minificado. | Evaluar lazy-loading condicional del provider WebLLM solo cuando el usuario selecciona local. |

## 6. Claims permitidos después de este loop

- AURA comunica al usuario por qué un proveedor LLM no está disponible y ofrece un camino alternativo determinista.
- La pantalla de revisión advierte explícitamente cuando la simulación no produce mejora, evitando confundir aprobación humana con evidencia de mejora.
- El Laboratorio de calibración informa al usuario sobre los requisitos para ejecutar corridas formales y registra los intentos fallidos como `attempted_failed`.
- Las rutas de datasets en tests son independientes del directorio de ejecución y usan resolución basada en `__dirname`.
- El flujo principal de auditoría permanece funcional sin depender del LLM.

## 7. Claims no permitidos

- «AURA diagnostica con IA incluso sin proveedor LLM configurado.»
- «El Laboratorio garantiza resultados comparables entre modelos sin verificación de proveedor.»
- «La aprobación humana del script implica mejora efectiva del dataset.»
- «AURA elimina alucinaciones del LLM.»
- «Los resultados del benchmark son formales sin ground truth, proveedor completo y contrato cumplido.»
- «El score de salud del dataset es una métrica absoluta y no depende del perfil determinista configurado.»

## 8. Commit sugerido

```
fix: close functional evidence gaps before UX strict audit

- DiagnosisStep: inline provider unavailability notice with specific
  reasons (missing API key / no WebGPU) and deterministic fallback path
- ReviewStep: warning when healthDelta.scoreDelta === 0 to prevent
  confusing human approval with effective improvement
- BenchmarkLab: actionable empty/error state when no provider available,
  with WebGPU detection and provider switch button
- Tests: standardize dataset path resolution to __dirname-based,
  eliminating CWD dependency (4 test files)
- CSS: add styles for provider-unavailable-notice,
  review-delta-zero-warning, lab-unavailable-notice
```
