import React, { useCallback, useState } from 'react';
import { ArrowRight, FileCode2, ShieldCheck } from 'lucide-react';
import { AIProvider, AuditReport, ProviderMetrics, ScriptValidationResult } from '../types';

interface ScriptGenerationStepProps {
  report: AuditReport;
  aiProvider: AIProvider;
  cleaningScript: string;
  scriptValidation: ScriptValidationResult | null;
  onScriptGenerated: (script: string, metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
}

const ScriptGenerationStep: React.FC<ScriptGenerationStepProps> = ({
  report,
  aiProvider,
  cleaningScript,
  scriptValidation,
  onScriptGenerated,
  onLog,
  onContinue,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingMetrics, setStreamingMetrics] = useState<ProviderMetrics | null>(null);

  const generateScript = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setStreamingText('');
    setStreamingMetrics(null);
    onLog?.('script', 'Generando script de limpieza (streaming)');

    try {
      const { content, metrics } = await aiProvider.generateExecutiveReportStream(report, (chunk) => {
        setStreamingText((prev) => prev + chunk);
      });

      if (!content.python_script) {
        setError('El modelo no generó un script Python/Pandas.');
        onLog?.('script', 'Sin python_script en la respuesta');
        return;
      }

      onScriptGenerated(content.python_script, metrics);
      setStreamingMetrics(metrics);
      onLog?.('script', `Script generado · ${content.python_script.split('\n').length} líneas · ${metrics.latencyMs}ms`);
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido generando script';
      setError(msg);
      onLog?.('script', `Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [aiProvider, isLoading, onLog, onScriptGenerated, report]);

  return (
    <>
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">acciones sugeridas</p>
            <h2 className="sec-title">Generar script de limpieza.</h2>
          </div>
        </header>
        <p className="section-note">
          El script se genera a partir del diagnóstico y de los hallazgos del perfil. AURA valida columnas,
          operaciones destructivas y cobertura de issues antes de que un humano pueda aprobarlo.
        </p>

        <div className="benchmark-protocol mt-6">
          <div>
            <span>hallazgos base</span>
            <strong>{report.issues.length}</strong>
          </div>
          <div>
            <span>script</span>
            <strong>{cleaningScript ? `${cleaningScript.split('\n').length} líneas` : 'pendiente'}</strong>
          </div>
          <div>
            <span>validación</span>
            <strong>{scriptValidation ? (scriptValidation.valid ? 'válido' : 'requiere revisión') : 'pendiente'}</strong>
          </div>
        </div>

        <div className="mt-6">
          <button className="btn-p" onClick={generateScript} disabled={isLoading}>
            <FileCode2 size={14} />
            {isLoading ? 'Generando' : cleaningScript ? 'Regenerar script' : 'Generar script'}
          </button>
        </div>

        {isLoading && streamingText && (
          <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="animate-pulse w-2 h-2 rounded-full bg-[var(--accent)]" />
              <strong className="text-sm">Generando (razonamiento visible)</strong>
            </div>
            <div className="text-xs text-[var(--ink-muted)] font-mono max-h-64 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
              {streamingText}
            </div>
          </div>
        )}

        {streamingMetrics && !isLoading && (
          <div className="mt-4 flex gap-4 text-xs text-[var(--ink-muted)]">
            <span>⏱ {streamingMetrics.latencyMs}ms</span>
            <span>🔤 {streamingMetrics.tokensGenerated} tokens</span>
            <span>🖥 {streamingMetrics.isLocal ? 'Local' : 'Cloud'}</span>
          </div>
        )}

        {error && (
          <p className="section-note mt-4" style={{ color: 'var(--accent)' }}>{error}</p>
        )}

        {scriptValidation && scriptValidation.warnings.length > 0 && (
          <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} />
              <strong>Validación automática</strong>
            </div>
            <ul className="mt-3 text-sm text-[var(--ink-muted)]">
              {scriptValidation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {cleaningScript && (
          <div className="mt-6">
            <div className="script-review">
              <div className="script-review-header">
                <div className="flex items-center gap-2">
                  <FileCode2 size={14} className="text-[var(--ink)]" />
                  <span className="eyebrow text-[var(--ink)]">Vista previa del script generado</span>
                </div>
              </div>
              <div className="script-governance-note">
                <ShieldCheck size={14} />
                <p>Esta etapa solo genera y valida. La aprobación humana ocurre en la siguiente pantalla.</p>
              </div>
              <div className="script-code-shell">
                <div className="script-scroll custom-scrollbar">
                  <pre className="script-code">
                    {cleaningScript.split('\n').map((line, index) => (
                      <span key={`${index}-${line}`} className="script-line">
                        <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                        <code>{line || ' '}</code>
                      </span>
                    ))}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Siguiente paso: revisión final</p>
          <p className="guide-desc">Con el script generado y aprobado, puedes simular el impacto y preparar la exportación.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!cleaningScript}>
          Ir a revisión <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
};

export default ScriptGenerationStep;
