# Cierre OE4 Task 8 — representantes, HITL y reauditoría

Fecha: 11 de julio de 2026.

## Resultado

Task 8 queda cerrada en código. AURA puede escoger nueve representantes de la
matriz formal, exigir una decisión humana antes de preparar cualquier ejecución
y conservar el resultado externo con comparación antes/después.

## Selección reproducible

- Se agrupan las 45 corridas en nueve celdas modelo–modo.
- Cada celda exige exactamente cinco repeticiones 1–5.
- Se selecciona la mediana del F1 primario.
- Si dos repeticiones comparten la mediana, gana la repetición menor.
- Una mediana insegura queda bloqueada; no se cambia por otra corrida más
  conveniente después de ver los resultados.
- Una campaña incompleta o con coordenadas ajenas al protocolo falla cerrada.

## Frontera de ejecución

- Una corrida revisada pasa primero a `awaiting_hitl`.
- La decisión humana explícita conserva `approved`, `rejected` o `blocked`.
- Solo `approved`, con contrato, sintaxis y seguridad correctos, puede preparar
  un notebook para Google Colab.
- AURA no ejecuta Python en el navegador ni añade `child_process` o Pyodide.
- Un fallo de fingerprint, preflight, sandbox o preparación queda persistido
  como `blocked`.
- El notebook se entrega como artefacto; la ejecución continúa fuera de AURA.

## Evidencia importada

- El CSV original se verifica con hash exacto y permanece inmutable.
- El CSV devuelto conserva otro hash exacto, sin normalizar espacios finales.
- La reauditoría registra score, issues, filas, columnas y celdas modificadas.
- Las reglas quedan separadas en resueltas, persistentes y nuevas.
- Un resultado mixto se marca `inconclusive`; no se fuerza una mejora o un
  empeoramiento cuando las dimensiones discrepan.

## Evidencia de validación

- Pruebas focales y dependientes: 81/81.
- Suite completa: 1681 aprobadas y 6 omitidas de forma prevista.
- El hash textual exacto del CSV fuente reproduce el fingerprint congelado
  `7438bbdc…5faf`.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; permanecen las advertencias conocidas de chunks
  grandes e imports mixtos, sin error de compilación.

## Siguiente paso

Task 9 debe derivar el expediente completo del TFM desde una campaña canónica:
`campaign.json`, `runs.csv`, `report.md`, `report.pdf` y `manifest.json`.
