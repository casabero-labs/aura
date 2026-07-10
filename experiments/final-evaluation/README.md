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

**Task 1 cerrada el 10 de julio de 2026:** hashes, oráculos, tres modelos,
tres modos, matriz, orden balanceado y warm-ups están congelados y cubiertos por
pruebas. OE4 continúa **parcial** hasta implementar el corredor, ejecutar las 45
unidades reales y exportar el expediente final válido.
