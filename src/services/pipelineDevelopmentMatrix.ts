import type { PipelineState } from '../components/MainPipeline';

export interface PipelineDevelopmentLoopPlan {
  id: string;
  title: string;
  visibleResult: string;
  e2eGate: string;
}

export interface PipelineDevelopmentMatrixRow {
  state: PipelineState;
  stageLabel: string;
  currentState: string[];
  reviewRequirement: string[];
  strengths: string[];
  weaknesses: string[];
  developmentObjectives: string[];
  loop: PipelineDevelopmentLoopPlan;
}

export const PIPELINE_DEVELOPMENT_MATRIX: PipelineDevelopmentMatrixRow[] = [
  {
    state: 'upload',
    stageLabel: 'Subir CSV',
    currentState: [
      'Carga local de archivos .csv con drag and drop y selector nativo.',
      'Parseo en navegador, deteccion de delimitador, campos y trazas de inicio/fin.',
      'Mensaje local-first: no se envia el archivo crudo y el siguiente paso genera perfil determinista.',
    ],
    reviewRequirement: [
      'Formalizar metadatos del caso experimental: dataset, version, fuente, objetivo y ground truth asociado.',
      'Registrar evidencia de parseo en un contrato exportable: filas, columnas, delimitador, truncamiento y fingerprint.',
      'Cubrir estados de error: archivo no CSV, CSV vacio, columnas ausentes y carga cancelada.',
    ],
    strengths: [
      'Privacidad bien alineada con la arquitectura local-first.',
      'Entrada sencilla y comprensible para una demostracion academica.',
      'Ya produce el punto de partida reproducible para la auditoria.',
    ],
    weaknesses: [
      'El protocolo experimental no se captura todavia desde la UI.',
      'El ground truth no queda vinculado al dataset cargado.',
      'Los errores de carga no generan evidencia reutilizable para la entrega.',
    ],
    developmentObjectives: [
      'Agregar ficha de dataset experimental antes o despues de la carga.',
      'Persistir un contrato de ingestion dentro del anexo JSON.',
      'Crear fixtures E2E para carga valida e invalida.',
    ],
    loop: {
      id: 'L02-A',
      title: 'Contrato de ingestion y evidencia inicial',
      visibleResult: 'CSV aceptado con ficha experimental, fingerprint y evidencia de parseo.',
      e2eGate: 'abrir -> subir fixture -> ver feedback -> perfilar',
    },
  },
  {
    state: 'profile',
    stageLabel: 'Perfilar',
    currentState: [
      'Motor determinista ejecuta reglas reproducibles sobre datos parseados.',
      'Se muestran estadisticas de dataset, columnas, score, matriz de reglas, hallazgos y paquete de evidencia.',
      'Se calcula fingerprint, duraciones de parseo/auditoria y trazas de ejecucion.',
    ],
    reviewRequirement: [
      'Detallar ground truth, criterios de etiquetado y umbrales por regla.',
      'Reportar precision, recall y F1-score por dataset y por familia de regla.',
      'Justificar falsos positivos, falsos negativos y limites del motor determinista.',
    ],
    strengths: [
      'Es la base mas fuerte de AURA: auditable, trazable y no dependiente del LLM.',
      'Ya produce evidencia tecnica visible y exportable.',
      'Permite separar hechos observados de interpretaciones asistidas.',
    ],
    weaknesses: [
      'Las metricas academicas no estan integradas en la pantalla de perfil.',
      'Los umbrales existen en logica, pero no siempre se explican como decision metodologica.',
      'La relacion objetivo especifico -> evidencia aun debe quedar explicita.',
    ],
    developmentObjectives: [
      'Exportar tabla por regla con esperado, detectado, TP, FP, FN, precision, recall y F1.',
      'Mostrar ficha metodologica de umbrales y version del motor.',
      'Conectar hallazgos con objetivos especificos OE1/OE2.',
    ],
    loop: {
      id: 'L02-B',
      title: 'Validacion determinista formal',
      visibleResult: 'Perfil con tabla de metricas por regla y evidencia lista para TFM/articulo.',
      e2eGate: 'subir fixture -> ver perfil -> exportar metricas deterministas',
    },
  },
  {
    state: 'diagnosis',
    stageLabel: 'Diagnóstico',
    currentState: [
      'El LLM recibe hallazgos estructurados y smart sample, no el CSV crudo completo.',
      'Hay proveedor local/cloud, hash de prompt, resumen de entrada y exportacion JSON/PDF del diagnostico.',
      'La base formal de campañas, corridas e intentos ya existe fuera del flujo principal.',
    ],
    reviewRequirement: [
      'Consolidar benchmark multimodelo con corridas formales y comparables.',
      'Medir utilidad del diagnostico: cumplimiento de formato, alucinaciones, columnas inventadas y claims no soportados.',
      'Comparar smart sample frente a prompt libre o configuraciones alternativas.',
    ],
    strengths: [
      'La capa cognitiva esta restringida por evidencia determinista.',
      'El enfoque local/cloud permite discutir privacidad, gobernanza y costo.',
      'Ya existen servicios de benchmark, evaluacion y deteccion de alucinaciones.',
    ],
    weaknesses: [
      'Los resultados comparativos aun no estan cerrados como evidencia formal.',
      'La utilidad del diagnostico debe medirse contra criterios objetivos.',
      'Falta cerrar una tabla publicable de modelos, modos de entrada y estados de evidencia.',
    ],
    developmentObjectives: [
      'Definir protocolo de benchmark: modelos, repeticiones, temperatura, datasets y modo de entrada.',
      'Mostrar en UI el estado de evidencia de cada corrida: planeada, fallida, preliminar o formal.',
      'Exportar tabla comparativa lista para resultados y articulo.',
    ],
    loop: {
      id: 'L03-A',
      title: 'Benchmark LLM y diagnostico verificable',
      visibleResult: 'Tabla multimodelo con latencia, formato, alucinaciones, script y evidencia formal.',
      e2eGate: 'abrir consola formal nueva -> ejecutar campaña -> ver estado -> exportar expediente',
    },
  },
  {
    state: 'script',
    stageLabel: 'Script',
    currentState: [
      'Genera script Python/Pandas desde diagnostico previo y paquete estructurado.',
      'Si el modelo falla, AURA genera un respaldo determinista para no bloquear el flujo.',
      'Valida columnas existentes, cobertura de hallazgos, operaciones destructivas, uso de Pandas y revision humana.',
    ],
    reviewRequirement: [
      'Demostrar que el script no introduce columnas fantasma ni acciones destructivas sin control humano.',
      'Medir cobertura del script frente a hallazgos detectados por el motor.',
      'Separar claramente generacion asistida, validacion automatica y aprobacion humana.',
    ],
    strengths: [
      'Tiene fallback determinista y no depende ciegamente del proveedor LLM.',
      'La matriz de validacion ya convierte riesgos en señales visibles.',
      'El contrato de prompt mantiene el script anclado al diagnostico previo.',
    ],
    weaknesses: [
      'La cobertura de hallazgos aun no se presenta como metrica formal del experimento.',
      'El bloqueo de operaciones destructivas debe endurecerse como politica verificable.',
      'Falta una bateria E2E para script valido, script invalido y fallback determinista.',
    ],
    developmentObjectives: [
      'Convertir validacion de script en tabla de resultados: cobertura, columnas invalidas, riesgo y origen.',
      'Bloquear avance cuando existan riesgos criticos sin decision humana explicita.',
      'Crear pruebas para fallback, columnas fantasma y operaciones destructivas.',
    ],
    loop: {
      id: 'L04-A',
      title: 'Script seguro y medible',
      visibleResult: 'Script generado/respaldado con score de validacion, evidencia de riesgo y politica HITL visible.',
      e2eGate: 'diagnosticar -> generar script -> validar -> bloquear o continuar',
    },
  },
  {
    state: 'review',
    stageLabel: 'Revisar',
    currentState: [
      'El usuario puede revisar, editar y aprobar explicitamente el script.',
      'La aprobacion ejecuta una simulacion sobre copia, no modifica el archivo original.',
      'Se genera ImprovementRun con delta de salud y evidencia de impacto antes/despues.',
    ],
    reviewRequirement: [
      'Documentar criterios de revision humana y trazabilidad de la decision.',
      'Presentar delta de salud como evidencia de impacto, no como garantia absoluta.',
      'Conectar revision HITL con gobernanza, privacidad y mitigacion de riesgos de IA.',
    ],
    strengths: [
      'La decision humana ya es parte real del flujo.',
      'La simulacion evita modificaciones irreversibles sobre el dato original.',
      'El delta antes/despues permite discutir impacto aplicado.',
    ],
    weaknesses: [
      'La razon de aprobacion o rechazo no queda capturada como dato estructurado.',
      'No existe aun checklist formal de revision para defensa academica.',
      'El ImprovementRun debe quedar integrado en el paquete final de resultados.',
    ],
    developmentObjectives: [
      'Agregar checklist de revision: seguridad, cobertura, interpretabilidad y acciones destructivas.',
      'Registrar decision humana, observaciones y responsable dentro del anexo JSON.',
      'Exportar tabla de delta de salud para memoria y articulo.',
    ],
    loop: {
      id: 'L04-B',
      title: 'HITL trazable y delta de salud',
      visibleResult: 'Decision humana registrada con simulacion, delta y evidencia de gobernanza.',
      e2eGate: 'revisar -> aprobar -> simular -> ver delta -> preparar exportacion',
    },
  },
  {
    state: 'export',
    stageLabel: 'Exportar',
    currentState: [
      'Exporta PDF, anexo JSON, CSV de hallazgos y script final aprobado.',
      'El JSON incluye perfil, diagnostico, script, validacion, benchmark e ImprovementRun cuando existen.',
      'La seccion final resume criticos, advertencias y estado del script HITL.',
    ],
    reviewRequirement: [
      'Consolidar un paquete unico de resultados para TFM y articulo.',
      'Garantizar que cada objetivo especifico tenga evidencia descargable o reproducible.',
      'Generar tablas y anexos con versionado, protocolo, metricas y limites.',
    ],
    strengths: [
      'Ya hay artefactos multiples para trazabilidad tecnica.',
      'La exportacion respeta la separacion entre perfil, diagnostico, script y experimento.',
      'Permite cerrar la demostracion con evidencia verificable.',
    ],
    weaknesses: [
      'Los artefactos estan fragmentados y no hay gate de completitud academica.',
      'El PDF no siempre incorpora benchmark formal o tablas articulo-ready.',
      'Falta manifest de reproducibilidad con versiones, datasets y comandos.',
    ],
    developmentObjectives: [
      'Crear paquete TFM/articulo con manifest, tablas APA-ready, JSON, CSV y script.',
      'Agregar checklist de completitud por objetivo especifico.',
      'Bloquear claims fuertes cuando falte evidencia formal.',
    ],
    loop: {
      id: 'L05-A',
      title: 'Paquete final de resultados',
      visibleResult: 'Bundle exportable con manifest, tablas, anexos, evidencia y claims permitidos.',
      e2eGate: 'exportar -> descargar artefactos -> verificar objetivos cubiertos',
    },
  },
];

export const PIPELINE_STAGE_ORDER: PipelineState[] = PIPELINE_DEVELOPMENT_MATRIX.map((row) => row.state);

export const findPipelineDevelopmentRow = (
  state: PipelineState,
): PipelineDevelopmentMatrixRow | undefined => PIPELINE_DEVELOPMENT_MATRIX.find((row) => row.state === state);
