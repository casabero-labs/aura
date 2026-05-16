# AURA — Mandatos del Proyecto

## Identidad

- **Nombre**: AURA — Entorno de Diagnóstico Cognitivo para la Calidad del Dato mediante Benchmarking de LLMs
- **Tipo**: Trabajo Fin de Máster (TFM) — Desarrollo de Software
- **Universidad**: Universidad Internacional de La Rioja (UNIR)
- **Programa**: Máster en Análisis y Visualización de Datos Masivos
- **Autor**: Joseph David Gari Bustos
- **Director**: Luis Guadalupe Macias Trejo
- **Potencial**: Publicación científica (recomendado por el director)

## Principio Rector

El documento de tesis (`docs/memoria/`) es el **norte absoluto** del proyecto. Todo código, toda decisión de arquitectura, y toda documentación debe alinearse con lo que la memoria TFM define. El código existente en `src/` es un recurso que se adapta a la tesis, no al revés.

Para la segunda entrega, la línea oficial está en:

`docs/memoria/entregas/segunda_entrega/LINEA_OFICIAL_AURA.md`

Resumen canónico: AURA no debe prometer precisión perfecta del motor determinista. La tesis defendible es que la Capa 1 genera evidencia reproducible, la Capa 2 interpreta esa evidencia bajo restricciones anti-alucinación y la Capa 3 conserva gobernanza humana.

**Regla de oro**: Ningún feature se considera terminado hasta que:
1. ✅ El código compila y funciona
2. 📸 Se captura evidencia (screenshot/métricas)
3. 📝 Se documenta en el capítulo correspondiente de la memoria
4. 📊 Si aplica, se registran métricas en `experiments/results/`

## Arquitectura

AURA sigue una **Arquitectura de 4 Capas de Estabilidad**:

1. **Capa 0**: Infraestructura Soberana (Local-First) — CSV y auditoría determinista en navegador; inferencia local opcional con WebLLM/WebGPU
2. **Capa 1**: Motor Determinista (`src/services/auditEngine.ts`) — 22+ reglas reproducibles que generan evidencia factual
3. **Capa 2**: Estabilidad Cognitiva (`src/services/providers/`) — LLM cloud/local controlado con smart sample y anclaje semántico
4. **Capa 3**: Gobernanza y Trazabilidad (`src/services/pdfGenerator.ts`) — HITL, scripts Pandas, PDF

## Objetivos Específicos (OE)

- **OE1**: Motor de auditoría determinista reproducible → `src/services/auditEngine.ts`
- **OE2**: Benchmarking multi-modelo cloud/local → `experiments/benchmarks/`
- **OE3**: Arquitectura local-first y comparación WebLLM/Gemini → `src/services/aiProvider.ts`
- **OE4**: Scripts de limpieza auditables → generación vía proveedores IA y reporte PDF

## Stack Tecnológico

- React 19 + TypeScript + Vite 6
- TailwindCSS (CDN) + CSS Variables
- Google GenAI SDK (`@google/genai`)
- PapaParse, Recharts, jsPDF, lucide-react

## Estructura del Repositorio

```
aura/
├── GEMINI.md                          ← Este archivo
├── README.md                          ← Presentación académica
├── docs/                              ← ESPACIO ACADÉMICO
│   ├── CENTRO_COMANDO_ACADEMICO.md    ← Brújula del proyecto
│   ├── README.md                      ← Navegación de docs
│   ├── memoria/                       ← Documento TFM
│   │   ├── entregas/                  ← Entregas formales al director
│   │   ├── borradores/               ← Borradores de capítulos
│   │   └── retroalimentacion/        ← Feedback del profesor
│   ├── figuras/                       ← Diagramas, screenshots
│   ├── tablas/                        ← Tablas comparativas, catálogos
│   ├── referencias/                   ← Bibliografía organizada
│   └── publicacion/                   ← Material para artículo científico
├── src/                               ← Código fuente AURA
│   ├── components/                    ← Componentes React UI
│   └── services/                      ← Lógica de negocio (4 capas)
└── experiments/                       ← Validación experimental
    ├── datasets/                      ← Datasets de prueba
    ├── benchmarks/                    ← Scripts de benchmark
    └── results/                       ← Resultados de evaluación
```

## Infisical

- No aplica para este proyecto (no hay backend ni secretos de infraestructura en producción).
- La API key de Gemini se gestiona via `src/.env.local` o el panel de Settings de la UI.

## Reglas de Desarrollo

1. Todo cambio en el código debe poder justificarse desde un objetivo (OE1-OE4) de la tesis
2. Los nombres de componentes y servicios deben mantener coherencia con la nomenclatura de las capas
3. Toda experimentación va en `experiments/`, nunca en `src/`
4. Las capturas de pantalla y diagramas para la memoria van en `docs/figuras/`
5. El idioma del código (variables, comentarios) es español donde sea posible, inglés para APIs y frameworks
6. Cada feature debe generar evidencia en `docs/` antes de considerarse terminado
7. Las métricas experimentales se registran en `experiments/results/` con formato reproducible
8. Las referencias bibliográficas se mantienen en `docs/referencias/registro_bibliografico.md`
9. No introducir afirmaciones de "precisión 100%", "EM=1.00" o "todo local" sin evidencia experimental y matiz de modo de ejecución

## Cronograma Crítico

| Hito | Semana | Contenido |
|---|---|---|
| ✅ Primera entrega | 3 | Borrador inicial (completado) |
| 🔴 **Segunda entrega** | **10** | Cap. 2+3 finales, Cap. 5 avanzado, resultados preliminares |
| ⬜ Entrega final | 14 | Documento completo + depósito |
