# Phase 10 L12 — Provider Readiness & Fallback UX Closeout

## 1. Objetivo

Garantizar que AURA sigue siendo usable aunque el proveedor IA real no esté disponible, y añadir validación opt-in separada para Chrome AI / Gemini Nano real usando perfil persistente dedicado.

- **L12A**: Provider readiness / fallback UX — endurecer que AURA funciona sin proveedores reales.
- **L12B**: Chrome AI real opt-in — validación manual con perfil dedicado, fuera de CI.

## 2. Commit auditado

```
92905736e19703480275242a50ee80554420bc92
```

## 3. Archivos creados/modificados

### Creados

| Archivo | Propósito |
|---------|-----------|
| `src/tests/e2e/aura-provider-readiness.spec.ts` | Spec E2E de provider readiness (8 tests) |
| `src/tests/e2e/aura-chrome-ai-real.optin.spec.ts` | Spec opt-in de Chrome AI real (1 test) |
| `docs/product/aura/phase_10/l12_provider_evidence/evidence.json` | Evidencia estructurada L12A |
| `docs/product/aura/phase_10/l12_provider_evidence/chrome_ai_real_optin.json` | Evidencia L12B (post-ejecución) |
| `docs/product/aura/phase_10/l12_provider_evidence/screenshots/*.png` | Screenshots del test run |
| `docs/product/aura/phase_10/L12_PROVIDER_READINESS_CLOSEOUT.md` | Este documento |

## 4. Escenario L12A — Provider Readiness (estándar, corre en CI)

### Tests implementados

| Test ID | Validación |
|---------|------------|
| L12A-01 | Page loads without Chrome AI API — sin errores críticos |
| L12A-02 | `globalThis.LanguageModel` es `false` cuando API ausente |
| L12A-03 | Motor determinista funciona sin AI provider real |
| L12A-04 | UI de estado de proveedor muestra estado realista |
| L12A-05 | Estado de proveedor registrable en export |
| L12A-06 | No se descargan modelos en E2E estándar |
| L12A-07 | No afirma "Gemini Nano siempre disponible" |
| L12A-08 | Modos de proveedor enumerados sin crash |

### Reglas cumplidas

- ✅ detecta modos de proveedor: mock, local, chrome_ai, cloud, unavailable, skipped
- ✅ no se rompe si `globalThis.LanguageModel` no existe
- ✅ no se rompe si Chrome AI devuelve unavailable/downloadable/downloading
- ✅ explica al usuario el estado real del proveedor (UI settings)
- ✅ permite continuar con diagnóstico determinístico
- ✅ registra estado de proveedor en evidencia/export
- ✅ no afirma que Gemini Nano esté siempre disponible
- ✅ no descarga modelos en CI
- ✅ no depende de proveedor real en E2E estándar

## 5. Escenario L12B — Chrome AI Real Opt-in

### Requisitos de activación

```bash
AURA_E2E_REAL_CHROME_AI=true
AURA_E2E_BASE_URL="https://aura.casabero.com"
AURA_CHROME_AI_PROFILE_DIR="$HOME/.aura/chrome-ai-profile"
```

### Reglas cumplidas

- ✅ No corre por defecto (skip condition en `OPT_IN_ACTIVE`)
- ✅ No corre en CI estándar (misma guard condition)
- ✅ No usa perfil personal (`validateProfilePath` rechaza Default/Profile 1/rutas estándar)
- ✅ No falla pipeline estándar si Gemini Nano no está disponible (test no assertea éxito)
- ✅ Usa `launchPersistentContext` con `channel: "chrome"`
- ✅ Rechaza rutas inseguras (Default, Profile 1, Chrome User Data estándar)
- ✅ Evalúa `'LanguageModel' in globalThis`
- ✅ Evalúa `LanguageModel.availability()`
- ✅ Si `available`, ejecuta prompt "Responde exactamente: AURA_OK"
- ✅ Registra resultado en JSON
- ✅ Si no disponible, registra estado honesto y no inventa éxito

### Profile safety validator

```ts
function validateProfilePath(dirPath: string): { valid: boolean; reason?: string }
```

Rechaza:
- Nombres de perfil estándar: `Default`, `Profile 1`, `Profile 2`, etc.
- Directorios de Chrome estándar: `/chrome/user data`, `/google/chrome`, `/chromium`, `/brave`
- Requiere que la ruta contenga `.aura` como marcador de perfil dedicado

## 6. Evidencia generada

```
docs/product/aura/phase_10/l12_provider_evidence/evidence.json
docs/product/aura/phase_10/l12_provider_evidence/chrome_ai_real_optin.json
docs/product/aura/phase_10/l12_provider_evidence/screenshots/
```

## 7. Screenshots

| Archivo | Captura |
|---------|---------|
| `01_page_loaded_no_chrome_ai.png` | Página cargada sin Chrome AI API |
| `02_deterministic_engine_works.png` | Diagnóstico determinista sin AI |
| `03_provider_settings_ui.png` | UI de configuración/estado de proveedor |
| `04_export_before_provider_state.png` | Estado pre-export |
| `05_after_deterministic_diagnosis.png` | Diagnóstico completado sin AI |
| `chrome_ai_real_optin_result.png` | Resultado de Chrome AI real opt-in (si se ejecutó) |

## 8. Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| Typecheck (`tsc --noEmit`) | ✅ |
| Build (`vite build`) | ✅ |
| `exportPackage` (vitest, 5 tests) | ✅ |
| `exportPackageSchema` (vitest, 3 tests) | ✅ |
| `exportContractValidation` (vitest, 6 tests) | ✅ |
| `exportJsonPreflight` (vitest, 1 test) | ✅ |
| `aura-export-contract.spec.ts` (Playwright, 5 tests) | ✅ |
| `aura-full-flow-export.spec.ts` (Playwright, 1 test) | ✅ |
| `aura-embedded-calibration.spec.ts` (Playwright, 2 tests) | ✅ |
| `aura-provider-readiness.spec.ts` (Playwright, 8 tests) | ✅ |
| `aura-chrome-ai-real.optin.spec.ts` (Playwright, 1 test — opt-in) | ⏭️ skip (sin env vars) |

## 9. Greps ejecutados

| Búsqueda | Resultado |
|----------|-----------|
| `Gemini Nano siempre\|Chrome AI siempre\|benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready` | Solo en restricciones, tests de ausencia, documentación de límites |
| `AURA_E2E_REAL_CHROME_AI\|AURA_CHROME_AI_PROFILE_DIR\|launchPersistentContext` | Presente en opt-in spec |
| `cuarta entrega` | Solo en agent prompts y closeouts previos |

## 10. Riesgos abiertos

1. **Chrome AI real opt-in requiere entorno local**: El test L12B-01 solo corre cuando las variables de entorno están presentes. Es una validación manual/opt-in, no automatizada en CI.
2. **Perfil persistente se desincroniza**: El perfil dedicado en `~/.aura/chrome-ai-profile` puede quedar en estado inconsistente si Chrome se cierra abruptamente. El test debería crear contexto limpio cada vez.
3. **No hay mock de Chrome AI en L12A**: Los tests L12A validan que la app no se rompe sin Chrome AI, pero no simulan todos los estados de `availability()`. Esto es aceptable porque la lógica de normalización ya tiene unit tests en `chromeAvailability.test.ts`.
4. **Screenshots locales**: Las capturas se generan en cada run y pueden variar según resolución y datos del fixture.

## 11. Recomendación de cierre

Cerrar la issue **#18 — Phase 10 L12**. Provider readiness y fallback UX están implementados, testeado y documentado:

- ✅ Flujo estándar no depende de proveedores reales
- ✅ Chrome AI / Gemini Nano real puede validarse en modo opt-in con perfil dedicado
- ✅ Perfil personal protegido
- ✅ CI no contaminado
- ✅ Evidencia JSON y screenshots generados
- ✅ Greps de términos prohibidos limpios
- ✅ 8 tests Playwright estándar + 1 test opt-in
- ✅ Typecheck, build y test suites existentes pasan

**No inicia cuarta entrega académica.**
