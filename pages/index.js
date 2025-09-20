import React, { useEffect, useState, useCallback } from 'react';
import { stackClientApp } from '../stack/client';

const VOCABULARY_URL = 'https://app-orange-meadow-73857621.dpl.myneon.app/vocabulary';
const LOCAL_STORAGE_KEY = 'vocabularyData';
const LOCAL_STORAGE_HISTORY_KEY = 'vocabularyViewedHistory';
const LOCAL_STORAGE_LEVEL_KEY = 'vocabularyLevel';
const LOCAL_STORAGE_RANDOM_KEY = 'vocabularyRandomOrder';

export default function Home() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Check auth on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await stackClientApp.getUser({ or: 'return-null' });
        if (!cancelled) setUser(u);
      } catch (e) {
        if (!cancelled) setAuthError(e instanceof Error ? e.message : 'Auth error');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    // Load stored tokens if present
    try {
      if (typeof window !== 'undefined') {
        // New explicit keys
        const lsAccess = localStorage.getItem('AccessToken');
        const lsRefresh = localStorage.getItem('RefreshToken');
        const lsUserId = localStorage.getItem('AuthUserId');
        if (lsAccess) setAccessToken(lsAccess);
        if (lsRefresh) setRefreshToken(lsRefresh);
        if (lsUserId) setAuthUserId(lsUserId);
        // Back-compat: old bundled key
        if (!lsAccess || !lsRefresh || !lsUserId) {
          const raw = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.access_token === 'string') setAccessToken(parsed.access_token);
            if (parsed && typeof parsed.refresh_token === 'string') setRefreshToken(parsed.refresh_token);
            if (parsed && typeof parsed.user_id === 'string') setAuthUserId(parsed.user_id);
          }
        }
      }
    } catch (_) {}
    return () => { cancelled = true; };
  }, []);

  async function handleEmailPasswordSignIn(event) {
    event?.preventDefault?.();
    setAuthError('');
    try {
      const res = await stackClientApp.signInWithCredential({ email, password, noRedirect: true });
      if (res && res.status === 'ok') {
        const u = await stackClientApp.getUser({ or: 'return-null' });
        setUser(u);
        setAuthError('');
        // Capture tokens and persist in required shape
        const auth = u && typeof u.getAuthJson === 'function' ? await u.getAuthJson() : { accessToken: null, refreshToken: null };
        const payload = {
          access_token: auth?.accessToken ?? '',
          refresh_token: auth?.refreshToken ?? '',
          user_id: u?.id ?? '',
        };
        try {
          // Store both the bundled object and explicit keys as requested
          localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(payload));
          localStorage.setItem('AccessToken', payload.access_token || '');
          localStorage.setItem('RefreshToken', payload.refresh_token || '');
          localStorage.setItem('AuthUserId', payload.user_id || '');
        } catch (_) {}
        setAccessToken(payload.access_token);
        setRefreshToken(payload.refresh_token);
        setAuthUserId(payload.user_id);
      } else {
        const msg = res?.error?.message || 'Не удалось войти';
        setAuthError(msg);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Не удалось войти');
    }
  }
  const [entryList, setEntryList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewedHistory, setViewedHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('B2');
  const [generatedSentence, setGeneratedSentence] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRandomOrder, setIsRandomOrder] = useState(false);
  const [orderIndices, setOrderIndices] = useState([]);
  const [randomHistory, setRandomHistory] = useState([]); // indices visited in random mode
  const [randomHistoryPos, setRandomHistoryPos] = useState(-1); // pointer into randomHistory
  // Auth tokens
  const LOCAL_STORAGE_AUTH_KEY = 'stackAuthTokens';
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [authUserId, setAuthUserId] = useState('');

  function buildDefaultOrder(length) {
    return Array.from({ length }, (_, i) => i);
  }

  function shuffleOrder(order) {
    const arr = order.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function mapApiDataToEntries(data) {
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item && (item.key !== undefined) && (item.translate !== undefined))
      .sort((a, b) => {
        const aId = typeof a.id === 'number' ? a.id : Number.MAX_SAFE_INTEGER;
        const bId = typeof b.id === 'number' ? b.id : Number.MAX_SAFE_INTEGER;
        return aId - bId;
      })
      .map(({ key, translate, id }) => ({
        id: typeof id === 'number' ? id : undefined,
        word: String(key),
        translation: String(translate),
      }));
  }

  useEffect(() => {
    // Do not load vocabulary until authenticated either by Stack or stored token
    if (authLoading || (!user && !accessToken)) return;
    let isActive = true;

    async function loadVocabulary() {
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
        if (cached) {
          const cachedObject = JSON.parse(cached);
          if (!isActive) return;
          const entries = mapApiDataToEntries(cachedObject);
          setEntryList(entries);
          setIsLoading(false);
        }

        const headers = { Accept: 'application/json' };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        const response = await fetch(VOCABULARY_URL, { method: 'GET', headers });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }

        if (!isActive) return;
        const entries = mapApiDataToEntries(data);
        setEntryList(entries);
        setIsLoading(false);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        setIsLoading(false);
      }
    }

    loadVocabulary();

    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  // Load history on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setViewedHistory(parsed);
        }
      }
      const savedLevel = localStorage.getItem(LOCAL_STORAGE_LEVEL_KEY);
      if (savedLevel) setSelectedLevel(savedLevel);
      const savedRandom = localStorage.getItem(LOCAL_STORAGE_RANDOM_KEY);
      if (savedRandom === 'true') setIsRandomOrder(true);
    } catch (_) {
      // ignore malformed
    }
  }, [authLoading, user, accessToken]);

  // Rebuild navigation order whenever entries change
  useEffect(() => {
    if (entryList.length === 0) {
      setOrderIndices([]);
      return;
    }
    const ord = buildDefaultOrder(entryList.length);
    setOrderIndices(ord);
    setCurrentIndex((prevIndex) => (ord.length > 0 ? (ord.includes(prevIndex) ? prevIndex : ord[0]) : prevIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryList]);

  // Seed random history when random mode is enabled
  useEffect(() => {
    if (!isRandomOrder) return;
    if (entryList.length === 0) return;
    if (randomHistory.length === 0 || randomHistoryPos === -1) {
      setRandomHistory([currentIndex]);
      setRandomHistoryPos(0);
    }
  }, [isRandomOrder]);

  // Track viewed words whenever the current entry changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (entryList.length === 0) return;
    const entry = entryList[currentIndex];
    if (!entry) return;

    setViewedHistory((prev) => {
      // Avoid duplicates in history (applies to both modes)
      if (prev.some((h) => h && h.word === entry.word)) {
        return prev;
      }
      const next = [...prev, {
        id: entry.id ?? undefined,
        word: entry.word,
        translation: entry.translation,
        viewedAt: Date.now(),
      }];
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, [currentIndex, entryList]);

  // Clear generated sentence when navigating to a different word
  useEffect(() => {
    setGeneratedSentence('');
    setIsGenerating(false);
  }, [currentIndex]);

  const handleAdvance = useCallback(() => {
    if (isLoading) return;
    if (isRandomOrder) {
      if (entryList.length === 0) return;
      // If we have forward history (user had gone back), move forward within history
      if (randomHistoryPos >= 0 && randomHistoryPos < randomHistory.length - 1) {
        const nextIndex = randomHistory[randomHistoryPos + 1];
        setRandomHistoryPos((p) => p + 1);
        setCurrentIndex(nextIndex);
        return;
      }
      // Otherwise, pick a new random index and append to history (truncate any forward part first)
      const freshIndex = Math.floor(Math.random() * entryList.length);
      setRandomHistory((prev) => {
        const truncated = prev.slice(0, randomHistoryPos + 1);
        const updated = [...truncated, freshIndex];
        return updated;
      });
      setRandomHistoryPos((p) => p + 1);
      setCurrentIndex(freshIndex);
      return;
    }
    if (orderIndices.length === 0) return;
    const pos = orderIndices.indexOf(currentIndex);
    if (pos === -1) return;
    const next = orderIndices[(pos + 1) % orderIndices.length];
    setCurrentIndex(next);
  }, [isLoading, entryList.length, orderIndices, currentIndex, isRandomOrder, randomHistory, randomHistoryPos]);

  const handleBack = useCallback(() => {
    if (isLoading) return;
    if (isRandomOrder) {
      if (entryList.length === 0) return;
      // Move back within random history if possible
      if (randomHistoryPos > 0) {
        const prevIndex = randomHistory[randomHistoryPos - 1];
        setRandomHistoryPos((p) => p - 1);
        setCurrentIndex(prevIndex);
      }
      return;
    }
    if (orderIndices.length === 0) return;
    const pos = orderIndices.indexOf(currentIndex);
    if (pos === -1) return;
    const next = orderIndices[(pos - 1 + orderIndices.length) % orderIndices.length];
    setCurrentIndex(next);
  }, [isLoading, entryList.length, orderIndices, currentIndex, isRandomOrder, randomHistoryPos, randomHistory]);

  const currentEntry = entryList.length > 0 ? entryList[currentIndex] : null;
  const displayWord = currentEntry ? currentEntry.word : '';
  const displayTranslation = currentEntry ? currentEntry.translation : '';

  async function handleGenerateSentence(event) {
    event.stopPropagation();
    if (!displayWord || !selectedLevel || isGenerating) return;
    try {
      setIsGenerating(true);
      setGeneratedSentence('');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: displayWord, level: selectedLevel }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }
      const data = await response.json();
      setGeneratedSentence(data.sentence || '');
    } catch (e) {
      setGeneratedSentence(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }

  // Gate: show auth UI first
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
        Загрузка авторизации…
      </div>
    );
  }

  if (!user && !accessToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <form
          onSubmit={handleEmailPasswordSignIn}
          style={{ width: 'min(380px, 95vw)', border: '1px solid #e5e5e5', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}
        >
          <h1 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.15rem' }}>Вход</h1>
          <p style={{ marginTop: 0, marginBottom: '1rem', opacity: 0.75, fontSize: '0.9rem' }}>Авторизуйтесь, чтобы открыть словарь</p>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.5rem 0.6rem', border: '1px solid #ccc', borderRadius: '0.4rem' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Пароль</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.5rem 0.6rem', border: '1px solid #ccc', borderRadius: '0.4rem' }}
            />
          </label>
          {authError && (
            <div style={{ color: '#b00020', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{authError}</div>
          )}
          <button
            type="submit"
            style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
          >
            Войти
          </button>

          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.7 }}>
            Есть аккаунт: используйте Email и Пароль, созданные в Stack Auth
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
          event.preventDefault();
          handleAdvance();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleBack();
        }
      }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '2rem',
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'Inter, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Top controls */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsSettingsOpen(true);
        }}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          padding: '0.4rem 0.7rem',
          borderRadius: '0.4rem',
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
        aria-label="Open settings"
      >
        Settings
      </button>

      {/* Sign out */}
      <button
        type="button"
        onClick={async (event) => {
          event.stopPropagation();
          try {
            await user?.signOut({ redirectUrl: '/' });
            setUser(null);
            try { localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY); } catch (_) {}
            try { localStorage.removeItem('AccessToken'); } catch (_) {}
            try { localStorage.removeItem('RefreshToken'); } catch (_) {}
            try { localStorage.removeItem('AuthUserId'); } catch (_) {}
            setAccessToken('');
            setRefreshToken('');
            setAuthUserId('');
          } catch (_) {}
        }}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          padding: '0.4rem 0.7rem',
          borderRadius: '0.4rem',
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
        aria-label="Sign out"
      >
        Sign out
      </button>

      

      {/* Left arrow */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleBack();
        }}
        style={{
          position: 'absolute',
          left: '0.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '0.6rem 0.8rem',
          borderRadius: '9999px',
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
        }}
        aria-label="Previous"
      >
        ←
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleAdvance();
        }}
        style={{
          position: 'absolute',
          right: '0.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '0.6rem 0.8rem',
          borderRadius: '9999px',
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
        }}
        aria-label="Next"
      >
        →
      </button>
      <div>
        {isLoading && <p>Loading vocabulary…</p>}
        {!isLoading && errorMessage && (
          <>
            <h1>Failed to load vocabulary</h1>
            <p>{errorMessage}</p>
          </>
        )}
        {!isLoading && !errorMessage && currentEntry && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              width: 'min(420px, calc(100vw - 4rem))',
              boxSizing: 'border-box',
            }}
          >
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#19067a' }}>{displayWord}</h1>
            <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>{displayTranslation}</p>
            <button
              type="button"
              onClick={handleGenerateSentence}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.4rem',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
              aria-label="Generate sentence"
            >
              {isGenerating ? 'Generating…' : 'Generate Sentence'}
            </button>
            {generatedSentence && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 1rem)',
                  left: 0,
                  right: 0,
                  margin: '0 auto',
                  fontSize: '1rem',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #eee',
                  borderRadius: '0.5rem',
                  background: '#fff',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  color: '#19067a',
                  lineHeight: 1.6,
                }}
              >
                {generatedSentence}
              </div>
            )}
          </div>
        )}
        {!isLoading && !errorMessage && !currentEntry && <p>No vocabulary available.</p>}
      </div>

      {/* History overlay */}
      {isHistoryOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Viewed words history"
        >
          <div style={{ background: '#fff', width: 'min(700px, 95vw)', maxHeight: '80vh', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid #eee' }}>
              <strong>Viewed history</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setViewedHistory([]);
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
                      }
                    } catch (_) {}
                  }}
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid #ccc', background: '#fff', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid #ccc', background: '#fff', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {viewedHistory.length === 0 ? (
                <p style={{ padding: '1rem', opacity: 0.7 }}>No viewed words yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {viewedHistory.map((item, index) => (
                    <li key={`${item.id ?? 'noid'}-${index}`} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0', textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{item.word}</div>
                      <div style={{ opacity: 0.8 }}>{item.translation}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings overlay */}
      {isSettingsOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <div style={{ background: '#fff', width: 'min(700px, 95vw)', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid #eee' }}>
              <strong>Settings</strong>
              <button type="button" onClick={() => setIsSettingsOpen(false)} style={{ padding: '0.3rem 0.6rem', border: '1px solid #ccc', background: '#fff', borderRadius: '0.4rem', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>History</div>
                  <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>View the list of viewed words</div>
                </div>
                <button type="button" onClick={() => { setIsHistoryOpen(true); setIsSettingsOpen(false); }} style={{ padding: '0.4rem 0.7rem', border: '1px solid #ccc', background: '#fff', borderRadius: '0.4rem', cursor: 'pointer' }}>Open</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Reset cache</div>
                  <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Clear cached vocabulary and reload</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                        localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
                      }
                    } catch (_) {}
                    window.location.reload();
                  }}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid #ccc', background: '#fff', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>English level</div>
                  <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>Level used for AI sentence generation</div>
                </div>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    const level = e.target.value;
                    setSelectedLevel(level);
                    try {
                      localStorage.setItem(LOCAL_STORAGE_LEVEL_KEY, level);
                    } catch (_) {}
                  }}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #ccc', background: '#fff' }}
                >
                  {['A1','A2','B1','B2','C1','C2'].map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Random order</div>
                  <div style={{ textAlign: 'left', opacity: 0.7, fontSize: '0.9rem' }}>Show words in random order instead of sequential</div>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isRandomOrder}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setIsRandomOrder(enabled);
                      try { localStorage.setItem(LOCAL_STORAGE_RANDOM_KEY, enabled ? 'true' : 'false'); } catch (_) {}
                      // Reset random history when toggling mode
                      setRandomHistory([]);
                      setRandomHistoryPos(-1);
                    }}
                  />
                  <span style={{marginRight: '0.5rem'}}>
                    {isRandomOrder ? 'On' : 'Off'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
