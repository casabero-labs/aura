import { Check, Brain, ClipboardCheck, FileText, Search, Upload } from 'lucide-react';

export type PipelineState = 'upload' | 'diagnostic' | 'analysis' | 'review' | 'export';

interface PipelineProgressProps {
  currentStep: PipelineState;
  onStepClick?: (step: PipelineState) => void;
}

const steps: { num: number; label: string; icon: React.ReactNode; state: PipelineState }[] = [
  { num: 1, label: 'Subir CSV', icon: <Upload size={14} />, state: 'upload' },
  { num: 2, label: 'Diagnosticar', icon: <Search size={14} />, state: 'diagnostic' },
  { num: 3, label: 'Analizar IA', icon: <Brain size={14} />, state: 'analysis' },
  { num: 4, label: 'Revisar', icon: <ClipboardCheck size={14} />, state: 'review' },
  { num: 5, label: 'Exportar', icon: <FileText size={14} />, state: 'export' },
];

const stepOrder: PipelineState[] = ['upload', 'diagnostic', 'analysis', 'review', 'export'];

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
                <div className="stepper-icon">
                  {status === 'done' ? <Check size={14} /> : step.icon}
                </div>
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