# Tabla Comparativa: Herramientas de Calidad del Dato vs AURA

> Tabla para incluir en **Capítulo 2 — Contexto y Estado del Arte** (§2.2).
> Solicitada explícitamente en la retroalimentación de la primera entrega.

## Tabla 1. Comparativa de herramientas de auditoría y calidad del dato

| Criterio | Great Expectations | OpenRefine | Monte Carlo | Soda Core | Cocoon (Zhang et al., 2024) | **AURA** |
|---|---|---|---|---|---|---|
| **Paradigma** | Rule-based (assertions YAML/Python) | Manual + clustering semi-auto | ML anomaly detection (cloud) | Rule assertions (CI/CD) | LLM-driven cleaning | **Determinista + LLM cognitivo** |
| **Comprensión semántica** | ❌ No | Parcial (manual, por clustering) | Parcial (patrones ML) | ❌ No | ✅ Sí (LLM contextual) | ✅ Sí (LLM con anclaje semántico) |
| **Diagnóstico en lenguaje natural** | ❌ | ❌ | ❌ (dashboards) | ❌ | ✅ Parcial | ✅ Completo (streaming) |
| **Generación automática de código de limpieza** | ❌ | ❌ | ❌ | ❌ | ✅ (Pandas) | ✅ (Pandas, auditable HITL) |
| **Privacidad / Local-first** | ✅ On-premises | ✅ Desktop | ❌ Cloud SaaS | ✅ CI/CD local | ❌ Cloud API | ✅ Browser-native (Capa 0) |
| **Motor determinista propio** | ✅ (basado en reglas YAML) | ❌ (manual) | ❌ (ML) | ✅ (checks YAML) | ❌ (solo LLM) | ✅ (22+ reglas TypeScript, reproducible) |
| **Mitigación de alucinaciones** | N/A | N/A | N/A | N/A | ❌ No documentada | ✅ (Copy-Paste, t=0.1, JSON estricto, M4) |
| **Reporte ejecutivo PDF** | ❌ (JSON/HTML) | ❌ | Dashboard web | ❌ | ❌ | ✅ (jsPDF multi-página) |
| **Benchmarking multi-modelo** | N/A | N/A | N/A | N/A | ❌ (modelo fijo) | ✅ (intercambio Gemini/Llama) |
| **Escalabilidad** | ✅ Big Data (Spark) | ❌ (~5.000 filas) | ✅ Cloud-native | ✅ Pipelines | No documentada | 🔶 CSV completo en navegador; datasets muy grandes requieren entorno dedicado |
| **Configuración requerida** | Alta (YAML + Python) | Baja (GUI) | Alta (deploy cloud) | Media (YAML) | Media (API key) | **Baja (drag & drop, zero-config)** |
| **Costo** | Open Source | Open Source | Enterprise ($$$$) | Freemium | Open Source | **Open Source** |
| **Tipo de usuario objetivo** | Data Engineers | Analistas / Periodistas de datos | Equipos de Data Ops | DevOps / Data Engineers | Data Scientists | **Analistas, científicos de datos, auditores** |

## Análisis del Gap Identificado

La tabla evidencia que **ninguna herramienta existente combina simultáneamente** las tres dimensiones que AURA integra:

1. **Motor determinista propio** que genera evidencia reproducible antes de consultar al LLM
2. **Capa cognitiva LLM** con mecanismos formales de mitigación de alucinaciones (anclaje semántico, Copy-Paste)
3. **Arquitectura local-first** que procesa el CSV crudo en navegador y permite comparar inferencia local frente a cloud

### Posicionamiento de AURA

```
                    Comprensión Semántica
                           ▲
                           │
                    Cocoon ●│          ● AURA
                           │
           Great Exp ●     │     ● Monte Carlo
                           │
           Soda Core ●─────┼──────────────────▶ Privacidad
                           │                    Local-First
                           │
                    OpenRefine ●
                           │
```

AURA ocupa un cuadrante que las herramientas existentes dejan vacío: **alta comprensión semántica + alta privacidad local**, respaldado por un motor determinista que ancla la IA a hechos verificables.

## Fuentes

- Great Expectations: https://greatexpectations.io/
- OpenRefine: https://openrefine.org/
- Monte Carlo: https://www.montecarlodata.com/
- Soda Core: https://www.soda.io/
- Cocoon: Zhang, S., Huang, Z., & Wu, E. (2024). Data cleaning using large language models. ICDEW 2025.
- AURA: Desarrollo propio del presente TFM.
