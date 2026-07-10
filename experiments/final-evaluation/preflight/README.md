# Preflight Ollama OE4

`ollama-preflight.latest.json` se genera únicamente cuando pasan todos los
gates del entorno formal:

- manifiesto y protocolo contienen exactamente los mismos tres modelos;
- cliente y servidor Ollama tienen la misma versión;
- existe espacio libre suficiente para los artefactos congelados;
- los tres identificadores están instalados exactamente y exponen digest local;
- cada modelo devuelve una respuesta smoke no vacía con telemetría nativa.

Comando canónico:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm run ollama:validate
```

Estado observado el 10 de julio de 2026: **bloqueado antes de campaña** por
cliente `0.31.1` frente a servidor `0.20.3`. Solo estaba instalada la alternativa
operativa `qwen2.5:3b`; no se inició ninguna corrida formal ni se generó un recibo
de éxito.
