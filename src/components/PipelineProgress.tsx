export type PipelineState = 'upload' | 'profile' | 'calibration' | 'diagnosis' | 'diagnostic_report' | 'script' | 'review' | 'export';

interface PipelineProgressProps {
  currentStep: PipelineState;
  onStepClick?: (step: PipelineState) => void;
}

const mainFlowSteps: { num: number; label: string; state: PipelineState }[] = [
  { num: 1, label: 'Carga', state: 'upload' },
  { num: 2, label: 'Perfil base', state: 'profile' },
  { num: 3, label: 'Diagnóstico', state: 'diagnosis' },
  { num: 4, label: 'Reporte diagnóstico', state: 'diagnostic_report' },
  { num: 5, label: 'Exportación', state: 'export' },
];

const mainFlowIndex: Record<PipelineState, number> = {
  upload: 0,
  profile: 1,
  diagnosis: 2,
  diagnostic_report: 3,
  export: 4,
  calibration: 1,
  script: 3,
  review: 3,
};

const branchLabelFor: Record<PipelineState, string | null> = {
  upload: null,
  profile: null,
  diagnosis: null,
  diagnostic_report: null,
  export: null,
  calibration: 'Laboratorio / Calibración experimental',
  script: 'Rama opcional: Remediación',
  review: 'Rama opcional: Remediación',
};

const getStepStatus = (stepState: PipelineState, currentStep: PipelineState) => {
  const currentIdx = mainFlowIndex[currentStep];
  const stepIdx = mainFlowIndex[stepState];

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
};

const PipelineProgress = ({ currentStep, onStepClick }: PipelineProgressProps) => {
  const handleStepClick = (step: PipelineState) => {
    if (onStepClick) {
      onStepClick(step);
    }
  };

  const branchLabel = branchLabelFor[currentStep];

  return (
    <div className="stepper" data-testid="pipeline-stepper">
      <div className="stepper-track">
        {mainFlowSteps.map((step, index) => {
          const status = getStepStatus(step.state, currentStep);
          const isClickable = onStepClick !== undefined;

          return (
            <div key={step.state} style={{ display: 'contents' }}>
              <div
                className={`stepper-step ${status} ${isClickable ? 'clickable' : ''}`}
                onClick={() => handleStepClick(step.state)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                data-step={step.state}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    handleStepClick(step.state);
                  }
                }}
              >
                <span className="stepper-index">{step.num}</span>
                <span className="stepper-label">{step.label}</span>
              </div>
              {index < mainFlowSteps.length - 1 && (
                <div className="stepper-line" />
              )}
            </div>
          );
        })}
      </div>
      {branchLabel && (
        <div className="stepper-branch" data-testid="pipeline-stepper-branch" role="status">
          <span className="stepper-branch-dot" aria-hidden="true" />
          {branchLabel}
        </div>
      )}
    </div>
  );
};

export default PipelineProgress;
