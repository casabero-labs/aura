# Evidencia reproducible de Diagnosis V2.5

Esta carpeta conserva análisis derivados de campañas históricas y comparaciones
estructurales sin modificar los nueve exportables originales ni su manifiesto.

## Campaña 2

- `campaign-2-baseline.json`: baseline regenerable que separa corridas fallidas,
  códigos por corrida, ocurrencias internas, ocurrencias adicionales después del
  primer bloqueo, tokens, latencia, compliance y claims. No infiere causalidad
  de fallo raíz.
- Fuente congelada:
  `experiments/tests/campana2/resultado_export/campaign.json`.

Regeneración desde `src/`:

```bash
npm run diagnosis:campaign-baseline -- \
  ../experiments/tests/campana2/resultado_export/campaign.json \
  ../docs/product/aura/evidence/diagnosis-v2.5/campaign-2-baseline.json
```

## Comparación estructural V2.5-B frente a V2.5-C

- `diagnosis-v2-5-c-comparison.json`: compara los tres modos sobre el mismo
  report y envelope, sin llamadas a modelos.
- Mide caracteres, estimación `ceil(caracteres/4)`, referencias visibles y
  tamaño interno del alias map.
- El workflow del PR regenera el artefacto y falla cuando el resultado no
  coincide exactamente con el archivo versionado.

Verificación desde `src/`:

```bash
npm run diagnosis:v2.5-comparison -- \
  --check ../docs/product/aura/evidence/diagnosis-v2.5/diagnosis-v2-5-c-comparison.json
```

El artefacto no demuestra latencia, output tokens ni compliance de modelos. Es
un baseline estructural previo a la campaña real posterior.

## V3

La comparación de tokens con V3 permanece marcada como
`pending_v3_serializer`. No se publica una cifra V3 hasta disponer de un
serializador ejecutable sobre las mismas interpretaciones semánticas.
