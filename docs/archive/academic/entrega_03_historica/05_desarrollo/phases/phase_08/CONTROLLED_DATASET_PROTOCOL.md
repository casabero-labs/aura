# Phase 8 L2 — Controlled Dataset Protocol

## Propósito

Definir formalmente el dataset sintético controlado `controlled_customers_phase8.csv` que servira como base para validar el flujo completo de AURA en Phase 8 L3 (Controlled Pilot Run). Este dataset esta diseniado especiificamente para ser la entrada del pilot run, permitiendo comparar los hallazgos de AURA contra un ground truth documentado.

## ¿Por qué es sintético?

1. **Sin PII**: todos los nombres, correos, telefonos, documentos y direcciones son sinteticos. No hay datos personales reales.
2. **Errores intencionales documentados**: cada problema existe porque fue diseniado, no descubierto. Esto permite medir precision y recall.
3. **Reproducibilidad**: cualquier persona puede usar el mismo CSV y obtener resultados comparables sin depender de un dataset real propietario.
4. **Control de scope**: permite verificar que AURA detecta lo que debe detectar sin falsos positivos no esperados.

## Confirmación de ausencia de PII

- Correos electronicos usan exclusivamente dominio `.invalid` (reservado por RFC 6761 para documentacion/test).
- Telefonos usan series sinteticas `+56-9-1111-XXXX` (prefijo de Chile, numeros de ejemplo).
- Nombres combinan nombres comunes genericos con apellido seguido de "Sintetico"/"Sintetica".
- Empresas usan nombres genericos: SolucionesDelta, TecnologiasOmega, etc.
- Tax IDs usan prefijo `SYN-` para identificar como sinteticos.
- No hay emails de proveedores reales (gmail, hotmail, outlook, yahoo, etc.).

## Contexto simulado de negocio

El dataset simula una base de clientes de una plataforma SaaS ficticia que opera en Chile. Cada cliente tiene:

- Un plan contratado (BASIC, PREMIUM, ENTERPRISE).
- Creditos mensuales asignados (`total_credits`) y creditos consumidos (`credits_used`).
- Datos de contacto (nombre, email, telefono).
- Datos demograficos (ciudad, pais).
- Estado administrativo (ACTIVE, INACTIVE, SUSPENDED, PENDING).

## Columnas

| # | Columna | Tipo | Requerido | Dominio |
|---|---------|------|-----------|---------|
| 1 | customer_id | string | SI | CXXX formato |
| 2 | full_name | string | SI | Nombre + Apellido sintetico |
| 3 | email | string | SI | Formato email valido, dominio .invalid |
| 4 | phone | string | SI | +56-9-XXXX-XXXX normalizado |
| 5 | birth_date | date | SI | DD/MM/YYYY, < 120 anios, no futura |
| 6 | registration_date | date | SI | DD/MM/YYYY, >= 2020, no futura |
| 7 | city | string | SI | Ciudades de Chile (lista cerrada) |
| 8 | country | string | SI | CL |
| 9 | plan_type | string | SI | BASIC, PREMIUM, ENTERPRISE |
| 10 | credits_used | integer | SI | >= 0, <= total_credits |
| 11 | total_credits | integer | SI | >= 0, >= credits_used |
| 12 | company | string | NO | Nombre sintetico o vacio |
| 13 | tax_id | string | NO | SYN-XXXX o vacio |
| 14 | status | string | SI | ACTIVE, INACTIVE, SUSPENDED, PENDING |
| 15 | notes | string | NO | Texto libre o vacio |

## Reglas de calidad esperadas

1. `customer_id` — unico, formato C + 3 digitos.
2. `full_name` — no nulo, sin placeholders (N/A, UNKNOWN, SIN_DATO).
3. `email` — no nulo, formato email valido, sin placeholders.
4. `phone` — no nulo, formato normalizado, sin placeholders.
5. `birth_date` — no nulo, formato DD/MM/YYYY, no futura, edad razonable (< 120 anios).
6. `registration_date` — no nulo, formato DD/MM/YYYY, no futura, >= 2020.
7. `city` — no nulo, en lista de ciudades permitidas, casing consistente, sin espacios extra.
8. `country` — no nulo, valor CL para este dataset.
9. `plan_type` — no nulo, en {BASIC, PREMIUM, ENTERPRISE}, uppercase.
10. `credits_used` — no nulo, >= 0, <= total_credits.
11. `total_credits` — no nulo, >= 0, >= credits_used.
12. `status` — no nulo, en {ACTIVE, INACTIVE, SUSPENDED, PENDING}.
13. `company` — opcional.
14. `tax_id` — opcional, si tiene valor, formato SYN-XXXX.
15. `notes` — opcional.

## Errores intencionales incluidos

| Categoria | Cantidad aproximada | Ejemplos |
|-----------|---------------------|----------|
| Duplicados (ID) | 1 | C001 repetido en fila 41 |
| Nulos en campos requeridos | 8+ | full_name, email, phone, birth_date, registration_date, city, country, plan_type, total_credits |
| Placeholders (N/A, UNKNOWN, SIN_DATO) | 7+ | email=N/A, phone=UNKNOWN, city=SIN_DATO, full_name=N/A |
| Emails invalidos | 5 | correo-invalido, NOT-AN-EMAIL, N/A, vacio |
| Telefonos con formato inconsistente | 2 | 9-1111-0020, 000-0000-000 |
| Fechas invalidas o imposibles | 2 | 30/02/2000, 14/03/19986 (anio 5 digitos) |
| Fechas futuras | 3 | birth_date 2075, registration_date 2025 |
| Casing irregular | 4 | premium, basic, ARICA, la serena |
| Espacios extra | 4 | "  Santiago  ", "   Tomas Varela Sintetico  " |
| Valores fuera de rango | 2 | credits_used = -50, credits_used > total_credits |
| Categorias no permitidas | 5 | country=CHL, country=XXX, plan_type=invalid_plan, plan_type=desconocido |
| Inconsistencias de negocio | 1 | credits_used > total_credits |
| Edad improbable | 2 | cliente de 7-8 anios (requiere interpretacion) |

## Errores fuera de alcance (no incluidos)

- Datos personales reales (nombres, correos, telefonos, documentos).
- Datos financieros reales.
- Datos de salud.
- Datos offensivos, sesgados o discriminatorios.
- Inyecciones SQL/XSS (fuera del scope de AURA como profiler de datos).
- Archivos corruptos (CSV siempre es parseable).
- Problemas de encoding (UTF-8 estandar).
- Columnas con tipos semanticos complejos (coordenadas, JSON embebido, URLs).

## Criterios de uso en L3

1. **Pre-auditoria**: AURA debe cargar el CSV y ejecutar `runAudit` determinista.
2. **Comparacion con ground truth**: los issues reportados por AURA se cruzan contra `controlled_customers_phase8_ground_truth.json`.
3. **Clasificacion de deteccion**:
   - `true_positive` — issue en ground truth detectado por AURA.
   - `false_positive` — issue reportado por AURA que no esta en ground truth.
   - `false_negative` — issue en ground truth no detectado por AURA.
4. **Metricas minimas a reportar**:
   - Precision = TP / (TP + FP)
   - Recall = TP / (TP + FN)
5. **No se ejecuta mejora en L3**: L3 es solo pilot run. El HealthDelta y el ImprovementRun se dejan para fases posteriores.

## Claims permitidos

- El dataset `controlled_customers_phase8.csv` es 100% sintetico y no contiene PII.
- Los errores fueron diseniados intencionalmente con ground truth documentado.
- AURA puede ser validada contra este dataset controlado sin riesgos de privacidad.
- Las metricas de deteccion obtenidas son validas SOLO para este dataset y contexto.
- Los correos usan dominio `.invalid` reservado para documentacion/test segun RFC 6761.

## Claims prohibidos

- NO afirmar que este dataset representa datos reales de clientes.
- NO afirmar que la validacion sobre este dataset equivale a validacion externa independiente.
- NO afirmar que AURA es production-ready basado solo en resultados de este dataset.
- NO afirmar que el recall/precision obtenido generaliza a cualquier dataset.
- NO afirmar que AURA corrigio datos reales con este dataset.
- NO afirmar que existe un benchmark formal definitivo solo con este dataset.

## Limitaciones

1. **Sintetico**: los patrones de error son intencionales y no representan la distribucion de errores del mundo real.
2. **Un solo dominio**: enfocado en clientes SaaS en Chile. No cubre otros dominios (salud, finanzas, logistica).
3. **Tamano reducido**: 50 filas. No mide escalabilidad ni rendimiento sobre grandes volumenes.
4. **Idioma limitado**: datos en espaniol. No cubre problemas de encoding multilingue ni caracteres especiales.
5. **Reglas conocidas**: el disenio del dataset conoce las reglas del motor determinista de AURA, lo que puede favorecer resultados optimistas.
6. **Sin corrupcion de archivo**: el CSV es siempre parseable. No prueba robustez ante archivos malformados.
7. **Sin tipos semanticos complejos**: no incluye coordenadas, JSON embebido, URLs, etc.
8. **Sin dependencia de LLM**: las reglas deterministicas son el foco. Los modos que requieren interpretacion (cognitive_expected) estan marcados explícitamente.
