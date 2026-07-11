import React from 'react';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';

interface CampaignSetupPanelProps {
  creating: boolean;
  canCreate: boolean;
  blocker?: string;
  onCreate: () => Promise<void>;
}

const CampaignSetupPanel: React.FC<CampaignSetupPanelProps> = ({
  creating,
  canCreate,
  blocker,
  onCreate,
}) => (
  <section className="oe4-setup" aria-labelledby="oe4-setup-title">
    <div>
      <p className="oe4-eyebrow">Protocolo congelado</p>
      <h2 id="oe4-setup-title">Crear la campaña formal</h2>
      <p>
        AURA conservará una matriz de 45 unidades: tres modelos, tres entradas y
        cinco repeticiones. Los fallos también forman parte del resultado.
      </p>
    </div>
    <dl className="oe4-protocol-grid">
      <div><dt>Protocolo</dt><dd>{FINAL_EVALUATION_PROTOCOL.id}</dd></div>
      <div><dt>Dataset</dt><dd>{FINAL_EVALUATION_PROTOCOL.dataset.id}</dd></div>
      <div><dt>Corridas</dt><dd>{FINAL_EVALUATION_PROTOCOL.matrix.units}</dd></div>
      <div><dt>Llamadas máximas</dt><dd>{FINAL_EVALUATION_PROTOCOL.matrix.maxLlmCalls}</dd></div>
    </dl>
    {blocker && <p className="oe4-blocker" role="status">{blocker}</p>}
    <button
      type="button"
      className="btn-p"
      disabled={!canCreate || creating}
      onClick={() => void onCreate()}
    >
      {creating ? 'Creando campaña…' : 'Crear campaña congelada'}
    </button>
  </section>
);

export default CampaignSetupPanel;
