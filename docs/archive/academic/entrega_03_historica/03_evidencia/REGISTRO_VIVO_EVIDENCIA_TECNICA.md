# Registro vivo de evidencia técnica — Tercera entrega AURA

> Propósito: conservar, durante el desarrollo, los avances que pueden transformarse en evidencia académica. Cada entrada distingue lo demostrado, su utilidad para el TFM y lo que todavía no puede afirmarse.

## 2026-06-24 — Validación del asistente de configuración de Ollama

### Identificación

- Commit verificado: `1eed86555b7ef53c9fe26bfe1d707d785e4d20c6`
- Mensaje: `test: validate real Ollama wizard source`
- Archivo modificado: `src/__tests__/ollamaWizardHtml.test.ts`
- Archivo productivo validado: `src/public/ollama-setup.html`

### Cambio realizado

La prueba dejó de validar cadenas HTML simuladas dentro del propio test. Ahora lee directamente el archivo productivo `ollama-setup.html` mediante `readFileSync`, por lo que una regresión en la página real puede romper la suite.

La prueba comprueba que:

1. `runOllamaDiagnostic` existe una sola vez;
2. la implementación antigua `async function connect` no existe;
3. el botón de conexión invoca `runOllamaDiagnostic`;
4. el botón de reintento invoca la misma función;
5. el flujo muestra el panel de diagnóstico mediante `showDiagWrap(true)`;
6. los mensajes genéricos antiguos fueron retirados.

### Resultado reportado

- `npm test`: 316 passed, 6 skipped, 0 failed.
- `npm run build`: compilación correcta.

### Verificación independiente

La revisión del commit confirma que únicamente se modificó el test y que este consulta el archivo HTML real. La página productiva contiene la función `runOllamaDiagnostic`, muestra los pasos de diagnóstico y enlaza los botones `connect-btn` y `retry-btn` con esa función.

### Relación con los objetivos

- **OE1, arquitectura local-first:** fortalece la confiabilidad del flujo de configuración de un proveedor local.
- **OE3, diagnóstico restringido:** mejora la preparación operativa para ejecutar diagnósticos con Ollama sin depender de un proveedor cloud.
- **Usabilidad y reproducibilidad:** el asistente explica sistema operativo, origen autorizado, endpoint, modelo y estado de conexión de forma guiada.

### Qué demuestra

- La prueba automatizada está acoplada al archivo productivo y no a una copia artificial.
- La estructura principal del asistente de Ollama queda protegida frente a regresiones de nombres, listeners y mensajes.
- El software incluye un mecanismo guiado para preparar inferencia local.

### Qué no demuestra todavía

- No demuestra que Ollama esté disponible en el equipo del usuario.
- No demuestra una conexión real con `/api/tags` o `/api/chat`.
- No constituye una corrida LLM válida ni un resultado de benchmark.
- No demuestra latencia, calidad diagnóstica ni privacidad absoluta.

### Evidencia pendiente

Cuando se realice la validación funcional local:

1. ejecutar el asistente con Ollama activo;
2. conservar modelo, endpoint, fecha y versión del código;
3. registrar el resultado de `/api/tags` y `/api/chat`;
4. tomar una captura del diagnóstico exitoso o del fallo clasificado;
5. guardar la corrida como `preliminary_valid` o `attempted_failed`, según corresponda.

### Redacción natural para el capítulo 5

El asistente de Ollama actúa como una guía de conexión local. En lugar de pedir al usuario que configure manualmente todos los detalles, identifica el sistema operativo, muestra el origen que debe autorizarse, permite seleccionar el endpoint y el modelo, y ejecuta una secuencia de comprobaciones. Estas comprobaciones verifican si la página se encuentra en un contexto seguro, si la dirección corresponde a un equipo local, si Ollama responde, si la política CORS permite la conexión, si el modelo está instalado y si el endpoint de conversación devuelve una respuesta. La prueba incorporada en este cierre no simula una copia del asistente, sino que inspecciona el archivo utilizado realmente por la aplicación, reduciendo el riesgo de que la documentación de prueba se separe del comportamiento productivo.

### Clasificación de evidencia

`implemented_and_tested`

No se eleva a `preliminary_valid` hasta completar una conexión real documentada.
