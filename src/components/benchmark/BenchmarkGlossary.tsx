import React from 'react';
import { BENCHMARK_GLOSSARY } from '../../services/benchmark/benchmarkGlossary';

const BenchmarkGlossary: React.FC = () => {
  const categories = [...new Set(BENCHMARK_GLOSSARY.map((entry) => entry.category))];
  return (
    <section className="oe4-panel oe4-glossary" aria-labelledby="oe4-glossary-title">
      <div className="oe4-panel-heading">
        <div>
          <p className="oe4-eyebrow">Guía en lenguaje sencillo</p>
          <h2 id="oe4-glossary-title">Glosario para entender los resultados</h2>
          <p>Abre cada grupo cuando necesites traducir una métrica o parámetro técnico.</p>
        </div>
      </div>
      <div className="oe4-glossary-groups">
        {categories.map((category) => (
          <details key={category} open={category === 'Referencia' || category === 'Calidad'}>
            <summary>{category}</summary>
            <dl>
              {BENCHMARK_GLOSSARY.filter((entry) => entry.category === category).map((entry) => (
                <div key={entry.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.plainDefinition}<small>Ejemplo: {entry.example}</small></dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
};

export default BenchmarkGlossary;
