# Phase 5 Loop 1 — Cierre Preflight Verifier

> **Estado:** cerrado  
> **Loop:** Phase 5 L1  
> **Fecha:** 2026-07-01  
> **Base:** Phase 5 Loop 0 (`096f96d6d81318967086f0a05e9d5b7573c2605a`)

## 1. Entregable

**`src/services/preflightCheck.ts`** — helper `preflightCheck(contract, remediationPlan, buildContext, currentDatasetFingerprint): PreflightResult`

### Interfaz

```ts
export interface PreflightResult {
  status: 'ready' | 'blocked';
  verification: { valid: boolean; errors: string[] };
  hashMatch: boolean;
  fingerprintMatch: boolean;
  acceptedActionsCoherent: boolean;
  reasons: string[];
}
```

### Validaciones

| Check | Lógica | Bloqueo |
|---|---|---|
| Verificación fresca | `verifyScriptContractV2(contract, plan, ctx)` | Si `!valid` |
| Hash integrity | `computeScriptHashV2(contract)` === `contract.scriptHash` | Si no coincide |
| Fingerprint | `contract.datasetFingerprint` === `currentDatasetFingerprint` | Si no coincide |
| HITL coherence | `acceptedActionIds` coincide con acciones `approved` del plan | Si hay violaciones |
| Null guard | `contract === null|undefined` | Bloqueo inmediato |

## 2. Tests

**17 tests** en `src/__tests__/preflightCheck.test.ts`:

| Categoría | Tests | Cubren |
|---|---|---|
| Ready | 3 | contrato válido, múltiples acciones, acciones rechazadas/pendientes excluidas |
| Blocked: hash | 2 | hash alterado, scriptText alterado |
| Blocked: fingerprint | 2 | fingerprint diferente, fingerprint vacío |
| Blocked: HITL | 4 | acción rechazada en acceptedActionIds, pendiente, aprobada faltante, fantasma |
| Blocked: verification | 3 | null, undefined, objeto vacío |
| Múltiples razones | 1 | hash roto + fingerprint incorrecto + HITL violado |
| Edge cases | 2 | plan vacío, scriptText alterado |

## 3. Pruebas ejecutadas

- `npm run typecheck` — **0 errores**
- `npm run build` — **exitoso** (3.99s)
- `npm test -- --run` — **1091 passed, 6 skipped** (1 error pre-existente en `scriptGenerationStepV2.test.tsx`, timeout de worker, no relacionado)

## 4. Restricciones cumplidas

- No ejecuta Python.
- No modifica contratos v2 existentes.
- No toca evidencia congelada Phase 3 ni Phase 4.
- No implementa runtime sandbox.
- No implementa HealthDelta.
- No afirma dataset corregido ni mejora medida.

## 5. Archivos modificados

| Archivo | Acción |
|---|---|
| `src/services/preflightCheck.ts` | **Creado** |
| `src/__tests__/preflightCheck.test.ts` | **Creado** |

## 6. Casos bloqueados cubiertos

- **Hash mismatch:** scriptHash alterado manualmente, scriptText modificado
- **Fingerprint mismatch:** dataset diferente, fingerprint vacío
- **HITL coherence:** acción rechazada en acceptedActionIds, pendiente incluida, aprobada ausente, acción fantasma
- **Verification failure:** contrato null, undefined, objeto vacío
- **Combinación:** múltiples razones de bloqueo simultáneas

## 7. Pendientes para Loop 2

El Preflight Verifier no ejecuta código Python. El siguiente loop (Phase 5 L2) debe implementar el runtime sandbox mínimo que ejecute un fixture controlado sin dataset real, con timeout, sin red, sin filesystem libre y whitelist de imports.

## 8. Claims

**Permitidos tras L1:**
- AURA dispone de un preflight verifier que valida hash, fingerprint, verificación fresca y coherencia HITL antes de autorizar ejecución.
- El preflight verifier bloquea ante contrato null, hash alterado, fingerprint cambiado, acciones no aprobadas y verificación fallida.

**No permitidos todavía:**
- Ejecución Python real dentro de AURA.
- Dataset corregido por pipeline formal de Phase 5.
- HealthDelta real.
