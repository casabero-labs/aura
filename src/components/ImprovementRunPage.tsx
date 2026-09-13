// ── Phase 6 Loop 5: ImprovementRunPage ──
// Page wrapper for the optional Health Delta workspace.
// Uses controlled fixtures only. Delegates Python execution to Colab.

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ImprovementRunPanel from './ImprovementRunPanel';

interface Props {
  onBack: () => void;
}

const ImprovementRunPage: React.FC<Props> = ({ onBack }) => {
  return (
    <main className="sys-main improvement-run-page" data-testid="improvement-run-page">
      <div className="improvement-run-page-inner">
        <div className="improvement-run-page-header">
          <button
            onClick={onBack}
            className="improvement-run-back"
          >
            <ArrowLeft size={13} />
            Volver
          </button>
          <div className="improvement-run-page-title">
            <p>08 · Revisión de mejora <span className="sr-only">Phase 6</span></p>
            <h1>Ejecución de mejora <span className="sr-only">Improvement Run</span></h1>
          </div>
        </div>

        <ImprovementRunPanel />
      </div>
    </main>
  );
};

export default ImprovementRunPage;
