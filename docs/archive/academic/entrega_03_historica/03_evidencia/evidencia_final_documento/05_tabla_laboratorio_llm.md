# Laboratorio de comparación de modelos

| Modelo / proveedor | Estado de evidencia | Repeticiones | Latencia | Cumplimiento de formato | Alucinaciones o referencias inválidas | Observación académica |
|---|---|---|---|---|---|---|
| DeepSeek (cloud) | Ejecutado en desarrollo | Variable según sesión | ~2-8s | Alto: respeta formato JSON estructurado | Bajas: sigue el contrato de diagnóstico | Proveedor principal en pruebas de desarrollo |
| Gemini (Google) | Ejecutado en desarrollo | Variable según sesión | ~3-10s | Medio-alto: ocasionalmente añade campos extra | Bajas-moderadas: puede incluir columnas no referenciadas | Disponible como alternativa cloud |
| Ollama (local) | Smoke test | 1-2 por modelo | Depende del hardware | Variable según modelo | Moderadas: modelos pequeños tienden a alucinar más | Solo para entornos sin conexión |
| WebLLM (local) | Experimental | Limitadas por memoria | Lento en hardware sin GPU | Bajo en modelos pequeños | Altas en modelos pequeños | Depende de WebGPU; no recomendado para producción |
| Chrome Prompt API | Experimental | Pocas pruebas | Rápido | Medio: API experimental | Moderadas | Solo disponible en Chrome Canary |

> **Nota académica:** El laboratorio de modelos permite comparar proveedores bajo condiciones controladas, pero NO constituye un benchmark formal. No se declara un modelo ganador. Las métricas de latencia y cumplimiento varían entre ejecuciones y dependen de las condiciones de red y hardware. Para declarar superioridad de un modelo sobre otro, se requiere un protocolo de benchmark con al menos 30 repeticiones por modelo, mismos prompts y mismo dataset, condiciones que no se cumplen en esta fase del proyecto.
