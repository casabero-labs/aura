# Inventario de elementos · Aura → Editorial 1.2

**Fecha:** 16 septiembre 2026. **Base:** producción `aura.casabero.com` (`d303c2b`) y `App.tsx` / `MainPipeline.tsx` actuales.

Esto no sustituye el inventario de 70 TSX del 14 sep. Aquí se lista **lo que una persona ve y usa**, con veredicto. Rediseñar o quitar no está vetado: el contrato a preservar es evidencia, autorización humana y valores, no la disposición SaaS.

Leyenda:

| Veredicto | Significa |
|---|---|
| **Tokens** | El objeto es correcto; cambiar tipo, color, radio, foco, densidad |
| **Rediseñar** | Misma función, otra disposición Editorial |
| **Reconsiderar** | Mover, fusionar o retirar; no es obligatorio que exista así |
| **Proteger** | No tocar por estética (motor, sesión, ZIP, preservación) |
| **Retirar** | Código o UI sin camino; no migrar Ink/Warm |

Editorial 1.2: canvas `#FFFFFF`, tinta `#191919`, serif de lectura, sans de control, radios 0–4, sin sombra, nav 52 px, una primaria por contexto.

---

## 0. Cascada y cromo global

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| `src/index.css` (~16k líneas, reglas duplicadas) | Tokens Editorial + overrides sans/SaaS al final | **Rediseñar** | Foundations nuevas; no más parches al final. El título de home es serif 148 px y luego sans |
| `casabero-editorial.tokens.css` | Hex 1.2 correctos | **Tokens** | Única fuente de color/tipo; el resto solo consume |
| `index.html` fuentes | Source Serif 4 + Source Sans 3 | **Tokens** | Quitar Inter/Playfair si quedan |
| `data-casabero-theme="editorial"` | Presente | Conservar | |
| Modo claro/oscuro | Switch en la nav | **Reconsiderar** | Modo en Configuración, no cromo de primer nivel. Editorial admite `data-theme`, no un segundo tema |
| Skip link | Existe | **Tokens** | |
| Anillo de foco | Mixto (outline + borde) | **Tokens** | Botón: anillo 2 px con hueco. Campo: inset 2 px. Nunca ambos |
| Color semántico (éxito/error/acento) | Todo mapeado a `#191919` | **Rediseñar** | Jerarquía por peso, filete y copy. No fingir semántica con teal ni con tinta plana |
| Lucide icons | En botones y tarjetas | **Reconsiderar** | Texto primero; icono solo si aporta. `currentColor`, trazo fino |
| Favicon / AuraMark | Tres elipses | **Tokens** | `currentColor`, stroke 1.55 |

---

## 1. Shell (U01 / U09)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Wordmark AURA + marca | Botón a Inicio | **Tokens** | Sans/meta 52 px de alto; no logo de producto SaaS |
| Destino Auditoría | Nav igual que Laboratorio | **Tokens** | Dos destinos de trabajo, estado `aria-current` |
| Destino Laboratorio | En nav **y** CTA de portada | **Reconsiderar** | Solo en nav. No repetir en el hero |
| Configuración | Drawer (bien) | **Tokens** | Utilidad etiquetada; Escape, foco, retorno |
| Ayuda | Drawer + otra vez en el footer | **Reconsiderar** | Una sola entrada (nav). Footer no duplica |
| Historial / registro | Footer | **Reconsiderar** | Utilidad desde Ayuda o desde el análisis, no tercer flujo |
| «Nuevo análisis» en nav | Aparece con datos | **Reconsiderar** | Vive en Inicio (otra auditoría) y en Exportación. No en chrome permanente |
| Footer CASABERO · aura · 2026 | Firma + 2 botones | **Rediseñar** | Firma editorial. Sin menú paralelo |
| Changelog modal | Overlay | **Tokens** | O retirar de la nav si no hay disparador visible |
| Error boundary | Pantalla de fallo | **Tokens** | Mensaje + recargar; sin stack de dashboard |
| `?view=ollama-setup` | Ruta standalone | **Tokens** | Editorial + salida clara a Inicio |

---

## 2. Inicio (U01)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Eyebrow «Auditoría local…» | Uppercase tracking | **Tokens** | Meta sans 0.10–0.16 em, no hero de marca |
| H1 «Auditar un CSV» | Display ~148 px, luego override sans | **Rediseñar** | Serif 44–64 px. Tarea, no cartel |
| Párrafo de alcance | Correcto de fondo | **Tokens** | Cuerpo serif 17–19 px |
| Primaria «Empezar auditoría» | Outline/fill mixto | **Tokens** | Una primaria outline Editorial |
| Secundaria «Abrir Laboratorio» | Misma fila que la primaria | **Reconsiderar** | Quitar. Laboratorio ya está en nav |
| Línea de proceso (Carga → …) | Una frase | **Tokens** | Conservar corta; no tres tarjetas (ya no están en JSX) |
| Estado con sesión: Reanudar + archivo/etapa | Existe | **Rediseñar** | Primaria Reanudar; «Empezar otra» subordinada + diálogo |
| Tres tarjetas Perfilar/Diagnosticar/Defender | Fuera del JSX actual | **Retirar** | No reintroducir |

---

## 3. Carga (U02)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Stepper 1–5 (pills numeradas) | Wizard de producto | **Rediseñar** | Hitos de documento (filete + nombre de etapa). No barra tipo onboarding |
| Título «Cargar CSV» | h3 en tarjeta | **Rediseñar** | Título de sección serif; la tarjeta no es el layout |
| Copy de privacidad + formato | Correcto | **Tokens** | Junto al control, no en un recuadro de marketing |
| Zona drag-and-drop | `.file-drop` | **Tokens** | Filete, estado arrastre/error. Input nativo visible |
| «Seleccionar archivo» duplicado (label + botón) | Dos controles | **Rediseñar** | Un control |
| Evidencia de ingestión (tarjeta métricas) | Dashboard de chips | **Rediseñar** | Identidad del archivo + detalle expandible (filas, hash, delimitador) |
| Error CSV vacío/ilegible | Ya hay mensaje accionable | **Tokens** | Misma sección, reintento, sin score |

---

## 4. Perfil (U03)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Hero de perfil / score grande | Certifica de más | **Rediseñar** | Conclusión condicionada + denominador. 100/100 no es «salud universal» |
| Fila de métricas (filas, columnas, hallazgos) | Varias cards | **Rediseñar** | Una fila de cifras sans tabular |
| Prioridades (lista de issues) | Cards con badges CRÍTICO | **Rediseñar** | Lista/tabla: regla, columna, `N de M (%)`, hipótesis vs confirmado |
| Columnas afectadas | Chips | **Tokens** o **rediseñar** | Índice seleccionable + detalle |
| ColumnStats / IQR / cardinalidad | Detalle técnico | **Tokens** | Plegado; pista IQR ya existe |
| Gráfico de severidad | SVG de producto | **Rediseñar** | Tinta Editorial, alternativa tabular |
| BoxPlot / DatasetProfile / FindingsTable / RuleActivationMatrix | Varios sin camino de import | **Retirar** o reactivar con diseño nuevo | No migrar muertos |
| Continuar al diagnóstico | Primaria | **Tokens** | |

---

## 5. Diagnóstico (U04)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| DiagnosisHeroPanel | Bloque denso | **Rediseñar** | Objetivo → proveedor → qué se envía → Iniciar |
| Provider panel + quick config modal | Configuración en el medio de la tarea | **Reconsiderar** | Esencial aquí; avanzado en drawer Configuración |
| Contract canvas / cognitive contract | Lienzo técnico al frente | **Rediseñar** | Detalle plegado «Qué recibirá el modelo» |
| Progreso (enviando / recibiendo / cancelar) | Ya no es timer falso | **Tokens** | scaleX, tiempo real, cancelar con alcance |
| «Continuar con informe determinista» | Recuperación | **Tokens** | Causa + alternativa, misma sección |
| ChromeAiStatusPanel | Estado de modelo | **Tokens** | |
| GeminiAdvisor | Ruta legacy | **Reconsiderar** | Fusionar o retirar si duplica diagnóstico |

---

## 6. Informe (U05)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Hero + 6 summary cards | Dataset, modelo, score, decisión | **Rediseñar** | Conclusión primero; metadata en «Cómo se obtuvo» |
| Hallazgos agrupados | Atributos mezclados con cards | **Rediseñar** | Un patrón de hallazgo: señal, columna, N/M, evidencia, certeza |
| «Señal pendiente de contexto» / 999 | Copy correcto | **Tokens** | No volver a «Riesgo confirmado» |
| Recomendaciones | Lista | **Tokens** | |
| Gráficas del informe | Preview | **Tokens** | Junto a la afirmación; tabla alternativa |
| Primarias Exportar / Corregir una copia | A veces duplicadas arriba y abajo | **Rediseñar** | Una zona de acción, mismo estado |
| Evidencia técnica plegable | Existe | **Tokens** | |

---

## 7. Corrección opcional (U06)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Aviso rama opcional | Banner | **Tokens** | Encabezado persistente + volver al informe |
| Plan V2 (aprobar / conservar / rechazar) | Lista de acciones | **Rediseñar** | Tabla: columna real, observado → propuesto, alcance |
| Cerrar sin cambios | Ya navega a exportar | **Tokens** | |
| Script review (análisis estático) | Contadores «seguro» | **Tokens** | Copy ya corregido; chrome Editorial |
| ReviewStep / ApplyVerify / HealthDelta | Varias etapas internas | **Rediseñar** | Tres hitos locales, no tres etapas del stepper global |
| Legacy V1 script generation | Todavía importado | **Reconsiderar** | Retirar si V2 cubre; no maquillar |

---

## 8. Exportación (U07)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Grid de 4 descargas equivalentes | PDF, JSON, CSV, ZIP | **Rediseñar** | Una recomendada + alternativas. PDF = diagnóstico inicial |
| Copy de ZIP / original no incluido | Correcto | **Tokens** | |
| Destruir sesión | Bloque al final | **Tokens** | Separado de descargar. Diálogo ya nativo |
| Volver al informe | Existe | **Proteger** | No perder evidencia (regresión ya cerrada) |

---

## 9. Laboratorio (U08)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Entrada desde nav | Correcta como destino | **Tokens** | Interior en LOOP-03, no en portada |
| Lab: setup, matriz, ejecución, resultados en un componente | Densidad de consola | **Rediseñar** | Por estado: vacía / en curso / completa |
| `editorial-lab.css` | Parche local | **Tokens** | Absorbido en foundations, no hoja paralela |
| ExecutionEvidencePanel / HumanRubricPanel | Sin camino | **Retirar** o enlazar | |

---

## 10. Configuración, ayuda, PDF (U09 + F8)

| Elemento | Ahora | Veredicto | Qué hacer |
|---|---|---|---|
| Settings: proveedores, Ollama, evidencia | Formulario largo | **Rediseñar** | Grupos: proveedor → evidencia → conexión. Drawer |
| Wizard Ollama | Tutorial | **Tokens** | Documento de ayuda, no wizard de onboarding |
| HelpCenter | Manual en drawer | **Rediseñar** | Ayuda corta junto a la tarea; extensa navegable |
| AuditLogViewer | Overlay técnico | **Tokens** | |
| PDF diagnóstico / determinista / lab | Tipografía propia | **Tokens** | Preset compatible o estándar; no Inter |

---

## 11. Infra que se confunde con UI

| Elemento | Veredicto |
|---|---|
| `https://api.aura.casabero.com` TLS | **Proteger/infra** | Nested subdomain sin cert CF. No se arregla con CSS |
| Preservación `001` / sesión / ZIP | **Proteger** | |
| 15 TSX sin import | **Retirar** en F0 | No pasar a Editorial |

---

## Orden que usaría (alineado al addendum del 14)

1. **LOOP-01** — Cascada + shell + Inicio + Carga. Quitar Laboratorio y dark mode de la portada. Stepper → hitos de documento.
2. **LOOP-02** — Perfil, diagnóstico, informe, exportación, rama de corrección. Conclusión primero; una zona de acción.
3. **LOOP-03** — Laboratorio por estado; utilidades densas; retirar muertos; PDF.

Criterio de no híbrido: no publicar un loop a `aura.casabero.com` hasta que ese recorrido se vea solo Editorial (humano + 390/1280 claro/oscuro).

---

## Qué no es este inventario

No es implementación. No cambia contratos de auditoría. Autoriza rediseño de disposición. El archivo de 70 componentes sigue siendo la lista de código; este es la lista de **elementos humanos**.
