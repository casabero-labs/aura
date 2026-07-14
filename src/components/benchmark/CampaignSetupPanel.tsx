import React from 'react';
import type { InferenceSnapshotV1 } from '../../contracts/llm/types';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';
import type { OllamaModelInfo } from '../../services/ollamaLocalBridge';
import { ollamaModelDisplayName, ollamaModelId } from '../../services/ollamaModelCatalog';

interface CampaignSetupPanelProps {
  creating: boolean;
  canCreate: boolean;
  blocker?: string;
  installedModels: readonly OllamaModelInfo[];
  modelCatalogLoading: boolean;
  inference: InferenceSnapshotV1;
  onInferenceChange: (inference: InferenceSnapshotV1) => void;
  onRefreshModels: () => Promise<void>;
  onCreate: () => Promise<void>;
}

const CampaignSetupPanel: React.FC<CampaignSetupPanelProps> = ({
  creating,
  canCreate,
  blocker,
  installedModels,
  modelCatalogLoading,
  inference,
  onInferenceChange,
  onRefreshModels,
  onCreate,
}) => {
  const inferenceValid = Number.isInteger(inference.numCtx)
    && inference.numCtx >= 4096
    && inference.numCtx <= 131072
    && Number.isInteger(inference.numPredict)
    && inference.numPredict >= 512
    && inference.numPredict <= inference.numCtx
    && inference.temperature >= 0
    && inference.temperature <= 2;
  const updateNumber = (key: 'numCtx' | 'numPredict' | 'temperature', value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onInferenceChange({ ...inference, [key]: parsed });
  };
  const applyPreset = (numCtx: number, numPredict: number) => {
    onInferenceChange({
      ...inference,
      temperature: 0.1,
      numCtx,
      numPredict,
      timeoutSeconds: numCtx >= 32768 ? 900 : 600,
    });
  };
  return (
  <section className="oe4-setup" aria-labelledby="oe4-setup-title">
    <div>
      <p className="oe4-eyebrow">Protocolo congelado</p>
      <h2 id="oe4-setup-title">Preparar experimento</h2>
      <p>
        AURA conservará una matriz de {FINAL_EVALUATION_PROTOCOL.matrix.units} unidades: tres modelos,
        tres entradas y {FINAL_EVALUATION_PROTOCOL.repetitions} repeticiones. Los fallos también forman parte del resultado.
      </p>
      <p>
        Cada corrida usa el mismo procesador de diagnóstico de Auditoría. El Laboratorio solo organiza,
        conserva y evalúa las respuestas de las múltiples corridas.
      </p>
    </div>
    <dl className="oe4-protocol-grid">
      <div><dt>Protocolo</dt><dd>Evaluación reproducible · v{FINAL_EVALUATION_PROTOCOL.version}</dd></div>
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
    <section className="oe4-inference-config" aria-labelledby="oe4-inference-title">
      <div className="oe4-inference-heading">
        <div>
          <p className="oe4-eyebrow">Configuración congelada</p>
          <h3 id="oe4-inference-title">Memoria y longitud de respuesta</h3>
        </div>
        <div className="oe4-inference-presets" aria-label="Perfiles rápidos">
          <button type="button" className="btn-s" onClick={() => applyPreset(16384, 4096)}>Perfil 16 GB</button>
          <button type="button" className="btn-s" onClick={() => applyPreset(32768, 8192)}>Perfil 64 GB</button>
        </div>
      </div>
      <p>
        Estos valores se aplican igual a las 27 corridas y quedan registrados en cada recibo.
        Cambiarlos después exige crear una campaña nueva.
      </p>
      <div className="oe4-inference-fields">
        <label>
          <span>Ventana de contexto · numCtx</span>
          <input
            type="number"
            min="4096"
            max="131072"
            step="1024"
            value={inference.numCtx}
            onChange={(event) => updateNumber('numCtx', event.target.value)}
          />
          <small>Capacidad total para prompt y respuesta. Más contexto consume más RAM.</small>
        </label>
        <label>
          <span>Salida máxima · numPredict</span>
          <input
            type="number"
            min="512"
            max={inference.numCtx}
            step="256"
            value={inference.numPredict}
            onChange={(event) => updateNumber('numPredict', event.target.value)}
          />
          <small>Tope de tokens de salida. Evita JSON truncado; un límite mayor puede tardar más.</small>
        </label>
        <label>
          <span>Temperatura</span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.05"
            value={inference.temperature}
            onChange={(event) => updateNumber('temperature', event.target.value)}
          />
          <small>0.1 favorece respuestas estables y reproducibles para el contrato JSON.</small>
        </label>
      </div>
      <div className="oe4-inference-summary" role="status">
        <span>CONTEXTO {inference.numCtx.toLocaleString()}</span>
        <span>SALIDA {inference.numPredict.toLocaleString()}</span>
        <span>TEMPERATURA {inference.temperature}</span>
        <span>TIMEOUT {inference.timeoutSeconds}s</span>
      </div>
      {!inferenceValid && (
        <p className="oe4-blocker">La salida debe estar entre 512 y numCtx; numCtx admite de 4.096 a 131.072.</p>
      )}
    </section>
    {blocker && <p className="oe4-blocker" role="status">{blocker}</p>}
    <button
      type="button"
      className="btn-p"
      disabled={!canCreate || creating || !inferenceValid}
      onClick={() => void onCreate()}
    >
      {creating ? 'Creando experimento…' : 'Crear experimento'}
    </button>
  </section>
  );
};

export default CampaignSetupPanel;
