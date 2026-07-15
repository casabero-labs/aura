# Protocolo de la segunda campaña

## Identidad

- Protocolo: `aura.oe4.final-evaluation.v2`
- Versión: `2.6.0`
- Dataset: `synthetic_ground_truth.csv`
- Matriz: 3 modelos × 3 entradas × 3 repeticiones
- Diagnósticos evaluados: 27
- Calentamientos excluidos: 9

## Modelos

1. `hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`
2. `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL`
3. `hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL`

## Entradas

1. Contexto mínimo (`prompt_libre`)
2. Evidencia equilibrada (`smart_sample`)
3. Evidencia completa (`recommended`)

## Parámetros

La interfaz permite elegir `numCtx` y `numPredict` antes de crear la campaña. El snapshot completo incluye temperatura, `topP`, `think`, seed, keep alive y timeout. Después de crearla, todo queda congelado.

## Condiciones de aceptación

- las 27 unidades deben ser intentadas;
- los fallos deben conservar respuesta, error, modelo solicitado y observado, hashes y recibo;
- las corridas válidas deben tener evaluación automática;
- cada modelo observado debe corresponder al solicitado;
- la exportación debe contener nueve archivos y hashes verificables;
- el resultado seleccionado debe producir una configuración exacta aplicable a Auditoría.

## Recorrido humano

1. Abrir Laboratorio.
2. Verificar los modelos instalados.
3. Elegir el perfil de inferencia.
4. Crear la campaña 2.6.0.
5. Iniciar y observar el stream real del modelo.
6. Esperar los 27 intentos.
7. Abrir Visualizar resultados.
8. Seleccionar una combinación según el objetivo.
9. Revisar la configuración generada.
10. Exportar los nueve archivos.
