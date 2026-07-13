# AURA Evidence Package V1

`aura.evidence-package.v1` es el expediente ZIP generado al final de una
auditoría normal. Consolida artefactos ya producidos por AURA; no vuelve a
ejecutar el LLM, el motor determinista ni Python.

## Contenido

| Ruta | Contenido |
|---|---|
| `manifest.json` | Identidad del expediente y SHA-256, tamaño, tipo y descripción de cada artefacto. |
| `technical/` | JSON técnico canónico de la sesión. |
| `profile/` | Reporte, evidencia de carga y validación determinista disponible. |
| `report/` | Modelo del informe y PDF `showcase-ink`. |
| `findings/` | CSV de hallazgos. |
| `diagnosis/` | Instrucción, payload, prompt exacto, schema, recibo y respuesta del proveedor. |
| `remediation/` | Plan, contrato, verificación y script revisado. |
| `activity/` | Registro temporal del flujo. |
| `snapshots/` | Vistas SVG reproducibles derivadas de los contratos. |

## Reglas de verdad

- El CSV original nunca se incluye. Su identidad se conserva mediante
  `datasetSha256`.
- El expediente puede contener muestras visibles de los hallazgos y del
  payload; debe revisarse antes de compartirlo.
- Las API keys están prohibidas por el preflight del JSON técnico.
- `provider-response.raw.json` solo existe cuando la sesión conservó el cuerpo
  exacto recibido. Una sesión histórica usa
  `provider-response.normalized.json` y lo declara así.
- `approved-script.py` exige plan, contrato `aura.script.v2`, hash coincidente y
  verificación válida. Un script histórico sin contrato se guarda como
  `reviewed-script-unverified.py`.
- Las vistas SVG no se presentan como screenshots del navegador.
- El ZIP no acredita ejecución Python ni reauditoría. Esas afirmaciones exigen
  recibo Python y CSV corregido verificados.
