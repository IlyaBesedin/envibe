import React from 'react';
import { WORD_INPUT_MAX_LENGTH } from '../lib/constants';
import RequestErrorMessage from './RequestErrorMessage';

export default function AddWordModal({
  isOpen,
  onClose,
  word,
  onWordChange,
  translation,
  onTranslationChange,
  dictionaryId,
  onDictionaryChange,
  dictionaryList,
  isDictionaryLoading,
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
      aria-label="Add new word"
      data-testid="add-word-modal"
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
          <span style={{ fontWeight: 600 }}>New word</span>
          <input
            data-testid="add-word-input"
            maxLength={WORD_INPUT_MAX_LENGTH}
            value={word}
            onChange={(e) => onWordChange(e.target.value.slice(0, WORD_INPUT_MAX_LENGTH))}
            placeholder="Enter a new word"
            onKeyDown={(e) => e.stopPropagation()}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Translation</span>
          <input
            data-testid="add-word-translation-input"
            maxLength={WORD_INPUT_MAX_LENGTH}
            value={translation}
            onChange={(e) => onTranslationChange(e.target.value.slice(0, WORD_INPUT_MAX_LENGTH))}
            placeholder="Enter translation"
            onKeyDown={(e) => e.stopPropagation()}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontWeight: 600 }}>Dictionary</span>
          <select
            data-testid="add-word-dictionary-select"
            value={dictionaryId ?? ''}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!nextValue) {
                onDictionaryChange(null);
                return;
              }
              const nextId = Number(nextValue);
              onDictionaryChange(Number.isNaN(nextId) ? null : nextId);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={dictionaryList.length === 0 || isDictionaryLoading}
            style={{ ...inputStyle, WebkitAppearance: 'none', appearance: 'none', opacity: isDictionaryLoading ? 0.7 : 1 }}
          >
            {dictionaryList.length === 0 ? (
              <option value="">{isDictionaryLoading ? 'Loading…' : 'No dictionaries'}</option>
            ) : (
              dictionaryList.map((dict) => (
                <option key={dict.id} value={dict.id}>
                  {dict.title}
                </option>
              ))
            )}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', alignContent: 'center' }}>
          {success && (
            <div data-testid="add-word-success" style={{ flex: '1 1 200px', textAlign: 'left', paddingLeft: '0.65rem', color: 'var(--accent-strong)', marginRight: 'auto' }}>
              Word successfully added
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="add-word-submit"
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
              data-testid="add-word-close"
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
            <RequestErrorMessage data-testid="add-word-error" message={error} />
          ) : (
            <div data-testid="add-word-error" style={{ color: 'var(--danger)', textAlign: 'left', fontSize: '0.9rem' }}>{error}</div>
          )
        )}
      </div>
    </div>
  );
}
