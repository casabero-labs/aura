import React from 'react';
import { QualityIssue, IssueSeverity, IssueCategory } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Info, ShieldAlert, Type, ListX, BrainCircuit, Activity } from 'lucide-react';

interface IssueListProps {
  issues: QualityIssue[];
}

const getSeverityIcon = (severity: IssueSeverity) => {
  const common = "text-[var(--main-color)]";
  switch (severity) {
    case IssueSeverity.CRITICAL: return <AlertCircle className="text-red-600" size={16} />;
    case IssueSeverity.WARNING: return <AlertTriangle className={common} size={16} />;
    case IssueSeverity.INFO: return <Info className={common} size={16} />;
    default: return <CheckCircle className="text-emerald-600" size={16} />;
  }
};

const getCategoryIcon = (category: IssueCategory) => {
  const common = "text-[var(--secondary-color)]";
  switch (category) {
    case IssueCategory.INTEGRITY: return <ListX size={14} className={common} />;
    case IssueCategory.HYGIENE: return <ShieldAlert size={14} className={common} />;
    case IssueCategory.TYPES: return <Type size={14} className={common} />;
    case IssueCategory.LOGIC: return <Activity size={14} className={common} />;
    case IssueCategory.SEMANTIC: return <BrainCircuit size={14} className={common} />;
    default: return <Info size={14} className={common} />;
  }
}

const IssueList: React.FC<IssueListProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--ink-muted)] m-4">
        <CheckCircle size={32} strokeWidth={1.5} className="mb-4 text-[var(--success)] opacity-40" />
        <h3 className="heading-md text-[var(--ink2)]">Estructura Saludable</h3>
        <p className="font-sans text-[13px] text-[var(--ink-muted)] mt-1">No se detectaron anomalías lógicas.</p>
      </div>
    );
  }

  const grouped = issues.reduce((acc, issue) => {
    const cat = issue.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {} as Record<string, QualityIssue[]>);

  const sortOrder = [
    IssueCategory.INTEGRITY,
    IssueCategory.HYGIENE,
    IssueCategory.TYPES,
    IssueCategory.LOGIC,
    IssueCategory.SEMANTIC
  ];

  return (
    <div className="space-y-12 p-6">
      {sortOrder.map(catKey => {
        const catIssues = grouped[catKey];
        if (!catIssues) return null;

        return (
          <div key={catKey} className="space-y-4">
            <h4 className="eyebrow text-[var(--ink2)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              {getCategoryIcon(catKey as IssueCategory)} {catKey}
            </h4>
            <div className="grid gap-2">
              {catIssues.map((issue) => (
                <div key={issue.id} className="bg-[var(--surface)] border border-[var(--border)] p-4 flex items-start gap-4 rounded-sm">
                  <div className="mt-1 flex-shrink-0">
                    {getSeverityIcon(issue.severity)}
                  </div>
                  <div className="flex-1 min-w-0" >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-[14px] font-sans font-bold text-[var(--ink)] flex items-center gap-2">
                        {issue.column && (
                          <span className="text-[10px] font-mono font-medium text-[var(--bg)] bg-[var(--ink)] px-1.5 py-0.5 rounded-sm">
                            {issue.column}
                          </span>
                        )}
                        {issue.ruleName}
                      </h4>
                      <span className="text-[11px] font-mono font-medium text-[var(--ink2)] bg-[var(--surface-raised)] px-2 py-0.5 rounded-sm">
                        {issue.count} registros
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--ink2)] leading-relaxed font-sans">{issue.description}</p>
                    {issue.sampleValues.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {issue.sampleValues.map((val, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-[var(--bg)] text-[var(--ink-soft)] text-[11px] font-mono border border-[var(--border)] rounded-sm">
                            "{String(val).substring(0, 30)}"
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IssueList;