import React from 'react';
import { ScoreDeduction, IssueCategory } from '../types';

interface ScoreBreakdownProps {
    deductions: ScoreDeduction[];
}

const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ deductions }) => {
    // Calcular el score por categoría (base 100)
    const categoryScores = {
        [IssueCategory.INTEGRITY]: 100,
        [IssueCategory.HYGIENE]: 100,
        [IssueCategory.LOGIC]: 100,
        [IssueCategory.SEMANTIC]: 100,
        [IssueCategory.TYPES]: 100,
    };

    deductions.forEach(d => {
        if (categoryScores[d.category] !== undefined) {
            categoryScores[d.category] -= d.points;
        }
    });

    // Nombres legibles para la UI
    const categoryNames = {
        [IssueCategory.INTEGRITY]: 'Integridad Estructural',
        [IssueCategory.HYGIENE]: 'Higiene Textual',
        [IssueCategory.LOGIC]: 'Lógica de Negocio',
        [IssueCategory.SEMANTIC]: 'Riesgo Semántico',
        [IssueCategory.TYPES]: 'Consistencia de Tipos',
    };

    // Filtramos las categorías relevantes o mostramos todas con sus scores reales
    const displayCategories = [
        IssueCategory.INTEGRITY,
        IssueCategory.HYGIENE,
        IssueCategory.LOGIC,
        IssueCategory.SEMANTIC
    ];

    return (
        <>
            {displayCategories.map(cat => {
                const score = Math.max(0, categoryScores[cat]); // clamp to 0
                return (
                    <div key={cat} className="bar-item">
                        <label>
                            <span>{categoryNames[cat]}</span>
                            <b>{score}%</b>
                        </label>
                        <div className="progress">
                            <span style={{ '--value': `${score}%` } as React.CSSProperties}></span>
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default ScoreBreakdown;
