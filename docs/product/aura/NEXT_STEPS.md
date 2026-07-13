# Hoja de ruta definitiva de AURA

Última actualización: 12 de julio de 2026.

Este documento es la única referencia operativa para cerrar AURA. El historial
de correcciones queda en Git y en los planes anteriores; aquí solo se conserva
el estado vigente y el trabajo que falta.

## Objetivo de cierre

Entregar AURA como un sistema local-first que:

1. audita un CSV con reglas deterministas;
2. produce un diagnóstico LLM restringido por evidencia;
3. genera un informe defendible y un expediente técnico verificable;
4. propone un plan y un script reproducible bajo revisión humana;
5. ejecuta la corrección sobre una copia y comprueba el resultado;
6. evalúa modelos y métodos de entrada mediante el Laboratorio.

Estos son los **seis objetivos específicos definitivos**. No se deben volver a
reformular durante el cierre.

## Estado actual confirmado

| Área | Estado | Qué significa |
|---|---|---|
| Motor determinista | Cerrado | Audita, calcula el score y conserva evidencia reproducible. |
| Diagnóstico normal V2 | Cerrado con Qwen | `flujo4` produjo 15 hallazgos, 15 bloques, modelo observado correcto y recibo válido. |
| Informe PDF | Cerrado | PDF `showcase-ink` revisado visualmente, sin cortes ni afirmaciones infladas. |
| Exportación | Cerrada en código | PDF, JSON y CSV comparten identidad; existe un ZIP completo de evidencia. |
| Plan y script | Cerrado | AURA genera el script de forma determinista y exige revisión humana; el LLM no escribe código. |
| Aplicar y verificar | Pendiente | Todavía falta ejecutar el script sobre una copia, validar el recibo y reauditar. |
| Laboratorio | Preparado, sin campaña real | Protocolo, contratos, métricas, persistencia y exportadores están implementados. |
| Evaluación formal | Pendiente | No se han ejecutado los smokes ni las 45 corridas formales. |
| Documento final TFM | Pendiente de resultados | Se redactará con la evidencia real de la campaña y la remediación verificada. |

Gate técnico actual: 1.774 pruebas aprobadas, 6 omitidas, typecheck y build
correctos, 9 recorridos Playwright aprobados y grafo actualizado.

## Decisiones congeladas

- Modelos formales:
  - `hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL`;
  - `hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL`.
- Métodos de entrada: `prompt_libre`, `smart_sample` y `recommended`.
- Campaña: 3 modelos × 3 métodos × 5 repeticiones = **45 diagnósticos**.
- Calentamientos: 15 en total, excluidos de las métricas.
- Llamadas reales previstas: 60, contando diagnósticos y calentamientos.
- Scripts de evaluación: 9 representantes, uno por combinación modelo × método.
- Dataset controlado: `controlled_customers_phase8.csv`.
- El score y los hallazgos pertenecen al motor determinista; el LLM no los modifica.
- La remediación siempre requiere revisión humana y nunca modifica el CSV original.
- DeepSeek no forma parte de la matriz final.

## Hoja de ruta restante

### 1. Implementar “Aplicar y verificar” en el flujo normal

Es el siguiente trabajo de desarrollo y el único bloque funcional importante
que falta en la auditoría normal.

Debe permitir:

- preparar una ejecución Python/Pandas desde el script aprobado;
- enlazar el bundle con el SHA-256 del CSV original y el hash del script;
- ejecutar siempre sobre una copia;
- producir `corrected.csv` y un recibo Python;
- importar juntos el CSV corregido y el recibo;
- validar hashes, versiones, sintaxis y ejecución;
- reauditar el resultado;
- mostrar score, hallazgos resueltos, persistentes y nuevos;
- añadir al ZIP el script, bundle, recibo, CSV corregido y comparación antes/después.

Condición de salida: AURA debe mostrar **“Ejecución verificada; resultado
reauditable”**. No debe afirmar que el dataset es correcto para el negocio.

### 2. Realizar una corrida normal final con Gemma

Después de desplegar el paso anterior:

- repetir el mismo dataset y método usados en `flujo4`;
- confirmar modelo solicitado = modelo observado;
- revisar PDF, JSON, CSV y ZIP;
- guardar la evidencia como un nuevo flujo;
- no repetir Qwen salvo que una modificación posterior invalide `flujo4`.

Condición de salida: Qwen y Gemma tienen corridas normales válidas sobre el
cierre actual.

### 3. Ejecutar los dos smokes del Laboratorio

El usuario realizará las corridas reales cuando el orquestador indique el paso
a paso.

1. **1 × 3 × 1:** Qwen con los tres métodos, una repetición por método.
2. **3 × 1 × 1:** los tres modelos con `recommended`, una repetición por modelo.

Cada corrida debe conservar snapshot, prompt, respuesta, modelo observado,
recibo, métricas y errores. Un fallo se registra como evidencia; no se sustituye
silenciosamente.

Condición de salida: las seis corridas smoke terminan sin problemas de modelo,
contrato, persistencia o exportación.

### 4. Ejecutar la campaña formal

Solo si los dos smokes pasan:

- ejecutar 45 diagnósticos y 15 calentamientos;
- no cambiar modelos, parámetros, dataset ni protocolo durante la campaña;
- conservar cada corrida en el Laboratorio;
- verificar que los denominadores del reporte coincidan con las corridas reales.

Condición de salida: campaña completa, persistida y exportable sin corridas
faltantes ni mezcladas.

### 5. Evaluar los nueve representantes

Para cada combinación modelo × método:

- seleccionar el representante definido por el protocolo;
- completar la evaluación humana de claridad, trazabilidad y accionabilidad;
- aprobar o rechazar el plan y el script;
- ejecutar solamente los scripts aprobados;
- validar el recibo Python y reauditar el CSV resultante.

Las métricas consolidadas serán:

- precisión, recall y F1 del diagnóstico;
- cumplimiento del contrato;
- columnas inventadas y claims sin soporte;
- anclaje a reglas y muestras problemáticas;
- latencia, tokens, errores y estabilidad;
- validez, seguridad y cobertura del script;
- score e issues antes/después;
- claridad, trazabilidad y accionabilidad humana en escala 0–4.

### 6. Consolidar resultados y cerrar el TFM

El Laboratorio debe generar el reporte consolidado. Con ese expediente se hará:

- tabla comparativa de modelos y métodos;
- resultados del OE4;
- evidencia de revisión humana y scripts del OE5/OE6;
- discusión de límites y fallos;
- conclusiones sin declarar un ganador universal;
- actualización del documento final de entrega.

Condición de salida: resultados reproducibles, anexos completos y documento de
depósito coherente con los seis objetivos.

## Bloqueos vigentes

- No ejecutar las 45 corridas antes de completar “Aplicar y verificar”, la
  corrida normal Gemma y los dos smokes.
- No presentar un script revisado como ejecutado sin recibo Python.
- No presentar las vistas SVG del ZIP como capturas reales del navegador.
- No incluir el CSV original ni credenciales en el expediente de evidencia.
- No cambiar la matriz de modelos o el protocolo durante una campaña iniciada.

## Próxima acción exacta

**Implementar “Aplicar y verificar” en el flujo normal reutilizando el ejecutor
Python/Pandas y el recibo ya probados en el Laboratorio, sin acoplar el flujo
normal a `ExperimentRunV1`.**

Al terminar ese bloque se actualizará esta hoja, se desplegará y se acompañará
al usuario en la corrida normal Gemma. La campaña formal continúa bloqueada
hasta entonces.

## Documentos vigentes relacionados

- [Plan de cierre del diagnóstico normal y PDF](../../plans/2026-07-12-cierre-diagnostico-normal-y-reporte-pdf.md)
- [Contrato del paquete completo de evidencia](contracts/aura-evidence-package-v1.md)
- [Protocolo del Laboratorio](../../plans/2026-07-10-laboratorio-oe4-evaluacion-llm.md)
