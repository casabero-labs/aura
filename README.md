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
│  → Browser-native · procesamiento local por defecto│
└─────────────────────────────────────────────────────┘
```

## Estructura del repositorio

```
aura/
├── docs/
│   ├── plans/               # Fuente única de cierre y hoja de ruta
│   ├── product/aura/        # Evidencia y evolución del producto
│   └── archive/academic/    # Entregas académicas históricas
├── src/                     # Aplicación React/TypeScript y pruebas
└── experiments/             # Datasets, protocolos y resultados reproducibles
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

## Objetivos definitivos del TFM

| ID | Objetivo | Descripción |
|---|---|---|
| OE1 | Auditoría local y reproducible | Ingesta, perfilamiento, fingerprint y detección determinista trazable |
| OE2 | Diagnóstico cognitivo controlado | LLM restringido por evidencia, contratos, errores y alucinaciones registradas |
| OE3 | Gobernanza de la remediación | Planes y scripts opcionales verificables con decisión HITL |
| OE4 | Evaluación comparativa de LLM | Comparación reproducible y acotada de al menos dos modelos o proveedores |
| OE5 | Validación y comunicación | Flujo E2E y exportación de PDF, JSON y CSV para resultados del TFM |

La formulación completa, el estado de alineación y la hoja de ruta final están en [`docs/plans/2026-07-09-cierre-definitivo-aura.md`](./docs/plans/2026-07-09-cierre-definitivo-aura.md).

## Licencia

Este trabajo es parte de un Trabajo Fin de Máster. Todos los derechos reservados.

---

<div align="center">
  <sub>Desarrollado por <a href="https://casabero.com">casabero.com</a></sub>
</div>
