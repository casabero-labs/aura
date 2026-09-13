import React from 'react';
import type { ExperimentEvidencePackage } from '../../services/benchmark/experimentArtifactExporter';
import type {
  ExperimentCampaignEvidenceDocumentV1,
  FormalValidityResult,
} from '../../services/benchmark/experimentReport';
import { OE4_INPUT_MODE_LABELS } from '../../services/benchmark/finalEvaluationProtocol';
import type { DecisionUseCase } from '../../services/benchmark/experimentDecisionSupport';

interface CampaignReportPanelProps {
  formalValidity: FormalValidityResult;
  evidenceDocument: ExperimentCampaignEvidenceDocumentV1;
  evidencePackage: ExperimentEvidencePackage | null;
  onExport?: (evidencePackage: ExperimentEvidencePackage) => void;
}

interface ReportBlockerSummary {
  key: string;
  title: string;
  description: string;
}

const summarizeBlocker = (reason: string): ReportBlockerSummary => {
  if (reason.includes('protocolVersion must match')) {
    return {
      key: 'protocol',
      title: 'Protocolo anterior',
      description: 'Esta campaña pertenece a una versión anterior y se conserva únicamente como evidencia histórica.',
    };
  }
  if (reason.includes('environment.inference must match')) {
    return {
      key: 'inference',
      title: 'Configuración no vigente',
      description: 'Los parámetros usados no coinciden con el protocolo actual. No se mezclarán con la nueva campaña.',
    };
  }
  if (reason.includes('campaign status is not completed') || reason.includes('not every experimental unit was attempted')) {
    return {
      key: 'incomplete',
      title: 'Campaña incompleta',
      description: 'El reporte se habilitará cuando todas las unidades planeadas hayan sido intentadas.',
    };
  }
  return {
    key: `other:${reason}`,
    title: 'Validación pendiente',
    description: 'La evidencia aún no reúne todas las condiciones necesarias para preparar el reporte.',
  };
};

const ARTIFACT_DESCRIPTIONS: Record<string, string> = {
  'campaign.json': 'Fuente canónica del experimento: configuración, corridas, evaluaciones automáticas y recibos.',
  'runs.csv': 'Una fila por corrida para comparar modelos, métodos, métricas, errores, hashes y estados.',
  'report.md': 'Informe legible en Markdown con método, resultados, fallos, métricas y conclusiones.',
  'report.pdf': 'Versión PDF del informe para revisión humana, archivo o publicación.',
  'results-summary.json': 'Resumen estructurado de la matriz, scores, recomendaciones y configuración seleccionada.',
  'methodology.md': 'Criterios, ponderaciones, alcance y límites usados para calcular los resultados.',
  'glossary.md': 'Guía en lenguaje sencillo de métricas, modos de entrada y parámetros de inferencia.',
  'selected-configuration.json': 'Modelo, método de entrada y parámetros exactos listos para el próximo diagnóstico normal.',
  'manifest.json': 'Hashes de todos los archivos exportados para comprobar que el expediente no fue alterado.',
};

const modelName = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'Qwen3.5 4B';
  if (modelId.includes('gemma-4-E4B')) return 'Gemma 4 E4B';
  if (modelId.includes('SmolLM3-3B')) return 'SmolLM3 3B';
  return modelId;
};

const useCaseLabel: Record<DecisionUseCase, string> = {
  balanced: 'Mejor equilibrio para AURA',
  diagnostic_quality: 'Mayor calidad operativa',
  reliability: 'Mayor estabilidad',
  traceability: 'Mayor soporte de evidencia',
  speed: 'Menor latencia',
};

const score = (value: number | null): string => value === null ? 'n/d' : value.toFixed(1);

const downloadArtifact = (filename: string, mediaType: string, content: string | Uint8Array): void => {
  const blob = new Blob([content], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CampaignReportPanel: React.FC<CampaignReportPanelProps> = ({
  formalValidity,
  evidenceDocument,
  evidencePackage,
  onExport,
}) => {
  const blockerSummaries = Array.from(
    new Map(formalValidity.reasons.map((reason) => {
      const summary = summarizeBlocker(reason);
      return [summary.key, summary] as const;
    })).values(),
  );
  const exportAll = () => {
    if (!formalValidity.valid || evidencePackage === null) return;
    if (onExport) {
      onExport(evidencePackage);
      return;
    }
    evidencePackage.artifacts.forEach((artifact) =>
      downloadArtifact(artifact.filename, artifact.mediaType, artifact.content));
  };

  return (
    <section className="oe4-panel oe4-report-panel" aria-labelledby="oe4-report-title">
      <div className="oe4-panel-heading">
        <div>
          <p className="oe4-eyebrow">Resultados reproducibles</p>
          <h2 id="oe4-report-title">{formalValidity.valid ? 'Reporte listo' : 'Reporte no disponible'}</h2>
        </div>
        <span className={`oe4-status ${formalValidity.valid ? 'oe4-status--reaudited' : 'oe4-status--blocked'}`}>
          {formalValidity.valid ? 'listo' : 'bloqueado'}
        </span>
      </div>
      {formalValidity.valid ? (
        <>
          <p className="oe4-info">AURA calculó el resultado con el oráculo controlado y las 27 corridas. Los fallos reducen la estabilidad; no se borran ni reciben un cero inventado.</p>
          <div className="oe4-recommendations" aria-label="Recomendaciones automáticas por objetivo">
            {evidenceDocument.decisionSupport.recommendations.map((recommendation) => (
              <article key={recommendation.useCase} className={recommendation.useCase === 'balanced' ? 'is-primary' : ''}>
                <span>{useCaseLabel[recommendation.useCase]}</span>
                <strong>{modelName(recommendation.modelId)}</strong>
                <small>{OE4_INPUT_MODE_LABELS[recommendation.inputMode]} · {score(recommendation.score)}/100</small>
                <p>{recommendation.rationale}</p>
              </article>
            ))}
          </div>
          <details className="oe4-score-method" open>
            <summary>Cómo califica AURA</summary>
            <div>
              <p><strong>No es un juicio de otro LLM.</strong> La evaluación compara regla, columna y alcance con un oráculo congelado del dataset controlado.</p>
              <dl>
                <div><dt>Alineación con GT</dt><dd>F1 medio frente al ground truth controlado. Describe concordancia; no premia dos veces una cobertura exigida por contrato.</dd></div>
                <div><dt>Fiabilidad</dt><dd>Diagnósticos válidos divididos entre corridas intentadas.</dd></div>
                <div><dt>Contrato</dt><dd>Gate de validez: una respuesta que no lo cumple se conserva como fallo y no recibe score operativo.</dd></div>
                <div><dt>Evidencia</dt><dd>Fidelidad y anclaje a la evidencia visible para ese método.</dd></div>
                <div><dt>Sin alucinaciones</dt><dd>Corridas válidas sin columnas inventadas ni claims sin soporte.</dd></div>
                <div><dt>Eficiencia</dt><dd>Latencia mediana de diagnósticos válidos, relativa a la combinación más rápida de esta campaña.</dd></div>
              </dl>
              <p>Índice equilibrado: fiabilidad 35 %, evidencia 25 %, ausencia de claims sin soporte 20 % y eficiencia 20 %. Alineación GT y contrato se muestran por separado como control descriptivo y gate. Es una ayuda contextual, no un ganador universal.</p>
            </div>
          </details>
          <div className="oe4-score-table-wrap">
            <table className="oe4-score-table">
              <caption>Scores comparables por modelo y modo de entrada</caption>
              <thead><tr><th scope="col">Modelo + entrada</th><th scope="col">Alineación GT</th><th scope="col">Fiabilidad</th><th scope="col">Contrato</th><th scope="col">Evidencia</th><th scope="col">Sin alucinaciones</th><th scope="col">Velocidad</th><th scope="col">Equilibrado</th></tr></thead>
              <tbody>
                {evidenceDocument.decisionSupport.scores.map((entry) => (
                  <tr key={entry.cellId}>
                    <th scope="row">{modelName(entry.modelId)}<small>{OE4_INPUT_MODE_LABELS[entry.inputMode]}</small></th>
                    <td>{score(entry.accuracy)}</td>
                    <td>{score(entry.reliability)}</td>
                    <td>{score(entry.contractCompliance)}</td>
                    <td>{score(entry.evidenceSupport)}</td>
                    <td>{score(entry.hallucinationSafety)}</td>
                    <td>{score(entry.efficiency)}</td>
                    <td><strong>{score(entry.balanced)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="oe4-report-scope"><strong>Alcance:</strong> este Laboratorio evalúa diagnósticos LLM. La revisión humana, el script, HITL y la remediación pertenecen al pipeline normal de Auditoría.</p>
          <p className="oe4-info">Los nueve artefactos se derivan de este experimento sin copiar métricas manualmente.</p>
          <ul aria-label="Artefactos disponibles" className="oe4-artifact-list">
            {evidencePackage?.artifacts.map((artifact) => (
              <li key={artifact.filename}>
                <strong>{artifact.filename}</strong>
                <span>{ARTIFACT_DESCRIPTIONS[artifact.filename] ?? 'Artefacto técnico del experimento.'}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="oe4-report-intro">AURA conserva esta evidencia, pero no la presentará como resultado formal.</p>
          <ul className="oe4-report-blockers" aria-label="Condiciones pendientes del reporte">
            {blockerSummaries.map((summary) => (
              <li key={summary.key}>
                <strong>{summary.title}</strong>
                <span>{summary.description}</span>
              </li>
            ))}
          </ul>
          <details className="oe4-report-technical">
            <summary>Ver detalle técnico</summary>
            <ul>
              {formalValidity.reasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}
            </ul>
          </details>
        </>
      )}
      <button type="button" className="btn-p" disabled={!formalValidity.valid || evidencePackage === null} onClick={exportAll}>
        Exportar 9 archivos
      </button>
    </section>
  );
};

export default CampaignReportPanel;
