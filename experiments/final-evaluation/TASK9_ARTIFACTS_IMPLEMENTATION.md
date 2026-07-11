# Task 9 - expediente TFM

## Estado al 11 de julio de 2026

La implementación está terminada. La validación automática queda pendiente de
la ejecución manual acordada con el responsable del TFM.

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
- Revisión visual de un PDF de tres páginas: correcta; no hay texto cortado ni
  secciones fuera de página.
- La suite Vitest no fue ejecutada por Codex, por acuerdo con el responsable.

## Gate manual pendiente

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentAggregation.test.ts __tests__/experimentReport.test.ts __tests__/experimentArtifactExporter.test.ts
npm run typecheck
npm run build
```

Task 9 se cierra cuando estos tres comandos terminen correctamente. Solo
entonces Task 10 pasa a ser el siguiente frente activo.
