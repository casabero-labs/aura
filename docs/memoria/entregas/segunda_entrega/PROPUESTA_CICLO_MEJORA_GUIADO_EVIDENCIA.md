# Propuesta: Ciclo de Mejora Guiado por Evidencia

> Documento de propuesta para segunda entrega.
> Objetivo: plasmar como AURA integra diagnostico tecnico, benchmark cientifico y mejora efectiva del dataset en un solo flujo.

## 1. Proposito del cambio

AURA no debe limitarse a producir un diagnostico ni a mostrar un benchmark aislado. La finalidad practica del sistema es mejorar la salud del dataset usando una estrategia medible y trazable. La finalidad academica es demostrar que esa mejora puede evaluarse bajo condiciones controladas, especialmente cuando se usan modelos locales sencillos como alternativa a proveedores cloud.

Por tanto, el benchmark se integra como criterio de decision:

- si un modelo local genera un script valido, sin columnas alucinadas y con mejora simulada comparable, debe recomendarse por privacidad;
- si un modelo cloud mejora la calidad pero introduce mayor exposicion de datos, debe aparecer como contraste;
- si una corrida falla por API key, WebGPU o alucinacion, queda registrada como intento, pero no como resultado experimental.

## 2. Arquitectura funcional

```text
Dataset original
  |
  v
Capa 1: AuditReport inicial
  |
  v
Capa 2: Benchmark local/cloud + smart sample/prompt libre
  |
  v
Selector de estrategia
  |
  v
Capa 3: Script Python/Pandas + acciones estructuradas
  |
  v
Simulacion segura en TypeScript
  |
  v
Re-auditoria
  |
  v
HealthDelta + evidencia exportable
```

## 3. Relacion con objetivos especificos

| Objetivo | Como se evidencia en el ciclo |
|---|---|
| OE1 | El `AuditReport` inicial y posterior muestra que el motor determinista mide la salud antes y despues. |
| OE2 | `BenchmarkResult` compara modelos bajo el mismo reporte determinista y el mismo modo de entrada. |
| OE3 | La seleccion local/cloud permite contrastar privacidad, latencia y calidad de salida. |
| OE4 | El script Pandas y la validacion HITL conectan recomendacion con accion revisable. |

## 4. Entidad central: `ImprovementRun`

`ImprovementRun` es el registro que une producto y ciencia. Contiene:

- auditoria inicial;
- resultados de benchmark por modelo;
- modelo recomendado;
- script generado;
- validacion del script;
- acciones de remediacion;
- auditoria posterior simulada;
- delta de salud;
- estado de evidencia.

Esta entidad evita que los resultados queden dispersos entre UI, tablas y archivos JSON. Cada ciclo puede exportarse y trazarse en la memoria.

## 4.1 Evidencia operacional obligatoria

Para evitar especulacion, cada ejecucion debe registrar evidencia verificable:

- `AuditExecutionEvidence`: prueba de que el motor determinista corrio sobre un dataset concreto.
- `ExecutionTraceEvent`: eventos con timestamp, etapa, tiempo acumulado y detalles tecnicos.
- `datasetFingerprint`: huella reproducible del dataset o del reporte usado como base factual.
- `startedAt` y `completedAt`: inicio y cierre de cada corrida.
- `parseDurationMs`, `auditDurationMs` y `latencyMs`: tiempos medidos por la app.
- `webGpuAvailable`: preflight del entorno cuando se ejecuta proveedor local.

Una tabla con estado `Ejecutando` no es suficiente como evidencia academica. La corrida debe cerrar con traza exportable o quedar como `attempted_failed`.

## 5. Criterios de decision

La recomendacion de modelo en v1 sigue este orden:

1. descartar corridas fallidas;
2. descartar scripts con columnas invalidas;
3. penalizar alucinaciones;
4. priorizar `smart_sample` sobre `prompt_libre`;
5. preferir local cuando sea comparable;
6. considerar latencia como criterio secundario.

## 6. Alcance v1

La primera version implementa ciclo completo, pero con simulacion controlada:

- no ejecuta Python arbitrario en navegador;
- no aplica cambios destructivos sobre el archivo original;
- solo simula acciones seguras sobre una copia;
- exporta evidencia para revision academica;
- deja acciones ambiguas como pendientes de validacion humana.

## 7. Limites reconocidos

Esta version no prueba todavia resultados formales de OE2/OE3 si no se ejecuta el protocolo completo con credenciales validas, WebGPU disponible, datasets definidos y repeticiones. Los resultados de v1 deben presentarse como evidencia preliminar salvo que se ejecute una corrida formal documentada.

## 8. Frase recomendada para la memoria

> AURA incorpora un Ciclo de Mejora Guiado por Evidencia que conecta diagnostico determinista, comparacion de modelos, generacion de scripts revisables y re-auditoria del dataset. De esta forma, la seleccion del modelo no se basa en preferencia subjetiva, sino en evidencia observable: validez del script, ausencia de alucinaciones, privacidad, latencia y mejora simulada en la salud del dataset.
