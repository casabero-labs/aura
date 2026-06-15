# Documento vivo de tercera entrega - AURA

> Actualizado: 2026-06-15  
> Estado: borrador operativo en construccion. Este documento consolida lo que se va implementando, verificando y dejando listo para la tercera entrega del TFM y para el articulo.

## 1. Proposito de la tercera entrega

La tercera entrega debe demostrar que AURA paso de ser un prototipo funcional a una arquitectura defendible, evaluable y trazable para auditoria de calidad de datos asistida por IA.

El foco no es agregar mas pantallas. El foco es producir evidencia:

- reproducible;
- exportable;
- vinculada a objetivos;
- honesta sobre limitaciones;
- util para memoria y articulo.

## 2. Respuesta a la retroalimentacion del profesor

La retroalimentacion recibida despues de la segunda entrega reconoce la pertinencia de AURA, pero exige mayor rigor academico y metodologico. Las acciones de tercera entrega se ordenan alrededor de cinco frentes.

| Observacion del profesor | Respuesta en tercera entrega | Evidencia generada |
|---|---|---|
| Profundizar estado del arte y posicionamiento de AURA | Separar contribucion principal de laboratorio experimental; no vender benchmark como resultado fuerte sin corridas formales | `RETROALIMENTACION_Y_DIRECTRICES.md`, `PROTOCOLO_BENCHMARK_AURA_2026-06.md` |
| Detallar diseno experimental | Definir estados `attempted_failed`, `preliminary_valid`, `formal_valid`; exigir ground truth para resultado formal | `MATRIZ_EVIDENCIA_RESULTADOS.md`, `evaluationService.ts` |
| Fortalecer benchmark multimodelo | Convertir el Lab en calibrador opcional de configuracion, no en flujo obligatorio | `BenchmarkLab.tsx`, protocolo de benchmark |
| Evidenciar utilidad aplicada | Mantener HITL, script validation, simulacion sobre copia y delta de salud | `ReviewStep.tsx`, export JSON, auditoria Titanic |
| Revisar forma y trazabilidad | Reducir ruido de UI, mover evidencia tecnica a detalles colapsados, auditar UX con estandar Casabero | `AUDITORIA_UX_CASABERO_AURA_2026-06-14.md` |

## 3. Contribucion principal de AURA

AURA se define como una arquitectura hibrida local-first para:

1. cargar y perfilar datasets CSV en navegador;
2. ejecutar auditoria determinista reproducible;
3. generar diagnostico asistido por LLM bajo contrato de evidencia;
4. proponer scripts de limpieza controlados;
5. validar scripts antes de aprobacion humana;
6. simular efectos sobre una copia del dataset;
7. exportar evidencia tecnica y ejecutiva;
8. comparar configuraciones LLM en un laboratorio opcional.

El Lab no es la contribucion principal por si solo. Su rol es calibrar configuraciones y producir evidencia experimental cuando existan proveedor disponible, ground truth y corridas exportadas.

## 4. Estado actual del flujo principal

| Fase | Estado actual | Evidencia |
|---|---|---|
| Subir CSV | Carga local, parseo en navegador, contrato de ingestion, manejo de errores | `executionEvidence.ts`, `IngestionEvidenceCard.tsx` |
| Perfilar | Score, hallazgos principales, columnas afectadas, detalles tecnicos colapsados | `ProfileStep.tsx`, E2E human-first |
| Diagnostico | UI compacta; proveedor local/cloud; contrato de entrada; bloqueo honesto si proveedor no disponible | `DiagnosisStep.tsx`, auditoria Titanic |
| Script | Generacion determinista/LLM; safety score; cobertura; columnas invalidas; operaciones destructivas | `ScriptGenerationStep.tsx`, `scriptValidationService.ts` |
| Revisar | Revision humana, checklist HITL, aprobacion, simulacion sobre copia | `ReviewStep.tsx`, `HitlDecision` |
| Exportar | PDF, JSON tecnico, CSV de hallazgos, script aprobado, manifest y limitaciones | `App.tsx`, `evidenceManifest.ts` |
| Laboratorio | Comparacion opcional de proveedor, modelo, temperatura y modo de entrada | `BenchmarkLab.tsx`, `benchmarkService.ts` |

## 5. Mejora reciente del benchmark

Se corrigio el discurso y el contrato tecnico del benchmark para evitar afirmaciones academicas debiles.

Cambios aplicados:

- `contractCompliance` se incorpora como nombre correcto del cumplimiento de salida.
- `formatCompliance` queda como alias historico.
- `jsonCompliance` se reserva solo para JSON real parseable y con campos requeridos.
- La penalizacion de columnas alucinadas usa `knownColumnCount`, no `tokensGenerated`.
- `Diagnosis Reliability Score` usa evidencia observada:
  - columnas reales mencionadas;
  - reglas reales mencionadas;
  - bad samples citados;
  - cero columnas fantasma;
  - validez de script;
  - latencia como tradeoff.

Esto permite defender que AURA no premia un modo de entrada solo porque deberia ser mejor, sino por la evidencia que efectivamente aparece en la respuesta.

## 6. Auditoria UX Casabero

Se realizo auditoria por fase con base en:

- `estandar-casabero` MCP;
- `examples/frontend/showcase.html`;
- `UX_UI_MANIFESTO.md`;
- `HUMAN_FIRST_UX.md`;
- flujo real con Titanic.

Resultado principal:

- la app ya separa flujo principal y Lab;
- la evidencia tecnica queda colapsada;
- no debe volver a mostrarse una matriz interna de desarrollo en la app;
- se corrigio overflow mobile observado con Titanic;
- quedan pendientes mensajes accionables para proveedor LLM no disponible y delta de simulacion igual a cero.

Documento asociado:

- `docs/qa/AUDITORIA_UX_CASABERO_AURA_2026-06-14.md`

## 7. Validacion ejecutada

Ultima validacion completa registrada:

| Comando | Resultado |
|---|---|
| `npm test` | 133/133 OK |
| `npm run build` | OK, con warning conocido de chunk grande WebLLM/PDF |
| `npm run test:e2e` | 5/5 OK |
| Verificacion mobile Titanic | `scrollWidth=390`, sin overflow |

La auditoria Titanic previa dejo evidencia en:

- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.pdf`
- `docs/qa/titanic-audit-2026-06-14/AURA_TITANIC_STRICT_AUDIT_2026-06-14.md`
- `docs/qa/titanic-audit-2026-06-14/aura_audit_1781480789856.json`

## 8. Limitaciones actuales

| Limitacion | Impacto |
|---|---|
| Diagnostico LLM no corre si WebGPU/API key no esta disponible | No se puede afirmar diagnostico cognitivo real en esa configuracion |
| Lab sin proveedor activo no produce corridas formales | OE4 queda implementado pero pendiente de evidencia experimental formal |
| Delta de simulacion puede ser 0 aunque se apruebe script | Debe comunicarse con advertencia mas fuerte |
| Detector anti-alucinacion no cubre claims semanticos no numericos | No se debe afirmar eliminacion total de alucinaciones |
| CSS mantiene estilos historicos no visibles | Deuda de mantenimiento, no bloqueo funcional actual |

## 9. Claims permitidos para la tercera entrega

Permitido:

- AURA implementa un flujo local-first de auditoria de CSV con evidencia exportable.
- El motor determinista produce hallazgos reproducibles y puede evaluarse contra ground truth.
- La capa LLM esta restringida por contratos de entrada y validacion posterior.
- El Lab permite comparar configuraciones, pero solo sus corridas con proveedor disponible, ground truth y validaciones limpias son formales.
- AURA incorpora revision humana antes de simular remediaciones.

No permitido aun:

- Decir que un modelo es superior sin tabla formal de corridas.
- Decir que AURA elimina alucinaciones.
- Decir que reduce data downtime con metrica real si no se mide en entorno productivo.
- Decir que el diagnostico LLM fue exitoso cuando el proveedor estuvo no disponible.

## 10. Proximos pasos

1. Mejorar estados UX para proveedor LLM no disponible.
2. Advertir con mayor fuerza cuando `healthDelta.scoreDelta === 0`.
3. Ejecutar corridas reales del Lab con proveedor disponible.
4. Exportar benchmark formal.
5. Generar tablas de resultados para memoria y articulo.
6. Redactar secciones de metodologia, resultados y discusion desde evidencia.
