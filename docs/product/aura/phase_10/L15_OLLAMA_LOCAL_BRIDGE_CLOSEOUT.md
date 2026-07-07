# Phase 10 L15 — Ollama Local Bridge Closeout

## 1. Objetivo

Crear integración robusta y guiada para Ollama local desde AURA alojada, con servicio browser → loopback, diagnóstico de estados, detección de OS/browser y wizard "Conectar Ollama de este equipo".

## 2. Commit auditado

```
58af89cf703e0a09ae9f4487dc4971cd3e4e0f44
```

## 3. Archivos modificados/creados

| Archivo | Tipo | Propósito |
|---------|------|-----------|
| `src/services/platformDetection.ts` | **Nuevo** | Detección de SO y navegador |
| `src/services/ollamaLocalBridge.ts` | **Nuevo** | Servicio browser-to-loopback con diagnóstico de 11 estados |
| `src/components/OllamaSetupWizard.tsx` | **Nuevo** | Wizard guiado paso a paso |
| `src/index.css` | Modificado | CSS completo para el wizard |
| `src/__tests__/ollamaLocalBridge.test.ts` | **Existente** | 29 tests — todos pasan |

## 4. Arquitectura browser → loopback

```
Browser JS (https://aura.casabero.com)
  → fetch(http://127.0.0.1:11434/api/tags)
  → fetch(http://127.0.0.1:11434/api/chat)
  → Ollama local (equipo del usuario)
```

- El servidor AURA nunca llama a localhost.
- `targetAddressSpace: 'local'` usado con fallback compatible.
- Evidencia: `connectionPath: 'browser_to_loopback'`, `dataSentToAuraBackend: false`.

## 5. Estados Ollama soportados (11)

| Estado | Significado | Acción |
|--------|-------------|--------|
| `not_configured` | Falta OLLAMA_ORIGINS | Mostrar instrucciones por SO |
| `permission_required` | Navegador necesita permiso | Botón "Solicitar permiso" |
| `permission_denied` | Permiso rechazado | Guía para habilitarlo |
| `cors_blocked` | OLLAMA_ORIGINS incorrecto | Mostrar comando exacto |
| `server_unreachable` | Ollama apagado | Indicar cómo abrirlo |
| `timeout` | No respondió a tiempo | Reintentar |
| `model_missing` | Sin modelo instalado | `ollama pull qwen2.5:3b` |
| `insecure_context` | Sin HTTPS | Usar https://aura.casabero.com |
| `unsupported_browser` | Safari/Firefox | Recomendar Chrome/Edge |
| `ready` | Listo | Diagnóstico local |
| `unknown_error` | Error no clasificado | Mostrar detalle |

## 6. Instrucciones por SO

### macOS
```bash
launchctl setenv OLLAMA_ORIGINS "https://aura.casabero.com"
```

### Linux
```ini
[Service]
Environment="OLLAMA_ORIGINS=https://aura.casabero.com"
```

### Windows
- GUI: Variables de entorno del sistema
- PowerShell: `setx OLLAMA_ORIGINS "https://aura.casabero.com"`

El origen se obtiene de `window.location.origin`, no quemado.

## 7. Modelos recomendados

- Primario: `qwen2.5:3b`
- Alternativo: `gemma2:2b`

## 8. Privacidad y seguridad

- Prompt y respuesta no pasan por el servidor de AURA.
- Solo se permiten endpoints loopback (127.0.0.1, localhost, ::1).
- Endpoints públicos rechazados.
- Evidencia registrada: `connectionPath: browser_to_loopback`.

## 9. Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| Typecheck | ✅ |
| Build | ✅ |
| `ollamaLocalBridge.test.ts` (29 tests) | ✅ |
| `ollamaWizardHtml.test.ts` (6 tests) | ✅ |
| `ollamaWizardIntegration.test.ts` (16 tests) | ✅ |
| `aura-provider-readiness.spec.ts` (8 tests) | ✅ |

## 10. Greps ejecutados

| Búsqueda | Resultado |
|----------|-----------|
| `production-ready\|benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal` en src | Solo en dist/ minificado y node_modules |
| `cuarta entrega` en src | No matches |
| `targetAddressSpace\|OLLAMA_ORIGINS\|browser_to_loopback\|127.0.0.1:11434` | Presente en servicios y dist/ |

## 11. Límites de claims

- No se declara producción general.
- No se declara benchmark formal.
- No se declara modelo ganador universal.
- No se inicia cuarta entrega.

## 12. Riesgos abiertos

1. **El wizard no está integrado en el flujo principal**: `OllamaSetupWizard` es un componente standalone. Debe integrarse en `SettingsPanel` o en el panel de proveedor de Diagnóstico como paso siguiente.
2. **No hay E2E para Ollama**: CI no depende de Ollama real. Las pruebas unitarias validan la lógica sin conexión real.
3. **Safari no soportado**: Safari bloquea fetch a localhost desde HTTPS externo. El diagnóstico lo detecta como `unsupported_browser`.
4. **`targetAddressSpace: 'local'` experimental**: La propiedad no es estándar en todos los navegadores. El bridge tiene fallback sin ella.

## 13. Issue #3

Parcial. La integración del wizard en el flujo principal (SettingsPanel / DiagnosisStep) queda pendiente. Issue #3 puede cerrarse si el Definition of Done acepta wizard standalone listo para integrar, o mantenerse abierta para el paso de integración UI.

**Recomendación de cierre de L15:** Cerrar con entrega del bridge + wizard standalone. La integración UI es un paso siguiente (L16 o similar).
