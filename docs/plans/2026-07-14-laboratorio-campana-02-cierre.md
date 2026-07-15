# Cierre del Laboratorio antes de la segunda campaña

## Objetivo

Cerrar el Laboratorio como evaluador reproducible de modelos y métodos de entrada usando un dataset controlado con ground truth, sin mezclar la remediación del pipeline normal.

**Estado:** implementación cerrada y validada el 14 de julio de 2026. La siguiente acción es desplegar y crear una campaña nueva con el protocolo `2.6.0`.

## Alcance congelado

1. Corregir falsos positivos de claims sin soporte usando únicamente la evidencia visible para cada modo de entrada.
2. Presentar F1 como alineación con el ground truth conocido, no como descubrimiento independiente.
3. Reequilibrar la recomendación automática hacia confiabilidad, soporte de evidencia, seguridad frente a alucinaciones y eficiencia.
4. Permitir seleccionar cualquier resultado y convertirlo en una configuración exacta para el próximo diagnóstico normal.
5. Completar la lectura de resultados con visualizaciones D3, resumen, metodología, glosario y exportables trazables.
6. Registrar el cambio en el Historial público sin referencias internas al TFM u OE4.
7. Preservar la primera campaña como piloto y congelar un protocolo nuevo para la segunda campaña.

## Fuera de alcance

- No cambiar el motor determinista, el ground truth ni el score de calidad del dataset.
- No cambiar el contrato del diagnóstico normal salvo la configuración seleccionada explícitamente por el usuario.
- No incorporar script, HITL, Python o reauditoría al Laboratorio.
- No alterar las carpetas `experiments/tests/flujo8/`, `experiments/tests/test_campaña/` ni capturas existentes del flujo de remediación.

## Implementación y pruebas

### 1. Claims respaldados

- Añadir pruebas TDD para valores visibles por `issueId`, fechas, negativos, valores enmascarados y hashes de privacidad.
- Mantener cierre estricto: una muestra no enviada por el modo de entrada no puede respaldar un claim.

### 2. Metodología de puntuación

- Mantener precisión, recall y F1 como control de alineación con GT.
- Evitar que una cobertura exigida por contrato domine la recomendación final.
- Publicar fórmula, pesos, datos ausentes y limitaciones en UI y exportación.

### 3. Configuración transferible

- Crear un contrato serializable con modelo, método de entrada y parámetros de inferencia.
- Seleccionar desde matriz o gráficos.
- Copiar configuración, aplicarla al próximo diagnóstico y navegar a Auditoría sin iniciar automáticamente.
- Verificar que el modelo exista en Ollama antes de aplicarlo.

### 4. Resultados y exportación

- Añadir resumen JSON, metodología Markdown, glosario Markdown y configuración seleccionada JSON.
- Mantener hashes y tamaños en `manifest.json`.
- Añadir un glosario en lenguaje sencillo dentro del Laboratorio.

### 5. Evidencia y cierre

- Pruebas focalizadas, suite completa, typecheck, build y E2E.
- Capturas de resultados, dimensiones, calidad/velocidad y configuración seleccionada.
- Actualizar Graphify.
- Commit y push únicamente con todos los gates en verde.

## Condición para iniciar la segunda campaña

La segunda campaña solo comienza cuando el protocolo nuevo, la metodología, la selección de configuración, los exportables y el recorrido E2E estén validados y publicados.
