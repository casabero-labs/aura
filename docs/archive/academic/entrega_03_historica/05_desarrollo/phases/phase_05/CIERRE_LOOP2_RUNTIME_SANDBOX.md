# Phase 5 Loop 2 — Cierre Runtime Sandbox Mínimo

> **Estado:** cerrado  
> **Loop:** Phase 5 L2  
> **Fecha:** 2026-07-01  
> **Base:** Phase 5 Loop 1 (`9be3f6821880370acf5196338876e04eae06b010`)

## 1. Entregable

**`src/services/runtimeSandbox.ts`** — runtime sandbox con validación de seguridad y preparación de contexto de ejecución.

### Interfaces

```ts
export interface SandboxConfig {
  timeoutMs: number;           // default: 30000
  networkDisabled: boolean;    // default: true
  filesystemRestricted: boolean; // default: true
  memoryLimitMb: number | null;  // default: 512
  allowedImports: string[];    // whitelist de 12 módulos
}

export interface SandboxExecutionResult {
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  sandbox: SandboxConfig;
  preflightBlocked: boolean;
  importViolations: string[];
  hasCleanDataset: boolean;
  networkAccessDetected: boolean;
  filesystemAccessDetected: boolean;
  dangerousBuiltinsDetected: string[];
}
```

### Funciones

| Función | Rol |
|---|---|
| `createDefaultSandboxConfig()` | Configuración por defecto: 30s timeout, sin red, sin filesystem, 512MB |
| `detectCleanDatasetFunction(scriptText)` | Detecta `def clean_dataset(df)` |
| `detectNetworkAccess(scriptText)` | Detecta patrones de acceso a red (requests, urllib, socket, http) |
| `detectFilesystemAccess(scriptText)` | Detecta patrones de acceso a filesystem (open, os.path, Path, shutil) |
| `detectDangerousBuiltins(scriptText)` | Detecta `eval`, `exec`, `__import__`, `compile`, `globals`, `locals`, etc. |
| `detectBannedImports(scriptText)` | Detecta imports prohibidos (os, sys, subprocess, shutil, socket, urllib, requests, http, ftplib, pathlib) |
| `validateScriptImports(scriptText, allowed)` | Valida todos los imports contra whitelist |
| `executeSandboxed(contract, preflight, config?)` | Ejecución controlada: valida preflight, escanea seguridad, produce resultado |

### Whitelist de imports (12 módulos)

`pandas`, `numpy`, `json`, `csv`, `io`, `hashlib`, `re`, `math`, `datetime`, `collections`, `itertools`, `typing`

### Bloqueos de seguridad

El sandbox bloquea (fail-closed) ante cualquiera de estas condiciones:
1. Preflight no está `ready`
2. `clean_dataset(df)` no existe en el script
3. Acceso a red detectado (con networkDisabled=true)
4. Acceso a filesystem detectado (con filesystemRestricted=true)
5. Builtins peligrosos detectados (eval, exec, __import__, etc.)
6. Imports fuera de whitelist
7. Imports de módulos prohibidos (os, sys, subprocess, etc.)

Si cualquiera de estas condiciones falla, el sandbox devuelve `status: 'failed'` con `error` que describe todas las violaciones.

## 2. Tests

**42 tests** en `src/__tests__/runtimeSandbox.test.ts`:

| Categoría | Tests | Cubren |
|---|---|---|
| Config | 1 | valores por defecto |
| clean_dataset detection | 4 | presente, ausente, vacío, type hints |
| Network detection | 3 | requests, urllib, socket, clean |
| Filesystem detection | 4 | open(), os.remove, Path(), clean |
| Dangerous builtins | 5 | eval, exec, __import__, compile, clean |
| Banned imports | 4 | os, subprocess, from socket, clean |
| Import whitelist | 5 | accepts valid, rejects PIL, rejects banned, custom whitelist, no imports |
| executeSandboxed integration | 12 | blocked preflight, success, missing clean_dataset, network detected, filesystem detected, dangerous builtins, import violations, custom config, empty script, structured logs, sandbox config |
| Edge cases | 4 | multiple violations, all standard imports, fail-closed, blocked preflight reasons |

## 3. Pruebas ejecutadas

- `npm run typecheck` — **0 errores**
- `npm run build` — **exitoso** (3.33s)
- `npm test -- --run` — **1133 passed, 6 skipped** (1 error pre-existente: `scriptGenerationStepV2.test.tsx` worker timeout)

## 4. Restricciones cumplidas

- No ejecuta dataset real del usuario (solo fixtures controlados).
- No implementa HealthDelta.
- No implementa exportación final.
- No modifica contratos v2 existentes.
- No toca evidencia congelada Phase 3 ni Phase 4.
- No afirma dataset corregido ni mejora medida.
- No oculta el error pre-existente de `scriptGenerationStepV2.test.tsx`.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/runtimeSandbox.ts` | **Creado** |
| `src/__tests__/runtimeSandbox.test.ts` | **Creado** |

## 6. Delegación de ejecución real

El sandbox valida seguridad y prepara contexto, pero **no ejecuta Python**. La ejecución real se delega al runtime externo según la decisión de Loop 0:
- **Colab notebook** (`colabExporter.ts`): genera notebook ejecutable con script aprobado.
- **Pyodide** (futuro): ejecución WASM en navegador.

## 7. Pendientes para Loop 3

El siguiente loop (Phase 5 L3) debe ejecutar `clean_dataset(df)` sobre copia controlada usando el runtime externo (Colab notebook), con execution summary y logs. El sandbox validado en L2 asegura que el script es seguro antes de delegar la ejecución.

## 8. Claims

**Permitidos tras L2:**
- AURA dispone de un runtime sandbox que valida seguridad del script antes de delegar ejecución.
- El sandbox detecta y bloquea red, filesystem, builtins peligrosos e imports no autorizados.
- La ejecución se delega a runtime externo (Colab notebook) bajo control del usuario.

**No permitidos todavía:**
- Ejecución Python real dentro de AURA.
- Dataset corregido por pipeline formal de Phase 5.
- HealthDelta real.
