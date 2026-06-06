# Reporte de consistencia del repositorio

> Fecha: 2026-05-15.
> Objetivo: reducir contradicciones entre agentes, memoria, documentacion, codigo y experimentos.

## 1. Decision tomada

El criterio de continuidad del proyecto queda centralizado en:

`docs/memoria/entregas/segunda_entrega/LINEA_OFICIAL_AURA.md`

Todos los agentes deben partir de esa formulacion, sin perder de vista que la primera entrega ya fue revisada y valorada positivamente:

> AURA genera evidencia reproducible con una Capa 1 determinista, interpreta esa evidencia con LLMs bajo restricciones anti-alucinacion y mantiene gobernanza humana mediante reportes y scripts auditables.

## 2. Cambios de consistencia aplicados

Los cambios aplicados no modifican el documento Word de la primera entrega. Solo alinean documentacion de apoyo, instrucciones para agentes y artefactos del repo para evitar contradicciones durante la preparacion de la segunda entrega.

| Archivo | Cambio |
|---|---|
| `GEMINI.md` | Se agrego referencia a la linea oficial y se corrigieron las capas para evitar "precision 100%" y "todo local" como afirmaciones absolutas. |
| `README.md` | Se ajusto el resumen del proyecto y los objetivos para hablar de reproducibilidad, benchmark y comparacion local/cloud. |
| `docs/CENTRO_COMANDO_ACADEMICO.md` | Se enlazo la linea oficial, se actualizaron estados de experimentos y se cambio "precision garantizada" por "evidencia reproducible". |
| `docs/tablas/catalogo_reglas_motor_determinista.md` | Se reemplazo "Precision EM=1.00" por "reproducibilidad determinista" y referencia a resultados empiricos. |
| `docs/tablas/tabla_comparativa_herramientas.md` | Se cambio AURA de "EM=1.00" a "22+ reglas reproducibles" y se matizo local-first. |
| `docs/tablas/diseno_capa_cognitiva.md` | Se actualizo la fuente real de la Capa 2: `aiProvider.ts` y `services/providers/`. |
| `docs/publicacion/borrador_articulo.md` | Se reformulo el metodo del futuro paper como motor reproducible + LLM controlado + arquitectura evaluable. |
| `experiments/benchmarks/validate_deterministic.ts` | Se cambio la nota final para evitar usar EM=1.00 sin validacion posterior. |
| `src/services/pdfGenerator.ts` | Se actualizo el titulo del reporte de "Motor de 20 Reglas" a "Motor de 22+ Reglas". |

## 3. Estado actual de consistencia

### Consistente

- La tesis del proyecto esta alineada en README, GEMINI, centro academico y pre-paper.
- La Capa 1 ya no se presenta como perfecta, sino como reproducible y medible.
- La Capa 0 se describe con matiz: local-first para CSV y motor determinista; IA local o cloud segun proveedor.
- La Capa 2 apunta a la arquitectura real de proveedores, no solo al servicio legacy de Gemini.

### Restos historicos aceptables

Algunas apariciones de "EM=1.00", "precision perfecta" o "todo local" permanecen dentro de archivos de observaciones en `segunda_entrega` porque estan citando formulaciones antiguas que deben corregirse. No son la linea oficial.

### Riesgos pendientes

| Riesgo | Impacto | Accion recomendada |
|---|---|---|
| `src/services/geminiService.ts` existe pero la app usa `aiProvider.ts` y `services/providers/` | Puede confundir a agentes nuevos | Decidir si se elimina, se archiva o se marca explicitamente como legacy |
| `experiments/results/benchmark_multimodelo.json` contiene ejecucion fallida por API key | No sirve como resultado OE2 | Reejecutar benchmark con credenciales validas o marcar como intento fallido |
| Archivo temporal de Word `~$imera_Entrega_TFM_Joseph_Gari_v2.docx` | Probablemente creado por Word al abrir el documento | No tocar sin confirmar; puede desaparecer al cerrar Word |
| `.DS_Store` aparece modificado | Ruido de macOS | Ignorar o limpiar en una decision separada |
| Documento Word de segunda entrega aun no existe | La memoria oficial todavia no incorpora los cambios | Crear borrador de segunda entrega y migrar la nueva version de Cap. 3 |

## 4. Regla operativa para siguientes agentes

Antes de editar codigo o memoria:

1. Leer `GEMINI.md`.
2. Leer `docs/memoria/entregas/segunda_entrega/LINEA_OFICIAL_AURA.md`.
3. Si se toca `src/`, dejar evidencia en `docs/` o `experiments/results/`.
4. No afirmar precision perfecta, cero alucinaciones o local-first absoluto sin benchmark que lo sostenga.
5. Usar `src/services/aiProvider.ts` y `src/services/providers/` como arquitectura vigente de IA.

## 5. Siguiente paso recomendado

Crear el borrador de la segunda entrega a partir del Word revisado de la primera entrega, manteniendo su estructura y aplicando ajustes incrementales:

1. Capitulo 2 cerrado con tabla comparativa y contraste de enfoques.
2. Capitulo 3 cerrado con objetivos medibles y metodologia paso a paso.
3. Seccion 3.3.3 ajustada, no reemplazada, como arquitectura experimental por capas.
4. Capitulo 5 avanzado con trazabilidad directa a codigo, diagramas, requisitos y benchmarks preliminares.
