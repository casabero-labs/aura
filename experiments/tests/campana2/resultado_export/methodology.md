# Metodología del Laboratorio AURA

## Referencia controlada

Alineación exacta ruleId + columnId + scope contra el ground truth congelado del dataset controlado.

Precisión, recall y F1 miden alineación con el ground truth conocido. Como el contrato exige cubrir el registro canónico, estas métricas se conservan como control descriptivo y no reciben peso en el índice equilibrado.

## Índice equilibrado

- Fiabilidad: 35 %
- Soporte de evidencia: 25 %
- Seguridad frente a claims sin soporte: 20 %
- Eficiencia: 20 %
- Alineación con GT: 0 %
- Contrato: 0 %; actúa como gate de validez.

Precisión, recall y F1 describen alineación con un registro de hallazgos conocido y exigido por contrato; por eso no aportan peso al índice equilibrado. El cumplimiento del contrato actúa como condición de validez, no como premio doble. El índice repondera únicamente fiabilidad, evidencia, seguridad frente a claims sin soporte y eficiencia. Es ayuda de decisión para esta campaña, no una afirmación de superioridad universal.

## Alcance

La recomendación aplica a este dataset, estos modelos, estos parámetros y el hardware capturado. No declara un ganador universal.
