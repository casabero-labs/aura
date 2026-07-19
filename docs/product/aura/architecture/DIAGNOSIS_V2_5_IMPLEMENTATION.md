# Diagnosis V2.5: corrección previa al experimento V3

**Estado:** V2.5-A y V2.5-B implementados en `main`; V2.5-C implementado como candidato en PR borrador #52

**Fecha:** 2026-07-19

**Alcance:** contrato de entrada, validación consciente de proyección, identidad de evidencia y evidencia reproducible

**V3 productivo:** no aprobado

## Decisión

La ruta vigente es:

```text
corregir V2
→ medir V2 de forma reproducible
→ estabilizar identidad y proyección
→ evaluar capacidad de modelos
→ construir V3 aislado
→ ejecutar campaña dual
→ decidir con evidencia
```

Esta ruta no introduce un gate por cantidad de parámetros, no modifica los
artefactos históricos de campaña y no conecta V3 al flujo productivo.

## V2.5-A: fábrica única de entrada

`buildDiagnosisInputPackageCoreV2` es la única fábrica que construye la
proyección, el payload, el schema dinámico y sus hashes.

Los entrypoints históricos:

- `buildDiagnosisPromptV2`;
- `buildCompactDiagnosisPromptV2`;

son adaptadores de compatibilidad. El primero selecciona `recommended` y el
segundo `smart_sample`. Ninguno selecciona diez issues ni genera un schema
contra un envelope distinto de la proyección.

El prompt canónico de esa etapa subió a `1.7.0`. `maxConfidence` quedó
incorporado tanto en los metadatos de tarea como en el schema enviado al
proveedor.

## V2.5-B: validación consciente de proyección

`validateDiagnosisResponseV2` puede recibir el `DiagnosisInputPackageV2` real
usado para la inferencia.

Cuando existe ese snapshot, el validador:

1. comprueba que el snapshot pertenece al mismo envelope;
2. verifica que `inputMode` y `evidenceEnvelopeRef` coinciden con el payload;
3. reconstruye las referencias y literales visibles por issue;
4. rechaza refs existentes en el envelope pero ocultas al modelo;
5. evalúa claims literales contra la evidencia visible, no contra el envelope
   completo.

El contexto se propaga por:

- diagnóstico normal;
- validación cruda;
- normalización de revisión humana;
- revalidación efectiva;
- Laboratorio formal;
- evaluación contractual de campaña.

En `prompt_libre`, adivinar un `ev-XXXX` real o citar un literal de una muestra
oculta produce un error bloqueante. Las llamadas históricas que no aportan
snapshot conservan el comportamiento V2 anterior para compatibilidad.

## Baseline reproducible de campaña 2

Comando:

```bash
cd src
npm run diagnosis:campaign-baseline -- \
  ../experiments/tests/campana2/resultado_export/campaign.json \
  ../docs/product/aura/evidence/diagnosis-v2.5/campaign-2-baseline.json
```

Resultado reproducido desde el `campaign.json` congelado:

| Métrica | Resultado |
|---|---:|
| Corridas | 27 |
| Completadas | 20 |
| Fallidas | 7 |
| Fallos terminales `DIAGNOSIS_REFERENCE_INVALID` | 4 |
| Fallos terminales `DIAGNOSIS_SCHEMA_INVALID` | 3 |
| Corridas que contienen `DIAGNOSIS_REFERENCE_INVALID` | 4 |
| Corridas que contienen `DIAGNOSIS_SCHEMA_INVALID` | 7 |
| Ocurrencias `DIAGNOSIS_REFERENCE_INVALID` | 172 |
| Ocurrencias `DIAGNOSIS_SCHEMA_INVALID` | 50 |
| Ocurrencias internas totales | 222 |
| Ocurrencias adicionales después del primer bloqueo | 215 |
| Corridas evaluadas como contractualmente conformes | 11 de 20 |
| Claims registrados por el evaluador | 34 |

Los siete fallos pertenecen a SmolLM3-3B. Esto describe la campaña; no justifica
un umbral general de parámetros.

El valor `604` no se reproduce desde el artefacto congelado de campaña 2 con la
definición explícita anterior. Por tanto, no se usa como indicador hasta que se
identifique otra fuente o fórmula reproducible.

Las 215 ocurrencias adicionales no se clasifican automáticamente como causadas
por el primer error. El baseline declara `rootCauseClassification: not_inferred`;
atribuir causalidad exige una taxonomía de fallos raíz separada.

## V2.5-C: identidad de evidencia e integridad de proyección

Plan detallado:

- [`DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md`](./DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md)

Registro de implementación:

- [`DIAGNOSIS_V2_5_C_IMPLEMENTATION.md`](./DIAGNOSIS_V2_5_C_IMPLEMENTATION.md)

Estado actual:

```text
implementado en agent/diagnosis-v2-5-c
→ PR borrador #52
→ sin merge a main
```

La implementación candidata:

- genera stable refs desde evidencia ya procesada por privacidad;
- expone aliases locales `e1`, `e2`, etc.;
- mantiene refs fuente V2 para compatibilidad;
- persiste una vista con stable refs;
- verifica hashes e invariantes del snapshot;
- certifica la resolución en el receipt;
- migra el Laboratorio formal sin reescribir campañas históricas;
- publica un baseline estructural reproducible.

Baseline estructural:

- [`diagnosis-v2-5-c-comparison.json`](../evidence/diagnosis-v2.5/diagnosis-v2-5-c-comparison.json)

El fixture muestra una reducción de 105 caracteres dedicados a referencias
visibles, pero un aumento total de 1.565 caracteres de prompt por las nuevas
reglas y metadata contractual. La estimación estructural aumenta 391 tokens
usando `ceil(caracteres/4)`. No hubo llamadas a modelos y no se declara una
mejora de latencia, compliance u output tokens.

## Pendiente antes de V3

1. Revisar y aprobar explícitamente el PR #52.
2. Fusionar V2.5-C y registrar el SHA de `main`.
3. Ejecutar Graphify local si continúa siendo un gate obligatorio.
4. Resolver la portabilidad en CI de `synthetic_ground_truth.csv` para las dos
   suites históricas dependientes del archivo.
5. Diseñar V2.5-D como capability gate basado en comportamiento contractual,
   no en cantidad de parámetros.
6. Ejecutar una campaña real posterior para medir aliases con modelos y
   tokenizers reales.
7. Implementar un serializador V3 aislado para medir tokens sobre las mismas
   interpretaciones semánticas.
8. Ejecutar una campaña dual V2/V3 antes de aprobar migración productiva.

## Gates

### V2.5-A y V2.5-B en `main`

- 123 pruebas focalizadas: pasan;
- `npm run typecheck`: pasa;
- `npm run build`: pasa;
- suite completa histórica: 1982 pasan y 6 se omiten;
- permanecen dos expectativas UI históricas fuera de ese alcance.

### V2.5-C en PR #52

El workflow del PR exige:

- typecheck;
- pruebas focalizadas de identidad, proyección, trazabilidad, comparación y
  evaluación formal;
- regeneración exacta del baseline estructural comprometido;
- regresiones portables de diagnóstico;
- build.

Dos suites históricas dependientes de un dataset ausente en el checkout remoto
se excluyen de este gate y están documentadas como deuda de portabilidad. El PR
no debe marcarse como aprobado ni fusionarse mientras el HEAD no tenga todos
los gates remotos verdes.
