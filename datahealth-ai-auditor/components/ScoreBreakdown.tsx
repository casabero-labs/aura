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
            <div className="mt-4 p-4 border border-[var(--border-color)] bg-emerald-50/50">
                <p className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                    Sin penalizaciones detectadas. Integridad óptima.
                </p>
            </div>
        );
    }

    // Sort deductions by points (highest first)
    const sorted = [...deductions].sort((a, b) => b.points - a.points).slice(0, 5);

    return (
        <div className="mt-6 space-y-2">
            <h4 className="text-[9px] font-mono font-black text-[var(--secondary-color)] uppercase tracking-[0.2em] mb-3">./desglose_deducciones_salud</h4>
            <div className="grid gap-1">
                {sorted.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--technical-bg)]/40 border-l-2 border-l-[var(--main-color)] border border-[var(--border-color)] group hover:bg-[var(--technical-bg)] transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-[var(--secondary-color)] opacity-40 group-hover:opacity-100 transition-opacity">
                                {getCategoryIcon(item.category)}
                            </span>
                            <span className="text-[11px] font-display font-bold text-[var(--main-color)] uppercase tracking-tight">{item.reason}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-red-600">-{item.points} pts</span>
                        </div>
                    </div>
                ))}
                {deductions.length > 5 && (
                    <p className="text-[8px] font-mono text-[var(--secondary-color)] italic mt-1 uppercase opacity-60">
                        * Se omiten {deductions.length - 5} penalizaciones menores para brevedad.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ScoreBreakdown;
