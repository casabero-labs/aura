import React from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { ProgressDisclosureProps } from '../types';

const ICONS: Record<string, React.ReactNode> = {
  running: <Loader2 size={14} className="progress-disclosure-spinner" />,
  success: <CheckCircle size={14} className="progress-disclosure-icon-success" />,
  warning: <AlertTriangle size={14} className="progress-disclosure-icon-warning" />,
  error: <AlertCircle size={14} className="progress-disclosure-icon-error" />,
};

const ProgressDisclosure: React.FC<ProgressDisclosureProps> = ({
  title,
  description,
  value,
  indeterminate = false,
  status,
  currentStep,
  steps,
  details,
  compact = false,
}) => {
  const isRunning = status === 'running';
  const hasBar = isRunning || status === 'error' || status === 'success' || status === 'warning';
  const showDeterminate = hasBar && !indeterminate && value !== undefined;
  const showIndeterminate = hasBar && (indeterminate || value === undefined);

  const ariaProps = showDeterminate
    ? {
        role: 'progressbar' as const,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(value!),
        'aria-label': title || currentStep || 'Progreso',
      }
    : showIndeterminate
      ? {
          role: 'progressbar' as const,
          'aria-label': title || description || 'Progreso en curso',
        }
      : {};

  return (
    <div
      className={`progress-disclosure ${compact ? 'progress-disclosure--compact' : ''} progress-disclosure--${status}`}
      data-testid="progress-disclosure"
    >
      <div className="progress-disclosure-head">
        <div className="progress-disclosure-left">
          {ICONS[status] && <span className="progress-disclosure-status-icon">{ICONS[status]}</span>}
          <div className="progress-disclosure-text">
            {title && <span className="progress-disclosure-title">{title}</span>}
            {description && <span className="progress-disclosure-description">{description}</span>}
            {currentStep && <span className="progress-disclosure-step">{currentStep}</span>}
          </div>
        </div>
        {showDeterminate && (
          <span className="progress-disclosure-pct">{Math.round(value!)}%</span>
        )}
      </div>

      {showDeterminate && (
        <div className="progress-disclosure-track" {...ariaProps}>
          <div
            className="progress-disclosure-fill"
            style={{ width: `${Math.round(value!)}%` }}
          />
        </div>
      )}

      {showIndeterminate && (
        <div className="progress-disclosure-track progress-disclosure-track--indeterminate" {...ariaProps}>
          <div className="progress-disclosure-fill progress-disclosure-fill--indeterminate" />
        </div>
      )}

      {steps && steps.length > 0 && (
        <div className="progress-disclosure-steps">
          {steps.map((step, i) => {
            const isCurrent = !isRunning && currentStep === step;
            const isPast = !isRunning && steps.indexOf(currentStep || '') > i;
            return (
              <span
                key={step}
                className={`progress-disclosure-step-item ${isPast ? 'progress-disclosure-step-item--done' : ''} ${isCurrent ? 'progress-disclosure-step-item--active' : ''}`}
              >
                {isPast && <CheckCircle size={10} />}
                {step}
              </span>
            );
          })}
        </div>
      )}

      {details && (
        <details className="progress-disclosure-details">
          <summary>Detalles</summary>
          <div className="progress-disclosure-details-body">{details}</div>
        </details>
      )}
    </div>
  );
};

export default ProgressDisclosure;
