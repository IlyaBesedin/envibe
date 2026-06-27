import React from 'react';
import { SENTENCE_TOPIC_OPTIONS } from '../lib/sentenceTopics';

const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  isSentenceGenerationHidden,
  onToggleSentenceGeneration,
  onOpenHistory,
  onReset,
  selectedLevel,
  onLevelChange,
  selectedTopic,
  selectedTopicLabel,
  onTopicChange,
  onAddDictionary,
  toggleButtonStyle,
}) {
  if (!isOpen) return null;

  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' };
  const labelStyle = { textAlign: 'left', margin: 0, fontWeight: 600 };
  const linkButtonStyle = { padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' };
  const selectStyle = {
    padding: '0.45rem 0.6rem',
    borderRadius: '0.45rem',
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    WebkitAppearance: 'none',
    appearance: 'none',
  };

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
        zIndex: 100,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', width: 'min(700px, 95vw)', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: 'var(--shadow-elevated)', color: 'var(--text-primary)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <strong>Settings</strong>
          <button
            type="button"
            data-testid="settings-close"
            onClick={onClose}
            style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: '1rem', display: 'grid', gap: '0.25rem' }}>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Dark theme</div>
            </div>
            <button
              type="button"
              data-testid="settings-theme-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleTheme();
              }}
              style={toggleButtonStyle(theme === 'dark')}
            >
              {theme === 'dark' ? 'On' : 'Off'}
            </button>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Hide sentence generation</div>
            </div>
            <button
              type="button"
              data-testid="settings-hide-sentence-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSentenceGeneration();
              }}
              style={toggleButtonStyle(isSentenceGenerationHidden)}
            >
              {isSentenceGenerationHidden ? 'On' : 'Off'}
            </button>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>History</div>
            </div>
            <button
              type="button"
              data-testid="settings-history-open"
              onClick={onOpenHistory}
              style={linkButtonStyle}
            >
              Open
            </button>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Reset cache and history</div>
            </div>
            <button
              type="button"
              data-testid="settings-reset"
              onClick={onReset}
              style={linkButtonStyle}
            >
              Reset
            </button>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Language level</div>
            </div>
            <select
              data-testid="settings-language-level-select"
              value={selectedLevel}
              onChange={(e) => onLevelChange(e.target.value)}
              style={selectStyle}
            >
              {LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Sentence topic</div>
            </div>
            <select
              data-testid="settings-topic-select"
              value={selectedTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              style={{
                ...selectStyle,
                width: `calc(${Math.max(6, selectedTopicLabel.length)}ch + 1.2rem)`,
                maxWidth: '100%',
                textAlign: 'center',
                textAlignLast: 'center',
              }}
            >
              {SENTENCE_TOPIC_OPTIONS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Add new dictionary</div>
            </div>
            <button
              type="button"
              data-testid="settings-add-dictionary"
              onClick={onAddDictionary}
              style={linkButtonStyle}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
