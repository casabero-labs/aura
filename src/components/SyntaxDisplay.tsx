import React, { useEffect, useRef, useState } from 'react';

interface SyntaxDisplayProps {
  filename: string;
  content?: string;
  children?: React.ReactNode;
  copyText?: string;
  className?: string;
  maxHeight?: number | string;
  wrap?: boolean;
  testId?: string;
  contentTestId?: string;
  role?: React.AriaRole;
  ariaLive?: 'off' | 'polite' | 'assertive';
  autoScroll?: boolean;
}

const SyntaxDisplay: React.FC<SyntaxDisplayProps> = ({
  filename,
  content,
  children,
  copyText,
  className = '',
  maxHeight,
  wrap = true,
  testId,
  contentTestId,
  role,
  ariaLive,
  autoScroll = false,
}) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const textToCopy = copyText ?? content;

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  useEffect(() => {
    if (!autoScroll || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [autoScroll, children, content]);

  const handleCopy = async () => {
    if (textToCopy === undefined || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const bodyStyle = maxHeight === undefined ? undefined : { maxHeight };
  const bodyClassName = `syntax-display__body${wrap ? ' syntax-display__body--wrap' : ''}`;

  return (
    <div className={`syntax-display ${className}`.trim()} data-testid={testId}>
      <div className="syntax-display__head">
        <span className="syntax-display__filename">{filename}</span>
        {textToCopy !== undefined && (
          <button
            type="button"
            className="syntax-display__copy"
            onClick={handleCopy}
            aria-label={`Copiar ${filename}`}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
      {content !== undefined ? (
        <pre
          ref={bodyRef as React.RefObject<HTMLPreElement>}
          className={bodyClassName}
          style={bodyStyle}
          data-testid={contentTestId}
          role={role}
          aria-live={ariaLive}
        ><code>{content}</code></pre>
      ) : (
        <div
          ref={bodyRef as React.RefObject<HTMLDivElement>}
          className={`${bodyClassName} syntax-display__body--custom`}
          style={bodyStyle}
          data-testid={contentTestId}
          role={role}
          aria-live={ariaLive}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default SyntaxDisplay;
