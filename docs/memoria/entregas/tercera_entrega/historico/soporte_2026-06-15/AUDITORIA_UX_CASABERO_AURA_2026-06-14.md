# Auditoria UX Casabero por fase - AURA

> Base: `estandar-casabero` MCP + `examples/frontend/showcase.html` + `UX_UI_MANIFESTO.md` + `HUMAN_FIRST_UX.md` + verificacion Titanic del flujo real.

## 1. Criterios usados

| Criterio Casabero | Regla aplicada en AURA |
|---|---|
| Human-first | Un usuario debe completar upload -> perfil -> diagnostico -> script -> revisar -> exportar |
| State clarity | Cada click relevante debe tener estado, causa y salida comprensible |
| Warm/editorial | Superficie sobria, sin ruido decorativo, sin matrices internas en la app |
| Informacion progresiva | Resumen primero; evidencia tecnica en detalles colapsados |
| Contratos honestos | No llamar JSON a lo que es cumplimiento textual de contrato |
| Responsive | Sin overflow horizontal en mobile; controles tocables y legibles |
| Lab opcional | El Lab calibra configuracion; no bloquea el flujo principal |

## 2. Observacion del MCP

El MCP `mcp__casabero_standards` encontro estos puntos relevantes:

- AURA tiene `DESIGN.md`.
- AURA requiere auditoria UX human-first por flujo critico.
- El detector MCP no encontro E2E porque inspecciono desde la raiz y el paquete/test suite vive en `src/`; esto se considera falso positivo parcial, no ausencia real de Playwright.
- Recomendacion MCP: validar responsive a 320/390px, contraste, foco y ausencia de overflow.

## 3. Auditoria por fase

| Fase | Lo que debe sentir el usuario | Estado actual observado | Riesgo UX | Accion |
|---|---|---|---|---|
| Subir CSV | "El archivo entro y AURA sabe que recibio" | Upload local funciona y deriva a perfil; contrato de ingestion esta en detalles | Si el error de CSV aparece muy tecnico, el usuario no sabe corregir | Mantener resumen de ingestion en detalles; error visible con causa humana |
| Perfilar | "Estos son los problemas reales del dataset" | Resumen compacto: score, filas, columnas, criticos, advertencias, top findings | Mobile tenia overflow horizontal con Titanic | Corregido CSS: stepper con scroll interno y contenedores `min-width: 0` |
| Diagnostico | "AURA interpreta los hallazgos, pero se si el modelo esta disponible" | Pantalla compacta existe; con Titanic el boton LLM quedo deshabilitado por proveedor no disponible | La causa aparece como title/estado, pero no como explicacion suficientemente accionable | Mostrar mensaje inline: proveedor local/cloud no disponible y que se puede continuar con script determinista |
| Script | "Tengo un arreglo propuesto y se que tan seguro es" | Script determinista funciona sin LLM; safety 88/100; cobertura 60% | Puede parecer aprobado aunque hay 2 hallazgos sin cobertura | Mantener safety/cobertura en primer plano; resaltar "requiere revision humana" como advertencia estructural |
| Revisar | "Puedo inspeccionar y aprobar antes de simular" | HITL funciona; scroll activa revision completa; simulacion sobre copia | Con Titanic la simulacion no mejora score ni issues, pero el flujo permite avanzar | Cuando delta sea 0, mostrar advertencia mas fuerte: "la simulacion no resolvio hallazgos" |
| Exportar | "Descargo un paquete claro y honesto" | Exporta PDF, JSON, CSV y script; claims/limitaciones visibles | "Objetivos 3/5" era lenguaje academico en primer plano | Corregido a "Cobertura"; OE queda solo en detalles tecnicos |
| Laboratorio | "Puedo calibrar AURA si quiero comparar configuraciones" | Lab separado del flujo principal; modos de entrada visibles | Sin proveedor real, no hay corridas formales y puede parecer que no hace nada | Mantener `attempted_failed`; explicar que no hay benchmark formal sin proveedor/ground truth |

## 4. Cambios aplicados en esta fase

### Benchmark/discurso

- Se agrego `contractCompliance` como nombre correcto.
- `formatCompliance` queda como alias historico.
- `jsonCompliance` queda reservado a JSON real.
- El Lab muestra columna "Contrato".
- El export de benchmark separa `contractCompliance` y `jsonCompliance`.

### Metricas

- La penalizacion de columnas fantasma ya no usa `tokensGenerated`.
- La base es `knownColumnCount`.
- `Diagnosis Reliability Score` usa evidencia observada:
  - columnas reales mencionadas;
  - reglas reales mencionadas;
  - bad samples citados.

### UX

- Fix responsive en perfil/stepper para evitar overflow horizontal mobile.
- Exportar ya no muestra "Objetivos" en primer plano; ahora muestra "Cobertura".

## 5. Debilidades que siguen abiertas

| Riesgo | Severidad | Por que importa |
|---|---:|---|
| Diagnostico LLM no corre sin proveedor disponible | Alta | No hay diagnostico cognitivo real en esa configuracion |
| Lab sin API key/WebGPU no produce evidencia formal | Alta | OE4 queda implementado pero no cerrado experimentalmente |
| Delta de simulacion puede ser 0 aunque el script se apruebe | Media | Se debe evitar que el usuario confunda aprobacion HITL con mejora efectiva |
| CSS aun tiene componentes historicos de matrices/loops | Media | No se ven en la app, pero aumentan deuda de mantenimiento |
| Algunos graficos usan hex crudos | Baja-media | Choca con Casabero tokens; no bloquea flujo pero debe limpiarse |
| Claims no numericos inventados siguen siendo dificiles de detectar | Media | Detector anti-alucinacion es parcial, no garantia total |

## 6. Siguiente loop recomendado

`AURA-UX-STRICT-02`

1. Diagnostico: mensaje inline claro cuando proveedor no esta disponible.
2. Revisar: advertencia fuerte cuando `healthDelta.scoreDelta === 0`.
3. Lab: empty/error state accionable para API key/WebGPU.
4. CSS: eliminar estilos muertos de matrices/loops o moverlos a archivo archivado.
5. QA: repetir Titanic desktop/mobile y confirmar 0 overflow.
