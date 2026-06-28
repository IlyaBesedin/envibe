import React from 'react';
import RequestErrorMessage from './RequestErrorMessage';

export default function AddDictionaryModal({
  isOpen,
  onClose,
  title,
  onTitleChange,
  language,
  onLanguageChange,
  success,
  isLoading,
  error,
  isRequestError,
  onSubmit,
}) {
  if (!isOpen) return null;

  const inputStyle = { padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Add new dictionary"
      data-testid="add-dictionary-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          width: 'min(480px, 95vw)',
          borderRadius: '0.6rem',
          boxShadow: 'var(--shadow-elevated)',
          padding: '1rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Title</span>
          <input
            data-testid="add-dictionary-title-input"
            maxLength={36}
            value={title}
            onChange={(e) => onTitleChange(e.target.value.slice(0, 36))}
            placeholder="Enter dictionary title"
            onKeyDown={(e) => e.stopPropagation()}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Language</span>
          <input
            data-testid="add-dictionary-language-input"
            maxLength={16}
            value={language}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^\p{L}]/gu, '').slice(0, 16);
              onLanguageChange(filtered);
            }}
            placeholder="Enter language"
            onKeyDown={(e) => e.stopPropagation()}
            style={inputStyle}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', alignContent: 'center' }}>
          {success && (
            <div data-testid="add-dictionary-success" style={{ flex: '1 1 200px', textAlign: 'left', paddingLeft: '0.65rem', color: 'var(--accent-strong)', marginRight: 'auto' }}>
              Dictionary successfully added
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="add-dictionary-submit"
              onClick={(e) => {
                e.stopPropagation();
                onSubmit();
              }}
              disabled={isLoading}
              style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', color: 'var(--text-on-accent)', cursor: isLoading ? 'default' : 'pointer', WebkitAppearance: 'none', appearance: 'none', opacity: isLoading ? 0.85 : 1 }}
            >
              {isLoading ? (
                <span className="add-button-dots" aria-live="polite">
                  <span className="add-button-dot" />
                  <span className="add-button-dot" />
                  <span className="add-button-dot" />
                </span>
              ) : (
                'Add'
              )}
            </button>
            <button
              type="button"
              data-testid="add-dictionary-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
            >
              Close
            </button>
          </div>
        </div>
        {error && (
          isRequestError ? (
            <RequestErrorMessage data-testid="add-dictionary-error" message={error} />
          ) : (
            <div data-testid="add-dictionary-error" style={{ color: 'var(--danger)', textAlign: 'left', fontSize: '0.9rem' }}>{error}</div>
          )
        )}
      </div>
    </div>
  );
}
