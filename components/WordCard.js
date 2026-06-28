import React from 'react';
import RequestErrorMessage from './RequestErrorMessage';

export default function WordCard({
  isLoading,
  errorMessage,
  displayedEntry,
  displayWord,
  displayTranslation,
  isLearningMode,
  isTranslationRevealed,
  onRevealTranslation,
  isSentenceGenerationHidden,
  onGenerateSentence,
  isGenerating,
  generatedSentence,
  generatedSentenceError,
  isSentenceCopied,
  onSentenceCopied,
  isEmptyDictionaryState,
  dictionaryTitle,
  onAddWord,
}) {
  return (
    <div>
      {isLoading && <p>Loading vocabulary…</p>}
      {!isLoading && errorMessage && (
        <RequestErrorMessage message={errorMessage} style={{ textAlign: 'center', fontSize: '1rem' }} />
      )}
      {!isLoading && !errorMessage && displayedEntry && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            width: 'min(420px, calc(100vw - 4rem))',
            boxSizing: 'border-box',
          }}
        >
          <h1 data-testid="word-title" style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--accent-strong)' }}>{displayWord}</h1>
          <div
            style={{
              width: '100%',
              padding: '24px 3rem',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {isLearningMode && displayedEntry && !isTranslationRevealed ? (
              <button
                type="button"
                data-testid="learning-show-translation"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!displayedEntry?.word) return;
                  onRevealTranslation(displayedEntry.word);
                }}
                style={{
                  fontSize: '0.95rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              >
                Show translation
              </button>
            ) : (
              <p
                data-testid="word-translation"
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  opacity: 0.8,
                  lineHeight: 1.4,
                  textAlign: 'center',
                  wordBreak: 'break-word',
                }}
              >
                {displayTranslation}
              </p>
            )}
          </div>
          {!isSentenceGenerationHidden && (
            <button
              type="button"
              data-testid="generate-sentence-button"
              onClick={onGenerateSentence}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: 'var(--text-on-primary)',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
              aria-label="Generate sentence"
            >
              {isGenerating ? 'Generating…' : 'Generate Sentence'}
            </button>
          )}
          {(generatedSentence || generatedSentenceError) && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 1rem)',
                left: 0,
                right: 0,
                margin: '0 auto',
                fontSize: '1rem',
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                background: 'var(--surface)',
                textAlign: 'center',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                display: 'grid',
                gap: '0.35rem',
              }}
            >
              {generatedSentenceError ? (
                <RequestErrorMessage
                  data-testid="generated-sentence-error"
                  message={generatedSentenceError}
                  style={{ textAlign: 'center' }}
                />
              ) : (
                <>
                  <div data-testid="generated-sentence-text">{generatedSentence}</div>
                  <div style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {isSentenceCopied && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', opacity: 0.90 }}>
                        Copied!
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!generatedSentence) return;
                        try {
                          if (navigator?.clipboard?.writeText) {
                            await navigator.clipboard.writeText(generatedSentence);
                            onSentenceCopied();
                          }
                        } catch (_) {}
                      }}
                      aria-label="Copy generated sentence"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem',
                        border: 'none',
                        borderRadius: '0.4rem',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
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
                </>
              )}
            </div>
          )}
        </div>
      )}
      {isEmptyDictionaryState && (
        <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
          <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.4 }}>
            Dictionary {dictionaryTitle ? `"${dictionaryTitle}"` : 'This dictionary'} doesn't contain any words.
            <br />Use the button below to add new words.
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddWord();
            }}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--accent-strong)',
              background: 'var(--accent-strong)',
              color: 'var(--text-on-accent)',
              cursor: 'pointer',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          >
            Add word
          </button>
        </div>
      )}
      {!isLoading && !errorMessage && !displayedEntry && !isEmptyDictionaryState && (
        <p>No vocabulary available. Try reloading.</p>
      )}
    </div>
  );
}
