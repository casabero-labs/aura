# Guia Ollama local para validacion AURA

Fecha de preparacion: 2026-06-23

## Objetivo

Dejar un proveedor LLM local funcional para validar AURA sin depender de Chrome AI ni de API cloud.

Modelo recomendado para esta fase:

- `qwen2.5:3b`
- Motivo: modelo pequeno para validacion local, multilingue, suficiente para diagnosticos estructurados iniciales y menos costoso en RAM que variantes de 7B o superiores.
- Uso previsto en AURA: diagnostico LLM restringido, comparacion `smart_sample` vs `prompt_libre`, y generacion inicial de criterios/script bajo validacion HITL.

Fuentes operativas:

- Descarga oficial de Ollama macOS: <https://ollama.com/download/mac>
- API base de Ollama: <https://docs.ollama.com/api/introduction>
- API de descarga de modelos: <https://docs.ollama.com/api/pull>
- Listado de modelos instalados: <https://docs.ollama.com/api/tags>
- Modelo `qwen2.5:3b`: <https://ollama.com/library/qwen2.5:3b>

## Estado local observado

En esta maquina:

- `ollama` esta instalado por Homebrew.
- Version detectada: `0.20.3`.
- Homebrew reporta version estable mas reciente disponible: `0.30.10`.
- El servidor responde cuando se arranca con variables explicitas para AURA.
- Antes de descargar, `ollama list` no mostraba modelos instalados.

Nota: actualizar Ollama no es obligatorio para validar `qwen2.5:3b`, pero queda recomendado antes de una corrida formal.

## Arranque recomendado para desarrollo AURA

Desde una terminal:

```bash
export OLLAMA_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
export OLLAMA_FLASH_ATTENTION="1"
export OLLAMA_KV_CACHE_TYPE="q8_0"
ollama serve
```

Mantener esa terminal abierta mientras se usa AURA.

Validar que el servidor responde:

```bash
curl http://localhost:11434/api/tags
```

Respuesta esperada si no hay modelos:

```json
{"models":[]}
```

## Opcion persistente con Homebrew

Si se quiere que Ollama arranque como servicio del usuario:

```bash
launchctl setenv OLLAMA_ORIGINS "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
launchctl setenv OLLAMA_FLASH_ATTENTION "1"
launchctl setenv OLLAMA_KV_CACHE_TYPE "q8_0"
brew services start ollama
```

Verificar estado:

```bash
brew services list | grep ollama
curl http://localhost:11434/api/tags
```

Para detenerlo:

```bash
brew services stop ollama
```

## Descargar el modelo elegido

Comando principal:

```bash
ollama pull qwen2.5:3b
```

Descarga equivalente via API:

```bash
curl http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:3b","stream":true}'
```

Confirmar instalacion:

```bash
ollama list
curl http://localhost:11434/api/tags
```

Debe aparecer `qwen2.5:3b`.

## Prueba minima del modelo

CLI:

```bash
ollama run qwen2.5:3b "Responde en una frase: AURA puede usar Ollama local."
```

API:

```bash
curl http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:3b",
    "messages": [
      { "role": "user", "content": "Responde en una frase: AURA puede usar Ollama local." }
    ],
    "options": { "temperature": 0.1 },
    "keep_alive": "10m",
    "stream": false
  }'
```

## Validacion desde el repo

Desde `src/`:

```bash
npm run ollama:validate
```

Con parametros explicitos:

```bash
npm run ollama:validate -- --base-url=http://localhost:11434 --model=qwen2.5:3b
```

Resultado esperado:

```text
AURA Ollama validation
baseUrl=http://localhost:11434
model=qwen2.5:3b
server=ok
installedModels=1
chat=ok
latencyMs=...
response=...
```

Si falta el modelo, el script se detiene con el comando exacto de descarga.

## Configurar AURA en navegador

1. Abrir AURA en desarrollo: `npm run dev` desde `src/`.
2. Entrar en Configuracion.
3. Seleccionar `Ollama local`.
4. Endpoint: `http://localhost:11434`.
5. Modelo: `qwen2.5:3b`.
6. Pulsar `Probar`.
7. Guardar configuracion.
8. Ejecutar diagnostico sobre un dataset de prueba.

Si el navegador bloquea la peticion:

- confirmar que `OLLAMA_ORIGINS` incluye `http://localhost:5173`;
- reiniciar `ollama serve`;
- repetir `curl http://localhost:11434/api/tags`.

## Criterio para declarar validacion preliminar

Se puede registrar como `preliminary_valid` si se cumplen todos:

- `curl /api/tags` responde;
- `qwen2.5:3b` aparece instalado;
- `npm run ollama:validate` termina con `chat=ok`;
- AURA permite seleccionar `Ollama local` y ejecutar al menos un diagnostico;
- el resultado se exporta o se registra en `03_evidencia/results/`.

No declarar `formal_valid` hasta completar el protocolo de benchmark con dataset, input mode, fingerprint, trazas y revision HITL.

## Problemas frecuentes

| Sintoma | Causa probable | Correccion |
|---|---|---|
| `could not connect to ollama server` | Servidor apagado | Ejecutar `ollama serve` o `brew services start ollama`. |
| `Failed to fetch` desde AURA | CORS/origen no permitido | Definir `OLLAMA_ORIGINS` con `localhost:5173` y reiniciar Ollama. |
| Modelo no encontrado | No se descargo el modelo | Ejecutar `ollama pull qwen2.5:3b`. |
| Respuesta muy lenta | Primera carga del modelo o poca RAM | Esperar primera carga, cerrar apps pesadas o probar `gemma2:2b`. |
| Puerto ocupado | Otro Ollama ya esta corriendo | Verificar con `curl /api/tags`; si responde, usarlo. |

## Alternativas si `qwen2.5:3b` no funciona

Orden sugerido:

1. `gemma2:2b` para menor consumo.
2. `llama3.2:3b` como alternativa 3B general.
3. `mistral:7b` solo si hay RAM suficiente y se necesita mas capacidad.

Cambiar el modelo en AURA y repetir:

```bash
ollama pull gemma2:2b
npm run ollama:validate -- --model=gemma2:2b
```
