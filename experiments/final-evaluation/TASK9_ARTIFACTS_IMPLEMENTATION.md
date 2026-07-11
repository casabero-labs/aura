# Task 9 - expediente TFM

## Estado al 11 de julio de 2026

Task 9 está cerrada en implementación y validación técnica.

Desde una sola representación canónica de campaña se generan cinco archivos:

- `campaign.json`: campaña, 45 corridas sin resumir, agregados, representantes y validez formal;
- `runs.csv`: una fila por unidad experimental;
- `report.md`: informe académico por dimensiones, sin ganador universal;
- `report.pdf`: versión A4 del mismo informe;
- `manifest.json`: tamaño y SHA-256 real de cada artefacto.

El hash propio del manifiesto se calcula sobre su contenido canónico sin el
campo `self`. Esta regla evita una referencia circular y queda declarada dentro
del propio archivo.

## Comprobaciones realizadas

- `npm run typecheck`: correcto.
- Suite focal: 3 archivos y 6 pruebas correctas.
- `npm run build`: correcto, con avisos no bloqueantes ya existentes sobre el
  reparto y tamaño de algunos chunks.
- Revisión visual de un PDF de tres páginas: correcta; no hay texto cortado ni
  secciones fuera de página.

## Comandos validados

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentAggregation.test.ts __tests__/experimentReport.test.ts __tests__/experimentArtifactExporter.test.ts
npm run typecheck
npm run build
```

Estas comprobaciones validan el exportador. No sustituyen las pruebas reales del
diagnóstico sobre el dataset ni el recorrido del pipeline principal, que forman
parte de la campaña experimental posterior. Task 10 es el siguiente frente.
