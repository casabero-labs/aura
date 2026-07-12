# OE4 — Evaluación final LLM

Base experimental congelada para la campaña final del Laboratorio OE4 de AURA.
Este directorio reúne el dataset, el ground truth histórico, los dos oráculos,
el protocolo y el manifiesto de modelos.

## Matriz definitiva

3 modelos × 3 modos de entrada × 5 repeticiones = **45 diagnósticos evaluados**.
Se ejecutan además **15 calentamientos reales excluidos**, para **60 llamadas
reales en total**. Los scripts no usan LLM: se generan de forma determinista
solo para los nueve representantes seleccionados.

| Modo | Función experimental |
|---|---|
| `prompt_libre` | Línea base: resumen, esquema y registro mínimo de reglas; sin muestras problemáticas. |
| `smart_sample` | Evidencia estructurada del motor: columnas, estadísticas, reglas y muestras. |
| `recommended` | Contrato AURA completo: registro técnico y anclaje explícito a bad samples. |

`enhanced_registry` y `copy_paste_bad_samples` siguen disponibles en la aplicación
para compatibilidad operativa, pero quedan fuera de la campaña formal porque son
variantes intermedias ya cubiertas por `recommended` y no añaden un contraste
experimental necesario.

Todos los modos formales usan `aura.diagnosis.v2`. El F1
primario conserva el mismo denominador de 16 claves `engine_exposed` en los tres
modos. La fidelidad a la evidencia usa un denominador de 16 en los tres modos;
el baseline puede anclar reglas, pero no dispone de muestras.

## Artefactos congelados

```text
experiments/final-evaluation/
├── datasets/
│   ├── controlled_customers_phase8.csv
│   └── controlled_customers_phase8.schema.json
├── oracles/
│   ├── controlled_customers_phase8_ground_truth.source.json
│   ├── diagnostic-oracle.v1.json
│   └── remediation-oracle.v1.json
├── protocol.v1.json  # histórico
├── protocol.v2.json  # ejecutable
└── model-manifest.v1.json
```

- Dataset: 50 filas, 15 columnas, SHA-256 `7438bbdc…5faf`.
- Esquema: SHA-256 `b1eba3a7…a2a98`.
- Ground truth histórico: SHA-256 `38c84685…040d`, preservado byte a byte.
- Oráculo diagnóstico: 32 claves canónicas; 16 `engine_exposed`, 7
  `engine_supported_not_exposed` y 9 `out_of_engine_scope`.
- Oráculo de remediación: solo usa acciones ejecutables por
  `RemediationActionTypeV2`; lo no soportado pasa por HITL.

La anomalía histórica se conserva: el resumen declara `50/3/2`, mientras el
array contiene `51/2/2`. Los conteos derivados se calculan desde el array.

## Estado

**Tasks 1–11 cerradas en implementación entre el 10 y el 11 de julio de 2026:** hashes,
oráculos, tres modelos, tres modos, matriz, orden balanceado y warm-ups están
congelados. Los contratos
`aura.experiment-campaign.v1` y `aura.experiment-run.v1` preservan cada corrida y
su historial append-only. El registro distingue modelos formales de alternativas
operativas, y el proveedor conserva tokens, duraciones y `thinking` nativos de
Ollama. El preflight genera un recibo con versiones, espacio libre, digests y
smokes cuando todos los gates pasan.

El calendario ejecutable materializa 45 IDs únicos en 15 bloques de modelo y
ejecuta un warm-up excluido por bloque. El corredor formal realiza una sola
llamada medida de diagnóstico por unidad, valida el contrato completo y registra
un recibo verificable. El script se prepara después de seleccionar y aprobar
los representantes. El cierre técnico histórico está en
[`TASK5_RUNNER_CLOSEOUT.md`](./TASK5_RUNNER_CLOSEOUT.md).

La persistencia formal ya cuenta con un contrato común, una implementación en
memoria y otra sobre IndexedDB. La campaña se crea con sus 45 corridas y cada
evento se guarda junto con el nuevo estado de la corrida en una sola operación.
Los IDs repetidos se rechazan y los fallos previos permanecen visibles. Véase
[`TASK6_STORE_CLOSEOUT.md`](./TASK6_STORE_CLOSEOUT.md).

La evaluación formal ya compara las claves primarias sin mezclar los
descubrimientos extendidos, calcula la cobertura del motor sobre las 55
incidencias fuente, mide fidelidad y anclaje, y registra columnas, reglas o
claims inventados. El script conserva por separado contrato, sintaxis,
seguridad y cobertura del oráculo. La operación agrega duraciones, tokens,
fallos y estabilidad, mientras la rúbrica humana valida claridad, trazabilidad
y accionabilidad entre 0 y 4. Véase
[`TASK7_EVALUATION_CLOSEOUT.md`](./TASK7_EVALUATION_CLOSEOUT.md).

La selección de representantes usa la mediana del F1 primario de cada celda y
desempata por la repetición menor. Produce exactamente nueve selecciones y no
sustituye una mediana insegura por una corrida más conveniente. El puente de
ejecución exige revisión y aprobación humana, prepara un notebook externo,
conserva los bloqueos de preflight o sandbox e importa el CSV resultante con
fingerprint exacto, reauditoría y delta. Véase
[`TASK8_HITL_EXECUTION_CLOSEOUT.md`](./TASK8_HITL_EXECUTION_CLOSEOUT.md).

Task 9 ya implementa la derivación de `campaign.json`, `runs.csv`, `report.md`,
`report.pdf` y `manifest.json` desde una sola fuente canónica. La comprobación de
tipos, su suite focal de 6 pruebas, el build y la revisión visual del PDF fueron
correctos. Task 9 queda cerrada.
Véase [`TASK9_ARTIFACTS_IMPLEMENTATION.md`](./TASK9_ARTIFACTS_IMPLEMENTATION.md).

La interfaz operativa anterior (`BenchmarkLab` y calibración incrustada) fue
retirada y no forma parte de OE4. La decisión, archivos eliminados y migración
de sesiones están documentados en
[`LEGACY_LAB_REMOVAL.md`](./LEGACY_LAB_REMOVAL.md). Task 10 construyó una
consola formal nueva; no convirtió ni restauró aquella interfaz.

La nueva entrada `Evaluación OE4` muestra protocolo, progreso, matriz 3 × 3,
detalle crudo, recibos, métricas, rúbrica humana, estado HITL, antes/después y
bloqueos del expediente. La pausa solo se aplica entre corridas. La creación
real ejecuta el preflight formal antes de congelar la campaña. Véase
[`TASK10_CONSOLE_CLOSEOUT.md`](./TASK10_CONSOLE_CLOSEOUT.md).

Task 11 valida el recorrido humano completo en Chromium con un proveedor
controlado que no cuenta como evidencia LLM: pausa segura, recuperación desde
IndexedDB tras recarga, reanudación, rúbrica, HITL, importación del CSV,
reauditoría y exportación de los cinco archivos. El smoke real con Ollama queda
separado y opt-in. En el entorno comprobado se omite porque no existe CLI en la
terminal, el servidor es `0.20.3` y solo contiene `qwen2.5:3b`. Véase
[`TASK11_E2E_CLOSEOUT.md`](./TASK11_E2E_CLOSEOUT.md).

Los tres modos formales ya se materializan como snapshots inmutables con una
misma instrucción y un mismo schema de salida:

| Modo | Evidencia visible |
|---|---|
| `prompt_libre` | Resumen físico, esquema y registro mínimo de reglas; sin muestras. |
| `smart_sample` | Resumen, esquema, estadísticas, reglas y muestras protegidas. |
| `recommended` | Todo lo anterior más registro, gobernanza, manifiestos y anclajes explícitos. |

OE4 continúa **parcial** hasta completar Task 12,
ejecutar las 45 unidades reales y exportar el expediente final válido.

El intento real del 10 de julio quedó bloqueado antes de la campaña por una
desalineación reproducible: cliente Ollama `0.31.1` y servidor `0.20.3`. Los tres
modelos formales tampoco están instalados todavía. No se sustituyen por mocks:
se corrige el entorno en Task 12 y se repite `npm run ollama:validate` desde
`src/` hasta producir `preflight/ollama-preflight.latest.json`.
