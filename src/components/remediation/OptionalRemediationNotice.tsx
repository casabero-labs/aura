import React from 'react';
import { Info } from 'lucide-react';

const OptionalRemediationNotice: React.FC = () => (
  <div className="companion-note" data-testid="optional-remediation-notice">
    <Info size={16} />
    <div>
      <p>
        <strong>Rama opcional de remediación.</strong> Estás en una rama opcional. El informe
        diagnóstico ya puede exportarse sin necesidad de generar un script.
      </p>
      <p>
        El script de limpieza es una <strong>recomendación</strong>, no una obligación para cerrar
        el análisis. La revisión humana (HITL) aplica únicamente si decides aprobar y simular un
        script de remediación.
      </p>
      <p>
        La reauditoría te permite comparar los hallazgos antes/después si decides limpiar una
        copia del dataset. Podés volver al informe diagnóstico o a la Exportación en cualquier
        momento.
      </p>
    </div>
  </div>
);

export default OptionalRemediationNotice;
