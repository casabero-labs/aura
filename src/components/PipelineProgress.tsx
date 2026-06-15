
export type PipelineState = 'upload' | 'profile' | 'diagnosis' | 'script' | 'review' | 'export';

interface PipelineProgressProps {
  currentStep: PipelineState;
  onStepClick?: (step: PipelineState) => void;
}

const steps: { num: number; label: string; state: PipelineState }[] = [
  { num: 1, label: 'Carga', state: 'upload' },
  { num: 2, label: 'Perfil', state: 'profile' },
  { num: 3, label: 'Diagnóstico', state: 'diagnosis' },
  { num: 4, label: 'Script', state: 'script' },
  { num: 5, label: 'Revisión', state: 'review' },
  { num: 6, label: 'Exportar', state: 'export' },
];

const stepOrder: PipelineState[] = ['upload', 'profile', 'diagnosis', 'script', 'review', 'export'];

const getStepStatus = (stepState: PipelineState, currentStep: PipelineState) => {
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepState);

  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
};

const PipelineProgress = ({ currentStep, onStepClick }: PipelineProgressProps) => {
  const handleStepClick = (step: PipelineState) => {
    if (onStepClick) {
      onStepClick(step);
    }
  };

  return (
    <div className="stepper">
      <div className="stepper-track">
        {steps.map((step, index) => {
          const status = getStepStatus(step.state, currentStep);
          const isClickable = onStepClick !== undefined;

          return (
            <div key={step.state} style={{ display: 'contents' }}>
              <div
                className={`stepper-step ${status} ${isClickable ? 'clickable' : ''}`}
                onClick={() => handleStepClick(step.state)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    handleStepClick(step.state);
                  }
                }}
              >
                <span className="stepper-label">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="stepper-line" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineProgress;
