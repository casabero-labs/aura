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
      case IssueSeverity.CRITICAL: return 'bg-red-600 text-white';
      case IssueSeverity.WARNING: return 'bg-[var(--main-color)] text-white';
      case IssueSeverity.INFO: return 'bg-[var(--technical-bg)] text-[var(--main-color)]';
      default: return 'bg-[var(--technical-bg)] text-[var(--secondary-color)]';
    }
  };

  return (
    <div className="bg-[var(--bg-color)] overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm text-[var(--secondary-color)] border-collapse">
          <thead className="bg-[var(--technical-bg)] text-[9px] uppercase font-mono font-bold tracking-[0.2em] text-[var(--secondary-color)] border-y border-[var(--border-color)]">
            <tr>
              <th className="px-6 py-4">ID_Columna</th>
              <th className="px-6 py-4">Tipo_Dato</th>
              <th className="px-6 py-4">Salud_Columna</th>
              <th className="px-6 py-4">Muestra_de_Datos</th>
              <th className="px-6 py-4 text-right">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {columns.map((col) => {
              const colIssues = getIssuesForColumn(col.name);

              return (
                <tr key={col.name} className="hover:bg-[var(--technical-bg)]/50 transition-colors group">
                  <td className="px-6 py-5 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-display font-bold text-[var(--main-color)] text-base tracking-tight italic">
                        {col.name}
                      </span>
                      {colIssues.length > 0 && (
                        <span className="text-[8px] text-red-600 font-mono font-bold uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" /> anomalía_detectada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[9px] font-mono font-bold border uppercase
                      ${col.inferredType === 'number' ? 'border-emerald-600 text-emerald-700' :
                        col.inferredType === 'mixed' ? 'border-amber-600 text-amber-700' : 'border-blue-600 text-blue-700'}`}>
                      {col.inferredType === 'number' ? <Hash size={10} /> : <FileType size={10} />}
                      {col.inferredType === 'number' ? 'número' : col.inferredType === 'mixed' ? 'mixto' : 'texto'}
                    </span>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="w-36">
                      <div className="flex justify-between text-[9px] mb-2 text-[var(--secondary-color)] font-mono font-bold uppercase">
                        <span className={col.nullCount > 0 ? "text-red-600" : ""}>{col.nullCount} NULOS</span>
                        <span>{col.uniqueCount} ÚNICOS</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--border-color)] rounded-none overflow-hidden flex">
                        <div
                          className="h-full bg-[var(--main-color)]"
                          style={{ width: `${Math.max(2, 100 - (col.nullCount / (col.nullCount + col.uniqueCount + 10)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top max-w-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {col.topFreq?.slice(0, 3).map((v, i) => (
                        <span key={i} className="px-2 py-1 bg-[var(--technical-bg)] border border-[var(--border-color)] text-[9px] font-mono rounded-none text-[var(--main-color)] hover:border-[var(--main-color)] transition-all cursor-default" title={`Frec: ${v.count}`}>
                          "{v.value === '' ? 'vacío' : v.value}"
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top text-right">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {colIssues.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-600/60 uppercase group-hover:text-emerald-600 transition-colors">
                          <ShieldCheck size={12} /> ESTADO_OK
                        </div>
                      ) : (
                        colIssues.map(issue => (
                          <div
                            key={issue.id}
                            className={`px-2 py-0.5 rounded-none text-[8px] font-mono font-bold uppercase flex items-center gap-3 shadow-sm ${getSeverityColor(issue.severity)}`}
                            title={issue.description}
                          >
                            {issue.severity === 'critical' && <AlertCircle size={8} />}
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