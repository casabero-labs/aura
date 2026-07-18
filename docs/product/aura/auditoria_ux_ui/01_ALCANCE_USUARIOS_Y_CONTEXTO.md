# 01 — Alcance, personas usuarias y contexto

## Alcance observado

La auditoría cubrió las superficies de producto disponibles para una persona
usuaria final sin modificar código ni datos de producción:

- Home y navegación global.
- Auditoría: carga, perfil, diagnóstico, informe y exportación.
- Recuperación frente a archivo inválido y proveedor no disponible.
- Configuración de proveedor y evidencia enviada al modelo.
- Laboratorio de evaluación LLM.
- Ayuda, historial y cierre destructivo de sesión.
- Estados responsivos en `1440 × 900` y `390 × 844`.

Quedaron fuera del alcance la exactitud científica del motor, la calidad del
PDF descargado, la ejecución real de remediaciones, la comparación exhaustiva
de los 27 diagnósticos del Laboratorio y una declaración formal de conformidad
WCAG.

## Roles operativos inferidos del producto

| Rol | Contexto | Objetivo principal | Riesgo UX dominante |
|---|---|---|---|
| Analista o auditor de datos | Evalúa un CSV y necesita entender su calidad | Llegar de un archivo a un informe interpretable | Bloqueo o ambigüedad entre diagnóstico determinista y asistido |
| Responsable de decisión | Revisa riesgos y decide si intervenir el dataset | Distinguir evidencia, riesgo confirmado y decisión humana | Doble conteo aparente o pérdida de trazabilidad |
| Operador sensible a privacidad | Configura dónde se procesa la evidencia | Saber qué sale del dispositivo y qué proveedor está activo | Recuperación fragmentada entre diagnóstico y configuración |
| Investigador o evaluador LLM | Usa el Laboratorio con protocolo reproducible | Crear y comparar una campaña controlada | Diferencia de estado entre modelos disponibles y proveedor del flujo de Auditoría |
| Persona usuaria móvil o con tecnología de asistencia | Navega, consulta o cierra una sesión | Acceder a las mismas funciones con contexto y control | Controles sin nombre, foco fuera del modal y contenido oculto expuesto |

## Objetivos y tareas críticas

1. Comprender qué hace AURA antes de entregar un archivo.
2. Cargar un CSV válido y recuperarse de un archivo incorrecto.
3. Interpretar el perfil determinista.
4. Obtener un diagnóstico o comprender con precisión por qué no está disponible.
5. Llegar al informe sin perder la relación entre hallazgos y decisiones.
6. Exportar evidencia y comprender el estado contractual de cada formato.
7. Cerrar o reiniciar una sesión con control explícito.
8. Configurar un proveedor sin perder el contexto del flujo.
9. Consultar ayuda e historial cuando aparece un bloqueo.

## Estados incluidos

- Inicial y retorno a Home.
- Archivo inválido y recuperación con archivo válido.
- Procesamiento y progreso.
- Perfil listo.
- Proveedor Cloud no disponible.
- Informe determinista disponible sin diagnóstico asistido.
- Exportación y confirmación destructiva.
- Menú móvil cerrado y abierto.
- Modal de historial.
- Laboratorio con modelos Ollama detectados.

## Contexto técnico de la observación

- Revisión humana sobre servidor local Vite.
- Dataset controlado: `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv`.
- Navegador integrado, sin errores ni advertencias de aplicación en consola.
- Persistencia local activa entre recargas.
- Contraste focal con `src/App.tsx`, `src/components/MainPipeline.tsx`,
  `src/components/DiagnosisStep.tsx` y `src/index.css`.
