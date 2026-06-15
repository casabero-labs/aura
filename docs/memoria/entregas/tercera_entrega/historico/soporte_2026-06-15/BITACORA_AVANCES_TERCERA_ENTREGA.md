# Bitacora de avances - tercera entrega AURA

> Proposito: registrar cada bloque de trabajo que alimenta la tercera entrega. Cada entrada debe indicar cambio, evidencia, validacion y siguiente paso.

## 2026-06-15 - Consolidacion de benchmark y auditoria UX Casabero

### Cambio realizado

Se tomo como base critica la necesidad de cuidar el discurso del benchmark. El Lab se mantiene como modulo experimental y calibrador opcional, pero se corrigio el contrato tecnico para evitar llamar "JSON compliance" a salidas que realmente cumplen un contrato textual.

Cambios principales:

- `contractCompliance` incorporado en `BenchmarkResult`.
- `formatCompliance` conservado como alias historico.
- `jsonCompliance` reservado a JSON real.
- Penalizacion de columnas alucinadas basada en `knownColumnCount`.
- `Diagnosis Reliability Score` basado en evidencia observada y no en promesas del modo de entrada.
- Lab actualizado para mostrar "Contrato".
- Exportar actualizado para mostrar "Cobertura" en lugar de "Objetivos" en primer plano.
- Fix responsive del perfil mobile/stepper.

### Archivos principales

| Archivo | Rol |
|---|---|
| `src/types.ts` | Nuevos campos de contrato/evidencia |
| `src/services/benchmark/evaluationService.ts` | Score compuesto y reliability score corregidos |
| `src/services/benchmark/hallucinationDetector.ts` | Deteccion de evidencia observada |
| `src/services/benchmarkService.ts` | Propagacion de `contractCompliance` y resumen de evidencia |
| `src/components/BenchmarkLab.tsx` | UI del Lab con lenguaje correcto |
| `src/index.css` | Fix de overflow mobile |
| `docs/experiments/PROTOCOLO_BENCHMARK_AURA_2026-06.md` | Protocolo formal minimo del benchmark |
| `docs/qa/AUDITORIA_UX_CASABERO_AURA_2026-06-14.md` | Auditoria UX por fase |

### Evidencia

- `npm test` -> 133/133 OK.
- `npm run build` -> OK.
- `npm run test:e2e` -> 5/5 OK.
- Verificacion mobile Titanic -> sin overflow (`scrollWidth=390`).
- Captura: `docs/qa/titanic-audit-2026-06-14/15-mobile-profile-after-ux-fix.png`.

### Decision academica

La tercera entrega debe decir:

> El benchmark de AURA es un laboratorio de calibracion integrado. Solo se reportan como formales las corridas que cumplen contrato, ausencia de columnas fantasma, script valido y correspondencia con ground truth.

No debe decir:

> El benchmark demuestra que un modelo es superior.

Eso solo sera valido cuando existan corridas formales exportadas.

### Pendiente directo

`AURA-UX-STRICT-02`

1. Mensaje inline cuando el proveedor LLM no este disponible.
2. Advertencia fuerte cuando la simulacion no mejora score/issues.
3. Empty/error state accionable en Lab para API key/WebGPU.
4. Repetir auditoria Titanic desktop/mobile.

## 2026-06-14 - Auditoria estricta con Titanic

### Cambio realizado

Se ejecuto una auditoria human-first completa con `titanic.csv`, registrando cada click del flujo.

### Resultado

- Flujo principal completo: carga, perfil, diagnostico, script, revision, exportacion y Lab.
- Veredicto: aprobado con advertencias.
- Diagnostico LLM real no ejecutado por proveedor no disponible.
- Script determinista generado con safety score alto, pero cobertura parcial.
- Simulacion no mejoro el score ni redujo issues en Titanic.

### Evidencia

- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.pdf`
- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.md`
- `docs/qa/titanic-audit-2026-06-14/aura_audit_1781480789856.json`

### Pendiente derivado

- No afirmar diagnostico cognitivo real si el boton LLM estuvo deshabilitado.
- Mejorar mensajes de proveedor no disponible.
- Mejorar comunicacion del delta cero.

## 2026-06-14 - Limpieza UX del flujo principal

### Cambio realizado

Se separo el flujo principal del Lab y se elimino de la UI material interno de seguimiento como matrices y loops.

### Resultado

- La app queda organizada en Auditoria, Laboratorio y Configuracion.
- Perfil, diagnostico, script, revisar y exportar priorizan resumen operativo.
- Detalles tecnicos quedan colapsados.
- Lab queda como calibrador opcional.

### Evidencia

- `docs/qa/AURA_QA_HUMAN_FIRST_2026-06-14.md`
- E2E human-first completo.

### Pendiente derivado

- Continuar reduciendo lenguaje academico en primer plano.
- Mantener OE, matrices y protocolos dentro de documentos, no dentro de la app.

## Regla de continuidad

Cada nuevo bloque de trabajo debe cerrar con:

1. que se cambio;
2. que evidencia genero;
3. que validacion paso;
4. que no se puede afirmar aun;
5. cual es el siguiente loop exacto.
