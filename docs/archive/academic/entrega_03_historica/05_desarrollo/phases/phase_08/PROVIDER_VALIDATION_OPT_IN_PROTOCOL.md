# Phase 8 L4 — Provider Validation Opt-in Protocol

## Objetivo

Definir cómo se valida la disponibilidad de proveedores reales (Chrome AI, Ollama, Gemini Cloud) en AURA, garantizando que:

1. La validación real sea **opt-in** (requiere activación explícita).
2. Los E2E estándar **no dependan** de proveedores reales.
3. El CI **no descargue modelos** ni haga llamadas de red a proveedores.
4. La disponibilidad de un proveedor **no equivale** a production-ready.

## ¿Por qué la validación real debe ser opt-in?

1. **Entornos controlados**: un usuario puede tener Chrome AI disponible y otro no. AURA debe funcionar sin proveedores reales.
2. **CI reproducible**: si los tests de CI dependen de Ollama local o Chrome AI real, fallarán en CI sin esos proveedores.
3. **No免费下载 modelos en CI**: descargar modelos de Chrome AI o WebLLM en CI es costoso e innecesario.
4. **Separación de concerns**: la validación de proveedores es evidencia complementaria, no requisito de funcionalidad base.

## Diferencia entre E2E estándar y E2E proveedor real

| Aspecto | E2E Estándar | E2E Proveedor Real |
|---------|--------------|-------------------|
| Providers | Mocks / fixtures | Reales |
| Chrome AI | No se llama | Opt-in, perfil dedicado |
| Ollama | No se llama | Opt-in, localhost |
| Gemini Cloud | No se llama | Opt-in, API key |
| CI | Corre normalmente | **No corre** (saltado) |
| Model download | No | No en CI |
| Claim | "AURA funciona" | "Proveedor X disponible" |

## Proveedores Cubiertos

### 1. Chrome AI / Gemini Nano

**Disponibilidad detectada por:** `chromeAvailability.ts` → `detectChromeAiAvailability()`

**Estados posibles:**

| Estado | Significado |
|--------|-------------|
| `not_configured` | Navegador no soporta Chrome AI API |
| `unavailable` | API existe pero modelo no está listo |
| `downloadable` | Modelo puede descargarse |
| `downloading` | Descarga en progreso |
| `available` | Modelo listo para usar |
| `attempted_failed` | Se intentó usar pero falló |
| `preliminary_valid` | Uso exitoso en modo opt-in, contexto controlado |

**Activación:** `AURA_PROVIDER_VALIDATION=chrome` o `?providerValidation=chrome`

**Perfil dedicado:** Los E2E con Chrome AI real usan un **perfil persistente dedicado** (no el perfil personal del usuario). Configurar en `playwright.config.ts` o script manual.

**NOTA:** Chrome AI NO está disponible en todos los navegadores. No afirmar disponibilidad general.

### 2. Ollama Local

**Disponibilidad detectada por:** `ollamaProvider.ts` → `isAvailable()` (GET `http://localhost:11434/api/tags`)

**Estados posibles:**

| Estado | Significado |
|--------|-------------|
| `not_configured` | Ollama no instalado |
| `unavailable` | localhost:11434 no responde |
| `available` | Servidor Ollama responde |
| `attempted_failed` | Se intentó usar pero falló |
| `preliminary_valid` | Uso exitoso verificado |

**Activación:** `AURA_PROVIDER_VALIDATION=ollama` o `?providerValidation=ollama`

**Puerto:** `http://localhost:11434` (estándar Ollama)

**NOTA:** Ollama debe estar corriendo localmente. No instalar ni arrancar Ollama automáticamente.

### 3. Gemini Cloud

**Disponibilidad detectada por:** `geminiProvider.ts` → `isAvailable()` (verifica que `apiKey.trim().length > 0`)

**Estados posibles:**

| Estado | Significado |
|--------|-------------|
| `not_configured` | No hay API key configurada |
| `unavailable` | API key presente pero llamada falla |
| `available` | API key configurada y responde |
| `attempted_failed` | Llamada falló |
| `preliminary_valid` | Llamada exitosa verificada |

**Activación:** `AURA_PROVIDER_VALIDATION=gemini` o `?providerValidation=gemini`

**API Key:** Se provee vía `VITE_GEMINI_API_KEY` en `aiConfig` de Settings. **Nunca hardcodear ni subir secretos.**

### 4. WebLLM (experimental, no producción)

**Disponibilidad detectada por:** `webllmProvider.ts` → `isAvailable()` (verifica `navigator.gpu`)

**Estado:** Experimental. No es proveedor de producción. No se reactiva como producción en Phase 8.

## Activation Mechanisms

### Environment Variable (for scripts and manual runs)

```bash
# Validar un proveedor
AURA_PROVIDER_VALIDATION=chrome npm run dev

# Validar múltiples proveedores
AURA_PROVIDER_VALIDATION=chrome,ollama npm run dev

# Validar todos
AURA_PROVIDER_VALIDATION=all npm run dev
```

### Query Param (for browser testing)

```bash
# En la URL del navegador
http://localhost:3000/?providerValidation=chrome
http://localhost:3000/?providerValidation=ollama
http://localhost:3000/?providerValidation=all
```

## Cómo se Evita Dependencia en CI

1. **Tests E2E estándar** (`phase7-*.spec.ts`, `phase8-boundary.spec.ts`): no establecen `AURA_PROVIDER_VALIDATION`. Los tests de `phase8-provider-opt-in.spec.ts` usan `test.skip` que se activa automáticamente cuando la variable no está presente.

2. **Playwright config**: el `webServer` no establece `AURA_PROVIDER_VALIDATION`. Los specs opt-in son skippeados.

3. **Scripts de validación manual**: se ejecutan manualmente por el desarrollador, no en pipeline.

4. **Helper `providerOptIn.ts`**: centraliza la detección y es usado por la UI para mostrar un banner cuando el modo opt-in está activo.

## Comandos Sugeridos para Validación Manual

```bash
# 1. Chrome AI validation
AURA_PROVIDER_VALIDATION=chrome npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 2. Ollama validation (requiere Ollama corriendo en localhost:11434)
AURA_PROVIDER_VALIDATION=ollama npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 3. Gemini Cloud validation (requiere VITE_GEMINI_API_KEY en Settings)
AURA_PROVIDER_VALIDATION=gemini npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts

# 4. All providers
AURA_PROVIDER_VALIDATION=all npx playwright test src/tests/e2e/phase8-provider-opt-in.spec.ts
```

## Registro de Evidencia

Cada validación debe documentar:

```json
{
  "provider": "chrome|ollama|gemini",
  "state": "available|unavailable|attempted_failed|preliminary_valid",
  "checkedAt": "ISO-8601 timestamp",
  "details": "información contextual",
  "error": "mensaje de error si attempted_failed"
}
```

## Estados Permitidos por Claim

| Estado | ¿Puedo afirmar "disponible"? | ¿Puedo afirmar "validado"? |
|--------|------------------------------|----------------------------|
| `not_configured` | No | No |
| `unavailable` | No | No |
| `downloadable` | No | No |
| `available` | Sí (opt-in) | No (falta benchmark) |
| `attempted_failed` | No | No |
| `preliminary_valid` | Sí (opt-in) | Sí (opt-in, contexto controlado) |

## Claims Permitidos

- Chrome AI disponibilidad fue validada en modo opt-in controlado.
- Ollama local disponibilidad fue validada en modo opt-in controlado.
- Gemini Cloud API key presencia fue verificada.
- Proveedor disponible no implica production-ready.
- La validación fue manual con activación explícita del usuario.

## Claims Prohibidos

- AURA está production-ready porque un proveedor está disponible.
- Chrome AI o Gemini Nano siempre está disponible.
- La disponibilidad del proveedor significa que AURA funciona en todos los entornos.
- Existe benchmark formal basado en la corrida opt-in.
- AURA corrigió datasets usando un proveedor real.
- El proveedor validado garantiza que AURA es útil para producción.

## Limitaciones

1. **Entorno-dependiente**: Chrome AI solo está disponible en Chrome 127+ con flags especiales. Ollama requiere instalación local.
2. **No es benchmark**: una corrida exitosa no constituye benchmark. Se necesita protocolo, repeticiones y resultados exportables.
3. **No validación externa**: la validación es interna y manual. No es auditoría independiente.
4. **WebLLM experimental**: sigue siendo experimental. No se usa como proveedor de producción.
5. **API keys**: Gemini Cloud requiere API key real. No debe subirse a repositorio.
6. **Perfil dedicado**: Chrome AI E2E requiere perfil persistente dedicado (no el perfil personal del usuario).

## Advertencia

La disponibilidad de un proveedor (Chrome AI, Ollama, Gemini) **no convierte a AURA en production-ready**. AURA sigue siendo una herramienta de auditoría determinista que puede asistir LLM en modo opt-in. La ausencia de un proveedor no impide que AURA funcione en su modo determinista base.
