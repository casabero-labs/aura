# Cierre OE4 Task 6 — persistencia de campañas

Fecha: 10 de julio de 2026.

## Resultado

Task 6 queda cerrada en código. AURA puede conservar una campaña completa, sus
45 corridas y el historial de cada intento sin reemplazar fallos anteriores.
Esto prepara el Laboratorio, pero todavía no ejecuta la campaña real.

## Qué quedó implementado

- Un contrato común de almacenamiento usado directamente por el corredor.
- Un almacén en memoria para pruebas rápidas y deterministas.
- Un almacén IndexedDB nativo para el navegador, sin añadir dependencias.
- Base `aura-experiment-lab-v1` con espacios separados para campañas, corridas,
  eventos y futuros artefactos.
- Creación de campaña y sus 45 corridas como una sola operación.
- Guardado conjunto del evento y del nuevo estado de la corrida.
- Rechazo de eventos repetidos antes de modificar información.
- Conservación del primer fallo cuando comienza un reintento enlazado.
- Recuperación del progreso al reconstruir el almacén.
- Selección de la siguiente corrida pendiente sin modificar las anteriores.
- El corredor ya no guarda `running` por separado antes del primer evento; ambos
  cambios quedan unidos para reducir estados incompletos ante un cierre brusco.

## Evidencia de validación

- Contrato ejecutado sobre memoria e IndexedDB: 14/14 pruebas.
- Integración corredor + almacén real: 1/1 prueba.
- Conjunto dependiente de Tasks 2, 5 y 6: 37/37 pruebas.
- Suite completa: 1654 aprobadas y 6 omitidas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; permanecen advertencias conocidas de tamaño de
  chunks e imports mixtos, sin error de compilación.

## Límite explícito

Vitest se ejecuta en Node y no incluye IndexedDB. La prueba del adaptador usa una
implementación controlada de la misma API, sin paquetes externos. La persistencia
en un navegador real se validará durante Task 11 junto con cierre, reapertura y
continuación del recorrido humano.

## Siguiente paso

Task 7 debe leer estas corridas y calcular las métricas automáticas de diagnóstico
y script, además de definir la rúbrica humana 0–4. No debe modificar las respuestas
crudas ni ejecutar todavía los modelos formales.
