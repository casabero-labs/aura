# AURA — Marco Experimental

## Propósito Científico

Demostrar que un modelo local (WebLLM/WebGPU) puede alcanzar estabilidad cognitiva comparable a un modelo cloud (Gemini) en tareas de auditoría de calidad de datos, bajo condiciones controladas.

## Hipótesis

**H0 (Nula):** No existe diferencia significativa en la calidad de la salida entre modelos locales y cloud cuando se usa smart sample con temperatura controlada.

**H1 (Alterna):** Los modelos locales con smart sample y temperatura baja (≤0.2) producen salidas con calidad equivalente a modelos cloud en tareas estructuradas de data quality.

## Variables

### Controladas
- **Dataset**: mismo CSV en todas las corridas
- **Prompt**: mismo smart sample (idéntico JSON de entrada)
- **Mecanismos anti-alucinación**: M1-M5 activos siempre
- **Orden de ejecución**: local primero, cloud después (para aislar latencia de descarga)

### Independientes (las que cambiamos)
1. **Modelo**: qué LLM se usa
2. **Temperatura**: 0.0, 0.1, 0.3, 0.5, 0.7, 1.0
3. **Input mode**: smart sample vs prompt libre (sin estructura)
4. **Proveedor**: local (WebLLM) vs cloud (Gemini)

### Dependientes (lo que medimos)
1. Latencia total (ms)
2. First token latency (ms)
3. Tokens por segundo
4. Cumplimiento formato JSON (sí/no)
5. Columnas alucinadas (cantidad y nombre)
6. Afirmaciones sin soporte en datos
7. Script Python generado (sí/no, líneas)
8. Score de calidad semántica (humano: 0-5)

## Experimentos

### E1 — Línea Base
Una sola corrida del mejor modelo local con temp 0.1 vs Gemini con temp 0.1.
*Objetivo:* establecer la referencia.

### E2 — Barrido de Temperatura
Mismo modelo local, 6 temperaturas (0.0 a 1.0), 3 repeticiones cada una.
*Objetivo:* encontrar el punto óptimo entre creatividad y precisión.

### E3 — Competencia de Modelos
Todos los modelos locales (5+) + 3 cloud, temp fija 0.1, smart sample.
*Objetivo:* ranking de modelos para data quality tasks.

### E4 — Input Mode
Smart sample vs prompt libre, mismo modelo y temperatura.
*Objetivo:* demostrar que M2 (anclaje semántico) reduce alucinaciones.

### E5 — Robustez (múltiples datasets)
Misma configuración (Llama 3.2 3B, temp 0.1) contra 3 datasets distintos.
*Objetivo:* verificar que los resultados no son casualidad de un dataset.

### E6 — Health Improvement Loop
Ejecutar el ciclo completo sobre un dataset: auditoría inicial, benchmark de estrategias, generación de script, simulación segura, re-auditoría y cálculo de delta de salud.
*Objetivo:* demostrar que AURA no solo diagnostica, sino que ayuda a seleccionar una intervención que mejora de forma medible la salud del dataset.

## Criterios de Éxito

- **E1**: latencia local < 30s, JSON compliance = 100%
- **E2**: temp 0.1-0.3 produce máxima adherencia a estructura
- **E3**: top 3 modelos locales tienen compliance ≥ 90% vs cloud
- **E4**: smart sample reduce alucinaciones ≥ 50% vs prompt libre
- **E5**: varianza entre datasets < 15% en todas las métricas
- **E6**: score posterior > score inicial, sin ejecutar acciones destructivas no revisadas

## Métricas del Ciclo de Mejora

- **Métrica principal**: delta de salud del dataset (`score_after - score_before`)
- **Métricas secundarias**:
  - issues totales antes/después
  - issues críticos antes/después
  - reglas corregidas
  - script válido contra columnas reales
  - acciones destructivas o ambiguas bloqueadas
  - columnas alucinadas
  - claims no soportados
  - modo de inferencia local/cloud
  - estado de evidencia (`planned`, `attempted_failed`, `preliminary_valid`, `formal_valid`)

## Salida Científica

Cada experimento genera:
- Fila en tabla comparativa del benchmark
- Marca de tiempo para reproducibilidad
- Configuración completa (modelo, temp, input mode, fecha)
- Evidencia para el TFM §4 (Resultados Experimentales)
- Cuando aplique, un `ImprovementRun` exportable con score antes/después y acciones de remediación simuladas

## Evidencia Operacional

Toda corrida debe distinguir entre "se solicito ejecutar" y "se ejecuto realmente". Para ello AURA registra:

- inicio y fin de auditoria determinista;
- duracion de parseo y motor determinista;
- fingerprint del dataset/reporte;
- inicio y fin de llamadas a proveedor LLM;
- preflight WebGPU para proveedores locales;
- salida del proveedor medida en tokens, latencia y cumplimiento;
- traza exportable en JSON.

Si una etapa no puede cerrarse con evidencia, se reporta como `attempted_failed` y no se usa para defender OE2/OE3.
