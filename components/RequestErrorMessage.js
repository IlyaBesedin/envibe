import React, { useCallback } from 'react';
import { copyTextToClipboard } from '../lib/utils';

export default function RequestErrorMessage({ message, style, ...props }) {
  const handleCopy = useCallback(async (event) => {
    event.stopPropagation();
    if (!message) return;

    try {
      await copyTextToClipboard(message);
    } catch (_) {}
  }, [message]);

  return (
    <div
      {...props}
      style={{
        color: 'var(--danger)',
        textAlign: 'left',
        fontSize: '0.9rem',
        lineHeight: 1.45,
        ...style,
      }}
    >
      <div style={{ fontWeight: 600 }}>Something went wrong</div>
      <div>
        <span>You may </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            font: 'inherit',
            textDecoration: 'underline',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        >
          copy error message
        </button>
        <span> or try later</span>
      </div>
    </div>
  );
}
