import React, { useEffect, useState } from 'react';
import type { CampaignPipelineConfigurationV1 } from '../../services/benchmark/campaignPipelineConfiguration';

interface CampaignConfigurationPanelProps {
  configuration: CampaignPipelineConfigurationV1;
  modelInstalled: boolean;
  onApply?: (configuration: CampaignPipelineConfigurationV1) => void;
  onGoToAudit?: () => void;
}

const score = (value: number | null): string => value === null ? 'n/d' : `${value.toFixed(1)}/100`;

const CampaignConfigurationPanel: React.FC<CampaignConfigurationPanelProps> = ({
  configuration,
  modelInstalled,
  onApply,
  onGoToAudit,
}) => {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setCopied(false);
    setApplied(false);
  }, [configuration.cellId]);

  const copy = async () => {
    await navigator.clipboard.writeText(`${JSON.stringify(configuration, null, 2)}\n`);
    setCopied(true);
  };

  const apply = () => {
    if (!modelInstalled || !onApply) return;
    onApply(configuration);
    setApplied(true);
  };

  return (
    <section className="oe4-panel oe4-configuration-panel" aria-labelledby="oe4-configuration-title" data-testid="oe4-configuration-panel">
      <div className="oe4-panel-heading">
        <div>
          <p className="oe4-eyebrow">Del resultado a la práctica</p>
          <h2 id="oe4-configuration-title">Configuración para el próximo diagnóstico</h2>
          <p>La selección de la matriz y los gráficos se traduce aquí en parámetros exactos del pipeline normal.</p>
        </div>
        <span className={`oe4-status ${modelInstalled ? 'oe4-status--reaudited' : 'oe4-status--blocked'}`}>
          {modelInstalled ? 'modelo disponible' : 'modelo no instalado'}
        </span>
      </div>

      <div className="oe4-configuration-summary">
        <div className="oe4-configuration-identity">
          <span>Modelo Ollama</span>
          <strong>{configuration.modelId}</strong>
          <small>{configuration.inputModeLabel}</small>
        </div>
        <dl>
          <div><dt>Temperatura</dt><dd>{configuration.inference.temperature}</dd></div>
          <div><dt>top_p</dt><dd>{configuration.inference.topP}</dd></div>
          <div><dt>numCtx</dt><dd>{configuration.inference.numCtx.toLocaleString('es-CO')}</dd></div>
          <div><dt>numPredict</dt><dd>{configuration.inference.numPredict.toLocaleString('es-CO')}</dd></div>
          <div><dt>Think</dt><dd>{configuration.inference.think ? 'Sí' : 'No'}</dd></div>
          <div><dt>Timeout</dt><dd>{configuration.inference.timeoutSeconds}s</dd></div>
          <div><dt>Keep alive</dt><dd>{configuration.inference.keepAlive}</dd></div>
          <div><dt>Seed</dt><dd>{configuration.inference.seed ?? 'automática'}</dd></div>
        </dl>
      </div>

      <div className="oe4-configuration-evidence">
        <div><span>Índice equilibrado</span><strong>{score(configuration.selection.balancedScore)}</strong></div>
        <div><span>Fiabilidad</span><strong>{score(configuration.selection.reliability)}</strong></div>
        <div><span>Evidencia</span><strong>{score(configuration.selection.evidenceSupport)}</strong></div>
        <div><span>Corridas válidas</span><strong>{configuration.selection.validRuns}/{configuration.selection.attemptedRuns}</strong></div>
      </div>

      {!modelInstalled && (
        <p className="oe4-blocker" role="alert">El modelo seleccionado no está instalado en Ollama. Refresca o instálalo antes de aplicar esta configuración.</p>
      )}
      <p className="oe4-configuration-caveat">{configuration.interpretation}</p>

      <div className="oe4-configuration-actions">
        <button type="button" className="btn-s" onClick={() => void copy()}>{copied ? 'Configuración copiada' : 'Copiar configuración'}</button>
        <button type="button" className="btn-p" disabled={!modelInstalled || !onApply} onClick={apply}>
          {applied ? 'Configuración aplicada' : 'Aplicar al próximo diagnóstico'}
        </button>
        <button type="button" className="btn-s" disabled={!onGoToAudit} onClick={onGoToAudit}>Ir a Auditoría</button>
      </div>
    </section>
  );
};

export default CampaignConfigurationPanel;
