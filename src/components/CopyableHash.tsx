import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyableHashProps {
  value: string;
  label: string;
  testId?: string;
}

const CopyableHash: React.FC<CopyableHashProps> = ({ value, label, testId }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <span className="diagnosis-hash-display" data-testid={testId}>
      <span className="diagnosis-hash-label">{label}</span>
      <code className="diagnosis-hash-code">{value}</code>
      <button type="button" className="diagnosis-hash-copy-btn" onClick={handleCopy} title={`Copiar ${label}`} aria-label={`Copiar ${label}`}>
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
};

export default CopyableHash;
