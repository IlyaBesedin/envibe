import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { stackClientApp } from '../stack/client';
import { SENTENCE_TOPIC_OPTIONS } from '../lib/sentenceTopics';

const VOCABULARY_URL = 'https://ep-floral-rain-a2efqgrr.apirest.eu-central-1.aws.neon.tech/neondb/rest/v1/vocabulary';
const LOCAL_STORAGE_KEY = 'vocabularyData';
const LOCAL_STORAGE_HISTORY_KEY = 'vocabularyViewedHistory';
const LOCAL_STORAGE_LEVEL_KEY = 'vocabularyLevel';
const LOCAL_STORAGE_RANDOM_KEY = 'vocabularyRandomOrder';
const LOCAL_STORAGE_THEME_KEY = 'envibeTheme';
const STACK_REFRESH_URL = 'https://api.stack-auth.com/api/v1/auth/sessions/current/refresh';
const STACK_CLIENT_VERSION = 'js @stackframe/js@2.8.27';

const tokenStore = {
  accessToken: '',
  refreshToken: '',
};

class TokenRefreshError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

function setTokenStoreTokens(accessToken, refreshToken) {
  tokenStore.accessToken = accessToken ?? '';
  tokenStore.refreshToken = refreshToken ?? '';
}

function generateRandomNonce() {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint32Array(4);
    globalCrypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(36).slice(2);
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return '';
}

export default function Home() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [theme, setTheme] = useState('light');

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
        let storedAccess = localStorage.getItem('AccessToken') || '';
        let storedRefresh = localStorage.getItem('RefreshToken') || '';
        let storedUserId = localStorage.getItem('AuthUserId') || '';

        if (!storedAccess || !storedRefresh || !storedUserId) {
          const raw = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.access_token === 'string' && !storedAccess) storedAccess = parsed.access_token;
            if (parsed && typeof parsed.refresh_token === 'string' && !storedRefresh) storedRefresh = parsed.refresh_token;
            if (parsed && typeof parsed.user_id === 'string' && !storedUserId) storedUserId = parsed.user_id;
          }
        }

        if (storedAccess) setAccessToken(storedAccess);
        if (storedRefresh) setRefreshToken(storedRefresh);
        if (storedUserId) setAuthUserId(storedUserId);
      }
    } catch (_) {}
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
      }
    } catch (_) {}
  }, [theme]);

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
  const [selectedTopic, setSelectedTopic] = useState('random');
  const [generatedSentence, setGeneratedSentence] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRandomOrder, setIsRandomOrder] = useState(false);
  const [orderIndices, setOrderIndices] = useState([]);
  const [randomHistory, setRandomHistory] = useState([]); // indices visited in random mode
  const [randomHistoryPos, setRandomHistoryPos] = useState(-1); // pointer into randomHistory
  const initialPositionResolvedRef = useRef(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [learningIndex, setLearningIndex] = useState(0);
  const [revealedTranslations, setRevealedTranslations] = useState({});
  // Auth tokens
  const LOCAL_STORAGE_AUTH_KEY = 'stackAuthTokens';
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [authUserId, setAuthUserId] = useState('');

  useEffect(() => {
    setTokenStoreTokens(accessToken, refreshToken);
  }, [accessToken, refreshToken]);

  const refreshAccessToken = useCallback(async () => {
    const currentRefreshToken = tokenStore.refreshToken || refreshToken;
    if (!currentRefreshToken) {
      throw new TokenRefreshError('Missing refresh token');
    }

    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-stack-access-type': 'client',
      'x-stack-client-version': STACK_CLIENT_VERSION,
      'x-stack-override-error-status': 'true',
      'x-stack-project-id': process.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? '',
      'x-stack-publishable-client-key': process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? '',
      'x-stack-refresh-token': currentRefreshToken,
      'x-stack-random-nonce': generateRandomNonce(),
    };

    const response = await fetch(STACK_REFRESH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new TokenRefreshError(`Failed to refresh token (status ${response.status})`);
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new TokenRefreshError('Failed to parse refresh response');
    }

    const nextAccessToken = pickFirstString(
      data?.accessToken,
      data?.access_token,
      data?.tokens?.accessToken,
      data?.tokens?.access_token,
      data?.data?.accessToken,
      data?.data?.access_token,
      data?.session?.accessToken,
      data?.session?.access_token,
      data?.session?.tokens?.accessToken,
      data?.session?.tokens?.access_token,
    );

    const maybeNextRefreshToken = pickFirstString(
      data?.refreshToken,
      data?.refresh_token,
      data?.tokens?.refreshToken,
      data?.tokens?.refresh_token,
      data?.data?.refreshToken,
      data?.data?.refresh_token,
      data?.session?.refreshToken,
      data?.session?.refresh_token,
      data?.session?.tokens?.refreshToken,
      data?.session?.tokens?.refresh_token,
    );

    if (!nextAccessToken) {
      throw new TokenRefreshError('Refresh response did not include an access token');
    }

    const resolvedRefreshToken = maybeNextRefreshToken || currentRefreshToken;

    setTokenStoreTokens(nextAccessToken, resolvedRefreshToken);
    setAccessToken(nextAccessToken);
    if (resolvedRefreshToken !== refreshToken) {
      setRefreshToken(resolvedRefreshToken);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('AccessToken', nextAccessToken);
        localStorage.setItem('RefreshToken', resolvedRefreshToken);
        localStorage.setItem(
          LOCAL_STORAGE_AUTH_KEY,
          JSON.stringify({
            access_token: nextAccessToken,
            refresh_token: resolvedRefreshToken,
            user_id: authUserId || '',
          }),
        );
      } catch (_) {}
    }

    return nextAccessToken;
  }, [authUserId, refreshToken]);

  const logoutDueToRefreshFailure = useCallback(async () => {
    setErrorMessage('');
    try {
      await user?.signOut({ redirectUrl: '/' });
    } catch (_) {}
    setUser(null);
    setAccessToken('');
    setRefreshToken('');
    setAuthUserId('');
    setTokenStoreTokens('', '');
    setEntryList([]);
    setIsLoading(false);
    setViewedHistory([]);
    setRandomHistory([]);
    setRandomHistoryPos(-1);
    initialPositionResolvedRef.current = false;
    setIsHistoryLoaded(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
        localStorage.removeItem('AccessToken');
        localStorage.removeItem('RefreshToken');
        localStorage.removeItem('AuthUserId');
        localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
      }
    } catch (_) {}
  }, [user]);

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
    if (authLoading) return;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;

    let isActive = true;

    const fetchVocabularyFromApi = async (allowRefresh = true) => {
      const headers = { Accept: 'application/json' };
      const currentAccessToken = tokenStore.accessToken || accessToken;
      if (currentAccessToken) {
        headers.Authorization = `Bearer ${currentAccessToken}`;
      }

      const response = await fetch(VOCABULARY_URL, { method: 'GET', headers });

      if (response.status === 401 && allowRefresh) {
        if (tokenStore.refreshToken) {
          try {
            await refreshAccessToken();
          } catch (refreshError) {
            await logoutDueToRefreshFailure();
            throw refreshError;
          }
          return fetchVocabularyFromApi(false);
        }
        await logoutDueToRefreshFailure();
        throw new TokenRefreshError('Refresh token missing for retry');
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return response.json();
    };

    async function loadVocabulary() {
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
        if (cached) {
          const cachedObject = JSON.parse(cached);
          if (!isActive) return;
          const entriesFromCache = mapApiDataToEntries(cachedObject);
          setEntryList(entriesFromCache);
          setIsLoading(false);
        }

        const data = await fetchVocabularyFromApi(true);

        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }

        if (!isActive) return;
        const entries = mapApiDataToEntries(data);
        setEntryList(entries);
        setErrorMessage('');
        setIsLoading(false);
      } catch (error) {
        if (!isActive) return;
        if (error instanceof TokenRefreshError) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        setIsLoading(false);
      }
    }

    loadVocabulary();

    return () => {
      isActive = false;
    };
  }, [authLoading, user, accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  // Load history on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHistoryLoaded(true);
      return;
    }
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
    } finally {
      setIsHistoryLoaded(true);
    }
  }, [authLoading, user, accessToken]);

  // Rebuild navigation order whenever entries or history change
  useEffect(() => {
    if (entryList.length === 0) {
      setOrderIndices([]);
      initialPositionResolvedRef.current = false;
      return;
    }

    const ord = buildDefaultOrder(entryList.length);
    setOrderIndices(ord);

    if (!isHistoryLoaded) {
      return;
    }

    if (!initialPositionResolvedRef.current) {
      let targetIndex = -1;

      if (viewedHistory.length > 0) {
        let targetEntry = null;
        if (isRandomOrder) {
          targetEntry = viewedHistory[viewedHistory.length - 1];
        } else {
          targetEntry = viewedHistory.reduce((latest, item) => {
            const latestTime = typeof latest?.viewedAt === 'number' ? latest.viewedAt : -Infinity;
            const currentTime = typeof item?.viewedAt === 'number' ? item.viewedAt : -Infinity;
            if (currentTime >= latestTime) return item;
            return latest;
          }, null);
          if (!targetEntry) {
            targetEntry = viewedHistory[viewedHistory.length - 1];
          }
        }

        if (targetEntry) {
          if (typeof targetEntry.id === 'number') {
            targetIndex = entryList.findIndex((entry) => entry.id === targetEntry.id);
          }
          if (targetIndex === -1 && targetEntry.word) {
            targetIndex = entryList.findIndex((entry) => entry.word === targetEntry.word);
          }
        }
      }

      const fallbackIndex = ord.length > 0 ? ord[0] : 0;
      const resolvedIndex = targetIndex >= 0 ? targetIndex : fallbackIndex;
      setCurrentIndex(resolvedIndex);
      if (isRandomOrder) {
        setRandomHistory([resolvedIndex]);
        setRandomHistoryPos(0);
      }
      initialPositionResolvedRef.current = true;
      return;
    }

    setCurrentIndex((prevIndex) => (ord.includes(prevIndex) ? prevIndex : ord[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryList, viewedHistory, isHistoryLoaded, isRandomOrder]);

  // Seed random history when random mode is enabled
  useEffect(() => {
    if (!isRandomOrder) return;
    if (entryList.length === 0) return;
    if (randomHistory.length === 0 || randomHistoryPos === -1) {
      setRandomHistory([currentIndex]);
      setRandomHistoryPos(0);
    }
  }, [isRandomOrder]);

  const learningEntries = useMemo(
    () => viewedHistory
      .filter((item) => item && item.word && item.translation)
      .map(({ word, translation, id }) => ({
        word,
        translation,
        id,
      })),
    [viewedHistory],
  );

  useEffect(() => {
    if (!isLearningMode) return;
    if (learningEntries.length === 0) {
      setLearningIndex(0);
      return;
    }
    setLearningIndex((prev) => {
      if (prev >= learningEntries.length) {
        return 0;
      }
      return prev;
    });
  }, [isLearningMode, learningEntries.length]);

  useEffect(() => {
    setRevealedTranslations({});
  }, [isLearningMode]);

  // Track viewed words whenever the current entry changes
  useEffect(() => {
    if (isLearningMode) return;
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
  }, [currentIndex, entryList, isLearningMode]);

  // Clear generated sentence when navigating to a different word
  useEffect(() => {
    setGeneratedSentence('');
    setIsGenerating(false);
  }, [currentIndex, learningIndex, isLearningMode]);

  const handleAdvance = useCallback(() => {
    if (isLearningMode) {
      if (learningEntries.length === 0) return;
      setLearningIndex((prev) => (prev + 1) % learningEntries.length);
      return;
    }
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
  }, [
    isLearningMode,
    learningEntries.length,
    isLoading,
    entryList.length,
    orderIndices,
    currentIndex,
    isRandomOrder,
    randomHistory,
    randomHistoryPos,
  ]);

  const handleBack = useCallback(() => {
    if (isLearningMode) {
      if (learningEntries.length === 0) return;
      setLearningIndex((prev) => {
        if (learningEntries.length === 0) return prev;
        return (prev - 1 + learningEntries.length) % learningEntries.length;
      });
      return;
    }
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
  }, [
    isLearningMode,
    learningEntries.length,
    isLoading,
    entryList.length,
    orderIndices,
    currentIndex,
    isRandomOrder,
    randomHistoryPos,
    randomHistory,
  ]);

  const activeEntries = isLearningMode ? learningEntries : entryList;
  const activeIndex = isLearningMode ? learningIndex : currentIndex;
  const currentEntry = activeEntries.length > 0 ? activeEntries[activeIndex] : null;
  const displayWord = currentEntry ? currentEntry.word : '';
  const displayTranslation = currentEntry ? currentEntry.translation : '';
  const isTranslationRevealed = !isLearningMode || !currentEntry
    ? true
    : Boolean(revealedTranslations[currentEntry.word]);
  const isLearningAvailable = learningEntries.length > 0;

  useEffect(() => {
    if (isLearningMode && !isLearningAvailable) {
      setIsLearningMode(false);
    }
  }, [isLearningMode, isLearningAvailable]);

  async function handleGenerateSentence(event) {
    event.stopPropagation();
    if (!displayWord || !selectedLevel || !selectedTopic || isGenerating) return;
    try {
      setIsGenerating(true);
      setGeneratedSentence('');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: displayWord, level: selectedLevel, topic: selectedTopic }),
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
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          padding: 'env(safe-area-inset-top) 1rem 1rem',
          boxSizing: 'border-box',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user && !accessToken) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          paddingTop: 'calc(2rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
          paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
          paddingRight: 'calc(2rem + env(safe-area-inset-right))',
          background: 'var(--page-bg)',
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
      >
        <form
          onSubmit={handleEmailPasswordSignIn}
          style={{ width: 'min(380px, 95vw)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', boxShadow: 'var(--shadow-elevated)', background: 'var(--surface)', color: 'var(--text-primary)' }}
        >
          <h1 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.15rem', textAlign: 'center' }}>Envibe</h1>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.4rem', fontSize: '16px', boxSizing: 'border-box', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Password</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: '0.5rem 2.4rem 0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.4rem', fontSize: '16px', boxSizing: 'border-box', width: '100%', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: 'var(--text-secondary)',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? 'H' : 'S'}
              </button>
            </div>
          </label>
          {authError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{authError}</div>
          )}
          <button
            type="submit"
            style={{ marginTop: '1rem', width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', color: 'var(--text-on-accent)', cursor: 'pointer', fontSize: '16px', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Sign In
          </button>
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
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '2rem',
        paddingTop: 'calc(2rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
        paddingRight: 'calc(2rem + env(safe-area-inset-right))',
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'Inter, sans-serif',
        background: 'var(--page-bg)',
        color: 'var(--text-primary)',
        transition: 'background-color 0.25s ease, color 0.25s ease',
        boxSizing: 'border-box',
      }}
    >
      {/* Settings */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsSettingsOpen(true);
        }}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 1rem)',
          right: 'calc(env(safe-area-inset-right) + 1rem)',
          padding: '0.4rem 0.7rem',
          borderRadius: '0.4rem',
          border: '1px solid var(--border-color)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: 'var(--text-primary)',
          WebkitAppearance: 'none',
          appearance: 'none',
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
            try { localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY); } catch (_) {}
            setAccessToken('');
            setRefreshToken('');
            setAuthUserId('');
            setTokenStoreTokens('', '');
            setViewedHistory([]);
            setEntryList([]);
            setRandomHistory([]);
            setRandomHistoryPos(-1);
            initialPositionResolvedRef.current = false;
            setIsHistoryLoaded(false);
            setIsLearningMode(false);
            setLearningIndex(0);
            setRevealedTranslations({});
            setSelectedTopic('random');
          } catch (_) {}
        }}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 1rem)',
          left: 'calc(env(safe-area-inset-left) + 1rem)',
          padding: '0.4rem 0.7rem',
          borderRadius: '0.4rem',
          border: '1px solid var(--border-color)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: 'var(--text-primary)',
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
        aria-label="Sign out"
      >
        Sign Out
      </button>

      {/* Learning mode */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!isLearningAvailable) {
            if (typeof window !== 'undefined') {
              window.alert('Learning Mode will be available once you have viewed a few words in the dictionary');
            }
            return;
          }
          setIsLearningMode((prev) => {
            const next = !prev;
            if (next) {
              setLearningIndex(0);
            }
            return next;
          });
        }}
        aria-pressed={isLearningMode}
        aria-disabled={!isLearningAvailable}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 1rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.4rem 0.9rem',
          borderRadius: '0.4rem',
          border: `1px solid ${isLearningMode ? 'var(--accent-strong)' : 'var(--border-color)'}`,
          background: isLearningMode ? 'var(--accent-strong)' : 'var(--surface)',
          color: isLearningMode ? 'var(--text-on-accent)' : 'var(--text-primary)',
          cursor: isLearningAvailable ? 'pointer' : 'not-allowed',
          fontSize: '0.85rem',
          WebkitAppearance: 'none',
          appearance: 'none',
          opacity: isLearningAvailable ? 1 : 0.6,
        }}
      >
        Learning Mode
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
          border: '1px solid var(--border-color)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: '1.2rem',
          lineHeight: 1,
          color: 'var(--text-primary)',
          WebkitAppearance: 'none',
          appearance: 'none',
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
          border: '1px solid var(--border-color)',
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: '1.2rem',
          lineHeight: 1,
          color: 'var(--text-primary)',
          WebkitAppearance: 'none',
          appearance: 'none',
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
              gap: '1.5rem',
              width: 'min(420px, calc(100vw - 4rem))',
              boxSizing: 'border-box',
            }}
          >
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--accent-strong)' }}>{displayWord}</h1>
            <div
              style={{
                width: '100%',
                padding: '24px 3rem',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {isLearningMode && currentEntry && !isTranslationRevealed ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!currentEntry?.word) return;
                    setRevealedTranslations((prev) => ({ ...prev, [currentEntry.word]: true }));
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
            <button
              type="button"
              onClick={handleGenerateSentence}
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
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  background: 'var(--surface)',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  color: 'var(--accent-strong)',
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
            background: 'var(--overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Viewed words history"
        >
          <div style={{ background: 'var(--surface)', width: 'min(700px, 95vw)', maxHeight: '80vh', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: 'var(--shadow-elevated)', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
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
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-on-accent)', WebkitAppearance: 'none', appearance: 'none' }}
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
                    <li key={`${item.id ?? 'noid'}-${index}`} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
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
          onClick={() => setIsSettingsOpen(false)}
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
          aria-label="Settings"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', width: 'min(700px, 95vw)', borderRadius: '0.6rem', overflow: 'hidden', boxShadow: 'var(--shadow-elevated)', color: 'var(--text-primary)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <strong>Settings</strong>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-on-accent)', WebkitAppearance: 'none', appearance: 'none' }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Theme</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.4rem',
                    border: `1px solid ${isRandomOrder ? 'var(--accent-strong)' : 'var(--border-color)'}`,
                    background: isRandomOrder ? 'var(--accent-strong)' : 'var(--surface)',
                    color: isRandomOrder ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                >
                  {theme === 'light' ? 'Light' : 'Dark'}
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Random words order</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const enabled = !isRandomOrder;
                    setIsRandomOrder(enabled);
                    try { localStorage.setItem(LOCAL_STORAGE_RANDOM_KEY, enabled ? 'true' : 'false'); } catch (_) {}
                    // Reset random history when toggling mode
                    setRandomHistory([]);
                    setRandomHistoryPos(-1);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.4rem',
                    border: `1px solid ${isRandomOrder ? 'var(--accent-strong)' : 'var(--border-color)'}`,
                    background: isRandomOrder ? 'var(--accent-strong)' : 'var(--surface)',
                    color: isRandomOrder ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                >
                  {isRandomOrder ? 'On' : 'Off'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>History</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsHistoryOpen(true); setIsSettingsOpen(false); }}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Open
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Reset cache</div>
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
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Reset
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>English level</div>
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
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                >
                  {['A1','A2','B1','B2','C1','C2'].map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Sentence topic</div>
                </div>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', minWidth: '9rem' }}
                >
                  {SENTENCE_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.value} value={topic.value}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
