import React from 'react';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';
import type { OllamaModelInfo } from '../../services/ollamaLocalBridge';
import { ollamaModelDisplayName, ollamaModelId } from '../../services/ollamaModelCatalog';

interface CampaignSetupPanelProps {
  creating: boolean;
  canCreate: boolean;
  blocker?: string;
  installedModels: readonly OllamaModelInfo[];
  modelCatalogLoading: boolean;
  onRefreshModels: () => Promise<void>;
  onCreate: () => Promise<void>;
}

const CampaignSetupPanel: React.FC<CampaignSetupPanelProps> = ({
  creating,
  canCreate,
  blocker,
  installedModels,
  modelCatalogLoading,
  onRefreshModels,
  onCreate,
}) => (
  <section className="oe4-setup" aria-labelledby="oe4-setup-title">
    <div>
      <p className="oe4-eyebrow">Protocolo congelado</p>
      <h2 id="oe4-setup-title">Preparar experimento</h2>
      <p>
        AURA conservará una matriz de {FINAL_EVALUATION_PROTOCOL.matrix.units} unidades: tres modelos,
        tres entradas y {FINAL_EVALUATION_PROTOCOL.repetitions} repeticiones. Los fallos también forman parte del resultado.
      </p>
    </div>
    <dl className="oe4-protocol-grid">
      <div><dt>Protocolo</dt><dd>{FINAL_EVALUATION_PROTOCOL.id}</dd></div>
      <div><dt>Dataset</dt><dd>{FINAL_EVALUATION_PROTOCOL.dataset.id}</dd></div>
      <div><dt>Diagnósticos evaluados</dt><dd>{FINAL_EVALUATION_PROTOCOL.matrix.units}</dd></div>
      <div><dt>Calentamientos excluidos</dt><dd>{FINAL_EVALUATION_PROTOCOL.matrix.warmupCalls}</dd></div>
      <div><dt>Llamadas reales</dt><dd>{FINAL_EVALUATION_PROTOCOL.matrix.totalRealCalls}</dd></div>
    </dl>
    <div className="oe4-installed-models" data-testid="oe4-installed-models">
      <div>
        <strong>Modelos disponibles en Ollama ({installedModels.length})</strong>
        <small> Lista consultada en tiempo real desde <code>/api/tags</code>.</small>
      </div>
      {installedModels.length > 0 ? (
        <ul>
          {installedModels.map((model) => (
            <li key={ollamaModelId(model)}>
              {ollamaModelDisplayName(model)} · {(model.size / 1e9).toFixed(1)} GB
            </li>
          ))}
        </ul>
      ) : !modelCatalogLoading ? <p>No se detectaron modelos instalados.</p> : null}
      <button type="button" className="btn-s" disabled={modelCatalogLoading} onClick={() => void onRefreshModels()}>
        {modelCatalogLoading ? 'Consultando Ollama…' : 'Refrescar modelos'}
      </button>
    </div>
    {blocker && <p className="oe4-blocker" role="status">{blocker}</p>}
    <button
      type="button"
      className="btn-p"
      disabled={!canCreate || creating}
      onClick={() => void onCreate()}
    >
      {creating ? 'Creando experimento…' : 'Crear experimento'}
    </button>
  </section>
);

export default CampaignSetupPanel;
