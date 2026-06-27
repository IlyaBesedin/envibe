import React from 'react';
import { WORD_INPUT_MAX_LENGTH } from '../lib/constants';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../lib/translationLanguages';
import RequestErrorMessage from './RequestErrorMessage';

export default function TranslateModal({
  isOpen,
  onClose,
  selectedLanguageCode,
  selectedLanguageLabel,
  onLanguageChange,
  wordInput,
  onWordInputChange,
  translatedWord,
  isCopied,
  onCopied,
  isTranslateDisabled,
  isTranslateLoading,
  onTranslate,
  isAddDisabled,
  isAddLoading,
  onAddToDictionary,
  success,
  error,
  isRequestError,
}) {
  if (!isOpen) return null;

  const actionButtonStyle = (disabled) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: '0.45rem',
    border: '1px solid var(--accent-strong)',
    background: 'var(--accent-strong)',
    color: 'var(--text-on-accent)',
    cursor: disabled ? 'default' : 'pointer',
    WebkitAppearance: 'none',
    appearance: 'none',
    opacity: disabled ? 0.7 : 1,
  });

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
      aria-label="Translate word"
      data-testid="translate-modal"
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left', width: '100%' }}>
            <select
              data-testid="translate-language-select"
              value={selectedLanguageCode}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-color)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                width: `calc(${Math.max(6, selectedLanguageLabel.length)}ch + 1.2rem)`,
                maxWidth: '100%',
                textAlign: 'center',
                textAlignLast: 'center',
                fontSize: '0.95rem',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            >
              {TRANSLATION_LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="translate-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0, WebkitAppearance: 'none', appearance: 'none' }}
          >
            Close
          </button>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Word or phrase</span>
          <input
            data-testid="translate-word-input"
            maxLength={WORD_INPUT_MAX_LENGTH}
            value={wordInput}
            onChange={(e) => onWordInputChange(e.target.value.slice(0, WORD_INPUT_MAX_LENGTH))}
            placeholder="Enter word or phrase"
            onKeyDown={(e) => e.stopPropagation()}
            style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Translation</span>
          <div style={{ position: 'relative' }}>
            <textarea
              data-testid="translate-result-field"
              readOnly
              value={translatedWord}
              placeholder="Translation result"
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                minHeight: '84px',
                resize: 'none',
                padding: '0.55rem 2.7rem 0.55rem 0.65rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-color)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ position: 'absolute', right: '0.45rem', bottom: '0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {isCopied && (
                <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Copied!</span>
              )}
              <button
                type="button"
                data-testid="translate-copy"
                onClick={async (event) => {
                  event.stopPropagation();
                  if (!translatedWord.trim()) return;
                  try {
                    if (navigator?.clipboard?.writeText) {
                      await navigator.clipboard.writeText(translatedWord);
                      onCopied();
                    }
                  } catch (_) {}
                }}
                disabled={!translatedWord.trim()}
                aria-label="Copy translated word"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2rem',
                  border: 'none',
                  borderRadius: '0.4rem',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: translatedWord.trim() ? 'pointer' : 'default',
                  opacity: translatedWord.trim() ? 1 : 0.55,
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              >
                <svg
                  enableBackground="new 0 0 24 24"
                  focusable="false"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                  aria-hidden="true"
                  style={{ opacity: 0.9 }}
                >
                  <g>
                    <rect fill="none" height="24" width="24" />
                  </g>
                  <g>
                    <path fill="currentColor" d="M16,20H5V6H3v14c0,1.1,0.9,2,2,2h11V20z M20,16V4c0-1.1-0.9-2-2-2H9C7.9,2,7,2.9,7,4v12c0,1.1,0.9,2,2,2h9 C19.1,18,20,17.1,20,16z M18,16H9V4h9V16z" />
                  </g>
                </svg>
              </button>
            </div>
          </div>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <button
            type="button"
            data-testid="translate-submit"
            onClick={(e) => {
              e.stopPropagation();
              onTranslate();
            }}
            disabled={isTranslateDisabled}
            style={actionButtonStyle(isTranslateDisabled)}
          >
            {isTranslateLoading ? (
              <span className="add-button-dots" aria-live="polite">
                <span className="add-button-dot" />
                <span className="add-button-dot" />
                <span className="add-button-dot" />
              </span>
            ) : (
              'Translate'
            )}
          </button>
          <button
            type="button"
            data-testid="translate-add-to-dictionary"
            onClick={(e) => {
              e.stopPropagation();
              onAddToDictionary();
            }}
            disabled={isAddDisabled}
            style={actionButtonStyle(isAddDisabled)}
          >
            {isAddLoading ? (
              <span className="add-button-dots" aria-live="polite">
                <span className="add-button-dot" />
                <span className="add-button-dot" />
                <span className="add-button-dot" />
              </span>
            ) : (
              'Add to Dictionary'
            )}
          </button>
        </div>
        {success && (
          <div data-testid="translate-success" style={{ color: 'var(--accent-strong)', textAlign: 'left', fontSize: '0.9rem' }}>{success}</div>
        )}
        {error && (
          isRequestError ? (
            <RequestErrorMessage data-testid="translate-error" message={error} />
          ) : (
            <div data-testid="translate-error" style={{ color: 'var(--danger)', textAlign: 'left', fontSize: '0.9rem' }}>{error}</div>
          )
        )}
      </div>
    </div>
  );
}
