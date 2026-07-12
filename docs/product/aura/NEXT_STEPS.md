# Próximo paso de AURA

La hoja de ruta vigente es:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)
- Corrección comprobable de los issues 26 y 27:
  [`docs/plans/2026-07-11-issues-26-27-ruta-v2-unica.md`](../../plans/2026-07-11-issues-26-27-ruta-v2-unica.md)

## Estado actual

AURA ya tiene una única ruta V2 para el diagnóstico normal y la evaluación
OE4. Los tres métodos producen un snapshot canónico distinto y conservan un
recibo verificable con método, secciones, prompt, hashes, modelo, digest y
parámetros observados.

El protocolo ejecutable es `aura.oe4.final-evaluation.v2`:

- 3 modelos × 3 métodos × 5 repeticiones = 45 diagnósticos evaluados;
- 15 calentamientos reales, uno por bloque de modelo, excluidos de las métricas;
- 60 llamadas reales en total;
- ninguna llamada LLM para generar scripts;
- 9 scripts deterministas, uno por representante seleccionado mediante la
  mediana del F1, siempre después de revisión y aprobación humana.

La consola `Evaluación OE4` ya puede crear una campaña productiva desde
`controlled_customers_phase8.csv`. Antes de crearla verifica el hash del CSV,
la versión de Ollama, los tres modelos y sus digests. Cada salida pasa por el
validador completo `aura.diagnosis.v2` y por el oráculo diagnóstico. Las claves
API no se guardan en localStorage ni se sincronizan al backend.

El SHA-256 del dataset se calcula sobre los bytes reales del archivo; no se
confunde con el fingerprint operativo corto de la interfaz. Los calentamientos
guardan su propio recibo en IndexedDB para no repetirse al recargar la página.

## Lo único que falta

1. Terminar los gates técnicos de esta corrección: suite completa, typecheck,
   build, smokes y actualización del grafo.
2. Instalar/verificar los tres modelos formales en Ollama.
3. Ejecutar primero los smokes reales: 1×3×1 y 3×1×1.
4. Si ambos pasan, ejecutar manualmente la campaña completa de 45 diagnósticos.
5. Evaluar la rúbrica humana, aprobar o rechazar los nueve representantes,
   ejecutar los scripts aprobados sobre copias y reauditar.
6. Exportar el expediente final y redactar el documento de depósito.

No se debe iniciar la campaña completa si falla la igualdad de hashes, cambia
el modelo observado, falta un calentamiento o una respuesta no supera el
contrato completo.
