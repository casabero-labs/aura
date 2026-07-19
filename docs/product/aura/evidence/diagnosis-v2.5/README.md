# Evidencia reproducible de Diagnosis V2.5

Esta carpeta conserva análisis derivados de campañas históricas sin modificar
los nueve exportables originales ni su manifiesto.

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

La comparación de tokens con V3 permanece marcada como
`pending_v3_serializer`. No se publica una cifra V3 hasta disponer de un
serializador ejecutable sobre las mismas interpretaciones semánticas.
