# Próximo paso de AURA

Ejecutar, en orden, la hoja de ruta definitiva:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)

Los Bloques 1 y 2 están cerrados. Las Tasks 1–8 del Bloque 3 ya congelaron la
base experimental OE4, los contratos de campaña y corrida, los tres modelos
formales, la telemetría nativa de Ollama y los tres contratos de entrada con
salida común `aura.diagnosis.v2`. El calendario determinista de 45 unidades y
15 warm-ups excluidos ya existe, y el corredor formal ejecuta la secuencia
simétrica diagnóstico → script con historial de intentos y reanudación por etapa.
Las campañas, sus 45 corridas y cada intento ya pueden conservarse mediante un
almacén temporal de pruebas o IndexedDB en el navegador, sin sobrescribir fallos.
Las salidas guardadas ya pueden evaluarse por separado en diagnóstico,
operación, script y rúbrica humana; el score compuesto quedó identificado
únicamente como exploratorio.
La mediana F1 elige ahora un representante reproducible por cada una de las
nueve celdas modelo–modo. Ningún script puede prepararse para Colab sin una
decisión HITL aprobada, y el CSV devuelto conserva fingerprint exacto,
reauditoría y comparación antes/después sin modificar la fuente.

El laboratorio operativo anterior y la calibración incrustada fueron retirados
intencionalmente: no usaban el protocolo OE4 ni se reutilizarán. La futura
consola formal se construirá desde cero en Task 10 sobre las Tasks 1–9.

El siguiente paso único es **Task 9 — generar el expediente TFM desde una fuente canónica** en
`docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md`. Después se continúa en
orden hasta Task 12; no se rediseña la matriz ni se abren fases paralelas.

Bloque ambiental ya visible para Task 12: sincronizar cliente Ollama `0.31.1`
con servidor `0.20.3` e instalar los tres modelos formales antes del smoke real.
