# Piloto exploratorio Gemma 4 con los tres métodos de entrada

## Propósito y alcance

Este piloto verificó el flujo normal de AURA antes de congelar la campaña del
Laboratorio. No forma parte de los resultados formales ni se mezcla con las 27
corridas de la campaña.

- Dataset: `synthetic_ground_truth.csv`.
- SHA-256: `4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49`.
- Modelo: `hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL`.
- Fecha: 14 de julio de 2026.
- Evidencia local: `experiments/tests/flujo7/` (no versionada porque puede contener muestras del dataset).

## Resultados observados

| Método visible | ID técnico | Secciones | Estado crudo | Gobernanza aplicada por AURA | Duración | Tokens de salida | Referencias de evidencia |
|---|---|---:|---|---:|---:|---:|---:|
| Contexto mínimo | `prompt_libre` | 3 | válido | 0 | 165,2 s | 3.533 | 0 |
| Evidencia equilibrada | `smart_sample` | 6 | inválido solo por `DIAGNOSIS_REVIEW_DOWNGRADE` | 9 | 192,2 s | 3.524 | 16 |
| Evidencia completa | `recommended` | 12 | inválido solo por `DIAGNOSIS_REVIEW_DOWNGRADE` | 1 | 255,6 s | 3.918 | 16 |

Los tres paquetes conservaron los 15 hallazgos y 15 bloques diagnósticos. Los
manifiestos y hashes fueron coherentes. La salida efectiva del producto fue
válida en los tres casos; cuando el modelo redujo indebidamente la revisión
humana, AURA conservó la respuesta cruda y aplicó su política determinista sin
alterar IDs, reglas, columnas, evidencias ni cobertura.

## Lectura del piloto

- Contexto mínimo fue el más rápido, pero produjo un diagnóstico genérico, sin
  referencias de evidencia y predominantemente en inglés.
- Evidencia equilibrada añadió evidencia útil, aunque fue la que más correcciones
  de gobernanza necesitó en esta ejecución.
- Evidencia completa ofreció la mejor trazabilidad global y solo necesitó una
  corrección determinista de revisión humana, a cambio de mayor latencia.
- Los valores de confianza uniformes en `1.0`, el idioma y la fecha generada por
  el modelo deben evaluarse como comportamiento del LLM, no como hechos del
  motor determinista.

## Decisión

El piloto se declara cerrado y suficiente para iniciar una campaña separada.
No permite declarar un modelo o método ganador: esa conclusión solo puede
derivarse de la matriz formal de 3 modelos × 3 métodos × 3 repeticiones.
