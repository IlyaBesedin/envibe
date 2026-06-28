import React from 'react';

export default function HistoryModal({ isOpen, onClose, onClear, items }) {
  if (!isOpen) return null;

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
      }}
      role="dialog"
      aria-modal="true"
      aria-label="History"
      data-testid="history-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', width: 'min(700px, 95vw)', maxHeight: '80vh', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: 'var(--shadow-elevated)', color: 'var(--text-primary)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <strong>History</strong>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="history-clear"
              onClick={onClear}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' }}
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="history-close"
              onClick={onClose}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-on-accent)', WebkitAppearance: 'none', appearance: 'none' }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {items.length === 0 ? (
            <p data-testid="history-empty" style={{ padding: '1rem', opacity: 0.7 }}>No viewed words yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((item, index) => (
                <li key={`${item.id ?? 'noid'}-${index}`} data-testid="history-item" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{item.word}</div>
                  <div style={{ opacity: 0.8 }}>{item.translation}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
