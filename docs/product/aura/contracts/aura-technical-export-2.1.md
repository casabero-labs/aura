# `aura-technical-export` 2.1

## Política de versión

La versión 2.1 añade `remediationExecution` como bloque canónico del builder actual. Es un incremento menor porque no cambia ni elimina la semántica de los seis bloques de 2.0. Un lector 2.0 puede ignorar el bloque nuevo; el validador de AURA sigue aceptando paquetes históricos 2.0 que no lo contienen.

No existe un builder 2.0 alternativo. `buildAuraExportPackage()` es el único builder canónico y produce 2.1.

## Estados

| Estado | Obligatorio | Permitido | Prohibido |
|---|---|---|---|
| `not_run` | Limitación canónica | Ningún artefacto | Bundle, recibo, verificación y dataset corregido |
| `prepared` | Bundle íntegro | Limitación descriptiva | Recibo, verificación y dataset corregido |
| `invalid` | Limitación o error saneado | Bundle y recibo disponibles como evidencia no certificada | Verificación y dataset corregido certificado |
| `verified` | Bundle, recibo exitoso y metadatos del corregido | Limitaciones | Resultado de reauditoría |
| `reaudited` | Cadena verificada completa y comparación antes/después | Limitaciones | Referencias con hashes distintos |

## Privacidad

- El CSV original nunca forma parte del JSON ni del ZIP.
- `corrected.csv` solo entra al ZIP mediante opt-in explícito después de verificar su SHA-256 byte a byte.
- El corregido puede conservar PII.
- No se exportan API keys, `stdout` o `stderr` crudos. Los recibos conservan únicamente hashes de streams y errores saneados.

## ZIP

`remediation/STATUS.md` declara siempre el estado. Una reauditoría verificada añade bundle, recibo Python, resultado de verificación, reportes antes/después y una vista SVG reproducible. `corrected.csv` sigue siendo opcional y no se confunde con el dataset original.
