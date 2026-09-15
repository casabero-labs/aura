import React from 'react';

export type RemediationMilestone = 'proposal' | 'approval' | 'apply';

const MILESTONES: { id: RemediationMilestone; label: string }[] = [
  { id: 'proposal', label: 'Propuesta' },
  { id: 'approval', label: 'Aprobación' },
  { id: 'apply', label: 'Aplicar y verificar' },
];

export default function RemediationBranchHeader({
  milestone,
}: {
  milestone: RemediationMilestone;
}) {
  return (
    <header className="remediation-branch-header" data-testid="remediation-branch-header">
      <p className="sec-eye">Rama opcional</p>
      <h2 className="sec-title">Corregir una copia</h2>
      <p className="section-note">
        El archivo original no se modifica. Aprobar no ejecuta. Un recibo válido no afirma integridad semántica.
      </p>
      <ol className="remediation-milestones" aria-label="Hitos de la corrección">
        {MILESTONES.map((item) => (
          <li
            key={item.id}
            aria-current={item.id === milestone ? 'step' : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>
    </header>
  );
}
