# P1-03 — Recibo Python verificable

## Objetivo

Demostrar que el script aprobado fue compilado y ejecutado realmente sobre el
CSV controlado, y que el CSV importado es exactamente la salida de esa
ejecución.

## Cadena de evidencia

1. AURA exporta un bundle con `runId`, script, hash del script aprobado y hash
   del CSV fuente.
2. El ejecutor local comprueba los hashes, compila el script con Python y llama
   a `clean_dataset(df)` sobre una copia cargada con pandas.
3. El ejecutor escribe el CSV resultante y un recibo con versiones, tiempos,
   estados y hashes de entrada, salida, stdout y stderr.
4. AURA importa juntos el CSV y el recibo, recalcula todos los hashes y rechaza
   cualquier diferencia.
5. Solo un recibo íntegro con sintaxis y ejecución aprobadas permite marcar
   `syntaxValid: true` y realizar la reauditoría.

## Reglas de cierre

- Importar solo un CSV nunca acredita ejecución ni sintaxis.
- Un recibo inválido o alterado se rechaza sin modificar la corrida.
- Un recibo válido de fallo puede conservarse como evidencia, pero no produce
  una reauditoría exitosa.
- La campaña de 45 corridas sigue bloqueada hasta completar smokes reales.

