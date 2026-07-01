// ── Phase 6 Loop 5: ImprovementRunPage ──
// Page wrapper for ImprovementRunPanel following BenchmarkLab pattern.
// Uses controlled fixtures only. Delegates Python execution to Colab.

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ImprovementRunPanel from './ImprovementRunPanel';

interface Props {
  onBack: () => void;
}

const ImprovementRunPage: React.FC<Props> = ({ onBack }) => {
  return (
    <main className="sys-main">
      <div style={{ padding: '0 0 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 13, borderRadius: 6,
              border: '1px solid #e5e7eb', background: '#fff',
              cursor: 'pointer', color: '#374151',
            }}
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase 6</p>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>Improvement Run</h2>
          </div>
        </div>

        <ImprovementRunPanel />
      </div>
    </main>
  );
};

export default ImprovementRunPage;
