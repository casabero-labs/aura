import React from 'react';
import { ScoreDeduction, IssueCategory } from '../types';
import { MinusCircle, ShieldAlert, Zap, Layers, Activity, BrainCircuit } from 'lucide-react';

interface ScoreBreakdownProps {
    deductions: ScoreDeduction[];
}

const getCategoryIcon = (category: IssueCategory) => {
    const size = 12;
    switch (category) {
        case IssueCategory.INTEGRITY: return <ShieldAlert size={size} />;
        case IssueCategory.HYGIENE: return <Zap size={size} />;
        case IssueCategory.TYPES: return <Layers size={size} />;
        case IssueCategory.LOGIC: return <Activity size={size} />;
        case IssueCategory.SEMANTIC: return <BrainCircuit size={size} />;
        default: return <MinusCircle size={size} />;
    }
};

const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ deductions }) => {
    if (deductions.length === 0) {
        return (
            <div className="mt-4 p-4 border border-[var(--border)] bg-[var(--surface)] rounded-sm">
                <p className="text-[12px] font-sans font-medium text-[var(--success)] flex items-center gap-2">
                    Sin penalizaciones estructurales. Integridad óptima.
                </p>
            </div>
        );
    }

    // Sort deductions by points (highest first)
    const sorted = [...deductions].sort((a, b) => b.points - a.points).slice(0, 5);

    return (
        <div className="mt-6 space-y-2">
            <h4 className="eyebrow text-[var(--ink2)] mb-3">Factores de Riesgo Estructural</h4>
            <div className="grid gap-1">
                {sorted.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--surface-raised)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors rounded-sm">
                        <div className="flex items-center gap-3">
                            <span className="text-[var(--ink2)] opacity-70">
                                {getCategoryIcon(item.category)}
                            </span>
                            <span className="text-[12px] font-sans font-medium text-[var(--ink)] tracking-tight">{item.reason}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-medium text-[var(--error)]">-{item.points} pts</span>
                        </div>
                    </div>
                ))}
                {deductions.length > 5 && (
                    <p className="text-[11px] font-serif text-[var(--ink-muted)] italic mt-2">
                        * Se omiten {deductions.length - 5} penalizaciones menores para brevedad.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ScoreBreakdown;
