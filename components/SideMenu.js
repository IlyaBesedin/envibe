import React from 'react';

export default function SideMenu({
  isOpen,
  onClose,
  dictionaryList,
  selectedDictionaryId,
  selectedDictionaryTitle,
  isDictionaryLoading,
  onSelectDictionary,
  toggleButtonStyle,
  isLearningMode,
  isLearningAvailable,
  onToggleLearning,
  isRandomOrder,
  onToggleRandom,
  onOpenAddWord,
  onOpenTranslate,
  onOpenSettings,
  onSignOut,
}) {
  const actionButtonStyle = {
    padding: '0.45rem 0.75rem',
    borderRadius: '0.45rem',
    border: '1px solid var(--border-color)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    WebkitAppearance: 'none',
    appearance: 'none',
  };
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' };
  const dividerStyle = { borderTop: '1px solid var(--border-color)', margin: '0.15rem -0.25rem 0', paddingTop: '0.35rem' };

  return (
    <>
      {isOpen && (
        <div
          data-testid="menu-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
            zIndex: 14,
          }}
        />
      )}
      <div
        data-testid="menu-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '33vw',
          minWidth: '240px',
          maxWidth: '400px',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 0.25s ease',
          padding: 'calc(env(safe-area-inset-top) + 1.4rem) 1.25rem 1.25rem',
          boxShadow: 'var(--shadow-elevated)',
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          overflowY: 'auto',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 0.75rem)',
          left: 0,
          right: 0,
          height: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.05rem',
          fontWeight: 700,
          pointerEvents: 'none',
        }}>Menu</div>
        <button
          type="button"
          data-testid="menu-close"
          aria-label="Close menu"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 0.75rem)',
            left: 'calc(env(safe-area-inset-left) + 0.75rem)',
            width: '44px',
            height: '26px',
            borderRadius: 'none',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        >
          <span style={{ position: 'relative', width: '18px', height: '18px' }}>
            {[45, -45].map((deg) => (
              <span
                key={deg}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  width: '18px',
                  height: '1px',
                  borderRadius: '999px',
                  background: 'var(--text-primary)',
                  transform: `translateY(-50%) rotate(${deg}deg)`,
                }}
              />
            ))}
          </span>
        </button>
        <div style={{ flexShrink: 0, height: 'calc(26px - 0.3rem)' }} />
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Dictionary</div>
          <select
            data-testid="menu-dictionary-select"
            value={selectedDictionaryId ?? ''}
            onChange={(event) => {
              event.stopPropagation();
              const nextValue = event.target.value;
              if (!nextValue) {
                onSelectDictionary(null);
                return;
              }
              const nextId = Number(nextValue);
              onSelectDictionary(Number.isNaN(nextId) ? null : nextId);
            }}
            disabled={isDictionaryLoading || dictionaryList.length === 0}
            style={{
              padding: '0.45rem 0.6rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--border-color)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              WebkitAppearance: 'none',
              appearance: 'none',
              opacity: isDictionaryLoading ? 0.7 : 1,
              width: `calc(${Math.max(6, selectedDictionaryTitle.length)}ch + 1.2rem)`,
              maxWidth: '100%',
              textAlign: 'center',
              textAlignLast: 'center',
            }}
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
        </div>
        <div style={dividerStyle} />
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Learning mode</div>
          <button
            type="button"
            data-testid="menu-learning-toggle"
            onClick={(event) => {
              event.stopPropagation();
              onToggleLearning();
            }}
            aria-pressed={isLearningMode}
            aria-disabled={!isLearningAvailable}
            style={{ ...toggleButtonStyle(isLearningMode), opacity: isLearningAvailable ? 1 : 0.6, cursor: isLearningAvailable ? 'pointer' : 'not-allowed' }}
          >
            {isLearningMode ? 'On' : 'Off'}
          </button>
        </div>
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Random order</div>
          <button
            type="button"
            data-testid="menu-random-toggle"
            onClick={(event) => {
              event.stopPropagation();
              onToggleRandom();
            }}
            style={toggleButtonStyle(isRandomOrder)}
          >
            {isRandomOrder ? 'On' : 'Off'}
          </button>
        </div>
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Add new word</div>
          <button
            type="button"
            data-testid="menu-add-word"
            onClick={(event) => {
              event.stopPropagation();
              onOpenAddWord();
            }}
            style={actionButtonStyle}
          >
            Add
          </button>
        </div>
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Translate text</div>
          <button
            type="button"
            data-testid="menu-translate-open"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTranslate();
            }}
            style={actionButtonStyle}
          >
            Open
          </button>
        </div>
        <div style={dividerStyle} />
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Settings</div>
          <button
            type="button"
            data-testid="menu-settings-open"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings();
            }}
            style={actionButtonStyle}
          >
            Open
          </button>
        </div>
        <div style={rowStyle}>
          <div style={{ fontWeight: 600 }}>Sign out</div>
          <button
            type="button"
            data-testid="menu-signout"
            onClick={(event) => {
              event.stopPropagation();
              onSignOut();
            }}
            style={actionButtonStyle}
          >
            Exit
          </button>
        </div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '1rem',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            lineHeight: 1.45,
            textAlign: 'left',
          }}
        >
          Please feel free to report any bugs or send feedback to{' '}
          <a
            href="mailto:envibe.dev@gmail.com"
            onClick={(event) => event.stopPropagation()}
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            envibe.dev@gmail.com
          </a>
        </div>
      </div>
    </>
  );
}
