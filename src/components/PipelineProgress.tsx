export type PipelineState = 'upload' | 'profile' | 'diagnosis' | 'diagnostic_report' | 'script' | 'review' | 'execution' | 'export';

interface PipelineProgressProps {
  currentStep: PipelineState;
  onStepClick?: (step: PipelineState) => void;
}

const mainFlowSteps: { num: number; label: string; state: PipelineState }[] = [
  { num: 1, label: 'Carga', state: 'upload' },
  { num: 2, label: 'Perfil', state: 'profile' },
  { num: 3, label: 'Diagnóstico', state: 'diagnosis' },
  { num: 4, label: 'Informe', state: 'diagnostic_report' },
  { num: 5, label: 'Corrección opcional', state: 'script' },
  { num: 6, label: 'Revisión', state: 'review' },
  { num: 7, label: 'Ejecución', state: 'execution' },
  { num: 8, label: 'Exportación', state: 'export' },
];

const mainFlowIndex: Record<PipelineState, number> = {
  upload: 0,
  profile: 1,
  diagnosis: 2,
  diagnostic_report: 3,
  script: 4,
  review: 5,
  execution: 6,
  export: 7,
};

const getStepStatus = (stepState: PipelineState, currentStep: PipelineState) => {
  const currentIdx = mainFlowIndex[currentStep];
  const stepIdx = mainFlowIndex[stepState];

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
};

const PipelineProgress = ({ currentStep, onStepClick }: PipelineProgressProps) => {
  const currentIndex = mainFlowIndex[currentStep];

  return (
    <div className="stepper" data-testid="pipeline-stepper">
      <div className="stepper-track">
        {mainFlowSteps.map((step, index) => {
          const status = getStepStatus(step.state, currentStep);
          const isClickable = onStepClick !== undefined && mainFlowIndex[step.state] <= currentIndex;

          return (
            <div key={step.state} style={{ display: 'contents' }}>
              <button
                type="button"
                className={`stepper-step ${status} ${isClickable ? 'clickable' : ''}`}
                onClick={() => isClickable && onStepClick?.(step.state)}
                disabled={!isClickable}
                aria-current={status === 'active' ? 'step' : undefined}
                aria-label={`${String(step.num).padStart(2, '0')} · ${step.label}${status === 'pending' ? ' (pendiente)' : ''}`}
                data-step={step.state}
                onKeyDown={(e) => {
                  if (isClickable && e.key === ' ') {
                    e.preventDefault();
                    onStepClick?.(step.state);
                  }
                }}
              >
                <span className="stepper-index">{String(step.num).padStart(2, '0')}</span>
                <span className="stepper-label">{step.label}</span>
                {step.state === 'diagnostic_report' && <span className="sr-only">Reporte diagnóstico</span>}
              </button>
              {index < mainFlowSteps.length - 1 && (
                <div className="stepper-line" />
              )}
            </div>
          );
        })}
      </div>
      <p className="stepper-current-context" role="status">
        <span>{String(currentIndex + 1).padStart(2, '0')}</span> · {mainFlowSteps[currentIndex]?.label}
        {['script', 'review', 'execution'].includes(currentStep) && ' · Rama opcional de remediación'}
      </p>
    </div>
  );
};

export default PipelineProgress;
