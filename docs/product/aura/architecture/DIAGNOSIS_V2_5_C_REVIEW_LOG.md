# Diagnosis V2.5-C: registro final de revisión

**Estado:** implementación candidata verificada en PR borrador #52

**Fecha:** 2026-07-19

**Rama:** `agent/diagnosis-v2-5-c`

**Destino:** `main`

**Merge:** no realizado

---

## 1. Propósito

Este registro complementa:

- [`DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md`](./DIAGNOSIS_V2_5_C_EVIDENCE_IDENTITY_PLAN.md);
- [`DIAGNOSIS_V2_5_C_IMPLEMENTATION.md`](./DIAGNOSIS_V2_5_C_IMPLEMENTATION.md).

Documenta los dos últimos retornos al nodo **CORREGIR** y los resultados de la
revisión automatizada previa a la aprobación humana.

---

## 2. Ciclo 8: colisión de digest truncado

### Hallazgo de revisión

La primera implementación deduplicaba entradas que compartían:

```text
issueId
+ stableEvidenceRef truncada
```

Ese criterio permitía dos interpretaciones:

1. evidencia semánticamente idéntica repetida;
2. dos identidades completas distintas que colisionaban después del truncamiento.

Tratar ambos casos igual era inseguro.

### Corrección

Se añadió un digest completo de identidad calculado sobre:

```text
material canónico del issue
+ material canónico de la muestra ya privatizada
```

La construcción aplica ahora esta regla:

```text
misma stable ref truncada
+ mismo digest completo
+ mismo issueId
→ duplicado semántico permitido

misma stable ref truncada
+ distinto digest completo o distinto issueId
→ fallo cerrado por colisión
```

### Pruebas

Se añadieron casos para:

- duplicados semánticos idénticos;
- colisión simulada con digest completo diferente;
- reutilización de una stable ref entre issues distintos.

---

## 3. Ciclo 9: baseline falsamente no reproducible

### Hallazgo de CI

El gate que regenera `diagnosis-v2-5-c-comparison.json` falló aunque las métricas
no habían cambiado.

### Causa

`fixtureHash` se calculaba sobre el envelope completo. El envelope contiene
`datasetFingerprint.generatedAt`, por lo que cada ejecución producía un hash
distinto.

El baseline era reproducible en métricas, pero no en identidad del fixture.

### Corrección

`fixtureHash` se deriva ahora únicamente de:

```text
report canónico
+ dataset SHA-256
+ delimitador
+ nivel de privacidad
```

No incluye timestamps ni otros campos variables de ejecución.

Hash estable resultante:

```text
4320edb48e9d5627dc4b318d168d59efb3931f3f14fd6b2392eb16e50ffb3106
```

El workflow vuelve a generar el artefacto y exige igualdad byte a byte con el
JSON versionado.

---

## 4. Gates automatizados

La ejecución verificada del workflow comprobó:

### Typecheck

```text
npm run typecheck
→ éxito
```

### Pruebas focalizadas

```text
5 archivos
22 pruebas
22 aprobadas
```

Cobertura focal:

- identidad estable;
- reordenamientos;
- colisiones;
- aliases por proyección;
- integridad del snapshot;
- separación raw/effective/stable;
- trazabilidad del receipt;
- evaluación formal;
- baseline estructural.

### Regresiones portables de diagnóstico

```text
20 archivos
187 pruebas
187 aprobadas
```

Persisten avisos de React sobre actualizaciones no envueltas en `act(...)` en
`DiagnosisNormalizationNotice.test.tsx`. Son warnings no bloqueantes y las
cuatro pruebas afectadas pasan.

### Baseline

```text
regeneración
+ comparación byte a byte
→ éxito
```

### Build

```text
npm run build
→ éxito
```

---

## 5. Suites históricas no ejecutadas en el gate remoto

Se excluyen temporalmente:

```text
controlledDatasetDiagnosisInputs.test.ts
formalDiagnosisEvaluator.test.ts
```

Ambas requieren `synthetic_ground_truth.csv`, archivo que no está presente en
el checkout de GitHub Actions.

La exclusión responde a una deuda de portabilidad preexistente. No se excluyen:

- tests de aliases;
- tests de pipeline;
- tests de validador;
- tests de integración;
- evaluación formal V2.5-C con fixture portable;
- trazabilidad de receipts.

---

## 6. Resultado del baseline estructural

| Métrica | V2.5-B | V2.5-C | Delta |
|---|---:|---:|---:|
| Caracteres del prompt | 34.125 | 35.690 | +1.565 |
| Tokens estimados por `ceil(chars/4)` | 8.532 | 8.923 | +391 |
| Caracteres de refs visibles | 175 | 70 | -105 |

Interpretación:

- los aliases reducen el texto dedicado a copiar referencias;
- la metadata y las reglas de integridad aumentan el prompt total;
- no se demuestra ahorro neto de tokens;
- no hubo llamadas a modelos;
- no se demuestra mejora de latencia, compliance o calidad semántica.

---

## 7. Veredicto técnico

La implementación candidata satisface los objetivos técnicos de V2.5-C:

- stable refs versionadas;
- aliases locales;
- protección ante refs ocultas o cruzadas;
- snapshot reconstruible;
- colisiones detectadas con fallo cerrado;
- vista persistible con stable refs;
- receipt que certifica la resolución;
- producto y Laboratorio formal conectados;
- compatibilidad histórica explícita;
- baseline estructural reproducible.

El veredicto técnico es:

```text
APTO PARA REVISIÓN HUMANA
```

No significa:

```text
aprobado para merge
fusionado a main
freeze definitivo
capability gate completado
V3 aprobado
```

---

## 8. Pendientes antes del freeze definitivo

1. revisión humana del PR #52;
2. decisión explícita de aprobación o corrección;
3. merge, preferiblemente mediante squash por el historial iterativo de la rama;
4. ejecución local de Graphify si continúa siendo gate obligatorio;
5. registro del SHA final de `main`;
6. creación del freeze V2.5-C;
7. apertura de V2.5-D para capability gate basado en comportamiento.
