# Task 11 — recorrido humano y recuperación E2E

## Estado al 11 de julio de 2026

Task 11 está cerrada. La prueba controlada de Chromium recorre la consola
`Evaluación OE4` como una persona:

1. crea una campaña de 45 unidades;
2. inicia una unidad y solicita una pausa segura;
3. recarga el navegador y recupera la campaña desde IndexedDB;
4. reanuda sin repetir la unidad ya guardada;
5. registra la rúbrica humana 0–4;
6. aprueba el representante mediante HITL;
7. prepara la ejecución externa e importa el CSV resultante;
8. muestra el antes/después y habilita `campaign.json`, `runs.csv`,
   `report.md`, `report.pdf` y `manifest.json`.

El proveedor controlado existe exclusivamente bajo
`VITE_OE4_E2E_HARNESS=true` en desarrollo. Sirve para probar la interfaz y la
recuperación; no constituye evidencia comparativa de ningún LLM.

## Validación

- E2E controlado: 1 aprobado.
- E2E real opt-in: implementado; 1 omitido sin `AURA_OE4_REAL=1`.
- Pruebas unitarias de la consola: 3 aprobadas.
- Suite completa: 1690 aprobadas y 6 omitidas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto, con avisos históricos no bloqueantes sobre chunks.

## Motivo documentado de la omisión real

La comprobación local encontró:

- CLI `ollama`: no disponible en la terminal;
- servidor Ollama: responde con versión `0.20.3`;
- modelos instalados: únicamente `qwen2.5:3b`;
- modelos congelados OE4: ausentes.

Por tanto, activar el smoke no produciría una prueba válida del modelo exacto.
No se reemplaza con un mock ni se descarga un modelo fuera de Task 12.

## Siguiente paso único

Task 12: restaurar y sincronizar Ollama, instalar los tres modelos congelados,
pasar el preflight, ejecutar manualmente las 45 unidades reales y exportar el
expediente final. Las corridas reales del dataset y del pipeline principal las
realizará el usuario desde la consola formal.
