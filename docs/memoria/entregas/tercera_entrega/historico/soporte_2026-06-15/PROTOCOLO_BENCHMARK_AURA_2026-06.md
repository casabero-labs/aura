# Protocolo minimo de benchmark AURA - junio 2026

> Objetivo: cerrar OE4 sin inflar resultados. El laboratorio no declara un ganador universal; calibra configuraciones LLM bajo el mismo dataset, contrato de entrada y reglas de evidencia.

## 1. Principio de discurso

La contribucion principal de AURA es la arquitectura local-first de auditoria, diagnostico asistido, script controlado y revision humana. El Lab es un modulo experimental opcional para decidir que configuracion produce el diagnostico mas confiable en un caso concreto.

No usar "benchmark formal" si la corrida no cumple todas estas condiciones:

1. proveedor disponible;
2. corrida completada;
3. contrato de salida cumplido;
4. cero columnas fantasma;
5. script valido;
6. ground truth asociado al dataset;
7. export JSON preservado.

## 2. Estados de evidencia

| Estado | Uso permitido | Ejemplo |
|---|---|---|
| `attempted_failed` | Intento fallido, no resultado | API key ausente, WebGPU no disponible, error de proveedor |
| `preliminary_valid` | Resultado preliminar | Corrida completa sin ground truth formal |
| `formal_valid` | Resultado formal defendible | Corrida completa + contrato + cero alucinaciones + script valido + ground truth |

Frase permitida:

> AURA reporta como formales solo las corridas con contrato cumplido, ausencia de columnas alucinadas, script valido y correspondencia con ground truth.

## 3. Dataset y configuracion minima

| Campo | Valor minimo |
|---|---|
| Dataset controlado | `src/experiments/datasets/synthetic_ground_truth.csv` |
| Dataset aplicado | `src/experiments/datasets/titanic.csv` |
| Repeticiones | 3 por configuracion formal |
| Temperatura base | 0.1 o 0.2 |
| Modo principal | `smart_sample` |
| Modos comparativos | `prompt_libre`, `copy_paste_bad_samples`, `recommended` |
| Local | WebLLM si WebGPU/modelo inicializa |
| Cloud | Un proveedor con API key activa |

## 4. Experimentos minimos

| Experimento | Compara | Regla |
|---|---|---|
| A | mismo modelo, distintos modos de entrada | fija proveedor, modelo, temperatura y dataset |
| B | distintos modelos, mismo modo de entrada | fija dataset, temperatura y `smart_sample` |
| C | local vs cloud | misma entrada, mismo dataset, misma temperatura |

No comparar `prompt_libre` contra `smart_sample` como si fueran "modelos". Son modos de entrada distintos.

## 5. Metricas oficiales

| Metrica | Formula o criterio | Nota |
|---|---|---|
| Latencia | `latencyMs` | menor es mejor |
| Tokens/s | `tokensPerSecond` | mayor es mejor |
| Cumplimiento de contrato | `contractCompliance` | secciones/campos esperados segun modo |
| JSON real | `hallucinationReport.jsonCompliance` | solo true si parsea JSON y campos requeridos |
| Columnas alucinadas | `hallucinatedColumns.length` | ideal = 0 |
| Score anti-alucinacion | `1 - min(hallucinatedColumns / knownColumnCount, 1)` | no usar tokens como proxy |
| Claims sin soporte | `unsupportedClaims` | detector parcial; reportar limite |
| Script incluido | `pythonScriptIncluded` | presencia de script Python/Pandas |
| Script valido | `scriptValidation.valid` | columnas existentes, cobertura y operaciones no destructivas |
| Reliability score | evidencia observada + contrato + alucinaciones + script + latencia | no se otorga credito solo por modo |

## 6. Tabla final para memoria/articulo

| Dataset | Modelo | Proveedor | Entrada | Temp. | Latencia | Contrato OK | JSON real | Alucinaciones | Script valido | Estado evidencia | Score |
|---|---|---|---:|---:|---:|---|---|---:|---|---|---:|

## 7. Claims permitidos

Permitido:

- "El Lab de AURA permite comparar configuraciones bajo un contrato comun."
- "Las corridas fallidas se registran como intentos fallidos, no como resultados."
- "El score compuesto prioriza contrato, ausencia de columnas fantasma, latencia, eficiencia, script y claims."

No permitido:

- "AURA demuestra que X modelo es superior" sin tabla formal.
- "AURA elimina alucinaciones"; solo detecta un subconjunto relevante.
- "JSON compliance" cuando solo se valido contrato textual.

## 8. Cambios aplicados al codigo base

- `contractCompliance` se agrega como nombre correcto del cumplimiento de salida.
- `formatCompliance` queda como alias historico.
- `jsonCompliance` queda reservado a parseo JSON real.
- La penalizacion de columnas alucinadas usa `knownColumnCount`, no `tokensGenerated`.
- `Diagnosis Reliability Score` usa evidencia observada: columnas/reglas mencionadas y bad samples citados.

## 9. Proximo cierre formal

1. Activar un proveedor real local o cloud.
2. Ejecutar 3 corridas por configuracion sobre `synthetic_ground_truth.csv`.
3. Exportar JSON del Lab.
4. Generar tabla final.
5. Repetir con Titanic como caso aplicado, indicando si es formal o demostrativo.
