# Task 10 - consola formal OE4

## Estado al 11 de julio de 2026

Task 10 está cerrada. AURA incorpora una superficie nueva llamada
`Evaluación OE4`; no restaura el laboratorio operativo retirado.

La consola permite:

- crear y conservar una campaña formal de 45 unidades mediante el contrato de preparación;
- iniciar, pausar entre corridas y reanudar sin perder intentos;
- ver la matriz 3 × 3, salidas crudas, métricas y anclajes;
- registrar la rúbrica humana 0–4;
- aprobar o rechazar representantes sin cambiarlos por resultados más cómodos;
- importar el CSV externo y mostrar el antes/después cuando la integración está disponible;
- exportar los cinco artefactos solo cuando todos los gates formales pasan.

La aplicación real mantiene bloqueada la creación mientras no exista el recibo
de preflight formal. Instalar modelos, sincronizar Ollama y ejecutar la campaña
real siguen perteneciendo a Task 12.

## Validación

- Pruebas focales: 33/33.
- Suite completa: 1690 aprobadas y 6 omitidas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto, con avisos no bloqueantes ya conocidos sobre chunks.
- Navegador, escritorio y móvil: vista accesible, sin errores de consola ni
  desbordamiento horizontal.

Task 11 es el siguiente frente: validar recuperación y recorrido completo E2E.
