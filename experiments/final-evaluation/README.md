# OE4 — Evaluación final LLM

Base experimental congelada para la campaña final del Laboratorio OE4 de AURA.
Este directorio reúne el dataset, el ground truth histórico, los dos oráculos,
el protocolo y el manifiesto de modelos.

## Matriz definitiva

3 modelos × 3 modos de entrada × 5 repeticiones = **45 unidades**. Cada unidad
produce diagnóstico y script, para un máximo de **90 llamadas LLM evaluadas**.

| Modo | Función experimental |
|---|---|
| `prompt_libre` | Línea base: esquema y contexto mínimo, sin reglas ni muestras problemáticas. |
| `smart_sample` | Evidencia estructurada del motor: columnas, estadísticas, reglas y muestras. |
| `recommended` | Contrato AURA completo: registro técnico y anclaje explícito a bad samples. |

`enhanced_registry` y `copy_paste_bad_samples` siguen disponibles en la aplicación
para compatibilidad operativa, pero quedan fuera de la campaña formal porque son
variantes intermedias ya cubiertas por `recommended` y no añaden un contraste
experimental necesario.

Todos los modos formales usan `aura.diagnosis.v2` y `aura.script.v2`. El F1
primario conserva el mismo denominador de 16 claves `engine_exposed` en los tres
modos. La fidelidad a la evidencia usa un denominador distinto: 0 para
`prompt_libre` y 16 para `smart_sample` y `recommended`.

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
├── protocol.v1.json
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

**Tasks 1–6 cerradas en implementación el 10 de julio de 2026:** hashes,
oráculos, tres modelos, tres modos, matriz, orden balanceado y warm-ups están
congelados. Los contratos
`aura.experiment-campaign.v1` y `aura.experiment-run.v1` preservan cada corrida y
su historial append-only. El registro distingue modelos formales de alternativas
operativas, y el proveedor conserva tokens, duraciones y `thinking` nativos de
Ollama. El preflight genera un recibo con versiones, espacio libre, digests y
smokes cuando todos los gates pasan.

El calendario ejecutable materializa 45 IDs únicos en 15 bloques de modelo y
mantiene un warm-up excluido por bloque. El corredor formal conserva la misma
secuencia diagnóstico → script en los tres modos, registra eventos append-only,
detiene el script ante fallo diagnóstico y reanuda desde el script cuando el
diagnóstico ya terminó. El cierre técnico y sus límites están en
[`TASK5_RUNNER_CLOSEOUT.md`](./TASK5_RUNNER_CLOSEOUT.md).

La persistencia formal ya cuenta con un contrato común, una implementación en
memoria y otra sobre IndexedDB. La campaña se crea con sus 45 corridas y cada
evento se guarda junto con el nuevo estado de la corrida en una sola operación.
Los IDs repetidos se rechazan y los fallos previos permanecen visibles. Véase
[`TASK6_STORE_CLOSEOUT.md`](./TASK6_STORE_CLOSEOUT.md).

Los tres modos formales ya se materializan como snapshots inmutables con una
misma instrucción y un mismo schema de salida:

| Modo | Evidencia visible |
|---|---|
| `prompt_libre` | Resumen físico y esquema de columnas; sin reglas ni muestras. |
| `smart_sample` | Resumen, esquema, estadísticas, reglas y muestras protegidas. |
| `recommended` | Todo lo anterior más registro, gobernanza, manifiestos y anclajes explícitos. |

OE4 continúa **parcial** hasta completar las Tasks 7–12,
ejecutar las 45 unidades reales y exportar el expediente final válido.

El intento real del 10 de julio quedó bloqueado antes de la campaña por una
desalineación reproducible: cliente Ollama `0.31.1` y servidor `0.20.3`. Los tres
modelos formales tampoco están instalados todavía. No se sustituyen por mocks:
se corrige el entorno en Task 12 y se repite `npm run ollama:validate` desde
`src/` hasta producir `preflight/ollama-preflight.latest.json`.
