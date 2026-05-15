import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ScoreGaugeProps {
  score: number;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];

  let color = 'var(--error)';
  if (score >= 60) color = 'var(--ink-soft)';
  if (score >= 85) color = 'var(--ink)';

  return (
    <div className="relative h-32 w-32 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={55}
            startAngle={180}
            endAngle={0}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="score" fill={color} />
            <Cell key="bg" fill="var(--border)" opacity={0.5} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreGauge;