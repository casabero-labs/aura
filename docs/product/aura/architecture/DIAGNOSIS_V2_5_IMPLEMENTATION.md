# Diagnosis V2.5: corrección previa al experimento V3

**Estado:** V2.5-A, V2.5-B y baseline V2 implementados

**Fecha:** 2026-07-19

**Alcance:** contrato de entrada, validación consciente de proyección y evidencia reproducible

**V3 productivo:** no aprobado

## Decisión

La ruta vigente es:

```text
corregir V2
→ medir V2 de forma reproducible
→ construir V3 aislado
→ ejecutar campaña dual
→ decidir con evidencia
```

Esta iteración no introduce un gate por cantidad de parámetros, no modifica los
artefactos históricos de campaña y no conecta V3 al flujo productivo.

## V2.5-A: fábrica única de entrada

`buildDiagnosisInputPackageCoreV2` es la única fábrica que construye la
proyección, el payload, el schema dinámico y sus hashes.

Los entrypoints históricos:

- `buildDiagnosisPromptV2`;
- `buildCompactDiagnosisPromptV2`;

son ahora adaptadores de compatibilidad. El primero selecciona `recommended` y
el segundo `smart_sample`. Ninguno selecciona diez issues ni genera un schema
contra un envelope distinto de la proyección.

El prompt canónico sube a `1.7.0`. `maxConfidence` queda incorporado tanto en
los metadatos de tarea como en el schema enviado al proveedor.

## V2.5-B: validación consciente de proyección

`validateDiagnosisResponseV2` acepta opcionalmente el `DiagnosisInputPackageV2`
real usado para la inferencia.

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

## Pendiente antes de V3

1. Definir aliases cortos visibles para el LLM y refs estables internas.
2. Diseñar un capability gate basado en comportamiento contractual, no en
   cantidad de parámetros.
3. Implementar un serializador V3 aislado para medir tokens sobre las mismas
   interpretaciones semánticas. El baseline deja ese campo en
   `pending_v3_serializer`.
4. Resolver antes del assembler V3:
   - mapa frente a array;
   - evidencia visible frente a evidencia del motor;
   - visualizaciones;
   - dataset sin issues;
   - compatibilidad formal de receipts históricos;
   - elevación unidireccional de revisión por parte del modelo.
5. Ejecutar una campaña dual V2/V3 antes de aprobar migración productiva.

## Gates de esta iteración

- 123 pruebas focalizadas de builders, sistema, validador, pipeline,
  integración, baseline y evaluación formal: pasan;
- `npm run typecheck`: pasa;
- `npm run build`: pasa, con los avisos de chunks grandes ya existentes;
- suite completa de Vitest: 1982 pasan y 6 se omiten; quedan dos expectativas
  UI fuera de este alcance que ya están desalineadas en `origin/main`:
  `pipelineDiagnosticReportState.test.tsx` y
  `exportJsonPreflight.integration.test.tsx`;
- `graphify update .`: ejecutado después de cerrar los cambios de código.
