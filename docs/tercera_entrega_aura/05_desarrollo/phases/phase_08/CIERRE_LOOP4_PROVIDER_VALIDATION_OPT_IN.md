# Phase 8 L4 — Cierre Provider Validation Opt-in

## Objetivo

Definir el protocolo formal de validación opt-in de proveedores reales (Chrome AI, Ollama, Gemini Cloud) separado del CI estándar, garantizando que AURA no depende de proveedores reales para funcionar y que la validación es evidencia complementaria, no requisito.

## Cambios Realizados

### 1. Helper centralizado: `src/utils/providerOptIn.ts`

- `detectProviderOptIn(env?, search?)` — detecta si el modo opt-in está activo.
  - Env var: `AURA_PROVIDER_VALIDATION=chrome|ollama|gemini|all`
  - Query param: `?providerValidation=chrome|ollama|gemini|all`
  - Retorna: `{ active, providers, source, requestedProviders }`
- `PROVIDER_VALIDATION_CLAIMS_PROHIBITED` — lista de claims prohibidos en validación de proveedores.
- `isProviderValidationClaimProhibited(text)` — detección de claim prohibido.
- `PROVIDER_NOTICE` — texto del banner de validación.
- `ProviderState` — estados permitidos: `not_configured | unavailable | downloadable | available | attempted_failed | preliminary_valid`.

### 2. Tests unitarios: `src/__tests__/providerOptIn.test.ts`

30 tests cubriendo:
- Detección inactiva sin flag.
- Activación por env var (`AURA_PROVIDER_VALIDATION=chrome|ollama|gemini|all`).
- Activación por query param (`?providerValidation=chrome|...`).
- Ignorar valores inválidos.
- Preferencia de env sobre query param.
- Case-insensitivity.
- Detección de claims prohibidos (production-ready, always available, etc.).
- Verificación de constantes exportadas.

### 3. Spec E2E opt-in: `src/tests/e2e/phase8-provider-opt-in.spec.ts`

8 tests en 4 grupos (Chrome AI, Ollama, Gemini Cloud, UI Feedback):
- Todos los tests usan `test.skip(!RUN_REAL_PROVIDERS, ...)` — se saltan automáticamente si `AURA_PROVIDER_VALIDATION` no está establecida.
- No usan perfil personal de Chrome.
- No descargan modelos en CI.
- Reportan estado como `unavailable`, `not_configured`, `attempted_failed` en vez de fingir éxito.

### 4. Documento de protocolo: `PROVIDER_VALIDATION_OPT_IN_PROTOCOL.md`

- Objetivos, proveedores cubiertos, estados, activación, comandos sugeridos, claims permitidos/prohibidos, limitaciones.

## Archivos Modificados/Creados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/utils/providerOptIn.ts` | Nuevo | Helper centralizado de opt-in |
| `src/__tests__/providerOptIn.test.ts` | Nuevo | 30 unit tests |
| `src/tests/e2e/phase8-provider-opt-in.spec.ts` | Nuevo | 8 E2E specs (saltados por defecto) |
| `docs/.../phase_08/PROVIDER_VALIDATION_OPT_IN_PROTOCOL.md` | Nuevo | Protocolo formal |
| `docs/.../phase_08/CIERRE_LOOP4_PROVIDER_VALIDATION_OPT_IN.md` | Nuevo | Cierre L4 |
| `PHASE8_EVIDENCE_LEDGER.md` | Modificado | Evidencia L4 |

## Cómo se Evita que CI Dependa de Proveedores Reales

1. **Tests E2E estándar**: no establecen `AURA_PROVIDER_VALIDATION`. El `playwright.config.ts` no pasa esta variable al webServer.
2. **Tests opt-in**: todos usan `test.skip(!RUN_REAL_PROVIDERS)`. Si `AURA_PROVIDER_VALIDATION` no está en el entorno, los tests se saltan sin falla.
3. **CI pipeline**: no instala Ollama, no configura API keys, no descarga modelos de Chrome AI.
4. **Helper**: la UI puede mostrar un banner cuando detecta `providerOptIn.active === true`, pero esto es solo informativo, no bloqueante.

## Cómo se Ejecutaría Validación Manual

```bash
# 1. Chrome AI (requiere Chrome 127+ con Chrome AI flags)
AURA_PROVIDER_VALIDATION=chrome npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 2. Ollama (requiere Ollama corriendo en localhost:11434)
AURA_PROVIDER_VALIDATION=ollama npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 3. Gemini Cloud (requiere VITE_GEMINI_API_KEY configurada en Settings)
AURA_PROVIDER_VALIDATION=gemini npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 4. Todos
AURA_PROVIDER_VALIDATION=all npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts
```

## Proveedores Cubiertos

| Proveedor | Estado | Notas |
|-----------|--------|-------|
| Chrome AI / Gemini Nano | Opt-in | No disponible universalmente |
| Ollama local | Opt-in | localhost:11434 |
| Gemini Cloud | Opt-in | API key en Settings |
| WebLLM | Experimental | No producción |

## Qué Queda Pendiente

1. **Validación real manual**: los specs E2E opt-in están creados pero no se ejecutaron en este loop. Quedan como infraestructura lista para uso manual.
2. **Diagnóstico de proveedor real**: los archivos de diagnóstico (Chrome AI diagnostics, Ollama diagnostics) no fueron generados en este loop. Se dejan para ejecución manual futura.
3. **Perfil persistente dedicado**: la configuración de un perfil Chrome dedicado para E2E de Chrome AI real no está implementada. Se documenta como requisito para la validación manual.

## Claims Permitidos

- Phase 8 L4 definió el protocolo de validación opt-in de proveedores reales.
- La validación de proveedores es opt-in y separada del CI estándar.
- Los E2E estándar no dependen de proveedores reales.
- La disponibilidad de un proveedor no equivale a production-ready.

## Claims Prohibidos

- AURA está production-ready porque un proveedor está disponible.
- Chrome AI / Gemini Nano siempre está disponible.
- La validación de proveedores constituye benchmark formal.
- AURA corrigió datasets usando un proveedor real.
- El proveedor validado garantiza utilidad en producción.

## Confirmaciones

- ✅ No se preparó cuarta entrega
- ✅ No se tocó código de producción (solo helper standalone + spec opt-in)
- ✅ No se modificaron contratos v2
- ✅ No se modificó scoring
- ✅ No se tocó auditEngine
- ✅ No se tocaron freezes
- ✅ No se reactivó WebLLM como producción
- ✅ No se usó perfil personal de Chrome
- ✅ No se descargaron modelos en CI
- ✅ No hay secretos en los archivos

## Próximo Loop Recomendado

**Phase 8 L5 — Benchmark Evidence Classification**

Clasificar las corridas de evidence gathered en Phase 8 según уровень de validación: `attempted_failed`, `preliminary_valid` o `formal_valid`.
