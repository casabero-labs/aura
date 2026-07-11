# Cierre OE4 Task 5 — calendario y corredor formal

Fecha: 10 de julio de 2026.

## Resultado

Task 5 queda cerrada en código. AURA dispone de un calendario reproducible y de
un corredor formal simétrico y reanudable para la matriz OE4. Esto todavía no
equivale a haber ejecutado la campaña real.

## Decisiones fijadas

- `experimentSchedule.ts` genera exactamente 45 unidades únicas: tres modelos ×
  tres modos × cinco repeticiones.
- La rotación de modelos proviene del protocolo congelado. El orden de modos se
  deriva de la semilla `4242` y rota entre los 15 bloques.
- Cada bloque registra un warm-up explícito con `excluded: true`; los 15
  warm-ups no forman parte de los 45 `runId` ni de las métricas.
- `experimentRunner.ts` es la única ruta de las campañas formales. El benchmark
  operativo anterior se conserva para los modos no formales.
- Cada unidad nueva hace dos llamadas en el mismo orden: diagnóstico
  `aura.diagnosis.v2` y script `aura.script.v2`.
- Respuestas no JSON o con `contractId` incorrecto se conservan como fallos de
  contrato; no cuentan como etapas completadas.
- Un fallo diagnóstico impide la llamada de script. Un fallo de script conserva
  el diagnóstico y puede reanudarse sin repetirlo.
- Cada intento agrega eventos `started` y `completed`, `failed` o `timeout`. Los
  reintentos enlazan el intento previo y la pausa se evalúa solo entre unidades.

## Evidencia de validación

- Pruebas focales y dependientes: 67/67.
- Suite completa: 1639 aprobadas y 6 omitidas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; conserva advertencias conocidas de chunks grandes
  e imports mixtos, sin error de compilación.

## Frontera pendiente

El almacenamiento actual es una interfaz del corredor, no persistencia durable.
Task 6 debe implementar el repositorio en memoria y el adaptador IndexedDB con
append atómico, rechazo de eventos duplicados y reconstrucción tras reinicio. No
se deben instalar modelos ni iniciar las 45 corridas antes de cerrar las Tasks
6–11 y superar el preflight ambiental de Task 12.
