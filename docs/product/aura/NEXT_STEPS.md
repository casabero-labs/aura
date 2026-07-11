# Próximo paso de AURA

Ejecutar, en orden, la hoja de ruta definitiva:

- [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](../../plans/2026-07-09-cierre-definitivo-aura.md)

Los Bloques 1 y 2 están cerrados. Las Tasks 1–11 del Bloque 3 ya congelaron la
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

Task 9 ya está cerrada: una sola campaña produce `campaign.json`, `runs.csv`,
`report.md`, `report.pdf` y `manifest.json`. Sus 6 pruebas focales, typecheck,
build y revisión visual del PDF están correctos.

El laboratorio operativo anterior y la calibración incrustada fueron retirados
intencionalmente: no usaban el protocolo OE4 ni se reutilizarán. La consola
formal nueva ya existe como `Evaluación OE4` y trabaja sobre las Tasks 1–9.

Task 11 ya está cerrada: Chromium valida creación, pausa, recarga, reanudación,
rúbrica, HITL, preparación externa, importación, reauditoría y los cinco
artefactos finales. El proveedor controlado usado en esa prueba solo demuestra
el comportamiento de la interfaz y no cuenta como evidencia de modelos.

El siguiente paso único es **Task 12: preparar el entorno, ejecutar las 45
unidades reales y congelar el expediente final**. No se rediseña la matriz ni
se abren fases paralelas. Las pruebas reales del diagnóstico sobre el dataset y
el pipeline principal pertenecen a esa campaña.

Bloque ambiental verificado para Task 12: el servidor Ollama responde como
`0.20.3`, el CLI no está disponible en la terminal y solo está instalado
`qwen2.5:3b`. Primero se restaura/sincroniza el CLI y luego se instalan los tres
modelos formales antes del smoke real.
