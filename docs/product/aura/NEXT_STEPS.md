# Hoja de ruta definitiva de AURA

Última actualización: 13 de julio de 2026, 18:35 (America/Bogota).

Este documento es la única referencia operativa para cerrar el TFM. La entrega
académica vence el **miércoles 15 de julio de 2026 a las 15:00**. Hasta entregar,
la prioridad es producir evidencia diagnóstica real, consolidar resultados y
terminar el documento. El desarrollo adicional de AURA continuará después.

## Objetivo de cierre académico

Entregar evidencia suficiente y honesta de que AURA:

1. ingiere y perfila un CSV localmente;
2. detecta problemas mediante reglas deterministas;
3. restringe el diagnóstico LLM a la evidencia observada;
4. permite comparar modelos y métodos de entrada;
5. conserva resultados, métricas y trazabilidad para análisis;
6. genera un informe defendible y exportable.

Estos son los **seis objetivos específicos definitivos**. No se reformulan en
esta fase; en el documento se verificará su grado de cumplimiento con evidencia.

## Estado congelado al inicio del cierre

| Área | Estado para el TFM |
|---|---|
| Motor determinista | Cerrado y utilizable. |
| Diagnóstico normal V2 | Funcional con evidencia válida en `flujo4`. |
| Informe PDF y exportación | Funcionales; existe ZIP de evidencia. |
| Plan y script | Implementados con revisión humana. |
| Aplicar y verificar | Integrado mediante PR #36; suficiente para esta entrega. |
| Laboratorio | Preparado para piloto y campaña real. |
| Evaluación formal | Pendiente de ejecutar. Es la prioridad inmediata. |
| Documento final | Pendiente de resultados y consolidación. |

## Decisiones congeladas para las pruebas

- Dataset: `controlled_customers_phase8.csv`.
- Modelos:
  - `hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL`.
- Métodos: `prompt_libre`, `smart_sample` y `recommended`.
- Prueba previa: Qwen x 3 métodos x 1 ejecución = **3 diagnósticos exploratorios**.
- Campaña formal prevista: 3 modelos x 3 métodos x 3 repeticiones = **27 diagnósticos**.
- La reducción de 45 a 27 conserva tres observaciones por combinación y reduce
  el tiempo de ejecución. Se declarará como evaluación descriptiva de muestra pequeña.
- El score y los hallazgos pertenecen al motor determinista; el LLM no los modifica.
- Un fallo se conserva como resultado. No se repite silenciosamente para ocultarlo.
- No se cambia dataset, modelo, método o parámetros después de iniciar la campaña formal.

## Plan urgente hasta el depósito

### Lunes 13, 18:00-21:00 — prueba previa y control de evidencia

1. Confirmar que Ollama y los tres modelos estén disponibles.
2. Ejecutar con Qwen un diagnóstico normal por cada método de entrada.
3. Guardar los tres ZIP en `experiments/tests/flujo5/` y verificar que cada uno conserve prompt, respuesta, modelo observado,
   recibo, latencia, errores y evaluación automática.
4. Corregir cualquier bloqueo común antes de congelar el protocolo formal.
5. Corregir únicamente bloqueos que impidan una corrida real. No pulir UI ni
   añadir contratos o métricas nuevas.

Condición de salida: las tres entradas de Qwen terminan y sus ZIP permiten
compararlas sin evidencia faltante.

### Lunes noche / martes mañana — campaña formal

Si la prueba previa confirma que la ejecución y exportación funcionan:

1. congelar la configuración;
2. ajustar y congelar el protocolo en 27 diagnósticos evaluados y 9 calentamientos;
3. ejecutar los diagnósticos y calentamientos definidos por el protocolo;
4. exportar la campaña completa;
5. verificar denominadores, combinaciones y corridas fallidas;
6. conservar una copia inmutable de los artefactos.

Si la campaña completa queda bloqueada, no se inventarán resultados: se usará
el piloto como evaluación exploratoria y se declarará la limitación.

### Martes 14 — consolidación y redacción

1. Generar la tabla modelo x método.
2. Consolidar precisión, recall, F1, cumplimiento del contrato, claims sin
   soporte, anclaje, latencia, errores y estabilidad.
3. Redactar resultados del objetivo experimental.
4. Contrastar los seis objetivos específicos con la evidencia disponible.
5. Redactar discusión, limitaciones, amenazas a la validez y conclusiones.
6. Incorporar figuras y tablas al documento final.

### Miércoles 15, 08:00-12:00 — cierre del documento

1. Revisión completa de coherencia entre objetivos, método, resultados y conclusiones.
2. Revisar numeración, referencias, tablas, figuras y anexos.
3. Exportar PDF final y verificarlo visualmente.
4. Preparar carpeta de entrega y copia de respaldo.
5. Congelar cambios a las 12:00 para conservar tres horas de margen.

## Trabajo diferido después del depósito

No bloquea el documento del miércoles:

- #32: reauditoría completa del CSV corregido;
- #33: ampliar JSON y ZIP de remediación;
- #34: QA integral y pulido final;
- mejoras adicionales de hashes, contratos y recibos que no bloqueen corridas;
- pulido visual menor de la rama opcional;
- nuevas reglas, datasets, proveedores o modelos;
- mejoras productivas previstas para el mes de desarrollo restante.

## Métricas que sí deben llegar al TFM

- precisión, recall y F1 del diagnóstico;
- cumplimiento del contrato;
- columnas inventadas y claims sin soporte;
- anclaje a reglas y muestras problemáticas;
- latencia, tokens, errores y estabilidad;
- claridad, trazabilidad y accionabilidad humana cuando se mida;
- score e issues antes/después únicamente si existe ejecución verificada.

No se declarará un ganador universal. Las conclusiones se limitarán al dataset,
los modelos, los métodos y las condiciones realmente evaluadas.

## Próxima acción exacta

**Completar primero `flujo5`: Qwen con `prompt_libre`, `smart_sample` y
`recommended`. No iniciar todavía la campaña formal.** El orquestador revisará
los tres ZIP y autorizará el cambio definitivo del protocolo a 27 corridas solo
si la prueba no revela un bloqueo que obligue a repetirlas.

## Documentos vigentes relacionados

- [Plan de cierre del diagnóstico normal y PDF](../../plans/2026-07-12-cierre-diagnostico-normal-y-reporte-pdf.md)
- [Contrato del paquete completo de evidencia](contracts/aura-evidence-package-v1.md)
- [Protocolo del Laboratorio](../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md)
