# Evidencia por objetivo específico

| Objetivo específico | Evidencia generada | Resultado observado | Limitación | Sección sugerida |
|---|---|---|---|---|
| OE1: Perfilar datasets localmente | Captura 01: carga y perfil de Titanic | Dataset procesado en navegador sin backend | No demuestra escalabilidad a archivos grandes | Marco teórico / Arquitectura |
| OE2: Detectar hallazgos con reglas deterministas | Captura 02: hallazgos de Titanic. Tabla 03: ground truth con F1 ≥ 0.90 | Hallazgos reproducibles; F1 validado contra referencia | FPs documentados en reglas de duplicados | Resultados / Validación |
| OE3: Restringir el diagnóstico a evidencia | Capturas 03, 04: paquete de evidencia y diagnóstico estructurado | Diagnóstico limitado a hallazgos del motor | No se ejecutó LLM real en capturas (harness) | Diseño / Contratos |
| OE4: Separar diagnóstico de decisión humana | Capturas 05, 06: plan de remediación con HITL | Acciones aprobadas/rechazadas individualmente | No demuestra calidad de las decisiones humanas | Diseño / Gobernanza |
| OE5: Generar script determinista desde acciones aprobadas | Captura 07: script Python/Pandas renderizado | Código contiene `def clean_dataset` y transformaciones aceptadas | Script no ejecutado | Implementación / Script |
| OE6: Validar el contrato de script | Captura 08: validación y aprobación | Hash, verificación fresca y aprobación completadas | `syntax not_run` | Implementación / Validación |
| OE7: Bloquear aprobación ante manipulación | Captura 09: hash alterado → bloqueo | Aprobación bloqueada ante contrato manipulado | Solo se probó alteración de hash | Implementación / Seguridad |
| OE8: Comparar modelos de IA | Captura 10: laboratorio de modelos | Interfaz de comparación disponible | Benchmark formal no completado; resultados experimentales | Experimentación / Laboratorio |
