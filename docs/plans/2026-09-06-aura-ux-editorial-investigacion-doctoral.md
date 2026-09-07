# Aura: auditoría de recorrido, Editorial e investigación doctoral

Fecha: 2026-09-06. Estado: **EN CURSO — avance persistido, sin implementación UI**.

## Objetivo y autorización

Evaluar cada paso real de uso de Aura: comprensión, amabilidad, UX/UI, accesibilidad, control, errores y terminación de tareas. Contrastar Casabero Editorial y proponer un piloto acotado antes de modificar la interfaz. En paralelo, investigar líneas internacionales y posibles preguntas doctorales adyacentes a Aura, sin atribuir novedad antes de revisar la literatura.

El usuario autorizó guardar avances en este Markdown. El código de aplicación permanece en solo lectura. Actualización de autorización: el usuario pidió explícitamente commit y push del avance documental en `main`. No se autorizó despliegue, cambio de rama, actualización de Graphify ni rediseño integral. Los datos de prueba serán sintéticos y las capturas se guardarán fuera del código.

## Coordinación y fuentes

- Coordinación/investigación: tarea `01a0789f-903a-7990-8c88-29ca33542169`.
- Actualización del estándar: tarea **Actualizar estándar Casabero y evaluar Editorial para Aura**, `01a078a2-bdbd-73a2-b773-c11aee6c832a`. Solo esa tarea realiza el pull autorizado de `/Users/casabero/Documents/GitHub/estandar-casabero`.
- Auditoría operativa y mantenimiento de este checkpoint: tarea actual.
- Evidencias externas: `/Users/casabero/Documents/Codex/audits/aura-2026-09-06/`.
- Estándar leído: `examples/frontend/showcase.html`, `standards/design/themes/EDITORIAL.md` (1.2.0), `standards/frontend/ACCESSIBILITY.md` del repositorio de estándares. La tarea del estándar confirmó pull seguro: `main` ya coincidía con `origin/main` en `63c52fe`. Evidencia verificada por esa tarea. Editorial normativo sigue en 1.2; el showcase principal es Warm y copiarlo íntegro no implementaría Editorial.

## Entorno confirmado

- Checkout: `/Users/casabero/Documents/GitHub/aura`, rama `main`, HEAD `52ca44e` (`docs(diagnosis): document detailed V2.5-C plan`). No se hizo fetch ni se afirma sincronización remota actual.
- Cambios preexistentes: `src/__tests__/diagnosisPromptV2.test 2.ts`, `src/__tests__/diagnosisSystemInstructionV2.test 2.ts`, `src/contracts/llm/diagnosisInputPackageV2 2.ts`, todos sin seguimiento. Se preservan.
- Graphify local existe, raíz declarada `.`. Una consulta limitada a 1500 tokens dio candidatos truncados (40/645), útil para localizar componentes; no prueba cobertura total. No se leyó `graph.json` ni se regeneró.
- Runtime iniciado desde `src` con dependencias existentes: `http://127.0.0.1:3017/` (sesión de proceso de auditoría `92604`). No se usa el build antiguo de `src/dist`.
- Navegador autorizado: Codex In-app Browser, pestaña creada para la auditoría, puerto distinto para aislar almacenamiento local de otras sesiones.

## Línea 1: recorrido y Editorial

### Observaciones verificadas hasta este checkpoint

1. Portada cargada y observada visualmente: navegación Home, Auditoría, Laboratorio, Configuración; acción **Empezar auditoría**; etapas resumidas Perfilar / Diagnosticar / Defender; enlaces de ayuda e historial. La portada usa fondo gris muy claro y tipografía sans, por tanto aún no corresponde al tema Editorial normativo.
2. `src/services/csvService.ts` acepta límite opcional; `MainPipeline.processFile` llama `parseCsv(uploadedFile)` sin límite. La afirmación histórica de `preview: 5000` ya no describe la ruta principal por código. Falta comprobar 6.001 filas en la interfaz.
3. `App.tsx` restaura mediante `loadPipelineSession` y guarda cuando existe reporte. Existe mecanismo de persistencia; todavía no se ha probado recarga/reanudación humana.
4. `FileUpload.tsx` exige extensión `.csv`, ofrece clic/arrastre y activa selección con teclado; falta probar errores, foco y archivo vacío.

### Capacidades documentadas, todavía no equivalentes a recorrido completado

README y `docs/product/aura/NEXT_STEPS.md` describen **Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación**, remediación opcional gobernada, Python ejecutado externamente sobre una copia y un Laboratorio separado para comparar diagnósticos. El código de `MainPipeline` contiene estados upload, profile, diagnosis, diagnostic_report, script, review, execution y export.

### Matriz inicial de cobertura

| Paso o variante | Estado | Evidencia / siguiente prueba |
|---|---|---|
| Portada y primer paso | Observado | Captura visual en conversación; persistir PNG |
| CSV válido pequeño | No ejercitado | `fixtures/aura_ux_sintetico.csv` preparado |
| Archivo vacío / extensión no CSV | No ejercitado | `fixtures/vacio.csv`, `fixtures/invalido.txt` preparados |
| Lectura completa >5.000 filas | Código inspeccionado | `fixtures/aura_ux_6001.csv`, probar 6.001 filas |
| Perfil, métricas, tablas | No ejercitado | Navegar tras carga |
| Diagnóstico y proveedor ausente | No ejercitado | Ver disponibilidad real, sin credenciales nuevas |
| Recomendaciones y aprobación humana | No ejercitado | Depende de ruta válida de diagnóstico |
| Script y revisión | No ejercitado | No usar fixtures internas como recorrido real |
| Ejecución externa / reauditoría | No ejercitado | Distinguir generación de ejecución verificada |
| Comparación antes/después | No ejercitado | No inferir de presencia del componente |
| PDF, JSON, CSV, ZIP | No ejercitado | Exigir archivo descargado y legible |
| Recarga y restauración | Código inspeccionado | Falta recorrido humano |
| Nueva sesión / cierre y destrucción | No ejercitado | Revisar diálogo y cancelar, preservar datos ajenos |
| Ayuda, historial, ajustes, laboratorio | No ejercitado | Incluir recorridos auxiliares reales |
| Teclado, foco, contraste, móvil/overflow | No ejercitado | Revisar desktop y 390/320 px |

### Hipótesis de mejora, no conclusiones todavía

- Editorial podría reforzar lectura de resultados y explicaciones: blanco puro, serif en títulos/texto de lectura, sans funcional en tablas y controles, mono solo en código/identificadores.
- Separar decisión principal de detalle técnico podría reducir carga cognitiva sin perder trazabilidad.
- El piloto debe conservar etapas, contratos y comportamiento; alcance sugerido pendiente de evidencias: perfil → diagnóstico → informe.

## Línea 2: investigación internacional y preguntas doctorales

Responsable: coordinación. Búsqueda en curso; **no existe aún una afirmación de novedad doctoral**.

Fuente primaria preliminar identificada por coordinación: Akella et al., [Quality Assessment of Tabular Data using Large Language Models and Code Generation](https://aclanthology.org/2025.emnlp-industry.183/), EMNLP Industry 2025. LLM + controles ejecutables de calidad de datos es antecedente publicado y no basta como afirmación de novedad. Lectura profunda en curso.

Hipótesis a investigar:

- Calidad semántica de datos condicionada por tarea.
- Abstención calibrada y revisión humana activa.
- Efecto de la limpieza sobre conclusiones posteriores y cambios de distribución.

### Límites de evidencia académica comunicados por coordinación

En `experiments/results/final_deterministic_evidence.md`, la unidad de evaluación es activación binaria de regla. Ground truths parciales no establecen precisión global; score de salud no equivale a exactitud ni F1. El caso `controlled_customers_phase8` documenta 16 TP y 13 FN sobre 29 claves, recall 55,17% y F1 71,11%; coincidencia exacta por fila y capacidades cognitivas/HITL quedan fuera de ese F1. Son datos documentales, no reejecución independiente en esta auditoría.

La campaña documentada del laboratorio registra 27 intentos / 20 válidos / 7 fallidos bajo un dataset controlado. No se ha reejecutado ahora ni demuestra generalización.

Coordinación detectó que el enlace README a `docs/tfm/memoria_final/README.md` no resolvía. Pendiente confirmar y registrar como inconsistencia documental.

## Próximos pasos exactos de reanudación

1. Confirmar el runtime 3017 y recuperar la pestaña de auditoría por su URL; no borrar almacenamiento ni reiniciar una sesión ajena.
2. Persistir captura de portada y cargar CSV sintético mediante selector visible. Documentar perfil, errores y CTA siguiente con PNG y ubicación de código.
3. Probar proveedor real disponible; si falta, recorrer recuperación y registrar bloqueo sin llamar a código/fixtures una prueba humana completada.
4. Probar exportaciones y recarga desde estados alcanzables; verificar archivos y contenidos descargados.
5. Revisar navegación auxiliar, teclado/foco, contraste y anchos 390/320. Restaurar viewport al finalizar.
6. Completar matriz, hallazgos priorizados con reproducción y propuesta Editorial acotada. Incorporar actualización del estándar y resultados de investigación enviados por coordinación.
7. Verificar diff final: solo este documento autorizado, además de cambios preexistentes; capturas fuera del repositorio. Commit/push permitido solo para este avance documental, sin incluir cambios ajenos.
8. Enviar avance/cierre con rutas absolutas a coordinación. Mantener explícitos los pasos pendientes y bloqueados.

## Checkpoint ampliado — 2026-09-07

### Publicación y continuidad

Primer avance publicado en `origin/main`: `67a449c067e58d9008c1d9f2f5441c4b2ec6f226`; coincidencia remota comprobada otra vez el 7 de septiembre. Solo se incluyó este Markdown. Se empleó `GRAPHIFY_SKIP_HOOK=1`, opción prevista por el hook, para respetar la prohibición de regenerar el grafo. El servidor anterior había finalizado; se reinició en el mismo puerto 3017. Las pruebas siguientes siguen usando el código de aplicación de `52ca44e`; el commit posterior es documental.

### Hallazgo UX-01 — P1: entrada vacía presentada como saludable

**Observado en interfaz, no solo en código.** Reproducción: Empezar auditoría → Seleccionar archivo → CSV de cero bytes `vacio.csv`. Resultado: 0 filas, 0 columnas, 0 hallazgos, score 100, **Dataset saludable**, **El dataset está listo para análisis**, CTA Continuar al diagnóstico habilitado. Al continuar sin modelo, el informe dice **Base defendible para análisis posterior**, score 100/100 y ofrece exportar. No existe evidencia suficiente para respaldar esas conclusiones con cero datos.

Evidencia: `/Users/casabero/Documents/Codex/audits/aura-2026-09-06/screenshots/02-csv-vacio.png`. Ruta causal inspeccionada: `src/components/MainPipeline.tsx:630` invoca parsing y continúa sin guardia de filas/columnas, `src/services/csvService.ts:14` resuelve incluso con errores de parsing, `src/components/ProfileStep.tsx:68` deriva saludable de ausencia de hallazgos.

Propuesta pendiente de autorización: validar tabla utilizable antes del score; estado **No se pudo auditar: archivo vacío**, motivo y selección de otro archivo. No generar conclusión saludable ni informe positivo. En archivos válidos sin hallazgos, evitar convertir ausencia de reglas activadas en certificación universal de aptitud.

### Restauración y proveedor: comprobaciones nuevas

- Se cerró la sesión de herramientas entre días y se reabrió el mismo origen. Portada reaparece; al pulsar **Auditoría** se restaura el paso Diagnóstico de `vacio.csv`. La persistencia básica entre aperturas funciona en este caso; no demuestra recuperación de archivos de remediación ni de datasets grandes.
- No existe aviso visible de **Reanudar análisis guardado** en portada: muestra **Empezar auditoría** aunque ya hay trabajo. Mejorar expectativa con nombre/fecha y acción Reanudar.
- Chrome AI/Gemini Nano aparece No disponible. El botón de generación está deshabilitado y hay explicación y alternativas **Continuar con informe determinista**, **Cambiar proveedor**, **Verificar Chrome AI**. La alternativa determinista se ejecutó y abrió informe. Esta recuperación funciona; diagnóstico asistido sigue sin ejercitarse.

## Revisión bibliográfica dirigida inicial

Fecha de recuperación comunicada por coordinación: **2026-09-06**. Esta es una **revisión bibliográfica dirigida inicial**, no un estado del arte exhaustivo. Coordinación verificó resúmenes, registros de publicación y secciones relevantes de texto completo. Ningún estudio se reprodujo localmente. No se ha establecido contribución doctoral novedosa.

| Fuente primaria | Aporte relevante y límite de interpretación |
|---|---|
| Akella et al., [Quality Assessment of Tabular Data using Large Language Models and Code Generation](https://aclanthology.org/2025.emnlp-industry.183/), EMNLP Industry 2025 | Combina filtrado estadístico, reglas semánticas propuestas por LLM, validadores ejecutables y conocimiento externo. LLM + reglas + código ya es antecedente publicado. |
| Ni et al., [ZeroED](https://scholars.cityu.edu.hk/en/publications/zeroed-hybrid-zero-shot-error-detection-with-large-language-model/), ICDE 2025; [preprint](https://arxiv.org/abs/2504.05345) | Detección híbrida con muestreo representativo, razonamiento/etiquetado LLM y clasificador en siete datasets. Su F1 por celda no es comparable directamente con activación de reglas de Aura. |
| Fan et al., [AutoPrep](https://www.vldb.org/pvldb/vol18/p3504-fan.pdf), PVLDB 18, 2025 | Preparación condicionada por pregunta en lenguaje natural, con planificación, programación y ejecución. Preparación dependiente de tarea ya tiene antecedentes; responder preguntas no equivale a estimar efectos causales. |
| Bendinelli, Dox y Holz, [Exploring LLM Agents for Cleaning Tabular Machine Learning Datasets](https://arxiv.org/abs/2503.06664), workshop Foundation Models in the Wild, ICLR 2025 | Mantiene fijo entrenamiento/ingeniería de variables y permite limpieza LLM+Python. Reporta dificultades con patrones distributivos y sesgos entre filas. Es workshop, no artículo principal ICLR; corrupción sintética no equivale a error natural. |
| Jäger y Biessmann, [From Data Imputation to Data Cleaning](https://proceedings.mlr.press/v238/jager24a.html), AISTATS 2024 | Limpieza conformal con imputación y evaluación predictiva posterior. Antecedente directo; no implica garantías sin supuestos. |
| Bashari, Sesia y Romano, [Robust Conformal Outlier Detection under Contaminated Reference Data](https://proceedings.mlr.press/v267/bashari25a.html), ICML 2025 | Conservadurismo bajo condiciones concretas de contaminación no adversarial; etiquetado activo limitado recupera potencia. No garantiza robustez ante cambio de dominio arbitrario o etiquetas humanas erróneas. |
| Zhu et al., [Stress-Testing ML Pipelines with Adversarial Data Corruption](https://www.vldb.org/pvldb/vol18/p4668-zhu.pdf), PVLDB 18(11), 2025 | Corrupción sistemática realista descubre fallas omitidas por inyección aleatoria, incluida ruptura de intercambiabilidad. No demuestra que todo método conformal falle siempre. [El grupo anuncia presentación VLDB 2026](https://www.cs.uic.edu/~bglavic/dbgroup/2025/07/24/PVLDB-Savage.html). |
| [Complexity-Aware Progressive Data Error Correction with Distilled Language Models and Conformal Reliability Control](https://www.mdpi.com/2227-7390/14/10/1599), Mathematics 14(10), 1599, 8 mayo 2026 | Reglas, modelo destilado y etapa probabilística/lógica, conjuntos conformales por capa y rechazo para revisión humana. Reconoce posible ruptura de intercambiabilidad condicional por cambio temporal/de errores; propone calibración adaptativa, recuperación de valores raros y aprendizaje activo. Antecedente especialmente cercano: híbrido + conformal + humano no basta como novedad. Evaluación metodológica inicial, sin afirmaciones numéricas. |
| Wang et al., [TabClean: Scalable Tabular Data Cleaning via Reusable LLM-Synthesized Programs](https://tabular-data-analysis.github.io/tada2026/papers/TaDA26_2.pdf), workshop TaDA en VLDB 2026 | Programas validados reutilizables para tablas posteriores del mismo esquema, seis benchmarks y desarrollo anotado. Reutilización/código/etiquetas humanas ya son antecedentes; esquema igual no demuestra distribución igual. |
| Beck, Eckman, Kern y Kreuter, [Bias in the Loop: How Humans Evaluate AI-Generated Suggestions](https://hdsr.mitpress.mit.edu/pub/nrcn4h7d/release/2), Harvard Data Science Review, 30 abril 2026 | Experimento con 2.784 participantes verificando extracciones tabulares de reportes de emisiones. Exigir valor corregido al rechazar elevó aceptación de sugerencias erróneas. Efectos modestos, una tarea/población y generalización práctica incierta. Motiva experimentar sobre UI de revisión; no prueba un defecto equivalente en Aura. |

Mapa de búsqueda, no evidencia experimental primaria: Zhou et al., [Can LLMs Clean Up Your Mess?](https://arxiv.org/abs/2601.17058), preprint presentado el 22 enero 2026, útil para taxonomía y bibliografía.

### Tres direcciones doctorales candidatas

**Síntesis propia de coordinación, no brecha establecida.** Campo preliminar: Data Management/Data-Centric AI con ML confiable o HCI según contribución elegida. Aura puede ser plataforma experimental; su existencia no es la contribución doctoral.

**A. Reparación semántica selectiva bajo cambio de distribución y presupuesto humano limitado.** Opción metodológica prioritaria: bajo supuestos explícitos, ¿cómo elegir reparar, abstenerse o solicitar revisión controlando reparaciones aceptadas dañinas y preservando valores minoritarios/raros válidos mientras evoluciona la distribución? Acotar un tipo de cambio, familia de error y objetivo medible. Cambio arbitrario no hereda garantías conformales. La contribución requiere política/estimador/cota nuevos e identificables o resultado empírico generalizable y falsable, más allá de combinar herramientas. Comparar baselines próximos; medir curvas riesgo-cobertura, daño en celdas inicialmente correctas, F1 por celda/registro, calibración/cobertura por subgrupo, tiempo/coste de anotación y utilidad predictiva posterior. Separar ajuste/calibración/test por dataset, dominio o tiempo; considerar selección adaptativa y adjudicación imperfecta, y reservar test final intacto. Comparar más modelos en un CSV no basta.

**B. Efectividad de la revisión humana en decisiones de calidad de datos.** Mejor conexión con interés UX: ¿qué evidencia, incertidumbre y diseños de decisión con esfuerzo equivalente reducen aceptar reparaciones incorrectas sin excesivo tiempo? Estudio aleatorizado con novatos/expertos, sugerencias idénticas entre condiciones y errores equilibrados. Medir aceptación/rechazo correctos, comprensión, carga y tiempo. Prerregistrar; calcular potencia tras piloto, sin inventar tamaños muestrales. Layout Editorial más atractivo o mayor satisfacción no bastan como contribución doctoral. Usar resultado HDSR como baseline y extenderlo.

**C. Limpieza y estabilidad de conclusiones científicas posteriores.** ¿Cómo propagar incertidumbre entre reparaciones plausibles a estimaciones, rankings o decisiones? Elegir una tarea y explicitar supuestos de ausencia de datos, selección y causalidad. Comparar pipelines defendibles, sensibilidad e impactos por subgrupo. Mejor score de salud o F1 predictivo no demuestra menor sesgo causal. Exige más desarrollo estadístico y de dominio; novedad y acceso a datos apropiados pendientes.

### Siguiente fase de investigación

Seguir citas hacia atrás/adelante, en particular antecedentes cercanos de 2026. Contrastar supuestos, datasets, unidad de evaluación, papel humano, cambios distributivos y disponibilidad. Reproducir dos o tres baselines cercanos. Elegir con dirección académica una pregunta estrecha y falsable. No se han buscado ni afirmado admisiones, financiación, plazas o una lista de universidades; esta revisión aporta autores/foros internacionales iniciales.

## Cobertura y hallazgos operativos — actualización 7 septiembre

Esta sección sustituye la matriz inicial para el estado actual. **La auditoría integral sigue incompleta.** El navegador autorizado perdió la pestaña dos veces durante esta continuación, incluso después de marcarla para reanudación; se recuperó una vez y la segunda interrupción se deja documentada. No se ha usado otra tecnología para eludir la limitación.

| Recorrido | Estado actual | Evidencia y límite |
|---|---|---|
| Portada → carga | Observado | Acción clara; falta CTA de reanudación con nombre/fecha |
| CSV vacío → perfil → informe | Observado, defecto P1 | 0 filas/columnas se presentan como saludables y exportables |
| CSV válido con 6.001 filas | Observado | Perfil muestra 6.001 filas y 3 columnas; lectura completa confirmada |
| Progreso de carga | Observado | Texto Leyendo archivo CSV y barra indeterminada; no se probó operación lenta ni cancelación |
| Archivo de extensión inválida / CSV malformado | No ejercitado | Solo validación de extensión inspeccionada en código |
| Perfil / columnas expandibles | Observado | Detalle tipos, cardinalidad, nulos, IQR; lenguaje técnico sin definición inmediata |
| Error/proveedor no disponible | Observado | Chrome AI no disponible, generación deshabilitada y alternativa determinista funcional |
| Diagnóstico LLM exitoso / recuperación con otro proveedor | No ejercitado | No se configuraron credenciales ni modelos |
| Informe y recomendaciones deterministas | Observado | Hallazgo único, evidencia 1 registro/0,02%, revisión humana y límites |
| Propuesta de script de respaldo | Observado | Generó base determinista aunque no había diagnóstico LLM |
| Código y aprobación humana | Observado | Código corto visible, botón Aprobar script y estado Aprobado; no se probó código largo ni edición |
| Simulación antes/después | Observado | Score 96→96, 1→1 hallazgos; avisa correctamente que no hay mejora |
| Aplicar/verificar externamente | Bloqueado por ruta de producto | Tras aprobar respaldo determinista, exige contrato V2 ausente; no hubo ejecución Python real |
| Reauditoría sobre CSV y recibo reales | No ejercitado | Bloqueada por precondiciones anteriores |
| Exportación JSON/PDF/CSV/ZIP | Intentada, archivo final no verificado | Clics efectuados; JSON no emitió evento de descarga en 15 s; no se localizó archivo correspondiente en Downloads. No se observó error visible. No permite atribuir fallo a Aura o al navegador; no se certifica descarga/legibilidad |
| Restauración entre aperturas | Observado parcialmente | Recuperó diagnóstico y luego informe al entrar en Auditoría; remediación/archivos externos pendientes |
| Cierre y destrucción | Diálogo y cancelación observados | No se confirmó eliminación; controles de teclado deficientes |
| Ayuda | Observado | Guía de flujo, privacidad, modelos, exportación y glosario; no se probó búsqueda |
| Ajustes / laboratorio / historial | Pendiente | Pestaña se interrumpió antes de recorrerlos |
| Móvil 390 px | Observado parcialmente | Sin overflow general: viewport=390, body=390, document=390. Barra de etapas con scroll horizontal; detalle de columnas estrecho |
| Móvil 320 px / zoom / lector de pantalla / contraste calculado | No ejercitado | No emitir conformidad WCAG global |

### UX-02 — P1: respaldo determinista aprobado termina en una precondición imposible para esa ruta

Reproducción: CSV `aura_ux_6001.csv` → Continuar al diagnóstico → Continuar con informe determinista → Corregir una copia → Generar propuesta → Revisar propuesta → Aprobar script → **Preparar exportación**. Aprobación y simulación funcionan, pero la acción lleva a **Aplicar y verificar**, que enumera: **No hay contrato de script V2**, **El hash del script V2 no es 64-hex**, **La verificación V2 del script falló**. El usuario aprobó una propuesta que la propia ruta no permite ejecutar. Además, la etiqueta Preparar exportación no anticipa ejecución externa.

Código: `src/components/MainPipeline.tsx:918` selecciona ruta de script sin contexto V2; `src/components/MainPipeline.tsx:995` enlaza revisión con execution; `src/components/ApplyVerifyStep.tsx:139` exige V2; `src/components/ReviewStep.tsx:416` etiqueta el CTA. Captura: `screenshots/08-bloqueo-v2.png` en carpeta externa.

Propuesta: definir contrato soportado para respaldo o declarar la limitación antes de generar/aprobar; no fingir que aprobación crea evidencias V2. Ofrecer exportar informe/script con su estado real y explicar requisitos de ejecución en lenguaje de tarea. Renombrar CTA según destino. Mantener las validaciones de integridad existentes.

### UX-03 — P1 de accesibilidad: diálogo destructivo sin gestión de foco

Reproducción: Exportación → Cerrar sesión y destruir datos locales → Tab. El foco pasa a **Ayuda** detrás del overlay. Escape no cierra. El botón X carece de nombre en el árbol accesible. Se canceló usando el botón visible; no se destruyeron datos.

Código: `src/App.tsx:1240` usa contenedores sin semántica dialog/aria-modal y sin foco inicial, contención ni cierre Escape; botón X `src/App.tsx:1245`. Captura `screenshots/09-modal-foco-fuera.png`. Propuesta: patrón modal accesible, foco inicial en Cancelar, contenido de fondo inerte, Escape y retorno al disparador, nombre Cerrar en X. Probar teclado de extremo a extremo antes de cerrar el hallazgo.

### UX-04 — P2: certeza excesiva y redondeo en hallazgos

El perfil del CSV completo muestra **Placeholders Tóxicos / 0% de registros afectados**; el informe precisa 1 registro y 0,02%. `src/components/ProfileStep.tsx:200` usa `toFixed(0)`. Recomendar número absoluto y porcentaje suficiente (**1 de 6.001; <0,1%**).

El fixture contiene registros consecutivos 1…6001, incluyendo 999 válido por construcción. El motor trata 999 como placeholder, cuenta un nulo en registro y el informe lo etiqueta **Riesgo confirmado**. `src/services/auditEngine.ts:40` incluye 999 en el vocabulario y `:298` lo excluye de no-nulos. Es un falso positivo demostrado para este fixture, no una estimación de tasa global. Diferenciar nulos reales de posibles sentinelas, mostrar el valor concreto y pedir confirmación contextual antes de declarar error. No corregir automáticamente un identificador válido.

### UX-05 — P2: indicadores de revisión de código que no reflejan ejecución real

En el script corto se resaltó como **destructiva** la línea de comentario `# Ejecutar sobre una copia del DataFrame original: df_clean = df.copy()`. El clasificador `src/components/ScriptReview.tsx:22` aplica una expresión regular que incluye `del ` y coincide con la palabra española del comentario. El usuario ve una operación destructiva que no lo es. Separar comentarios del código antes de clasificar; preferir estructura sintáctica y distinguir análisis estático de ejecución.

El panel también muestra **Seguro / Cobertura 100%**, pero el respaldo no incluye 999 entre valores a reemplazar y la simulación no resuelve el único hallazgo (96→96). La advertencia de no mejora es correcta. Explicar qué mide cobertura; no presentarla como resolución garantizada. Capturas `06-script-determinista.png` y `07-revision-simulacion.png`.

### UX-06 — P2: reanudación y carga de detalle técnico

Al reabrir, la portada muestra Empezar auditoría aun cuando hay una sesión recuperable. Propuesta: **Reanudar aura_ux_6001.csv**, etapa y fecha, junto a una acción distinta para iniciar otra. En perfil, explicar términos como IQR/cardinalidad mediante ayuda breve y mantener estadística avanzada plegada. A 390 px, el encabezado Tipos y cobertura por columna se comprime excesivamente por márgenes y cajas anidadas. Reflujo móvil necesita revisión específica a 320 px antes de afirmar cumplimiento.

### Inconsistencia documental confirmada

El archivo `docs/tfm/memoria_final/README.md` enlazado desde README no existe en este checkout, confirmado el 7 de septiembre. No se corrigió al estar fuera de la autorización de cambios de este checkpoint.

## Propuesta acotada de piloto Editorial — pendiente de aprobación

**Propósito:** ayudar a decidir si el dataset es utilizable, qué revisar y qué resultado descargar, preservando incertidumbre y control. No cambiar contratos, reglas de detección ni comportamiento solo por aplicar un tema.

1. Primero resolver UX-01/02/03 como trabajo funcional separado y autorizado. Un cambio tipográfico no corrige entradas vacías, continuidad de contratos ni foco modal.
2. Piloto visual en **Perfil → Informe → Exportación**, tres pantallas de alto valor. Blanco #FFFFFF, tinta #191919, serif Source Serif 4/Georgia para títulos y lectura; sans Source Sans 3/Arial para tablas, metadatos y controles; mono únicamente código/hashes. No copiar el showcase Warm completo.
3. Jerarquía: resumen breve del archivo y alcance, conclusión condicionada, hallazgos priorizados, una acción siguiente; evidencia técnica progresivamente desplegable. Mantener evidencia y procedencia accesibles. Cambiar Riesgo confirmado por señal pendiente de contexto cuando corresponda.
4. Estados explícitos: sin datos válidos, procesando, proveedor ausente, informe determinista, propuesta sin ejecutar, aprobación, simulación y ejecución externa verificada. Separar siempre estas evidencias.
5. Criterios para aceptar piloto: una persona puede explicar qué se evaluó y qué falta, localizar el valor problemático, cancelar y retomar, terminar sin modelo y descargar un archivo legible; foco y teclado correctos, viewport 320/390/1280 sin pérdida de información, contraste medido. Medir errores de interpretación y tiempo además de preferencia estética. Sin estudio con participantes todavía.

## Reanudación actualizada

- Recuperar/crear pestaña de auditoría solo en el origen 3017. El runtime actual se lanzó el 7 de septiembre; verificar que siga activo. La última pantalla fue Ayuda y la sesión contiene fixture de 6.001 filas, propuesta aprobada y simulación sin mejora.
- Restablecer cualquier override temporal de viewport: se usaron 390×844 y luego 1280×900, pero la pérdida de pestaña impidió reset final; comprobar antes de continuar.
- Completar ajustes, proveedor alternativo disponible sin credenciales nuevas, laboratorio, historial, CSV inválido/malformado, 320 px, contraste y teclado completo.
- Resolver la verificación de descargas con capacidad autorizada de navegador; observar destino real y abrir PDF/JSON/CSV/ZIP. No inferir éxito de clic ni culpar al producto del timeout de la herramienta.
- Reauditoría real queda pendiente de una ruta V2 válida. No usar manipulación de estado ni fixture interna como sustituto de recorrido humano.
- Mantener separados los resultados documentales de investigación y el auditado runtime. No reparar código sin nueva autorización.
