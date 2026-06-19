# Borrador de Artículo Científico — AURA

> **Estado**: Pre-borrador. Acumular material aquí durante el desarrollo del TFM.
> **Objetivo**: Artículo publicable tras la defensa del TFM.

---

## Título Propuesto

**AURA: A Hybrid Deterministic-Cognitive Architecture for Browser-Native Data Quality Diagnosis with Hallucination-Resistant LLM Integration**

## Autores

- Joseph David Gari Bustos (UNIR)
- Luis Guadalupe Macias Trejo (UNIR, Director)

---

## Abstract (borrador)

_Por redactar tras completar la validación experimental._

Elementos clave a incluir:
- Problema: Herramientas de calidad de dato ciegas al contexto + riesgos de privacidad en cloud
- Contribución: Arquitectura híbrida de 4 capas con ciclo de mejora guiado por evidencia
- Método: Motor determinista reproducible (22+ reglas) + LLM controlado + arquitectura local-first evaluable
- Resultados: [métricas por completar: precision/recall, benchmark LLM, delta de salud antes/después]
- Conclusión: [por completar]

---

## 1. Introduction

_Basarse en Cap. 1 de la tesis. Condensar motivación, gap, y contribución._

### Contribuciones del artículo:
1. Arquitectura híbrida determinista + LLM para diagnóstico de calidad del dato
2. Catálogo de 22+ reglas deterministas con mapeo a ISO/IEC 25012 y evaluación precision/recall
3. 5 mecanismos formales anti-alucinación (M1–M5) con evaluación empírica
4. Ciclo de mejora guiado por evidencia: benchmark, script, simulación segura y re-auditoría
5. Validación sobre N datasets públicos comparando M modelos LLM
6. Implementación browser-native open-source como prueba de concepto

---

## 2. Related Work

_Basarse en Cap. 2 de la tesis. Incluir tabla comparativa de `docs/tercera_entrega_aura/04_resultados/`._

---

## 3. Architecture

_Basarse en Cap. 5 de la tesis._

### 3.1 Layer 0: Sovereign Infrastructure
### 3.2 Layer 1: Deterministic Engine
### 3.3 Layer 2: Cognitive Stability
### 3.4 Layer 3: HITL Governance

---

## 4. Anti-Hallucination Mechanisms

_Basarse en `docs/tercera_entrega_aura/04_resultados/diseno_capa_cognitiva.md`._

### 4.1 M1: Low Temperature Sampling
### 4.2 M2: Semantic Anchoring
### 4.3 M3: Copy-Paste Paradigm
### 4.4 M4: Forced Chain of Reasoning
### 4.5 M5: Structured JSON Output

---

## 5. Experimental Evaluation

_Por completar tras experiments/_

### 5.1 Datasets
### 5.2 Metrics
### 5.3 Baselines
### 5.4 Results

### 5.5 Evidence-Guided Remediation Loop

_Describir el ciclo AURA: diagnóstico inicial, benchmark de estrategias, selección del modelo, generación de script Pandas, simulación segura y re-auditoría._

Métrica principal:
- delta de salud del dataset antes/después.

Métricas secundarias:
- reducción de issues críticos;
- reducción de issues totales;
- acciones bloqueadas por requerir revisión humana;
- columnas alucinadas;
- validez del script;
- comparación local/cloud.

---

## 6. Discussion

_Por completar_

---

## 7. Conclusion

_Por completar_

---

## Material Acumulado

> Ir agregando aquí fragmentos, tablas, figuras que servirán para el paper.

### Tablas listas
- [ ] Tabla comparativa herramientas (`docs/tercera_entrega_aura/04_resultados/tabla_comparativa_herramientas.md`)
- [ ] Catalogo de reglas con ISO 25012 (`docs/tercera_entrega_aura/04_resultados/catalogo_reglas_motor_determinista.md`)

### Figuras por crear
- [ ] Diagrama de arquitectura de 4 capas (formato publicable, no screenshot)
- [ ] Flujo de datos end-to-end
- [ ] Gráfico de resultados de benchmark

### Métricas por generar
- [ ] Precision/Recall del motor determinista por regla
- [ ] Latencia por modelo LLM
- [ ] Hallucination rate por modelo
- [ ] Comparativa con/sin mecanismos anti-alucinación
- [ ] Delta de salud antes/después del ciclo de mejora
- [ ] Validez y cobertura de scripts Pandas generados
