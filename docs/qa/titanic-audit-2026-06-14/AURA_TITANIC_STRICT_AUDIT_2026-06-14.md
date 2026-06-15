# AURA Titanic Strict Audit - 2026-06-14

- Fecha: 2026-06-14T23:46:21.967Z
- Repo: /Users/casabero/Documents/GitHub/aura
- Dataset: /Users/casabero/Documents/GitHub/aura/src/experiments/datasets/titanic.csv
- Resultado: APROBADO CON ADVERTENCIAS
- PASS: 55
- WARN: 4
- FAIL: 0
- ACTION/Clicks: 16

## Bitacora detallada

1. **INFO** [Contexto] Auditoria estricta AURA con dataset Titanic. Fecha: 2026-06-14T23:46:21.967Z
2. **PASS** [Contexto] Dataset: /Users/casabero/Documents/GitHub/aura/src/experiments/datasets/titanic.csv
3. **INFO** [Contexto] Repo: /Users/casabero/Documents/GitHub/aura
4. **ACTION** [Paso 1] Abrir AURA en http://127.0.0.1:3000/
5. **PASS** [Captura] Home / Auditoria inicial: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/01-home.png
6. **PASS** [Overflow] Home desktop: viewport=1280, scrollWidth=1280, overflow=false
7. **PASS** [Verificacion visual] Nav Auditoria: visible
8. **PASS** [Verificacion visual] Nav Laboratorio: visible
9. **PASS** [Verificacion visual] Nav Configuracion: visible
10. **ACTION** [Paso 2] Subir CSV Titanic por input[type=file]
11. **PASS** [Captura] Perfil compacto con Titanic: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/02-profile-titanic.png
12. **PASS** [Overflow] Perfil Titanic: viewport=1280, scrollWidth=1280, overflow=false
13. **PASS** [Verificacion visual] Resumen compacto de perfil: visible
14. **PASS** [Texto observado] Etiqueta de salud: Requiere atención
15. **PASS** [Texto observado] Conteos principales: 20filas12columnas1críticos2advertencias
16. **PASS** [Texto observado] Top hallazgos: Valores Nulos / VacíosCabin75%Valores Nulos / VacíosAge15%Outliers Extremos (IQR 3×)Parch5%
17. **PASS** [Texto observado] Columnas afectadas: Cabin1 critAge1 advSibSpParch1 advFare
18. **PASS** [Detalles tecnicos] Cantidad de details.technical-details en perfil: 1
19. **PASS** [Detalles tecnicos] Detalles tecnicos colapsados por defecto: true
20. **ACTION** [Click] Abrir detalles tecnicos del perfil
21. **PASS** [Captura] Perfil con detalles tecnicos abiertos: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/03-profile-details-open.png
22. **ACTION** [Click] Cerrar detalles tecnicos del perfil
23. **ACTION** [Click] Ir de Perfil a Diagnostico
24. **PASS** [Captura] Diagnostico antes de ejecutar modelo: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/04-diagnosis-start.png
25. **PASS** [Overflow] Diagnostico: viewport=1280, scrollWidth=1280, overflow=false
26. **PASS** [Verificacion visual] Seccion compacta de diagnostico: visible
27. **PASS** [Texto observado] Contenido compacto de diagnostico: diagnóstico asistidoInterpretar los problemas de calidad.principal señal de calidadValores Nulos / Vacíos en Cabin afecta 75.00% de registros.riesgo agregado1 críticos, 2 advertencias, 5 columnas afectadasdataset12 columnas, 20 filas, score 62/100Local-firstDiagnóstico en el navegador. Sin envío de datos.LocalCloudQwen 2.5 7B (4-bit)Qwen 2.5 3B (4-
28. **WARN** [Diagnostico LLM] Boton Generar diagnostico deshabilitado. Motivo observado: Proveedor no disponible. No se ejecuto diagnostico cognitivo real.
29. **PASS** [Captura] Diagnostico tras verificar disponibilidad del modelo: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/05-diagnosis-after-attempt.png
30. **WARN** [Lab en Diagnostico] Acceso a Lab desde detalles/diagnostico visible: false
31. **ACTION** [Click] Pasar de Diagnostico a Script
32. **PASS** [Captura] Script antes de generar: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/06-script-start.png
33. **PASS** [Overflow] Script inicial: viewport=1280, scrollWidth=1280, overflow=false
34. **PASS** [Verificacion visual] Resumen base de script: visible
35. **ACTION** [Click] Generar script o fallback determinista
36. **PASS** [Verificacion visual] Bloque de script generado: visible
37. **PASS** [Verificacion visual] Safety score visible: visible
38. **PASS** [Verificacion visual] Coverage visible: visible
39. **PASS** [Texto observado] Resumen validacion script: Safety Score88/100Cobertura de hallazgos60%Sin cobertura: 2 hallazgo(s) sin traza en el script Requiere revisión humanaMatriz de validación completaSafety Score88/100Columnas existentesSin columnas fantasmaCobertura de hallazgos3 / 5 (60%)Operaciones destructivasNo detectadasUso de PandasDetectadoOrigenRespaldo deterministaRevisión humanaRequeridaS
40. **PASS** [Captura] Script generado con validacion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/07-script-generated.png
41. **ACTION** [Click] Ir a Revisar script
42. **PASS** [Captura] Revision antes de aprobar: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/08-review-start.png
43. **PASS** [Overflow] Revision: viewport=1280, scrollWidth=1280, overflow=false
44. **PASS** [Verificacion visual] Status strip de revision: visible
45. **PASS** [Texto observado] Resumen de revision: Estado del scriptPendiente de revisiónSafety Score88/100 — SeguroCobertura60%
46. **ACTION** [Paso Review] Scroll al final del bloque de script para activar revision completa
47. **PASS** [Verificacion visual] Indicador codigo revisado completo: visible
48. **ACTION** [Click] Aprobar script y ejecutar simulacion
49. **PASS** [Verificacion visual] Delta de simulacion visible: visible
50. **PASS** [Texto observado] Delta de simulacion: Resultado de la simulaciónsimulación sobre copia — el archivo original no fue modificadoScore62 → 62+0 puntosIssues5 → 50 resueltosCríticos1 → 10 reglas corregidas
51. **PASS** [Captura] Revision con delta tras simulacion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/09-review-delta.png
52. **ACTION** [Click] Preparar exportacion
53. **PASS** [Captura] Exportacion final: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/10-export.png
54. **PASS** [Overflow] Exportacion: viewport=1280, scrollWidth=1280, overflow=false
55. **PASS** [Verificacion visual] Panel de cierre export: visible
56. **PASS** [Texto observado] Estado del paquete: PaqueteParcialObjetivos3/5Artefactos6ScriptAprobado
57. **PASS** [Texto observado] Claims permitidos: Evidencia generadaMotor deterministaFormalScript seguroPreliminarHITLFormalDelta de saludFormalBenchmark LLMPendiente
58. **PASS** [Texto observado] Limitaciones visibles: LimitacionesSimulación de remediación sobre copia en memoria; no modifica el archivo original.Benchmark LLM puede ser preliminar si no hay API keys o WebGPU activos.Ground truth disponible solo para datasets sintético y Titanic.Métricas deterministas por regla usan detección binaria (rule fired / not fired), no conteo de filas.
59. **ACTION** [Descarga] Click Descargar JSON tecnico
60. **PASS** [Descarga] JSON tecnico descargado: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/aura_audit_1781480789856.json
61. **ACTION** [Descarga] Click Reporte PDF ejecutivo
62. **PASS** [Descarga] PDF ejecutivo descargado: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/Aura_Data_Lab_Diagnostico.pdf
63. **ACTION** [Click] Abrir Laboratorio desde nav
64. **PASS** [Captura] Laboratorio de calibracion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/11-lab.png
65. **PASS** [Overflow] Laboratorio: viewport=1280, scrollWidth=1280, overflow=false
66. **PASS** [Verificacion visual] Controles del laboratorio: visible
67. **PASS** [Texto observado] Configuracion visible del laboratorio: ProveedorLocal WebLLMCloud configuradoModeloQwen 2.5 7B (4-bit)Qwen 2.5 3B (4-bit)Qwen 2.5 1.5B (4-bit)Qwen 2.5 0.5B (4-bit)Llama 3.1 8B (4-bit)Llama 3.2 3B (4-bit)Llama 3.2 1B (4-bit)Mistral 7B v0.3 (4-bit)Phi-3.5 Mini (4-bit)Phi-3 Mini 4K (4-bit)Gemma 2 2B (4-bit)Gemma 2 9B (4-bit)SmolLM2 1.7B (4-bit)SmolLM2 360M (4-bit)SmolLM2 135M (4-bit)DeepSe
68. **PASS** [Laboratorio] Modos de entrada visibles: Contrato AURA, Registro técnico, Bad samples, Recomendado, Prompt libre
69. **ACTION** [Click] Intentar ejecutar corrida en Lab con configuracion actual
70. **WARN** [Laboratorio] Estado tras intentar corrida: sin ejecucion formal o error accionable observado
71. **PASS** [Captura] Laboratorio tras intento de corrida: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/12-lab-after-run-attempt.png
72. **PASS** [Captura] Mobile 390 - Perfil Titanic: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/13-mobile-profile-titanic.png
73. **WARN** [Overflow] Mobile perfil Titanic: viewport=390, scrollWidth=427, overflow=true
74. **ACTION** [Click] Abrir menu movil
75. **PASS** [Captura] Mobile 390 - Menu nav: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/14-mobile-nav.png
76. **PASS** [Verificacion visual] Laboratorio en mobile: visible
77. **PASS** [Consola] Errores JS capturados: 0

## Descargas generadas

- /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/aura_audit_1781480789856.json
- /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/Aura_Data_Lab_Diagnostico.pdf

## Capturas

- Home / Auditoria inicial: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/01-home.png
- Perfil compacto con Titanic: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/02-profile-titanic.png
- Perfil con detalles tecnicos abiertos: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/03-profile-details-open.png
- Diagnostico antes de ejecutar modelo: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/04-diagnosis-start.png
- Diagnostico tras verificar disponibilidad del modelo: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/05-diagnosis-after-attempt.png
- Script antes de generar: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/06-script-start.png
- Script generado con validacion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/07-script-generated.png
- Revision antes de aprobar: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/08-review-start.png
- Revision con delta tras simulacion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/09-review-delta.png
- Exportacion final: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/10-export.png
- Laboratorio de calibracion: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/11-lab.png
- Laboratorio tras intento de corrida: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/12-lab-after-run-attempt.png
- Mobile 390 - Perfil Titanic: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/13-mobile-profile-titanic.png
- Mobile 390 - Menu nav: /Users/casabero/Documents/GitHub/aura/docs/qa/titanic-audit-2026-06-14/14-mobile-nav.png
