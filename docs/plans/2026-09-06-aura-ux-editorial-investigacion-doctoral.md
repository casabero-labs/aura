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
