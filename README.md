<div align="center">

# AURA

### Auditoría local-first de calidad del dato con diagnóstico restringido y evaluación comparativa de LLM

**Trabajo Fin de Máster** — Universidad Internacional de La Rioja (UNIR)  
Máster Universitario en Análisis y Visualización de Datos Masivos

---

*Joseph David Gari Bustos* · Director: *Luis Guadalupe Macias Trejo* · 2026

</div>

## Qué es AURA

AURA es una aplicación web para auditar datasets CSV antes de su explotación analítica. Separa tres responsabilidades:

1. **Evidencia determinista**: reglas explícitas, perfilado y métricas reproducibles ejecutadas sobre el CSV en el navegador.
2. **Diagnóstico asistido restringido**: el LLM recibe un paquete estructurado de evidencia, no autoridad para modificar el score ni inventar transformaciones.
3. **Gobernanza y remediación opcional**: revisión humana, script Python/Pandas trazable, ejecución externa sobre una copia, recibos y reauditoría.

El flujo principal es:

```text
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
                                 └→ Remediación opcional → revisión HITL
```

El Laboratorio OE4 compara modelos y métodos de entrada bajo un contrato común, preservando tanto corridas válidas como fallidas.

## Privacidad y proveedores

- El CSV y la auditoría determinista se procesan localmente en el navegador.
- Ollama permite inferencia local.
- Chrome AI se valida de forma opt-in con un perfil dedicado.
- Los proveedores cloud son opcionales y operan bajo políticas de minimización.
- Python no se ejecuta dentro de AURA: el runner actúa externamente sobre una copia controlada.

## Estructura del repositorio

```text
aura/
├── docs/
│   ├── tfm/memoria_final/    # entorno y fuentes canónicas del documento final
│   ├── product/aura/         # estado y evidencia viva del producto
│   ├── plans/                # diseños y planes técnicos fechados
│   └── archive/academic/     # entregas académicas históricas
├── src/                      # aplicación React/TypeScript y pruebas
└── experiments/              # datasets, protocolos, campañas y resultados
```

## Documentación vigente

- [Memoria final y fuentes canónicas](./docs/tfm/memoria_final/README.md)
- [Estado operativo y experimental](./docs/product/aura/NEXT_STEPS.md)
- [Evidencia determinista final](./experiments/results/final_deterministic_evidence.md)
- [Diseño del laboratorio OE4](./docs/plans/2026-07-10-laboratorio-oe4-evaluacion-llm-design.md)

Los closeouts, freezes y entregas archivadas conservan trazabilidad, pero no definen el estado actual.

## Objetivos específicos definitivos

| ID | Objetivo | Descripción |
|---|---|---|
| OE1 | Arquitectura local-first | Carga, procesamiento y auditoría CSV en navegador con trazabilidad y minimización |
| OE2 | Motor determinista | Reglas explícitas y métricas TP, FP, FN, precisión, recall y F1 |
| OE3 | Diagnóstico restringido | LLM limitado por evidencia estructurada y sin modificar la evidencia primaria |
| OE4 | Laboratorio de modelos | Comparación bajo contrato común, separando piloto, experimento y benchmark formal |
| OE5 | Gobernanza HITL | Revisión y aprobación humana antes de generar o ejecutar remediaciones |
| OE6 | Scripts trazables | Python/Pandas derivado de acciones aprobadas, con hashes, recibos y reauditoría |

## Ejecución local

**Requisito:** Node.js 18 o superior.

```bash
cd src
npm install
npm run dev
```

La configuración de proveedores se realiza desde la interfaz o mediante las variables de entorno documentadas para cada integración. No se deben publicar claves en el repositorio.

## Licencia

Este repositorio forma parte de un Trabajo Fin de Máster. Todos los derechos reservados.
