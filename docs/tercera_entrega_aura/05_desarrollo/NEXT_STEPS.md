# Next steps - tercera entrega AURA

Este archivo es el punto de continuacion para el desarrollo.

## Prioridad 1 - Sincronizar motor determinista y glosario

Objetivo: que OE2 quede defendible como capa factual.

Tareas:

1. Hecho: `04_resultados/catalogo_reglas_motor_determinista.md` ya esta sincronizado con la logica vigente de R07.
2. Completar fichas R01-R06 y R08-R10 en `10_glosario/glosario_reglas_deterministas_aura.md`.
3. Ejecutar `npm test` desde `src`.
4. Exportar o actualizar tabla por regla si existe script de validacion.

Criterio de cierre:

- catalogo y glosario no contradicen `src/services/auditEngine.ts`;
- tests verdes;
- cambios documentados en el borrador si alteran claims.

## Prioridad 2 - Cerrar tabla de resultados deterministas

Objetivo: convertir el motor en resultado academico, no solo implementacion.

Tareas:

1. Generar tabla con TP, FP, FN, precision, recall y F1 por regla.
2. Separar resultados por dataset: sintetico, Titanic y datasets sucios internos si aplica.
3. Explicar falsos positivos como evidencia de necesidad de capa cognitiva.

Criterio de cierre:

- tabla en `04_resultados/`;
- fuente reproducible indicada;
- limite metodologico escrito.

## Prioridad 3 - Ejecutar benchmark LLM solo si hay proveedor real

Objetivo: no declarar benchmark formal sin evidencia.

Tareas:

1. Seleccionar proveedor disponible: Gemini/Groq/DeepSeek/Ollama/WebLLM/Chrome AI.
2. Ejecutar comparacion `smart_sample` vs `prompt_libre`.
3. Registrar estado de cada corrida: `attempted_failed`, `preliminary_valid` o `formal_valid`.
4. Exportar JSON y tabla.

Criterio de cierre:

- si no hay proveedor, documentar `attempted_failed`;
- si hay proveedor, guardar export y tabla;
- no afirmar modelo ganador sin corridas `formal_valid`.

## Prioridad 4 - Evidencia HITL y delta de salud

Objetivo: sostener OE5 y la utilidad aplicada.

Tareas:

1. Correr flujo completo con dataset seleccionado.
2. Generar script.
3. Validar safety score, cobertura y columnas.
4. Aprobar o rechazar con checklist HITL.
5. Exportar delta de salud.

Criterio de cierre:

- JSON de evidencia en `03_evidencia/results/`;
- tabla de delta en `04_resultados/`;
- si delta es cero, explicarlo sin maquillar.

## Prioridad 5 - Redaccion incremental

Objetivo: que la memoria avance al mismo ritmo que el producto.

Tareas:

1. Actualizar `01_borrador/BORRADOR_TERCERA_ENTREGA_AURA.md` despues de cada cierre tecnico.
2. Mover resultados formales a tablas.
3. Mantener claims permitidos/no permitidos.

Criterio de cierre:

- el borrador siempre refleja el estado real del repo;
- no hay promesas absolutas;
- todo resultado fuerte tiene evidencia.
