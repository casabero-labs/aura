# Issue draft — L22 Ollama context overflow

## Objetivo

Corregir el fallo real actual de Ollama local:

```text
request (11256 tokens) exceeds the available context size (4096 tokens)
```

## Diagnóstico

Esto confirma que Ollama sí está conectado y que el modelo sí está siendo invocado. Ya no es problema de conexión ni de selección de modelo. El problema es que AURA está enviando un prompt demasiado grande para la ventana de contexto del modelo local.

## Causa probable en código

Los builders de prompt pueden enviar demasiada evidencia:

- todas las columnas;
- todos los hallazgos;
- JSON pretty printed;
- samples por columna;
- bad samples por issue.

Con datasets medianos, esto puede superar fácilmente 4096 tokens.

## Fix esperado

Implementar un modo compacto para Ollama:

1. Estimar tamaño del prompt antes de enviar.
2. Si provider = Ollama y prompt supera presupuesto seguro, usar prompt compacto.
3. Limitar columnas y hallazgos:
   - top N hallazgos por severidad;
   - top columnas con mayor riesgo;
   - samples truncados;
   - JSON compacto, no pretty JSON.
4. Añadir UI warning:

```text
El modelo local tiene una ventana de contexto limitada. AURA enviará una versión compacta del diagnóstico.
```

5. Opcional: permitir configurar `num_ctx` para Ollama, pero no depender solo de eso.

## Tests esperados

- prompt compacto genera menos caracteres/tokens que prompt recomendado;
- provider Ollama usa prompt compacto si supera presupuesto;
- error `exceeds the available context size` se normaliza como `context_window_exceeded`, no como modelo rechazado genérico;
- no se toca auditEngine ni scoring.
