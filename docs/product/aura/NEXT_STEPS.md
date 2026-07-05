# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica queda como carpeta histórica en `docs/tercera_entrega_aura/`.

## Estado de referencia

| Fase | Estado | Referencia |
|---|---|---|
| Phase 3 | Cerrada y congelada | `d3774dd5ac98d89ca4454c693b1b0a30856cd191` |
| Phase 4 | Cerrada y congelada | `05878e4a960afd11d564a60f4924bfb8f0b527e7` |
| Phase 5 | Cerrada y congelada | `40a376929fcaad13b1809bd0c8ba895011ceb8cb` |
| Phase 6 | Cerrada y congelada | `b689cce5012edf33d27e2e85bb325878ab79125a` |
| Phase 7 | Cerrada y congelada | `58891c215604d7a140774370d133ce06460691d5` |
| Phase 8 | Cerrada y congelada | `7fc32409160e5e9ee84d38bbe56db2fb4e504af4` |
| Phase 9 | Cerrada y congelada | `1344935ff9bb87f73b24b8f90d8cb15052228328` |

## Regla de frontera

La evolución del producto debe documentarse aquí, no dentro de `docs/tercera_entrega_aura/`.

No preparar una entrega académica futura sin instrucción explícita del usuario.

## Phase 10 — Calibración experimental opcional

Ruta principal: `docs/product/aura/phase_10/`.

Objetivo: integrar el antiguo laboratorio como opción informada dentro del flujo principal de AURA, sin convertirlo en requisito ni en promesa de benchmark formal.

Regla UX:

- acción principal: `Continuar diagnóstico normal`;
- acción secundaria: `Activar comparación experimental`.

## Próximo frente recomendado

### Phase 10 L7 — Revisión del orquestador sobre preflight de exportación 2.0

Las capas L3-L7 están completas y validadas técnicamente. El siguiente control recomendado es:

1. revisar que `validateAuraExportPackage` cubre las invariantes críticas del contrato 2.0;
2. confirmar que `App.tsx` ejecuta el preflight antes de `downloadTextFile`;
3. verificar que un paquete inválido cancela la descarga y muestra un aviso controlado;
4. contrastar el subconjunto runtime con el JSON Schema L6;
5. decidir si una fase posterior necesita un motor JSON Schema completo.

Closeout: `docs/product/aura/phase_10/L7_EXPORT_PREFLIGHT_CLOSEOUT.md`.

## Frente secundario

### Documentation Maintenance L3 — Migrar Phase 9 y Phase 8

Motivo: Phase 9 y Phase 8 son posteriores a la tercera entrega y no deben vivir dentro de `docs/tercera_entrega_aura/`.

Acciones recomendadas:

1. Mover `docs/tercera_entrega_aura/05_desarrollo/phases/phase_09/` a `docs/product/aura/phases/phase_09/`.
2. Mover `docs/tercera_entrega_aura/05_desarrollo/phases/phase_08/` a `docs/product/aura/phases/phase_08/`.
3. Mover `docs/tercera_entrega_aura/03_evidencia/phase_08/` a `docs/product/aura/evidence/phase_08/`.
4. Actualizar referencias internas.
5. Dejar notas de migración si alguna ruta antigua queda referenciada.

## Frentes funcionales completados

### Phase 10 L2 — Integrar opt-in al pipeline ✅

Completado. Ver `docs/product/aura/phase_10/L2_INTEGRATION_CLOSEOUT.md`.

Resumen:

1. Estado `calibration` agregado al pipeline.
2. `CalibrationOptInExplainer` se muestra después de perfilamiento.
3. Acción primaria: `Continuar diagnóstico normal`.
4. Laboratorio retirado de navegación principal (escritorio, móvil, Home CTA).
5. `BenchmarkLab` conservado internamente para opt-in experimental.

L2 solo cubre integración UX inmediata. La capa técnica de reemplazo de `BenchmarkLab` por experiencia embebida queda para L3 o L4.

Condiciones de completitud:

- typecheck pasa
- build pasa
- `calibration` está integrado al pipeline
- Laboratorio ya no aparece como módulo principal visible
- BenchmarkLab sigue disponible internamente
- No se preparó entrega académica

### Phase 10 L3 — Experiencia embebida de calibración ✅

Completado localmente. Ver `docs/product/aura/phase_10/L3_EMBEDDED_CALIBRATION_CLOSEOUT.md`.

Resumen:

1. El opt-in abre `CalibrationEmbeddedPanel` dentro del estado `calibration`.
2. La acción primaria `Continuar diagnóstico normal` permanece disponible.
3. El panel ejecuta una comparación controlada con la configuración activa.
4. Los resultados se guardan en `benchmarkResults`.
5. El usuario puede cerrar la calibración y volver a la explicación.
6. `BenchmarkLab` se conserva internamente y deja de ser el destino del opt-in.

Condiciones verificadas:

- typecheck pasa;
- build pasa con advertencias preexistentes de chunks;
- tests focales de panel y pipeline pasan;
- no se modificó `auditEngine`, scoring, contratos v2 ni freezes anteriores;
- no se preparó entrega académica;
- publicado en `origin/main` después de la validación local.

### Phase 10 L4 — Evidencia defendible de calibración ✅

Completado localmente. Ver `docs/product/aura/phase_10/L4_CALIBRATION_EVIDENCE_CLOSEOUT.md`.

Resumen:

1. El manifest resume calibración como `none`, `attempted`, `preliminary` o `formal`.
2. Se conservan totales, corridas completadas, intentos fallidos/no disponibles y corridas `formal_valid`.
3. Se eliminó el ranking heredado del manifest.
4. El JSON técnico exporta `calibrationEvidence` con clasificación, resumen, resultados y límites.
5. La pantalla Exportar muestra el estado de calibración sin abrir `BenchmarkLab`.

Condiciones verificadas:

- typecheck pasa;
- build pasa con advertencias preexistentes de chunks;
- 20 tests focales de `evidenceManifest` pasan;
- no se modificó `auditEngine`, scoring, contratos v2 ni freezes anteriores;
- no se preparó entrega académica;
- publicado en `origin/main` después de la validación local.

### Phase 10 L5 — Contrato estable de exportación y compatibilidad JSON ✅

Completado localmente. Ver `docs/product/aura/phase_10/L5_EXPORT_SCHEMA_CLOSEOUT.md`.

Resumen:

1. El JSON técnico declara contrato `aura-technical-export` versión `2.0`.
2. Los bloques canónicos quedan enumerados de forma estable.
3. `calibrationEvidence` siempre está presente, incluso sin corridas.
4. La migración desde `experiment` se documenta en metadatos de deprecación.
5. No se reintroduce un alias heredado silencioso.
6. `App.tsx` delega la estructura exportada a un helper puro testeable.

Condiciones verificadas:

- typecheck pasa;
- build pasa con advertencias preexistentes de chunks;
- 5 tests focales de `exportPackage` pasan;
- no se modificó `evidenceManifest`, `auditEngine`, scoring, contratos v2 ni freezes anteriores;
- no se preparó entrega académica;
- publicado en `origin/main` después de la validación local.

### Phase 10 L6 — JSON Schema formal para exportación técnica 2.0 ✅

Completado y preparado para publicación. Ver `docs/product/aura/phase_10/L6_JSON_SCHEMA_CLOSEOUT.md`.

Resumen:

1. Existe JSON Schema Draft 2020-12 independiente para `aura-technical-export` 2.0.
2. Exige los seis bloques canónicos del paquete.
3. Verifica constantes de nombre, versión, compatibilidad y clasificación experimental.
4. Restringe el estado de calibración a `none`, `attempted`, `preliminary` o `formal`.
5. Prohíbe el bloque raíz heredado y documenta su migración.
6. Un test estructural lee el schema real y lo contrasta con un paquete generado.

Condiciones verificadas:

- typecheck pasa;
- build pasa con advertencias preexistentes de chunks;
- 8 tests del filtro `exportPackage` pasan;
- 3 tests focales de `exportPackageSchema` pasan;
- no se modificó `exportPackage`, `evidenceManifest`, `auditEngine`, scoring, contratos v2 ni freezes anteriores;
- no se preparó entrega académica;
- commit y push autorizados únicamente después de las validaciones exitosas.

### Phase 10 L7 — Preflight interno del paquete exportado 2.0 ✅

Completado y preparado para publicación. Ver `docs/product/aura/phase_10/L7_EXPORT_PREFLIGHT_CLOSEOUT.md`.

Resumen:

1. Existe un validador interno ligero para las invariantes críticas del contrato `aura-technical-export` 2.0.
2. La validación comprueba identidad, versión, bloque canónico, compatibilidad y evidencia de calibración.
3. El bloque raíz heredado queda rechazado.
4. `App.tsx` ejecuta el preflight antes de iniciar la descarga.
5. Un paquete inválido cancela el JSON y muestra una advertencia controlada.
6. Se cubren entradas válidas, no estructuradas y violaciones contractuales con tests focales.

Condiciones verificadas:

- typecheck pasa;
- build pasa con advertencias preexistentes de imports y chunks;
- 8 tests del filtro `exportPackage` pasan;
- 3 tests focales de `exportPackageSchema` pasan;
- 6 tests focales de `exportContractValidation` pasan;
- no se modificaron schema L6, `exportPackage`, `evidenceManifest`, `auditEngine`, scoring, contratos v2 ni freezes anteriores;
- no se preparó entrega académica;
- commit y push autorizados únicamente después de las validaciones exitosas.

## Claims de producto

Permitido:

- AURA tiene fases técnicas congeladas y documentadas hasta Phase 9.
- AURA conserva límites explícitos para ejecución, evidencia, proveedores y claims.
- Las comparaciones de proveedores requieren evidencia clasificada y no deben venderse como veredicto absoluto.

No permitido:

- declarar AURA lista para producción general;
- decir que AURA corrige datasets reales sin revisión humana;
- presentar comparaciones como benchmark definitivo sin protocolo formal;
- afirmar que la cuarta entrega ya empezó;
- decir que el laboratorio determina el mejor modelo universal.

## Nota de migración

Este documento reemplaza el uso vivo de `docs/tercera_entrega_aura/05_desarrollo/NEXT_STEPS.md`.

La versión dentro de `tercera_entrega_aura` debe quedar como nota congelada de frontera, no como guía activa.
