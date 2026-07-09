import React, { useMemo, useState } from 'react';
import { CheckCheck, Copy, FileCode2 } from 'lucide-react';
import { AuditReport } from '../types';
import { buildSmartSample } from '../services/providers/prompts';

interface ProfileEvidencePackageProps {
  report: AuditReport;
}

const ProfileEvidencePackage: React.FC<ProfileEvidencePackageProps> = ({ report }) => {
  const sample = useMemo(() => buildSmartSample(report), [report]);
  const jsonString = useMemo(() => JSON.stringify(sample, null, 2), [sample]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is optional.
    }
  };

  return (
    <section className="section" id="profile-evidence-package">
      <div className="smart-sample-receipt">
        <div className="smart-sample-receipt-main">
          <span className="smart-sample-receipt-icon"><FileCode2 size={14} /></span>
          <div>
            <h3>Expediente listo para diagnóstico</h3>
            <p>
              AURA preparó el contexto verificable del perfil: columnas observadas, muestras limitadas y reglas activadas.
            </p>
          </div>
        </div>
        <div className="smart-sample-receipt-meta">
          <span>{sample.columns.length} columnas</span>
          <span>{sample.detected_issues.length} reglas</span>
          <span>{jsonString.length.toLocaleString('es-CO')} caracteres</span>
        </div>
        <button className="smart-sample-copy-btn" onClick={handleCopy} title="Copiar expediente técnico">
          {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
          {copied ? 'copiado' : 'copiar'}
        </button>
      </div>
    </section>
  );
};

export default ProfileEvidencePackage;
