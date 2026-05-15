import React from 'react';
import { ColumnStats, QualityIssue, IssueSeverity } from '../types';
import { AlertCircle, FileType, Hash, AlignLeft, ShieldCheck, AlertTriangle } from 'lucide-react';

interface DataProfileProps {
  stats: Record<string, ColumnStats>;
  issues: QualityIssue[];
}

const DataProfile: React.FC<DataProfileProps> = ({ stats, issues }) => {
  const columns = Object.values(stats);

  const getIssuesForColumn = (colName: string) => {
    return issues.filter(i => i.column === colName);
  };

  const getSeverityColor = (severity: IssueSeverity) => {
    switch (severity) {
      case IssueSeverity.CRITICAL: return 'bg-[var(--error)] text-[var(--bg)] border-[var(--error)]';
      case IssueSeverity.WARNING: return 'bg-[var(--ink-soft)] text-[var(--bg)] border-[var(--ink-soft)]';
      case IssueSeverity.INFO: return 'bg-[var(--surface-raised)] text-[var(--ink)] border-[var(--border)]';
      default: return 'bg-[var(--surface-raised)] text-[var(--ink2)] border-[var(--border)]';
    }
  };

  return (
    <div className="bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[var(--ink2)] border-collapse">
          <thead className="bg-[var(--surface-raised)] border-y border-[var(--border)]">
            <tr>
              <th className="px-6 py-4 eyebrow text-[var(--ink2)]">Columna</th>
              <th className="px-6 py-4 eyebrow text-[var(--ink2)]">Tipo de Dato</th>
              <th className="px-6 py-4 eyebrow text-[var(--ink2)]">Salud (Nulos/Únicos)</th>
              <th className="px-6 py-4 eyebrow text-[var(--ink2)]">Muestra</th>
              <th className="px-6 py-4 eyebrow text-[var(--ink2)] text-right">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {columns.map((col) => {
              const colIssues = getIssuesForColumn(col.name);

              return (
                <tr key={col.name} className="hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-serif font-bold text-[var(--ink)] text-[15px]">
                        {col.name}
                      </span>
                      {colIssues.length > 0 && (
                        <span className="text-[11px] text-[var(--error)] font-sans font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> Requiere atención
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex items-center gap-1 text-[13px] font-sans font-medium text-[var(--ink2)]">
                      {col.inferredType === 'number' ? <Hash size={14} /> : <FileType size={14} />}
                      <span className="capitalize">{col.inferredType === 'number' ? 'Numérico' : col.inferredType === 'mixed' ? 'Mixto' : 'Texto'}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="w-40">
                      <div className="flex justify-between text-[11px] mb-2 text-[var(--ink2)] font-sans font-medium">
                        <span className={col.nullCount > 0 ? "text-[var(--error)] font-bold" : ""}>{col.nullCount} Nulos</span>
                        <span>{col.uniqueCount} Únicos</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface-raised)] rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[var(--ink-muted)] rounded-full"
                          style={{ width: `${Math.max(2, 100 - (col.nullCount / (col.nullCount + col.uniqueCount + 10)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top max-w-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {col.topFreq?.slice(0, 3).map((v, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono rounded-sm text-[var(--ink)]" title={`Frec: ${v.count}`}>
                          "{v.value === '' ? 'vacío' : v.value}"
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {colIssues.length === 0 ? (
                        <div className="flex items-center gap-1 text-[12px] font-sans font-medium text-[var(--success)] opacity-80">
                          <ShieldCheck size={14} /> Íntegro
                        </div>
                      ) : (
                        colIssues.map(issue => (
                          <div
                            key={issue.id}
                            className={`px-2 py-1 rounded-sm text-[10px] font-sans font-semibold uppercase flex items-center gap-1.5 border ${getSeverityColor(issue.severity)}`}
                            title={issue.description}
                          >
                            {issue.severity === 'critical' && <AlertCircle size={10} />}
                            {issue.ruleName}
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataProfile;