<div align="center">

# AURA

### Entorno de Diagnóstico Cognitivo para la Calidad del Dato mediante Benchmarking de LLMs

**Trabajo Fin de Máster** — Universidad Internacional de La Rioja (UNIR)  
Máster Universitario en Análisis y Visualización de Datos Masivos

---

*Joseph David Gari Bustos* · Director: *Luis Guadalupe Macias Trejo* · 2026

</div>

## Resumen

AURA es una herramienta de auditoría inteligente de calidad del dato que combina un motor determinista de 22+ reglas con análisis cognitivo mediante LLMs (Large Language Models). A diferencia de las soluciones tradicionales que operan sobre reglas fijas y no comprenden el contexto, AURA integra tres capacidades en una sola arquitectura:

1. **Diagnóstico determinista** — Detección reproducible de anomalías estructurales, de higiene, tipado, lógica y seguridad
2. **Análisis cognitivo** — Interpretación semántica de hallazgos usando modelos de lenguaje (Gemini, Llama)
3. **Gobernanza auditable** — Generación de scripts de limpieza Python/Pandas revisables por humanos

La arquitectura es **local-first**: el CSV crudo y la auditoría determinista se procesan en el navegador. La capa cognitiva puede ejecutarse localmente con WebLLM/WebGPU o mediante proveedor cloud, enviando en ese caso un resumen inteligente en lugar del dataset completo.

## Arquitectura de Capas de Estabilidad

```
┌─────────────────────────────────────────────────────┐
│  Capa 3: Gobernanza y Trazabilidad (HITL)           │
│  → Scripts Pandas · Reportes PDF · Human-in-the-Loop│
├─────────────────────────────────────────────────────┤
│  Capa 2: Estabilidad Cognitiva (IA Controlada)      │
│  → Gemini / Llama · Anclaje Semántico · Copy-Paste  │
├─────────────────────────────────────────────────────┤
│  Capa 1: Motor Determinista (auditEngine.ts)        │
│  → 22+ reglas · IQR · RegExp · Hashes 32-bit       │
├─────────────────────────────────────────────────────┤
│  Capa 0: Infraestructura Soberana (Local-First)     │
│  → Browser-native · PII local · GDPR compliant     │
└─────────────────────────────────────────────────────┘
```

## Estructura del Repositorio

```
aura/
├── docs/                    # Artefactos académicos
│   ├── memoria/             # Documento TFM (versiones)
│   ├── figuras/             # Diagramas y screenshots
│   └── tablas/              # Tablas comparativas
├── src/                     # Código fuente AURA
│   ├── components/          # Componentes React
│   ├── services/            # Lógica de negocio
│   └── ...                  # Config (Vite, TS, etc.)
└── experiments/             # Validación experimental
    ├── datasets/            # Datasets de prueba (Kaggle/UCI)
    ├── benchmarks/          # Scripts de benchmark multi-modelo
    └── results/             # Resultados de evaluación
```

## Ejecución Local

**Requisitos:** Node.js ≥ 18

```bash
cd src
npm install
npm run dev
```

Configurar la API Key de Gemini en `src/.env.local`:
```
GEMINI_API_KEY=tu_clave_aqui
```

## Objetivos del TFM

| ID | Objetivo | Descripción |
|---|---|---|
| OE1 | Motor de auditoría determinista | TypeScript, 22+ reglas reproducibles, precisión/recall medidos experimentalmente |
| OE2 | Benchmarking multi-modelo | Gemini vs modelos locales: latencia, formato, alucinaciones, utilidad |
| OE3 | Arquitectura local-first | CSV y reglas en navegador; comparación inferencia local vs cloud |
| OE4 | Scripts de limpieza auditables | Generación automática de Pandas, HITL |

## Licencia

Este trabajo es parte de un Trabajo Fin de Máster. Todos los derechos reservados.

---

<div align="center">
  <sub>Desarrollado por <a href="https://casabero.com">casabero.com</a></sub>
</div>
