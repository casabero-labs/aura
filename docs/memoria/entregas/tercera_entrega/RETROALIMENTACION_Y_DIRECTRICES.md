# Retroalimentacion del profesor y directrices de consolidacion AURA

> Fecha de trabajo: 2026-06-06  
> Proposito: convertir la retroalimentacion de la segunda entrega en una ruta de tercera entrega, resultados y articulo.

## 1. Lectura ejecutiva de la retroalimentacion

El profesor valida la propuesta: AURA es innovadora, pertinente y bien alineada con calidad de datos, gobernanza de IA, ingenieria de datos, privacidad local-first, trazabilidad y control humano. Tambien reconoce que el prototipo existe y que los datasets sinteticos ya demuestran funcionamiento inicial.

La mejora solicitada no es cambiar de tema. Es elevar rigor academico y evidencia:

1. Estado del arte mas critico y comparativo.
2. Literatura mas robusta, preferiblemente indexada y de alto impacto.
3. Metodologia experimental mas precisa.
4. Ground truth, etiquetado, umbrales y mecanismos de evaluacion mejor descritos.
5. Benchmark LLM formal, no solo implementado.
6. Discusion del impacto aplicado en entornos reales.
7. Referencias y conclusiones uniformes.
8. Vinculo explicito entre objetivos y evidencia obtenida.

## 2. Directriz principal

La tercera entrega debe pasar de "AURA funciona" a:

> AURA es una arquitectura hibrida reproducible y evaluable que reduce riesgos de privacidad, variabilidad y alucinacion al combinar evidencia determinista, diagnostico LLM restringido, validacion de scripts y revision humana.

## 3. Respuesta por punto del profesor

| Observacion del profesor | Directriz para AURA | Resultado esperado |
|---|---|---|
| Ampliar discusion critica del estado del arte. | Reorganizar Cap. 2 por familias: rule-based, observabilidad cloud, LLM-based cleaning, arquitecturas hibridas/local-first. | Tabla comparativa + parrafos de posicionamiento cientifico. |
| Diferenciar AURA de soluciones existentes. | Explicar que AURA no compite solo por detectar errores, sino por gobernar un flujo: evidencia determinista -> LLM restringido -> HITL -> benchmark. | Seccion "Contribucion especifica de AURA". |
| Complementar preprints y fuentes tecnicas. | Mantener preprints emergentes como soporte tecnico, pero anclar argumento en literatura indexada y normativa oficial. | Registro bibliografico depurado con fuentes prioritarias. |
| Detallar diseno experimental. | Documentar dataset, ground truth, unidad de evaluacion, reglas, umbrales, TP/FP/FN y repeticion. | Protocolo experimental formal. |
| Formalizar benchmark LLM. | Ejecutar corridas validas con smart sample vs prompt libre, modelos locales/cloud, temperatura fija y export JSON. | Tabla de resultados LLM defendible. |
| Discutir impacto en entornos reales. | Traducir metricas tecnicas a impactos: data downtime, auditoria, procesos analiticos, privacidad, gobernanza. | Discusion aplicada en resultados. |
| Uniformar referencias y conclusiones. | Normalizar APA 7 y retrasar conclusiones fuertes hasta tener benchmark. | Capitulo final coherente y sin promesas absolutas. |
| Vincular objetivos y evidencia. | Crear matriz OE -> evidencia -> resultado -> limite -> siguiente accion. | Tabla central para memoria y defensa. |

## 4. Estado del arte: directriz de posicionamiento

La comparacion debe evitar quedarse en "AURA tiene mas funciones". Debe responder:

- Que riesgo resuelve cada familia de herramientas?
- Que riesgo deja abierto?
- Donde entra AURA?

Taxonomia recomendada:

| Familia | Ejemplos | Fortalezas | Limites | Posicion de AURA |
|---|---|---|---|---|
| Calidad rule-based | reglas, validaciones, perfiles de datos | reproducibilidad, bajo costo, explicabilidad | baja sensibilidad semantica, falsos positivos | AURA conserva esta base como Capa 1. |
| Observabilidad cloud | data monitoring, pipelines, alertas | monitoreo continuo, integracion empresarial | dependencia cloud, costo, exposicion de metadatos | AURA prioriza ejecucion local-first y evidencia exportable. |
| Data cleaning con LLM | agentes, workflows, diagnostico semantico | interpretacion y generacion de acciones | alucinacion, variabilidad, poca trazabilidad | AURA restringe el LLM a evidencia determinista. |
| Hibridas y gobernadas | reglas + IA + humano | balance entre automatizacion y control | requieren metodologia de evaluacion | AURA propone benchmark y HITL como parte del flujo. |

## 5. Metodologia experimental: directriz minima

La tercera entrega debe definir con precision:

- Unidad de evaluacion determinista: hallazgo por regla, columna y conteo esperado.
- Unidad de evaluacion LLM: corrida por modelo, dataset, temperatura, modo de entrada y contrato de prompt.
- Ground truth: dataset sintetico con errores inyectados documentados y, si se agregan datasets reales, etiquetado manual por criterio.
- Etiquetado: cada anomalia debe tener regla esperada, columna, filas afectadas, severidad y justificacion.
- Umbrales: cada regla debe explicar por que se activa, con valor por defecto y sensibilidad esperada.
- Estados de evidencia: `planned`, `attempted_failed`, `preliminary_valid`, `formal_valid`.

## 6. Resultados que deben generarse

Resultados minimos para una tercera entrega fuerte:

1. Tabla de precision/recall/F1 del motor por regla.
2. Tabla global del motor por dataset.
3. Comparacion `smart_sample` vs `prompt_libre`.
4. Comparacion local vs cloud, si hay entorno local disponible.
5. Tabla de alucinaciones: columnas inventadas, claims sin soporte y formato incumplido.
6. Tabla de validez de scripts: columnas invalidas, operaciones destructivas, cobertura de issues.
7. Delta de salud antes/despues de simulacion HITL.
8. Discusion de impacto aplicado.

## 7. Literatura prioritaria verificada

Usar estas fuentes como anclas; complementar luego con mas literatura indexada:

- Data-centric AI en sistemas de informacion: Jakubik et al. (2024), *Business & Information Systems Engineering*, DOI `10.1007/s12599-024-00857-8`.
- Data cascades en IA de alto riesgo: Sambasivan et al. (2021), CHI, DOI `10.1145/3411764.3445518`.
- LLMs para data cleaning: Zhang, Huang y Wu (2024), arXiv `2410.15547`.
- AutoDCWorkflow y benchmark de limpieza con LLM: Li, Fang y Torvik (2024/2025), arXiv `2412.06724`.
- WebLLM e inferencia en navegador: Ruan et al. (2024), arXiv `2412.15803`.
- ISO/IEC 25012:2008 como modelo de calidad de datos.
- Reglamento (UE) 2024/1689 como marco normativo oficial de IA.

## 8. Regla de redaccion para la tercera entrega

Evitar:

- "precision total";
- "elimina alucinaciones";
- "todo se procesa localmente" sin matiz;
- "benchmark demuestra" si solo esta implementado;
- "el LLM detecta" como si fuera evidencia primaria.

Usar:

- "evidencia reproducible";
- "mitigacion de alucinaciones";
- "local-first con modo cloud opcional";
- "resultados preliminares/formales segun estado de evidencia";
- "el LLM interpreta hallazgos deterministas".
