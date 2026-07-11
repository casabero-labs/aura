# Próximo paso de AURA

Ejecutar, en orden, la hoja de ruta definitiva:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)

Los Bloques 1 y 2 están cerrados. Las Tasks 1–5 del Bloque 3 ya congelaron la
base experimental OE4, los contratos de campaña y corrida, los tres modelos
formales, la telemetría nativa de Ollama y los tres contratos de entrada con
salida común `aura.diagnosis.v2`. El calendario determinista de 45 unidades y
15 warm-ups excluidos ya existe, y el corredor formal ejecuta la secuencia
simétrica diagnóstico → script con historial de intentos y reanudación por etapa.

El siguiente paso único es **Task 6 — persistir campañas en IndexedDB sin sobrescritura** en
`docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md`. Después se continúa en
orden hasta Task 12; no se rediseña la matriz ni se abren fases paralelas.

Bloque ambiental ya visible para Task 12: sincronizar cliente Ollama `0.31.1`
con servidor `0.20.3` e instalar los tres modelos formales antes del smoke real.
