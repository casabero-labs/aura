# Baseline INVALIDATED - Commit 6acc63e

## Motivo

- CSV parser manual hacia `.trim()` de los valores, eliminando trailing spaces
- 38 nombres tienen trailing spaces en el CSV real, PapaParse los preserva
- Al eliminar trailing spaces, la regla "Espacios Fantasma (Trim)" en Name nunca dispara
- El fixture de AuditReport no contiene este issue que el motor productivo real SI detectaria
- El ground truth no incluye esta accion como AUTOMATIZABLE

## Correccion en Fase 0C

Ver: `../baseline/` para el baseline corregido con:
1. PapaParse identico a produccion (preserva trailing spaces)
2. AuditReport real con "Espacios Fantasma (Trim)" en Name (38 afectados)
3. Ground truth actualizado: trim_whitespace como AUTOMATIZABLE
4. Evaluador corregido para citas, review retention, sintaxis Python
5. Tiempo limite real de 120s por llamada
