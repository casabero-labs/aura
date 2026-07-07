
export type PipelineState = 'upload' | 'profile' | 'calibration' | 'diagnosis' | 'diagnostic_report' | 'script' | 'review' | 'export';

interface PipelineProgressProps {
  currentStep: PipelineState;
  onStepClick?: (step: PipelineState) => void;
}

const steps: { num: number; label: string; state: PipelineState }[] = [
  { num: 1, label: 'Carga', state: 'upload' },
  { num: 2, label: 'Perfil técnico', state: 'profile' },
  { num: 3, label: 'Calibración', state: 'calibration' },
  { num: 4, label: 'Diagnóstico', state: 'diagnosis' },
  { num: 5, label: 'Reporte', state: 'diagnostic_report' },
  { num: 6, label: 'Script opcional', state: 'script' },
  { num: 7, label: 'Revisión opcional', state: 'review' },
  { num: 8, label: 'Exportar', state: 'export' },
];

const stepOrder: PipelineState[] = ['upload', 'profile', 'calibration', 'diagnosis', 'diagnostic_report', 'script', 'review', 'export'];

const getStepStatus = (stepState: PipelineState, currentStep: PipelineState) => {
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepState);

  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
};

const optionalSteps: PipelineState[] = ['script', 'review'];

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
                className={`stepper-step ${status} ${isClickable ? 'clickable' : ''} ${optionalSteps.includes(step.state) ? 'stepper-step--optional' : ''}`}
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
