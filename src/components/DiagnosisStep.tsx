import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, FlaskConical, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ShieldAlert, ListChecks, FileJson, FileText, Settings } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, checkModelDownloaded, deleteDownloadedModel } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';
import { normalizeAiProviderError, NormalizedProviderError } from '../services/providers/errors';

interface DiagnosisStepProps {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  analysisText: string;
  onAiConfigChange: (config: AIConfig) => void;
  onAnalysisComplete: (analysis: string) => void;
  onMetrics?: (metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
  onOpenLab?: () => void;
  onOpenSettings?: () => void;
}

type JsonSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export const buildDiagnosisInputSummary = (report: AuditReport) => {
  const critical = report.issues.filter((issue) => issue.severity === 'critical').length;
  const warning = report.issues.filter((issue) => issue.severity === 'warning').length;
  const affectedColumns = new Set(report.issues.map((issue) => issue.column).filter(Boolean)).size;
  const mainIssue = report.issues
    .slice()
    .sort((a, b) => b.affectedPercentage - a.affectedPercentage)[0];

  return {
    stage: 'Diagnóstico asistido',
    input: `${report.issues.length} hallazgos estructurados del perfil determinista`,
    rawDatasetAccess: false,
    problem: mainIssue
      ? `${mainIssue.ruleName} en ${mainIssue.column || 'dataset'} afecta ${mainIssue.affectedPercentage.toFixed(2)}% de registros.`
      : 'No hay hallazgos críticos; el diagnóstico puede documentar estabilidad y riesgos residuales.',
    risk: `${critical} críticos, ${warning} advertencias, ${affectedColumns} columnas afectadas`,
    output: 'causas probables, prioridades de limpieza y criterios para generar script',
  };
};

const JsonSection: React.FC<JsonSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="json-section">
      <button className="json-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`json-caret ${open ? 'open' : ''}`}>›</span>
        <span>{title}</span>
      </button>
      {open && <div className="json-section-content">{children}</div>}
    </div>
  );
};

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
  report,
  auditEvidence,
  aiConfig,
  aiProvider,
  analysisText,
  onAiConfigChange,
  onAnalysisComplete,
  onMetrics,
  onLog,
  onContinue,
  onOpenLab,
  onOpenSettings,
}) => {
  const [draftAnalysis, setDraftAnalysis] = useState(analysisText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedError, setNormalizedError] = useState<NormalizedProviderError | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  useEffect(() => {
    if (aiConfig.providerType === 'local') {
      const checkDownloads = async () => {
        const downloaded = new Set<string>(
          Object.entries(aiConfig.modelDownloadState || {})
            .filter(([, state]) => state.status === 'ready')
            .map(([modelId]) => modelId),
        );
        for (const model of LOCAL_MODELS) {
          if (await checkModelDownloaded(model.id)) {
            downloaded.add(model.id);
          }
        }
        setDownloadedModels(downloaded);
      };
      checkDownloads();
    }
  }, [aiConfig.providerType, aiConfig.modelDownloadState]);

  const handleDeleteModel = async (modelId: string) => {
    setDeletingModel(modelId);
    const success = await deleteDownloadedModel(modelId);
    if (success) {
      setDownloadedModels(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
    setDeletingModel(null);
  };

  React.useEffect(() => {
    aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
  }, [aiProvider]);

  React.useEffect(() => {
    setDraftAnalysis(analysisText);
  }, [analysisText]);

  const smartSample = React.useMemo(() => buildSmartSample(report), [report]);
  const diagnosisPrompt = React.useMemo(() => buildAnalysisPrompt(report, aiConfig.promptContract, aiConfig.inputMode), [report, aiConfig.promptContract, aiConfig.inputMode]);
  const diagnosisSummary = React.useMemo(() => buildDiagnosisInputSummary(report), [report]);

  const downloadTextFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportDiagnosisJson = () => {
    if (!draftAnalysis.trim()) return;
    const profile = {
      dataset: {
        rows: report.rowCount,
        columns: report.colCount,
        delimiter: report.delimiterDetected,
        score: report.score,
        duplicateRows: report.duplicateRows,
        datasetFingerprint: auditEvidence?.datasetFingerprint,
      },
      columnStats: report.columnStats,
      issues: report.issues,
      auditEvidence,
    };
    downloadTextFile(
      `aura_reporte_perfil_diagnostico_${Date.now()}.json`,
      JSON.stringify({
        reportType: 'perfil_determinista_y_diagnostico_llm',
        generatedAt: new Date().toISOString(),
        profile,
        provider: aiConfig.providerType,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash: computePromptHash(diagnosisPrompt),
        inputSummary: diagnosisSummary,
        smartSample,
        diagnosis: draftAnalysis,
        metrics: lastMetrics,
      }, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const exportDiagnosisPdf = async () => {
    if (!draftAnalysis.trim()) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const margin = 16;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    let y = 18;
    const draw = (text: string, size = 10, gap = 6) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, width);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += gap;
      });
    };

    doc.setFont('helvetica', 'bold');
    draw('AURA - Reporte consolidado: perfil del dataset y diagnostico LLM', 15, 8);
    doc.setFont('helvetica', 'normal');
    draw(`Dataset: ${report.rowCount.toLocaleString('es-CO')} filas · ${report.colCount} columnas · delimitador "${report.delimiterDetected}" · score ${report.score}/100`, 9, 5);
    draw(`Modelo: ${aiConfig.model} · Proveedor: ${aiConfig.providerType} · Temperatura: ${aiConfig.temperature}`, 9, 5);
    draw(`Prompt hash: ${computePromptHash(diagnosisPrompt)}`, 8, 5);
    y += 4;
    doc.setFont('helvetica', 'bold');
    draw('1. Perfil determinista del dataset', 11, 6);
    doc.setFont('helvetica', 'normal');
    draw(`Duplicados exactos: ${report.duplicateRows}. Reglas activadas: ${report.issues.length}. Evidencia: ${auditEvidence?.datasetFingerprint || 'sin fingerprint'}.`, 9, 5);
    draw(`Columnas observadas: ${Object.keys(report.columnStats).join(', ')}`, 8, 4);
    y += 3;
    doc.setFont('helvetica', 'bold');
    draw('2. Hallazgos deterministas principales', 11, 6);
    doc.setFont('helvetica', 'normal');
    report.issues.slice(0, 10).forEach((issue, index) => {
      draw(`${index + 1}. ${issue.severity.toUpperCase()} · ${issue.ruleName}${issue.column ? ` · ${issue.column}` : ''}: ${issue.description}`, 8, 4);
    });
    y += 3;
    doc.setFont('helvetica', 'bold');
    draw('3. Problema observado', 11, 6);
    doc.setFont('helvetica', 'normal');
    draw(diagnosisSummary.problem, 9, 5);
    y += 3;
    doc.setFont('helvetica', 'bold');
    draw('4. Diagnostico LLM generado', 11, 6);
    doc.setFont('helvetica', 'normal');
    draw(draftAnalysis.replace(/[#*_`]/g, ''), 9, 5);
    doc.save(`aura_reporte_perfil_diagnostico_${Date.now()}.pdf`);
  };

  const handleProviderTypeChange = (type: 'local' | 'cloud') => {
    const models = type === 'local'
      ? AVAILABLE_MODELS.local
      : AVAILABLE_MODELS.cloud.filter(m => {
          if (!aiConfig.apiKey) return false;
          if (m.provider === 'Google') return aiConfig.cloudProvider === 'google';
          return true;
        });
    const firstModel = type === 'local'
      ? models.find((model) => model.id === aiConfig.model) || models.find((model) => downloadedModels.has(model.id)) || models[0]
      : models[0];
    onAiConfigChange({
      ...aiConfig,
      providerType: type,
      model: firstModel?.id || aiConfig.model,
      cloudProvider: type === 'cloud'
        ? (firstModel?.provider?.toLowerCase() as AIConfig['cloudProvider'])
        : undefined,
    });
  };

  const handleModelChange = (modelId: string) => {
    const cloudModel = AVAILABLE_MODELS.cloud.find(m => m.id === modelId);
    onAiConfigChange({
      ...aiConfig,
      model: modelId,
      cloudProvider: cloudModel
        ? (cloudModel.provider.toLowerCase() as AIConfig['cloudProvider'])
        : aiConfig.cloudProvider,
    });
  };

  const availableModels = aiConfig.providerType === 'local'
    ? AVAILABLE_MODELS.local
    : AVAILABLE_MODELS.cloud.filter(m => {
        if (!aiConfig.apiKey) return false;
        if (m.provider === 'Google') return aiConfig.cloudProvider === 'google';
        return true;
      });

  const runDiagnosis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setDraftAnalysis('');
    let finalText = '';

    const prompt = diagnosisPrompt;
    const promptHash = computePromptHash(prompt);
    const inputHash = computeInputHash(report);

    onLog?.('diagnosis', `Iniciando diagnóstico con ${aiConfig.model} (${aiConfig.providerType})`);

    try {
      const { text, metrics } = await aiProvider.generateText(prompt);
      finalText = text;
      setDraftAnalysis(text);
      setLastMetrics(metrics);
      onMetrics?.(metrics);
      onAnalysisComplete(finalText);
      onLog?.('diagnosis', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${metrics.latencyMs}ms`);

      recordLlmCall({
        callType: 'diagnosis',
        providerType: aiConfig.providerType as 'local' | 'cloud',
        provider: aiConfig.providerType === 'local' ? 'WebLLM' : (aiConfig.cloudProvider || 'Cloud'),
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash,
        promptText: prompt,
        inputJsonHash: inputHash,
        promptLength: prompt.length,
        inputColumnCount: report.colCount,
        inputIssueCount: report.issues.length,
        rowCount: report.rowCount,
        colCount: report.colCount,
        datasetFingerprint: auditEvidence?.datasetFingerprint || '',
        responseLength: finalText.length,
        latencyMs: metrics.latencyMs,
        tokensGenerated: metrics.tokensGenerated,
        status: 'completed',
      });
    } catch (err: any) {
      const normalized = normalizeAiProviderError(err, aiConfig);
      setError(normalized.message);
      setNormalizedError(normalized);
      onLog?.('diagnosis', `Error: ${normalized.title} - ${normalized.message}`);

      recordLlmCall({
        callType: 'diagnosis',
        providerType: aiConfig.providerType as 'local' | 'cloud',
        provider: aiConfig.providerType === 'local' ? 'WebLLM' : (aiConfig.cloudProvider || 'Cloud'),
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash,
        promptText: prompt,
        inputJsonHash: inputHash,
        promptLength: prompt.length,
        inputColumnCount: report.colCount,
        inputIssueCount: report.issues.length,
        rowCount: report.rowCount,
        colCount: report.colCount,
        datasetFingerprint: auditEvidence?.datasetFingerprint || '',
        responseLength: finalText.length,
        latencyMs: 0,
        tokensGenerated: 0,
        status: 'error',
        error: normalized.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig.model, aiConfig.providerType, aiConfig.cloudProvider, aiConfig.temperature, aiProvider, isLoading, onAnalysisComplete, onLog, onMetrics, report, auditEvidence, diagnosisPrompt]);

  const isCloud = aiConfig.providerType === 'cloud';
  const hasDiagnosis = draftAnalysis.trim().length > 0;

  return (
    <>
      {/* ── COMPACT DIAGNOSIS ── */}
      <section className="diagnosis-compact">
        <div className="diagnosis-compact-header">
          <p className="sec-eye">diagnóstico asistido</p>
          <h2 className="sec-title">Interpretar los problemas de calidad.</h2>
        </div>

        {/* Problem Summary */}
        <div className="diagnosis-problem-grid">
          <article className="diagnosis-problem-card diagnosis-problem-card--primary">
            <AlertTriangle size={16} />
            <span>principal señal de calidad</span>
            <strong>{diagnosisSummary.problem}</strong>
          </article>
          <article className="diagnosis-problem-card">
            <ListChecks size={16} />
            <span>riesgo agregado</span>
            <strong>{diagnosisSummary.risk}</strong>
          </article>
          <article className="diagnosis-problem-card">
            <Database size={16} />
            <span>dataset</span>
            <strong>{report.colCount} columnas, {report.rowCount.toLocaleString('es-CO')} filas, score {report.score}/100</strong>
          </article>
        </div>

        {/* Privacy notice */}
        <div className={`privacy-notice ${isCloud ? 'privacy-notice--cloud' : 'privacy-notice--local'}`} style={{ marginBottom: 'var(--space-md)' }}>
          {isCloud ? (
            <>
              <Globe size={14} />
              <div>
                <strong>Cloud</strong>
                <p>Se envía el paquete estructurado, no el archivo completo.</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} />
              <div>
                <strong>Local-first</strong>
                <p>Diagnóstico en el navegador. Sin envío de datos.</p>
              </div>
            </>
          )}
        </div>

        {/* Model selector — compact inline */}
        <div className="diagnosis-model-bar">
          <div className="model-type-toggle" style={{ flex: 'none' }}>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'local' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('local')}
            >
              Local
            </button>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'cloud' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('cloud')}
            >
              Cloud
            </button>
          </div>
          <select
            className="model-select"
            value={aiConfig.model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {availableModels.length === 0 && (
              <option disabled>Sin modelos disponibles</option>
            )}
            {availableModels.map(model => {
              const isDownloaded = downloadedModels.has(model.id);
              return (
                <option key={model.id} value={model.id}>
                  {model.name}{isDownloaded ? ' · descargado' : ''}
                </option>
              );
            })}
          </select>
          <button
            className="btn-p"
            onClick={runDiagnosis}
            disabled={isLoading || providerAvailable === false}
            title={providerAvailable === false ? 'Proveedor no disponible' : 'Ejecutar diagnóstico asistido'}
          >
            <Brain size={14} />
            {isLoading ? 'Diagnosticando' : hasDiagnosis ? 'Regenerar diagnóstico' : 'Generar diagnóstico'}
          </button>
        </div>

        {isLoading && (
          <div className="diagnosis-loading" style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--ink3)' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-soft)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            {' '}Generando diagnóstico con {aiConfig.model}...
          </div>
        )}

        {providerAvailable === false && (
          <div className="provider-unavailable-notice">
            <div className="provider-unavailable-header">
              <ShieldAlert size={16} style={{ color: 'var(--orange)' }} />
              <strong>Proveedor LLM no disponible</strong>
            </div>
            <ul className="provider-unavailable-reasons">
              {aiConfig.providerType === 'cloud' && !aiConfig.apiKey && (
                <li>No hay API key configurada para el proveedor cloud. Agrégala en Configuración.</li>
              )}
              {aiConfig.providerType === 'cloud' && aiConfig.apiKey && (
                <li>El proveedor cloud no responde. Verifica la API key y la conectividad en Configuración.</li>
              )}
              {aiConfig.providerType === 'local' && (
                <li>WebGPU o modelo local no está disponible en este navegador. Requiere Chrome/Edge con soporte WebGPU.</li>
              )}
              {aiConfig.providerType === 'chrome' && (
                <li>Chrome AI (Prompt API) no está disponible. Actívala en chrome://flags o usa otro proveedor.</li>
              )}
            </ul>
            <div className="provider-unavailable-actions">
              <p>
                <strong>Puedes continuar con script determinista.</strong> El motor de reglas no depende del LLM.
              </p>
              <p className="provider-unavailable-note">
                Continuar sin diagnóstico LLM no genera evidencia formal de IA. El intento fallido se registra como <code>attempted_failed</code>, no como resultado válido.
              </p>
            </div>
          </div>
        )}

        {error && normalizedError && (
          <div className="provider-error-notice" style={{ 
            marginTop: 'var(--space-sm)',
            padding: 'var(--space-md)',
            background: 'var(--error-surface)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
              <strong style={{ color: 'var(--error)' }}>{normalizedError.title}</strong>
            </div>
            <p style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--ink2)' }}>{normalizedError.message}</p>
            <p style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--ink3)', fontStyle: 'italic' }}>Causa: {normalizedError.cause}</p>
            
            {normalizedError.recommendedActions.length > 0 && (
              <div style={{ marginTop: 'var(--space-xs)' }}>
                <p style={{ margin: '0 0 var(--space-xs) 0', fontWeight: 500 }}>Acciones sugeridas:</p>
                <ul style={{ margin: 0, paddingLeft: 'var(--space-md)' }}>
                  {normalizedError.recommendedActions.map((action, index) => (
                    <li key={index} style={{ marginBottom: '2px' }}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              <button 
                className="btn-s btn-sm"
                onClick={() => onOpenSettings?.()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Settings size={12} /> Abrir Configuración
              </button>
              
              {aiConfig.providerType === 'local' && (
                <button
                  className="btn-s btn-sm"
                  onClick={async () => {
                    const success = await deleteDownloadedModel(aiConfig.model);
                    if (success) {
                      alert('Modelo eliminado. Intenta descargarlo nuevamente desde Configuración.');
                      // Actualizar estado local
                      setDownloadedModels(prev => {
                        const next = new Set(prev);
                        next.delete(aiConfig.model);
                        return next;
                      });
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={12} /> Limpiar modelo cacheado
                </button>
              )}
              
              <button
                className="btn-s btn-sm"
                onClick={onContinue}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Play size={12} /> Continuar con script determinista
              </button>
            </div>
            
            <p style={{ marginTop: 'var(--space-xs)', fontSize: '10px', color: 'var(--ink3)' }}>
              El diagnóstico LLM no se completó. No hay evidencia formal de IA. 
              El motor de reglas determinista puede generar un script base.
            </p>
          </div>
        )}

        {/* Diagnosis result */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <GeminiAdvisor
            analysis={draftAnalysis}
            isLoading={isLoading}
            providerType={aiConfig.providerType as 'local' | 'cloud'}
            model={aiConfig.model}
          />
        </div>

        {lastMetrics && !isLoading && (
          <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: 'var(--space-xs)', display: 'flex', gap: 'var(--space-md)' }}>
            <span>{(lastMetrics.latencyMs / 1000).toFixed(1)}s</span>
            <span>{lastMetrics.tokensGenerated} tokens</span>
          </div>
        )}

        {/* Export buttons */}
        {hasDiagnosis && (
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-xs)' }}>
            <button className="btn-s btn-sm" onClick={exportDiagnosisPdf}>
              <FileText size={12} /> PDF consolidado
            </button>
            <button className="btn-s btn-sm" onClick={exportDiagnosisJson}>
              <FileJson size={12} /> JSON consolidado
            </button>
          </div>
        )}
      </section>

      {/* ── PRIMARY CTA ── */}
      <div className="context-guide">
        <span className="guide-icon"><Play size={14} /></span>
        <div>
          <p className="guide-title">Generar script de limpieza</p>
          <p className="guide-desc">El script usa los hallazgos deterministas y el diagnóstico como anclaje. Si el proveedor no responde, se genera un script base.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue}>
          Generar script <Play size={12} />
        </button>
      </div>

      {/* ── TECHNICAL DETAILS ── */}
      <details className="technical-details">
        <summary className="technical-details-summary">
          <ChevronDown size={14} className="technical-details-chevron" />
          <span>Detalles técnicos</span>
          <span className="technical-details-hint">modelo, paquete estructurado, contrato técnico y calibración</span>
        </summary>
        <div className="technical-details-body">

          {/* Downloaded models management (local only) */}
          {aiConfig.providerType === 'local' && downloadedModels.size > 0 && (
            <div className="downloaded-models-list" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="downloaded-models-header">
                <HardDrive size={10} />
                <span>Modelos descargados ({downloadedModels.size})</span>
              </div>
              {Array.from(downloadedModels).map(modelId => {
                const modelInfo = LOCAL_MODELS.find(m => m.id === modelId);
                if (!modelInfo) return null;
                return (
                  <div key={modelId} className="downloaded-model-item">
                    <span className="downloaded-model-name">{modelInfo.name}</span>
                    <span className="downloaded-model-size">{modelInfo.sizeGB} GB</span>
                    <button
                      className="delete-model-btn"
                      onClick={() => handleDeleteModel(modelId)}
                      disabled={deletingModel === modelId || modelId === aiConfig.model}
                      title={modelId === aiConfig.model ? 'No se puede eliminar el modelo activo' : 'Eliminar modelo'}
                    >
                      {deletingModel === modelId ? '...' : <Trash2 size={10} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lab CTA — secondary */}
          {onOpenLab && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)', background: 'var(--surface)' }}>
              <FlaskConical size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--ink2)', flex: 1 }}>Calibrar diagnóstico en Laboratorio</span>
              <button className="btn-s btn-sm" onClick={onOpenLab}>Abrir</button>
            </div>
          )}

          {/* Smart sample JSON */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <button
              className="btn-s btn-sm"
              onClick={() => setShowEvidence(!showEvidence)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {showEvidence ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {showEvidence ? 'Ocultar paquete estructurado' : 'Ver paquete estructurado'}
            </button>
            {showEvidence && (
              <div className="smart-sample-viewer" style={{ marginTop: 'var(--space-sm)' }}>
                <div className="smart-sample-header">
                  <div className="smart-sample-title">
                    <FileCode2 size={14} />
                    <span>PAQUETE ESTRUCTURADO</span>
                  </div>
                </div>
                <div className="smart-sample-body">
                  <JsonSection title={`context — ${Object.keys(smartSample.context).length} campos`} defaultOpen>
                    <div className="json-kv">
                      <span className="json-line"><span className="json-key">"total_rows"</span>: <span className="json-number">{smartSample.context.total_rows}</span>,</span>
                      <span className="json-line"><span className="json-key">"total_columns"</span>: <span className="json-number">{smartSample.context.total_columns}</span>,</span>
                      <span className="json-line"><span className="json-key">"detected_delimiter"</span>: <span className="json-string">"{smartSample.context.detected_delimiter}"</span>,</span>
                      <span className="json-line"><span className="json-key">"quality_score"</span>: <span className="json-number">{smartSample.context.quality_score}</span></span>
                    </div>
                  </JsonSection>
                  <JsonSection title={`columns — ${smartSample.columns.length} columnas`}>
                    <pre className="json-raw">{JSON.stringify(smartSample.columns, null, 2)}</pre>
                  </JsonSection>
                  <JsonSection title={`detected_issues — ${smartSample.detected_issues.length} reglas activadas`}>
                    <pre className="json-raw">{JSON.stringify(smartSample.detected_issues, null, 2)}</pre>
                  </JsonSection>
                </div>
              </div>
            )}
          </div>

        </div>
      </details>

      {/* ── Prompt modal ── */}
      {showPrompt && (
        <div className="prompt-modal" onClick={() => setShowPrompt(false)}>
          <div className="prompt-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prompt-modal-header">
              <h3>Contrato técnico de interpretación</h3>
              <button className="prompt-modal-close" onClick={() => setShowPrompt(false)}><X size={14} /></button>
            </div>
            <pre className="prompt-modal-body">{diagnosisPrompt}</pre>
            <div className="prompt-modal-footer">
              <span>{diagnosisPrompt.length.toLocaleString('es-CO')} chars</span>
              <span>{computePromptHash(diagnosisPrompt)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiagnosisStep;
