# Hoja de ruta definitiva de AURA

Última actualización: 13 de julio de 2026, 21:45 (America/Bogota).

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
| Diagnóstico normal V2 | Conserva el contrato completo y ahora identifica explícitamente el truncamiento informado por Ollama. Pendiente repetir smoke con el dataset controlado simple. |
| Informe PDF y exportación | Funcionales; el ZIP incluye diagnóstico, script, ejecución, CSV corregido y reauditoría cuando la corrida se completa. |
| Plan y script | Implementados de forma determinista con revisión humana. El LLM no escribe código ejecutable. |
| Aplicar y verificar | Cerrado técnicamente: runner Python real, recibo, CSV corregido, reauditoría antes/después y ZIP completo. Pendiente una corrida humana final. |
| Laboratorio | Preparado para piloto y campaña real. |
| Evaluación formal | Pendiente de ejecutar. Es la prioridad inmediata. |
| Documento final | Pendiente de resultados y consolidación. |

## Decisiones vigentes para la prueba piloto

Estas decisiones se validarán con las tres corridas de Qwen. El protocolo
formal V2.1 todavía referencia Phase 8 y **no debe ejecutarse**. Si el piloto
termina correctamente, se creará una única versión nueva del protocolo con el
dataset, hashes, oracle, 27 diagnósticos y 9 calentamientos definitivos.

- Dataset de cierre: `synthetic_ground_truth.csv` (15 filas, 9 columnas y ground truth explícito).
- `controlled_customers_phase8.csv` se conserva como prueba de estrés posterior;
  no será el dataset de la campaña del TFM porque su salida estructurada excedió
  la capacidad práctica del modelo local probado.
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
- `done_reason=length` se conserva como `DIAGNOSIS_RESPONSE_TRUNCATED`; no se
  intenta reparar ni certificar un JSON incompleto.
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

El primer intento `smart_sample` de `flujo5` con Phase 8 alcanzó el límite de
salida de 4096 tokens y produjo un JSON incompleto. No fue un fallo del motor
determinista. No se recortará la evidencia para forzar la prueba: el smoke se
repetirá con `synthetic_ground_truth.csv`, cuyo perfil completo genera 15
hallazgos, y Phase 8 quedará documentado como prueba de estrés y limitación.

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

## Cierre técnico alcanzado el 13 de julio

La rama opcional de remediación quedó conectada de extremo a extremo:

1. el diagnóstico LLM queda limitado a evidencia observada;
2. AURA construye el plan y el script Python de forma determinista;
3. la persona aprueba las acciones y el script;
4. el runner local valida sintaxis y ejecuta Python/Pandas sobre una copia;
5. AURA valida `corrected.csv` y `receipt.json`;
6. AURA reaudita el resultado con el mismo motor determinista;
7. el ZIP incorpora script, bundle, recibo, CSV corregido, reauditoría y resumen antes/después.

Gates repetidos por el orquestador sobre `48f302d`:

- 195/195 pruebas focalizadas;
- typecheck y build correctos;
- 3/3 E2E con runner y ZIP reales;
- recibo alterado rechazado;
- ausencia de `source.csv`, tamper y `force:true`.

## Trabajo diferido después del depósito

No bloquea el documento del miércoles:

- #34: QA integral y pulido final;
- mejoras adicionales de hashes, contratos y recibos que no bloqueen corridas;
- pulido visual menor de la rama opcional;
- nuevas reglas, datasets, proveedores o modelos;
- recomendación de modelo y método después del perfil, basada en columnas,
  hallazgos, tamaño estimado de entrada/salida y recursos locales disponibles;
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

**Publicar los commits aprobados y realizar una única corrida humana completa
con `synthetic_ground_truth.csv`: diagnóstico → plan → aprobación → script →
runner local → importación → reauditoría → ZIP.** Después de verificar ese ZIP,
continuar `flujo5` con Qwen en `prompt_libre`, `smart_sample` y `recommended`.
No iniciar todavía la campaña formal.

## Documentos vigentes relacionados

- [Plan de cierre del diagnóstico normal y PDF](../../plans/2026-07-12-cierre-diagnostico-normal-y-reporte-pdf.md)
- [Contrato del paquete completo de evidencia](contracts/aura-evidence-package-v1.md)
- [Protocolo del Laboratorio](../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md)
- [Texto para limitaciones del LLM local en el TFM](documentation/TFM_LIMITACIONES_LLM_LOCAL.md)
