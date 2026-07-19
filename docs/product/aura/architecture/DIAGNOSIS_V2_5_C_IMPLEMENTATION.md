# Diagnosis V2.5-C: implementación mediante ciclos de reproducción y revisión

**Estado:** candidato implementado en PR borrador; pendiente de aprobación humana y merge

**Fecha:** 2026-07-19

**Pull request:** `#52` — `agent/diagnosis-v2-5-c` → `main`

**Base de implementación:** Diagnosis V2.5-A y V2.5-B en `aaf51198fffb261ecec752abb64b6fd343f82fef`

**Plan rector:** [`DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md`](./DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md)

---

## 1. Método aplicado

La fase se implementó siguiendo el flujo:

```text
reproducir
→ ¿se reproduce?
→ hallar causa
→ intentar fix
→ tests
→ ¿pasan?
→ revisión
→ ¿aprobado?
```

Cada fallo de compilación, prueba o revisión devolvió el trabajo al nodo de corrección. No se modificó `main` y el PR permanece como borrador.

La fase no se considera fusionada ni productivamente aprobada mientras:

- el PR siga abierto;
- no exista aprobación humana explícita;
- no se ejecute el merge;
- no se complete el freeze documental posterior al merge.

---

## 2. Reproducción

### 2.1 Bug reproducido

Las refs V2 se construían mediante un contador global:

```text
ev-0000
ev-0001
ev-0002
```

La prueba de reproducción invirtió el orden de los issues manteniendo la misma evidencia semántica. Las refs ordinales cambiaron de issue, demostrando que la identidad dependía del recorrido global.

### 2.2 Resultado

```text
misma evidencia semántica
+ distinto orden de issues
→ distinta ref ordinal
```

El defecto no era atribuible al LLM. Nacía antes de la inferencia, durante la construcción determinista del envelope.

---

## 3. Causa raíz

La causa fue `refCounter` dentro de `evidenceEnvelopeV2`.

La ref fuente identificaba posición, no contenido. Cambios no semánticos podían modificarla:

- reordenamiento de issues;
- reordenamiento de muestras;
- truncamiento;
- exclusiones;
- incorporación de reglas anteriores en el recorrido.

También se confirmó que el material de evidencia disponible después de privacidad contiene:

- valores procesados;
- indicador `hashed`;
- indicador `pii`;
- issue, regla, columna y scope.

No contiene el ordinal dentro de `metadata`. Por tanto, es posible construir una identidad estable sin reintroducir valores brutos prohibidos.

---

## 4. Corrección arquitectónica

La solución separa tres representaciones:

```text
alias del prompt
    e1

ref fuente V2 de compatibilidad
    ev-0001

ref estable persistible
    ev:v1:<issueDigest>:<sampleDigest>
```

### 4.1 Alias del prompt

El modelo solo ve aliases cortos locales a la proyección:

```text
e1
e2
e3
```

No ve:

- refs ordinales `ev-XXXX`;
- refs estables internas `ev:v1:...`;
- el mapa completo de resolución.

### 4.2 Ref fuente V2

AURA resuelve el alias hacia la ref fuente esperada por el validador V2, remediación y compatibilidad histórica.

Esta vista evita una migración disruptiva de todos los consumidores en la misma fase.

### 4.3 Ref estable

La ref estable se deriva de:

```text
versión del algoritmo
+ contexto del issue
+ política de privacidad
+ valor ya procesado
+ metadata de privacidad
```

Formato implementado:

```text
ev:v1:<16 hex issueDigest>:<24 hex sampleDigest>
```

La ref estable no usa el valor bruto cuando la política de privacidad no permite conservarlo.

---

## 5. Componentes implementados

### 5.1 `diagnosisEvidenceIdentityV1.ts`

Responsabilidades:

- construcción de stable refs;
- canonicalización Unicode NFKC;
- construcción determinista del alias map;
- deduplicación semántica;
- resolución alias → ref fuente;
- resolución alias → stable ref;
- hash de citas resueltas;
- detección de alias inexistente, cruzado o duplicado.

### 5.2 `diagnosisInputPackageV2_5.ts`

Responsabilidades:

- construir la proyección alias-aware;
- sustituir refs visibles por aliases;
- mantener stable refs fuera del prompt;
- añadir `evidenceAliasMapHash`;
- añadir `projectionHash`;
- recalcular `promptHash`, `responseSchemaHash` e `inputHash`;
- verificar el snapshot reconstruyéndolo desde envelope y modo.

Versión de prompt:

```text
1.8.0
```

### 5.3 `diagnosisProjectedPipelineV2_5.ts`

Responsabilidades:

- validar integridad del snapshot;
- validar aliases antes del contrato V2;
- comprobar claims literales contra evidencia visible;
- resolver aliases a refs fuente;
- ejecutar el validador y normalizador HITL existentes;
- conservar la respuesta cruda con aliases;
- producir la respuesta efectiva compatible;
- producir una vista estable persistible;
- registrar el hash de resolución.

### 5.4 `diagnosisSelectorV2_5.ts`

Responsabilidades:

- envolver el selector existente;
- verificar que receipt y reconstrucción coinciden;
- persistir `evidenceResolution` en el resultado de producto;
- producir la stable diagnosis desde el resultado efectivo, incluida cualquier normalización HITL.

### 5.5 `executionReceiptV1.ts`

Los receipts nuevos pueden incluir:

```text
evidenceAliasContract
evidenceAliasMapHash
projectionHash
resolvedCitationsHash
```

Para una ejecución V2.5-C válida, la fábrica:

1. parsea el raw response;
2. resuelve los aliases usando el snapshot exacto;
3. calcula `resolvedCitationsHash`;
4. incorpora el hash al receipt;
5. incorpora esos campos al `receiptHash`.

Los receipts inválidos pueden no contener `resolvedCitationsHash` cuando el flujo se bloquea antes de resolver citas.

### 5.6 Laboratorio formal

El Laboratorio ahora genera snapshots V2.5-C.

La evaluación conserva dos vistas:

```text
rawOutput
  JSON exacto del modelo con aliases

resolvedDiagnosis
  diagnóstico con refs fuente para scoring contra el oráculo
```

Las campañas históricas siguen usando el evaluador anterior. No se reescriben artefactos congelados.

---

## 6. Integridad del snapshot

El snapshot V2.5-C se reconstruye y compara antes de confiar en él.

Se verifican:

- contrato y versión;
- envelope ref;
- input mode;
- secciones incluidas;
- alias map;
- alias map hash;
- projection hash;
- prompt hash;
- response schema hash;
- input hash;
- system instruction;
- user payload;
- response schema.

Una mutación del payload sin actualización de hashes se rechaza. Una mutación acompañada por hashes inventados también se rechaza porque la proyección se reconstruye desde la fuente canónica.

---

## 7. Ciclos de corrección ejecutados

### Ciclo 1: refs inestables

```text
reproducción
→ refs ordinales cambian por orden
→ stable refs + aliases
```

### Ciclo 2: narrowing de TypeScript

```text
typecheck falla
→ discriminación insuficiente en outcomes compuestos
→ tipos unión y casts limitados a pruebas/fallos
```

No se relajó validación productiva.

### Ciclo 3: Laboratorio formal

```text
revisión detecta builder legacy
→ formalCampaignFactory migra a V2.5-C
→ evaluador alias-aware
```

### Ciclo 4: mocks históricos

```text
regresiones fallan con ev-XXXX cableado
→ mocks leen allowedEvidenceAliasesByIssueId del prompt exacto
```

Los tests simulan ahora el contrato realmente recibido.

### Ciclo 5: métricas contaminadas

```text
prompt_libre reporta aliases visibles
→ contador incluía ejemplos e1/e2 de system instruction
→ métrica limitada a userPayload
```

### Ciclo 6: persistencia y receipts

```text
revisión detecta que pipeline exponía stable view pero selector la descartaba
→ selector V2.5-C persiste evidenceResolution
→ receipt deriva y certifica resolvedCitationsHash
```

### Ciclo 7: normalización HITL

```text
stable diagnosis inicial reflejaba raw pre-normalización
→ stable refs se fusionan con el diagnóstico efectivo
```

La vista persistible refleja la gobernanza final.

---

## 8. Pruebas focalizadas

Las pruebas cubren:

- reproducción de inestabilidad ordinal;
- estabilidad de stable refs ante reordenamiento;
- aliases deterministas;
- ausencia de aliases en `prompt_libre`;
- refs internas ausentes del prompt;
- integridad del snapshot;
- alias inexistente;
- alias cruzado;
- ref interna devuelta por el modelo;
- resolución alias → ref fuente;
- resolución alias → stable ref;
- separación raw/effective/stable;
- hash de citas resueltas;
- receipt alias-aware válido;
- receipt alterado;
- evaluación formal alias-aware;
- comparación estructural reproducible.

---

## 9. Regresión y CI

El workflow del PR ejecuta:

```text
npm ci
npm run typecheck
pruebas focalizadas V2.5-C
generación y verificación del baseline estructural
pruebas de regresión de diagnóstico
npm run build
```

Dos archivos de pruebas dependientes de `synthetic_ground_truth.csv` se excluyen del gate remoto porque ese dataset no existe en el checkout de CI:

```text
controlledDatasetDiagnosisInputs.test.ts
formalDiagnosisEvaluator.test.ts
```

La exclusión no oculta fallos introducidos por V2.5-C:

- las regresiones alias-related sí se ejecutan;
- los mocks que fallaron fueron corregidos;
- la integración formal V2.5-C tiene un fixture portable nuevo.

La portabilidad del dataset formal sigue siendo una deuda separada.

---

## 10. Baseline estructural V2.5-B frente a V2.5-C

Artefacto:

[`diagnosis-v2-5-c-comparison.json`](../evidence/diagnosis-v2.5/diagnosis-v2-5-c-comparison.json)

Metodología:

```text
mismo report
+ mismo envelope
+ mismos tres modos
+ cero llamadas a modelos
```

La estimación de tokens usa:

```text
ceil(caracteres / 4)
```

No es un tokenizer de proveedor.

### Resultado agregado del fixture

| Métrica | V2.5-B | V2.5-C | Delta |
|---|---:|---:|---:|
| Caracteres del prompt | 34.125 | 35.690 | +1.565 |
| Tokens estimados | 8.532 | 8.923 | +391 |
| Caracteres de refs visibles | 175 | 70 | -105 |

### Interpretación

Los aliases reducen la longitud dedicada a copiar referencias visibles.

Sin embargo, V2.5-C añade:

- reglas de seguridad;
- metadata contractual;
- allowed aliases por issue;
- schema adaptado.

Por eso no existe ahorro neto de prompt en este fixture. La fase se justifica por integridad, estabilidad y trazabilidad, no por una reducción de tokens ya demostrada.

No se deben publicar afirmaciones sobre:

- latencia;
- output tokens;
- compliance de modelos;
- mejora de SmolLM;

hasta ejecutar una campaña real posterior.

---

## 11. Compatibilidad

### Conservado

- `DiagnosisResponseV2` efectivo con refs fuente;
- validador V2;
- normalizador HITL;
- remediación actual;
- receipts históricos;
- campañas congeladas;
- ruta legacy explícita.

### Nuevo

- snapshot V2.5-C;
- aliases visibles;
- stable refs internas;
- stable diagnosis persistible;
- hashes de proyección y resolución;
- evaluación formal compatible.

---

## 12. Riesgos residuales

### 12.1 Campaña de modelos pendiente

El baseline estructural no demuestra comportamiento de proveedores. Debe ejecutarse una campaña posterior antes del capability gate definitivo.

### 12.2 Dataset formal no portable en CI

Dos suites históricas requieren un archivo ausente. Debe resolverse mediante fixture versionado, descarga verificada o generación determinista.

### 12.3 Colisiones

Los digests están truncados. La implementación produce refs versionadas y pruebas deterministas, pero una política explícita de ampliación automática ante colisión sigue siendo recomendable antes de escalar a grandes volúmenes.

### 12.4 Graphify

La actualización de Graphify requiere el checkout local y no puede certificarse desde el conector GitHub. Debe ejecutarse antes del freeze definitivo si el proyecto lo mantiene como gate obligatorio.

---

## 13. Criterios de aceptación evaluados

| Criterio | Estado del PR |
|---|---|
| Stable ref versionada | implementado |
| Aliases por proyección | implementado |
| `prompt_libre` sin aliases | implementado |
| Snapshot verificable | implementado |
| Mutaciones detectadas | implementado |
| Alias oculto/inexistente/cruzado rechazado | implementado |
| Vista persistible con stable refs | implementado |
| Receipt certifica resolución | implementado |
| Laboratorio alias-aware | implementado |
| Compatibilidad histórica | implementada |
| Baseline estructural reproducible | publicado |
| Campaña real de modelos | pendiente, fuera del cierre técnico de esta fase |
| Graphify local | pendiente |
| Aprobación humana | pendiente |
| Merge a `main` | pendiente |

---

## 14. Decisión de revisión

El PR puede pasar de implementación a revisión humana cuando todos los gates de CI del HEAD estén verdes.

No debe fusionarse automáticamente.

Después de aprobación y merge, el cierre debe:

1. registrar el SHA de `main`;
2. ejecutar Graphify local si continúa siendo obligatorio;
3. actualizar el estado del plan a implementado;
4. crear el freeze de V2.5-C;
5. abrir V2.5-D como capability gate basado en comportamiento.
