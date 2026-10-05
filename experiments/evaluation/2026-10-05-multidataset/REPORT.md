# Evaluación multidataset — 2026-10-05 (en curso)

## Preparación (sección 1)
- `main` = `production` = 365dee6, CI verde.
- `npm run verify`: 162 archivos, 2160 tests pasan (6 omitidos).
- Hook pre-push instalado. Dev server `aura-dev` en :3000.
- Chrome 154.0.0.0, `LanguageModel.availability()` = `available`, contextWindow 9216.
- Python 3.13 / pandas 3.0.3 (coincide con requirements.txt). Node 22.22.3.
- D7–D11 generados con `generate_datasets.py` (+ `.expected.json`).

## Casos
| Dataset | A0 | A1 | B | Notas |
|---|---|---|---|---|
| D1 titanic | en curso | — | — | Carga y Perfil OK: 891×12, 8 hallazgos, 64/100, columnas afectadas suman 8 |

## Hallazgos
- UX-CLICK-1 **confirmado**: tras recargar con sesión limpia, el primer clic en «Empezar auditoría» no respondió; el segundo sí.
