export type LoopStatus = 'done' | 'active' | 'blocked' | 'planned';

export interface DevelopmentLoopSignals {
  hasReport: boolean;
  hasBenchmarkResults: boolean;
  hasApprovedScript: boolean;
  hasImprovementRun: boolean;
  isExportStep: boolean;
}

export interface DevelopmentLoop {
  id: string;
  phase: string;
  title: string;
  objective: string;
  visibleResult: string;
  e2eGate: string;
  status: LoopStatus;
}

export interface DevelopmentLoopProgram {
  has: string[];
  wants: string[];
  mustDo: string[];
  loops: DevelopmentLoop[];
  nextLoop: DevelopmentLoop;
}

export const createLoopSignals = (input: Partial<DevelopmentLoopSignals> = {}): DevelopmentLoopSignals => ({
  hasReport: input.hasReport ?? false,
  hasBenchmarkResults: input.hasBenchmarkResults ?? false,
  hasApprovedScript: input.hasApprovedScript ?? false,
  hasImprovementRun: input.hasImprovementRun ?? false,
  isExportStep: input.isExportStep ?? false,
});

const statusFor = (
  isDone: boolean,
  isActive: boolean,
  blocked = false,
): LoopStatus => {
  if (isDone) return 'done';
  if (blocked) return 'blocked';
  if (isActive) return 'active';
  return 'planned';
};

export const buildDevelopmentLoopProgram = (
  signalsInput: Partial<DevelopmentLoopSignals> = {},
): DevelopmentLoopProgram => {
  const signals = createLoopSignals(signalsInput);
  const deterministicDone = signals.hasReport;
  const benchmarkDone = signals.hasBenchmarkResults;
  const hitlDone = signals.hasApprovedScript && signals.hasImprovementRun;
  const exportDone = signals.isExportStep && signals.hasReport;

  const loops: DevelopmentLoop[] = [
    {
      id: 'loop-01',
      phase: 'DISCOVER -> PLAN',
      title: 'Contrato academico y alcance AURA',
      objective: 'Fijar que AURA es una arquitectura hibrida evaluable: evidencia determinista, LLM restringido, HITL y benchmark.',
      visibleResult: 'Tercera entrega con matriz OE-evidencia, directrices y plan ejecutable.',
      e2eGate: 'Abrir AURA y entender que el trabajo se cierra por evidencia, no por promesas.',
      status: 'done',
    },
    {
      id: 'loop-02',
      phase: 'EXECUTE -> VERIFY',
      title: 'Motor determinista formal',
      objective: 'Producir precision, recall y F1 por regla/dataset con ground truth documentado.',
      visibleResult: 'Perfil determinista, reglas activadas, score y paquete de evidencia exportable.',
      e2eGate: 'Cargar CSV fixture -> ver perfil -> confirmar score, reglas y feedback humano.',
      status: statusFor(deterministicDone, !deterministicDone),
    },
    {
      id: 'loop-03',
      phase: 'EXECUTE -> VERIFY',
      title: 'Benchmark LLM formal',
      objective: 'Comparar smart sample vs prompt libre y modelos local/cloud con metricas objetivas.',
      visibleResult: 'Consola formal nueva con latencia, alucinaciones, formato, script y estado de evidencia.',
      e2eGate: 'Abrir consola formal -> lanzar corrida -> ver estado completed/error accionable -> exportar expediente.',
      status: statusFor(benchmarkDone, deterministicDone && !benchmarkDone),
    },
    {
      id: 'loop-04',
      phase: 'ITERATE -> VERIFY',
      title: 'Script HITL y delta de salud',
      objective: 'Validar que el script usa columnas reales, cubre issues y bloquea acciones destructivas ambiguas.',
      visibleResult: 'Script aprobado, validacion automatica e ImprovementRun con delta antes/despues.',
      e2eGate: 'Generar script -> revisar -> aprobar -> simular -> ver delta de salud.',
      status: statusFor(hitlDone, deterministicDone && !hitlDone),
    },
    {
      id: 'loop-05',
      phase: 'CLOSEOUT',
      title: 'Paquete de resultados para TFM/articulo',
      objective: 'Consolidar tablas, JSON, capturas y claims permitidos para memoria y publicacion.',
      visibleResult: 'Anexo JSON, CSV de issues, script final, benchmark y tablas APA-ready.',
      e2eGate: 'Llegar a Exportar -> descargar artefactos -> confirmar que cada objetivo tiene evidencia.',
      status: statusFor(exportDone, hitlDone && !exportDone),
    },
  ];

  const nextLoop = loops.find((loop) => loop.status === 'active' || loop.status === 'blocked')
    ?? loops.find((loop) => loop.status === 'planned')
    ?? loops[loops.length - 1];

  return {
    has: [
      'Motor determinista reproducible y pipeline local-first funcionando en navegador.',
      'Capa LLM restringida por smart sample, copy-paste evidence y validacion de scripts.',
      'Carpeta de tercera entrega con directrices para resultados y articulo.',
    ],
    wants: [
      'Resultados formales que se vean en AURA y se exporten como evidencia.',
      'Loops cerrados con E2E: abrir, entender, completar, ejecutar, ver feedback y terminar.',
      'Un camino directo desde prototipo a TFM defendible y articulo publicable.',
    ],
    mustDo: [
      'Formalizar metricas por regla y por dataset.',
      'Ejecutar benchmark LLM con estados de evidencia claros.',
      'Probar el flujo humano con fixtures y Playwright antes de cerrar fases criticas.',
    ],
    loops,
    nextLoop,
  };
};
