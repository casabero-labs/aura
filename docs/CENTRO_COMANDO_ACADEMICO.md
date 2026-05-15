# AURA — Centro de Comando Académico

> Este documento es la brújula que conecta el desarrollo de software con la producción académica.
> Cada avance técnico debe tener su reflejo en el documento de tesis.
> Cada capítulo de la tesis debe estar respaldado por evidencia del código.

---

## Cronograma TFM — UNIR

| Semana | Hito | Estado |
|---|---|---|
| 1–3 | Primera entrega (borrador inicial) | ✅ Entregado y retroalimentado |
| 4–6 | Integración de feedback + desarrollo técnico | ✅ En curso |
| 7–9 | Ejecución técnica intensiva (motor AURA) | 🔶 Fase actual |
| **10** | **Segunda entrega (borrador intermedio)** | 🔴 **PRÓXIMA ENTREGA** |
| 11–13 | Validación experimental + resultados finales | ⬜ Pendiente |
| 14 | Entrega final + depósito | ⬜ Pendiente |

---

## Segunda Entrega — Checklist de Contenidos

### 1. Capítulos que DEBEN estar FINALIZADOS

#### Cap. 2 — Contexto y Estado del Arte ✅→📝
- [x] 2.1 Contexto del problema (data downtime, cascadas, ceguera semántica)
- [x] 2.2 Estado del arte (DCAI, ISO 25012, observabilidad, LLMs, mitigación alucinaciones)
- [x] 2.3 Conclusiones del estado del arte (gap identificado)
- [ ] **NUEVO**: Incorporar tabla comparativa herramientas vs AURA ← feedback del profesor
- [ ] **NUEVO**: Reforzar contrastes rule-based vs cloud vs LLM-based ← feedback del profesor
- [ ] Reducir afirmaciones extensas, equilibrar densidad conceptual ← feedback del profesor

> **Recurso disponible**: `docs/tablas/tabla_comparativa_herramientas.md` → adaptar a formato Word/APA

#### Cap. 3 — Objetivos y Metodología ✅→📝
- [x] 3.1 Objetivo general
- [x] 3.2 Objetivos específicos (OE1–OE4, verbos en infinitivo)
- [x] 3.3 Metodología (CRISP-DM + Scrum + Capas de Estabilidad)
- [ ] Detallar CRISP-DM paso a paso con su aplicación en AURA
- [ ] Detallar Scrum: sprints, entregables por sprint
- [ ] Detallar Arquitectura de Capas con diagrama formal

### 2. Capítulo que debe mostrar AVANCES SIGNIFICATIVOS

#### Cap. 5 — Desarrollo de la Contribución 🔶
- [ ] 5.1 Arquitectura General de AURA (diagrama de 4 capas)
- [ ] 5.2 Capa 0: Infraestructura Soberana (modelo local-first)
- [ ] 5.3 Capa 1: Motor Determinista (catálogo de 22+ reglas)
- [ ] 5.4 Capa 2: Capa Cognitiva (prompt engineering, anti-alucinación)
- [ ] 5.5 Capa 3: Gobernanza y Trazabilidad (PDF, scripts Pandas)
- [ ] 5.6 Interfaz de Usuario (screenshots anotados)
- [ ] 5.7 Benchmarking (metodología, datasets, primeras métricas)
- [ ] Descripción de requisitos funcionales y no funcionales
- [ ] Diagrama de flujo de datos end-to-end

> **Recursos disponibles**:
> - `docs/tablas/catalogo_reglas_motor_determinista.md` → para §5.3
> - `docs/tablas/diseno_capa_cognitiva.md` → para §5.4
> - `docs/figuras/` → para screenshots §5.6

### 3. Bocetos/borradores requeridos

#### Resultados Preliminares 🔴
- [ ] Métricas del motor determinista (precisión, recall) sobre datasets de prueba
- [ ] Métricas de latencia por modelo LLM
- [ ] Primeras observaciones sobre tasa de alucinación
- [ ] Tablas y gráficos de resultados

#### Introducción (refinamiento) 📝
- [ ] Revisar 1.1 Motivación con datos actualizados
- [ ] Refinar 1.2 Planteamiento tras avances técnicos

#### Conclusiones (primer esbozo) 🔴
- [ ] Mapeo OE1 → resultado parcial
- [ ] Mapeo OE2 → resultado parcial
- [ ] Mapeo OE3 → resultado parcial / limitación
- [ ] Mapeo OE4 → resultado parcial

### 4. Requisitos de Formato

- [ ] Formato Word (.docx) obligatorio
- [ ] Calibri 12, interlineado 1.5, texto justificado
- [ ] Citas en formato APA 7ª edición
- [ ] Índice de contenidos actualizado automáticamente
- [ ] Índice de tablas actualizado
- [ ] Índice de figuras actualizado
- [ ] Todas las figuras con título y fuente
- [ ] Todas las tablas con título y fuente

---

## Matriz de Trazabilidad: Código ↔ Tesis ↔ Publicación

> Cada fila conecta un artefacto de código con su sección en la tesis y su potencial contribución a un artículo científico.

| Artefacto de Código | Capítulo Tesis | Sección Publicación | Estado |
|---|---|---|---|
| `src/services/auditEngine.ts` | §5.3 Motor Determinista | "Deterministic Quality Engine" | ✅ Código listo, 📝 documentar |
| `src/services/csvService.ts` | §5.2 Capa 0 | "Local-First Architecture" | ✅ Código listo, 📝 documentar |
| `src/services/geminiService.ts` | §5.4 Capa Cognitiva | "Anti-Hallucination Mechanisms" | ✅ Código listo, 📝 documentar |
| `src/services/pdfGenerator.ts` | §5.5 Capa 3 Gobernanza | "HITL Governance Layer" | ✅ Código listo, 📝 documentar |
| `src/components/*.tsx` | §5.6 Interfaz | — | ✅ Código listo, 📸 screenshots |
| `experiments/benchmarks/` | §5.7 Benchmarking | "Multi-Model Evaluation" | 🔴 Por crear |
| `experiments/datasets/` | §5.7 + Cap. 6 | "Experimental Validation" | 🔴 Por poblar |
| `experiments/results/` | Resultados | "Results and Discussion" | 🔴 Por generar |
| `docs/tablas/tabla_comparativa*.md` | §2.2 Estado del Arte | "Related Work Comparison" | ✅ Creada |
| `docs/tablas/catalogo_reglas*.md` | §5.3 Motor Det. | "Rule Catalog" | ✅ Creada |
| `docs/tablas/diseno_capa_cognitiva.md` | §5.4 Capa Cogn. | "Cognitive Layer Design" | ✅ Creada |

---

## Estructura del Espacio Académico

```
docs/
├── memoria/
│   ├── entregas/
│   │   ├── primera_entrega/          ← Primera_Entrega_TFM_v2.docx
│   │   └── segunda_entrega/          ← Aquí irá el borrador intermedio
│   ├── borradores/                   ← Borradores de capítulos individuales
│   └── retroalimentacion/            ← Feedback del profesor por entrega
├── figuras/                          ← Diagramas, screenshots, gráficos
├── tablas/                           ← Tablas comparativas, catálogos de reglas
├── referencias/                      ← Notas bibliográficas, fichas de lectura
└── publicacion/                      ← Material para artículo científico futuro
```

---

## Pipeline de Trabajo: Desarrollo ↔ Documentación

```
 ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 │   CÓDIGO    │ ──▶ │  EVIDENCIA  │ ──▶ │   MEMORIA   │
 │             │     │             │     │             │
 │ Implementar │     │ Screenshots │     │ Redactar    │
 │ feature     │     │ Métricas    │     │ capítulo    │
 │ en src/     │     │ Logs        │     │ en Word     │
 │             │     │ Resultados  │     │             │
 └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │ PUBLICACIÓN │
                   │             │
                   │ Acumular    │
                   │ material    │
                   │ para paper  │
                   └─────────────┘
```

**Regla de oro**: Ningún feature se considera "terminado" hasta que:
1. ✅ El código compila y funciona
2. 📸 Se captura evidencia visual (screenshot/grabación)
3. 📝 Se documenta en el capítulo correspondiente de la memoria
4. 📊 Si aplica, se registran métricas en `experiments/results/`

---

## Hacia la Publicación Científica

El profesor señaló potencial de publicación. Para maximizar esa posibilidad:

### Contribución principal del artículo
> "AURA: A Hybrid Deterministic-Cognitive Architecture for Browser-Native Data Quality Diagnosis with Anti-Hallucination Mechanisms"

### Conferencias/Revistas objetivo
| Venue | Tipo | Relevancia |
|---|---|---|
| VLDB / SIGMOD Workshop on Data Quality | Conferencia | Data quality + LLMs |
| EMNLP Industry Track | Conferencia | LLM applications |
| Data & Knowledge Engineering (Elsevier) | Revista | Data quality systems |
| IEEE Access | Revista | Open access, buen IF |

### Elementos diferenciadores para publicación
1. **Arquitectura híbrida determinista + LLM** con precisión garantizada en Capa 1
2. **5 mecanismos anti-alucinación formales** (M1–M5) con evaluación empírica
3. **Browser-native / local-first** como respuesta a preocupaciones de privacidad
4. **Benchmark multi-modelo** con métricas reproducibles
5. **Human-in-the-Loop** con scripts auditables (no "black box")

### Material a acumular en `docs/publicacion/`
- [ ] Abstract del artículo (borrador)
- [ ] Tabla de resultados experimentales
- [ ] Diagramas de arquitectura en formato publicable
- [ ] Análisis estadístico de benchmarks
