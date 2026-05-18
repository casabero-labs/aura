# Alineacion desarrollo-capas-benchmark

> Evidencia de avance tecnico para segunda entrega.
> Cambio de criterio: el benchmark deja de ser una vista separada y pasa a funcionar como selector de estrategia dentro del ciclo de mejora del dataset.

## 1. Decision de arquitectura

AURA debe integrar la parte tecnica y la parte cientifica en un unico flujo de trabajo. La aplicacion no se presenta como dos productos: uno operativo y otro academico. La aplicacion diagnostica el dataset, compara estrategias de inferencia, selecciona el modelo mas conveniente, genera un script revisable y mide si la salud del dataset mejora tras una simulacion segura.

La formulacion integrada es:

```text
Diagnosticar -> Comparar modelos -> Elegir estrategia -> Generar script -> Simular limpieza -> Re-auditar -> Medir mejora
```

## 2. Relacion entre flujo tecnico y flujo cientifico

| Lectura tecnica | Lectura cientifica | Evidencia generada |
|---|---|---|
| Cargar CSV y ejecutar auditoria | OE1: motor determinista reproducible | `AuditReport`, score inicial, issues, reglas activadas |
| Comparar local/cloud y smart sample/prompt libre | OE2/OE3: benchmark multi-modelo e input mode | `BenchmarkResult`, latencia, JSON, alucinaciones, script HITL |
| Elegir modelo para limpiar | Decision guiada por evidencia | Ranking por validez, privacidad, alucinaciones y rendimiento |
| Generar script Python/Pandas | OE4: salida accionable HITL | `python_script`, validacion de columnas y riesgos |
| Simular acciones seguras | Validacion de impacto | dataset simulado, acciones aplicadas, acciones bloqueadas |
| Re-auditar | Medicion de mejora | `HealthDelta`: score antes/despues e issues corregidos |

## 3. Cambios implementados en la app

| Area | Cambio |
|---|---|
| Modelo de datos | Se introduce `ImprovementRun` como entidad que une auditoria inicial, benchmark, script, simulacion, re-auditoria y estado de evidencia. |
| Benchmark | Las corridas fallidas quedan como `attempted_failed`; no deben contarse como evidencia valida de OE2/OE3. |
| Detector de alucinaciones | El benchmark usa verificacion de columnas fantasma, claims no soportados, compliance JSON y columnas invalidas en scripts. |
| Script HITL | El script se valida contra columnas reales y operaciones potencialmente destructivas. |
| Simulacion | AURA no ejecuta Python arbitrario; aplica acciones seguras en TypeScript sobre una copia del dataset. |
| Re-auditoria | El dataset simulado vuelve a pasar por `runAudit` para calcular delta de salud. |
| Exportacion | El ciclo completo se puede exportar como evidencia JSON para memoria o articulo. |

## 4. Acciones seguras v1

La primera version solo simula acciones que pueden ejecutarse en navegador con bajo riesgo:

- `trim_whitespace`: recorte de espacios externos y compactacion interna.
- `normalize_placeholders`: conversion de placeholders toxicos a `null`.
- `drop_exact_duplicates`: eliminacion de duplicados exactos en una copia simulada.
- `normalize_casing`: normalizacion basica de capitalizacion.
- `convert_disguised_numbers`: conversion segura de textos numericos a `number`.

Las acciones ambiguas, destructivas o dependientes de dominio quedan marcadas como `requires_human_review`.

## 5. Criterio de evidencia valida

| Estado | Significado | Uso academico |
|---|---|---|
| `planned` | Experimento preparado, no ejecutado | Metodologia o plan experimental |
| `attempted_failed` | Intento fallido por API key, WebGPU, error de formato o alucinacion critica | Trazabilidad, no resultado OE2/OE3 |
| `preliminary_valid` | Corrida valida preliminar con evidencia suficiente para discusion | Segunda entrega y resultados preliminares |
| `formal_valid` | Corrida con protocolo completo, repeticiones y datasets definidos | Articulo cientifico / entrega final |

## 6. Lectura para el TFM

El valor cientifico ya no esta solo en demostrar que AURA detecta problemas. La contribucion se vuelve mas fuerte:

> AURA permite evaluar que estrategia de diagnostico y remediacion mejora de forma medible la salud de un dataset, privilegiando modelos locales sencillos cuando producen resultados validos, trazables y comparables a alternativas cloud.

Esta formulacion conecta directamente la herramienta tecnica con la validacion experimental: el benchmark no es decorativo, sino el mecanismo que justifica la decision de limpieza.
