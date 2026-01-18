import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import { stackClientApp } from '../stack/client';
import { SENTENCE_TOPIC_OPTIONS } from '../lib/sentenceTopics';

const VOCABULARY_URL = 'https://YOUR_NEON_REST_HOST/neondb/rest/v1/vocabulary';
const DICTIONARY_URL = 'https://YOUR_NEON_REST_HOST/neondb/rest/v1/dictionary';
const LOCAL_STORAGE_KEY = 'vocabularyData';
const LOCAL_STORAGE_DICTIONARY_KEY = 'dictionaryData';
const LOCAL_STORAGE_SELECTED_DICTIONARY_KEY = 'selectedDictionaryId';
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
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) return;
      setSelectedDictionaryId(parsed);
    } catch (_) {}
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
        const msg = res?.error?.message || 'Failed to sign in';
        setAuthError(msg);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Failed to sign in');
    }
  }
  const [allEntries, setAllEntries] = useState([]);
  const [entryList, setEntryList] = useState([]);
  const [dictionaryList, setDictionaryList] = useState([]);
  const [selectedDictionaryId, setSelectedDictionaryId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newDictionaryId, setNewDictionaryId] = useState(null);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);
  const [isAddLoading, setIsAddLoading] = useState(false);
  const [isAddDictionaryModalOpen, setIsAddDictionaryModalOpen] = useState(false);
  const [newDictionaryTitle, setNewDictionaryTitle] = useState('');
  const [newDictionaryLanguage, setNewDictionaryLanguage] = useState('');
  const [addDictionaryError, setAddDictionaryError] = useState('');
  const [addDictionarySuccess, setAddDictionarySuccess] = useState(false);
  const [isAddDictionaryLoading, setIsAddDictionaryLoading] = useState(false);
  const [isSentenceCopied, setIsSentenceCopied] = useState(false);
  const [isSentenceGenerationHidden, setIsSentenceGenerationHidden] = useState(false);
  const [searchOverrideEntry, setSearchOverrideEntry] = useState(null);
  const toggleButtonStyle = useCallback((active) => ({
    padding: '0.4rem 0.8rem',
    borderRadius: '0.4rem',
    border: `1px solid ${active ? 'var(--accent-strong)' : 'var(--border-color)'}`,
    background: active ? 'var(--accent-strong)' : 'var(--surface)',
    color: active ? 'var(--text-on-accent)' : 'var(--text-primary)',
    cursor: 'pointer',
    WebkitAppearance: 'none',
    appearance: 'none',
  }), []);
  const blurSearchInput = useCallback(() => {
    setIsSearchFocused(false);
    if (searchInputRef.current && typeof searchInputRef.current.blur === 'function') {
      searchInputRef.current.blur();
    }
  }, []);
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

  const mapApiDataToEntries = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item && (item.key !== undefined) && (item.translate !== undefined))
      .sort((a, b) => {
        const aId = typeof a.id === 'number' ? a.id : Number.MAX_SAFE_INTEGER;
        const bId = typeof b.id === 'number' ? b.id : Number.MAX_SAFE_INTEGER;
        return aId - bId;
      })
      .map(({ key, translate, id, dict_id }) => {
        const parsedDictId = typeof dict_id === 'number' ? dict_id : Number(dict_id);
        return {
          id: typeof id === 'number' ? id : undefined,
          word: String(key),
          translation: String(translate),
          dict_id: Number.isFinite(parsedDictId) ? parsedDictId : undefined,
        };
      });
  }, []);

  const mapApiDataToDictionaries = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        if (!item) return null;
        const parsedId = typeof item.id === 'number' ? item.id : Number(item.id);
        if (!Number.isFinite(parsedId) || item.title === undefined) return null;
        return {
          id: parsedId,
          lang: typeof item.lang === 'string' ? item.lang : '',
          title: String(item.title).trim(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
  }, []);

  const fetchVocabularyFromApi = useCallback(async (allowRefresh = true) => {
    const headers = { Accept: 'application/json' };
    const currentAccessToken = tokenStore.accessToken || accessToken;
    if (currentAccessToken) {
      headers.Authorization = `Bearer ${currentAccessToken}`;
    }

    const response = await fetch(VOCABULARY_URL, { method: 'GET', headers });

    if (response.status === 400 && allowRefresh) {
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
  }, [accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  const fetchDictionaryFromApi = useCallback(async (allowRefresh = true) => {
    const headers = { Accept: 'application/json' };
    const currentAccessToken = tokenStore.accessToken || accessToken;
    if (currentAccessToken) {
      headers.Authorization = `Bearer ${currentAccessToken}`;
    }

    const response = await fetch(DICTIONARY_URL, { method: 'GET', headers });

    if (response.status === 400 && allowRefresh) {
      if (tokenStore.refreshToken) {
        try {
          await refreshAccessToken();
        } catch (refreshError) {
          await logoutDueToRefreshFailure();
          throw refreshError;
        }
        return fetchDictionaryFromApi(false);
      }
      await logoutDueToRefreshFailure();
      throw new TokenRefreshError('Refresh token missing for retry');
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }, [accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  const loadDictionary = useCallback(async (options = {}) => {
    const { skipCache = false, isActiveRef } = options;
    const isActive = () => !isActiveRef || isActiveRef.active;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;
    try {
      setIsDictionaryLoading(true);
      if (!skipCache && typeof window !== 'undefined') {
        const cached = localStorage.getItem(LOCAL_STORAGE_DICTIONARY_KEY);
        if (cached) {
          const cachedObject = JSON.parse(cached);
          if (!isActive()) return;
          const dictionariesFromCache = mapApiDataToDictionaries(cachedObject);
          setDictionaryList(dictionariesFromCache);
          setIsDictionaryLoading(false);
          setSelectedDictionaryId((prevId) => {
            if (dictionariesFromCache.length === 0) return null;
            if (prevId && dictionariesFromCache.some((dict) => dict.id === prevId)) {
              return prevId;
            }
            return dictionariesFromCache[0].id;
          });
        }
      }

      const data = await fetchDictionaryFromApi(true);

      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_DICTIONARY_KEY, JSON.stringify(data));
      }

      if (!isActive()) return;
      const dictionaries = mapApiDataToDictionaries(data);
      setDictionaryList(dictionaries);
      setSelectedDictionaryId((prevId) => {
        if (dictionaries.length === 0) return null;
        if (prevId && dictionaries.some((dict) => dict.id === prevId)) {
          return prevId;
        }
        return dictionaries[0].id;
      });
      setIsDictionaryLoading(false);
    } catch (error) {
      if (!isActive()) return;
      if (error instanceof TokenRefreshError) {
        return;
      }
      setIsDictionaryLoading(false);
    }
  }, [accessToken, user, fetchDictionaryFromApi, mapApiDataToDictionaries]);

  const loadVocabulary = useCallback(async (options = {}) => {
    const { skipCache = false, isActiveRef } = options;
    const isActive = () => !isActiveRef || isActiveRef.active;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;
    try {
      setIsLoading(true);
      if (!skipCache && typeof window !== 'undefined') {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const cachedObject = JSON.parse(cached);
          if (!isActive()) return;
          const entriesFromCache = mapApiDataToEntries(cachedObject);
          setAllEntries(entriesFromCache);
          setIsLoading(false);
        }
      }

      const data = await fetchVocabularyFromApi(true);

      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      }

      if (!isActive()) return;
      const entries = mapApiDataToEntries(data);
      setAllEntries(entries);
      setErrorMessage('');
      setIsLoading(false);
    } catch (error) {
      if (!isActive()) return;
      if (error instanceof TokenRefreshError) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [accessToken, user, fetchVocabularyFromApi, mapApiDataToEntries]);

  const addWordToApi = useCallback(async (payload, allowRefresh = true) => {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    const currentAccessToken = tokenStore.accessToken || accessToken;
    if (currentAccessToken) {
      headers.Authorization = `Bearer ${currentAccessToken}`;
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    try {
      const response = await fetch(VOCABULARY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 400 && allowRefresh) {
        if (tokenStore.refreshToken) {
          try {
            await refreshAccessToken();
          } catch (refreshError) {
            await logoutDueToRefreshFailure();
            throw refreshError;
          }
          return addWordToApi(payload, false);
        }
        await logoutDueToRefreshFailure();
        throw new TokenRefreshError('Refresh token missing for retry');
      }

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const err = await response.json();
          if (err && (err.message || err.error)) {
            message = err.message || err.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle timeout/abort error
      if (error.name === 'AbortError') {
        throw new Error('Failed to add word');
      }
      
      // Re-throw other errors
      throw error;
    }
  }, [accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  const addDictionaryToApi = useCallback(async (payload, allowRefresh = true) => {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    const currentAccessToken = tokenStore.accessToken || accessToken;
    if (currentAccessToken) {
      headers.Authorization = `Bearer ${currentAccessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(DICTIONARY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 400 && allowRefresh) {
        if (tokenStore.refreshToken) {
          try {
            await refreshAccessToken();
          } catch (refreshError) {
            await logoutDueToRefreshFailure();
            throw refreshError;
          }
          return addDictionaryToApi(payload, false);
        }
        await logoutDueToRefreshFailure();
        throw new TokenRefreshError('Refresh token missing for retry');
      }

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const err = await response.json();
          if (err && (err.message || err.error)) {
            message = err.message || err.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Failed to add dictionary');
      }

      throw error;
    }
  }, [accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  const openAddModal = useCallback((prefill = '') => {
    const normalized = prefill.trim().slice(0, 50);
    setNewWord(normalized);
    setNewTranslation('');
    setNewDictionaryId(selectedDictionaryId);
    setAddError('');
    setAddSuccess(false);
    setIsAddLoading(false);
    setIsAddModalOpen(true);
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    blurSearchInput();
  }, [blurSearchInput, selectedDictionaryId]);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setAddError('');
    setAddSuccess(false);
    setIsAddLoading(false);
  }, []);

  const openAddDictionaryModal = useCallback(() => {
    setNewDictionaryTitle('');
    setNewDictionaryLanguage('');
    setAddDictionaryError('');
    setAddDictionarySuccess(false);
    setIsAddDictionaryLoading(false);
    setIsAddDictionaryModalOpen(true);
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    blurSearchInput();
  }, [blurSearchInput]);

  const closeAddDictionaryModal = useCallback(() => {
    setIsAddDictionaryModalOpen(false);
    setAddDictionaryError('');
    setAddDictionarySuccess(false);
    setIsAddDictionaryLoading(false);
  }, []);

  const handleAddWord = useCallback(async () => {
    const key = newWord.trim();
    const translate = newTranslation.trim();
    if (!key || !translate) {
      setAddError('Both fields are required');
      return;
    }
    if (!newDictionaryId) {
      setAddError('Dictionary is required');
      return;
    }
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) {
      setAddError('Authorization required');
      return;
    }
    try {
      setAddError('');
      setAddSuccess(false);
      setIsAddLoading(true);
      await addWordToApi({ key, translate, dict_id: newDictionaryId });
      setNewWord('');
      setNewTranslation('');
      setSearchTerm('');
      setIsSearchFocused(false);
      setAddSuccess(true);
      await loadVocabulary({ skipCache: true });
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to add word');
    } finally {
      setIsAddLoading(false);
    }
  }, [newWord, newTranslation, newDictionaryId, addWordToApi, loadVocabulary, accessToken, user]);

  const handleAddDictionary = useCallback(async () => {
    const title = newDictionaryTitle.trim();
    const language = newDictionaryLanguage.trim();
    if (!title) {
      setAddDictionaryError('Title is required');
      return;
    }
    if (!language) {
      setAddDictionaryError('Language is required');
      return;
    }
    if (!/^\p{L}+$/u.test(language)) {
      setAddDictionaryError('Language must contain only letters');
      return;
    }
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) {
      setAddDictionaryError('Authorization required');
      return;
    }
    try {
      setAddDictionaryError('');
      setAddDictionarySuccess(false);
      setIsAddDictionaryLoading(true);
      await addDictionaryToApi({ title, lang: language.toLowerCase() });
      setNewDictionaryTitle('');
      setNewDictionaryLanguage('');
      setAddDictionarySuccess(true);
      await loadDictionary({ skipCache: true });
      await loadVocabulary({ skipCache: true });
    } catch (error) {
      setAddDictionaryError(error instanceof Error ? error.message : 'Failed to add dictionary');
    } finally {
      setIsAddDictionaryLoading(false);
    }
  }, [newDictionaryTitle, newDictionaryLanguage, addDictionaryToApi, loadDictionary, loadVocabulary, accessToken, user]);

  useEffect(() => {
    if (authLoading) return;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;

    const state = { active: true };
    loadVocabulary({ isActiveRef: state });

    return () => {
      state.active = false;
    };
  }, [authLoading, user, accessToken, loadVocabulary]);

  useEffect(() => {
    if (authLoading) return;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;

    const state = { active: true };
    loadDictionary({ isActiveRef: state });

    return () => {
      state.active = false;
    };
  }, [authLoading, user, accessToken, loadDictionary]);

  useEffect(() => {
    if (isMenuOpen || isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) {
      blurSearchInput();
    }
  }, [isMenuOpen, isSettingsOpen, isAddModalOpen, isAddDictionaryModalOpen, blurSearchInput]);

  useEffect(() => {
    if (selectedDictionaryId === null) {
      setEntryList(allEntries);
      return;
    }
    setEntryList(allEntries.filter((entry) => entry.dict_id === selectedDictionaryId));
  }, [allEntries, selectedDictionaryId]);

  useEffect(() => {
    if (selectedDictionaryId === null) return;
    initialPositionResolvedRef.current = false;
    setRandomHistory([]);
    setRandomHistoryPos(-1);
    setSearchOverrideEntry(null);
  }, [selectedDictionaryId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedDictionaryId === null) {
        localStorage.removeItem(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
        return;
      }
      localStorage.setItem(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY, String(selectedDictionaryId));
    } catch (_) {}
  }, [selectedDictionaryId]);

  useEffect(() => {
    if (newDictionaryId !== null) return;
    if (selectedDictionaryId === null) return;
    setNewDictionaryId(selectedDictionaryId);
  }, [newDictionaryId, selectedDictionaryId]);

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

  const filteredViewedHistory = useMemo(() => {
    if (selectedDictionaryId === null) return viewedHistory;
    return viewedHistory.filter((item) => item && item.dict_id === selectedDictionaryId);
  }, [viewedHistory, selectedDictionaryId]);

  const learningEntries = useMemo(
    () => filteredViewedHistory
      .filter((item) => item && item.word && item.translation)
      .map(({ word, translation, id }) => ({
        word,
        translation,
        id,
      })),
    [filteredViewedHistory],
  );

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

      if (filteredViewedHistory.length > 0) {
        let targetEntry = null;
        if (isRandomOrder) {
          targetEntry = filteredViewedHistory[filteredViewedHistory.length - 1];
        } else {
          targetEntry = filteredViewedHistory.reduce((latest, item) => {
            const latestTime = typeof latest?.viewedAt === 'number' ? latest.viewedAt : -Infinity;
            const currentTime = typeof item?.viewedAt === 'number' ? item.viewedAt : -Infinity;
            if (currentTime >= latestTime) return item;
            return latest;
          }, null);
          if (!targetEntry) {
            targetEntry = filteredViewedHistory[filteredViewedHistory.length - 1];
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
  }, [entryList, filteredViewedHistory, isHistoryLoaded, isRandomOrder]);

  // Seed random history when random mode is enabled
  useEffect(() => {
    if (!isRandomOrder) return;
    if (entryList.length === 0) return;
    if (randomHistory.length === 0 || randomHistoryPos === -1) {
      setRandomHistory([currentIndex]);
      setRandomHistoryPos(0);
    }
  }, [isRandomOrder]);

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length < 3) return [];

    const unique = new Set();
    allEntries.forEach((entry) => {
      if (!entry?.word) return;
      const lower = entry.word.toLowerCase();
      if (lower.includes(query)) {
        unique.add(entry.word);
      }
    });

    return Array.from(unique).slice(0, 5);
  }, [searchTerm, allEntries]);

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

  const addEntryToHistory = useCallback((entry) => {
    if (!entry?.word || !entry?.translation) return;
    setViewedHistory((prev) => {
      if (prev.some((h) => h && h.word === entry.word)) {
        return prev;
      }
      const next = [...prev, {
        id: entry.id ?? undefined,
        word: entry.word,
        translation: entry.translation,
        dict_id: entry.dict_id ?? undefined,
        viewedAt: Date.now(),
      }];
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Track viewed words whenever the current entry changes
  useEffect(() => {
    if (isLearningMode) return;
    if (typeof window === 'undefined') return;
    if (entryList.length === 0) return;
    const entry = entryList[currentIndex];
    if (!entry) return;

    addEntryToHistory(entry);
  }, [currentIndex, entryList, isLearningMode, addEntryToHistory]);

  useEffect(() => {
    if (isLearningMode) return;
    if (typeof window === 'undefined') return;
    if (!searchOverrideEntry) return;
    addEntryToHistory(searchOverrideEntry);
  }, [searchOverrideEntry, isLearningMode, addEntryToHistory]);

  // Clear generated sentence when navigating to a different word
  useEffect(() => {
    setGeneratedSentence('');
    setIsGenerating(false);
    setIsSentenceCopied(false);
  }, [currentIndex, learningIndex, isLearningMode]);

  const handleAdvance = useCallback(() => {
    if (searchOverrideEntry) {
      setSearchOverrideEntry(null);
    }
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
    searchOverrideEntry,
  ]);

  const handleBack = useCallback(() => {
    if (searchOverrideEntry) {
      setSearchOverrideEntry(null);
    }
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
    searchOverrideEntry,
  ]);

  const handleSignOut = useCallback(async () => {
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
      setAllEntries([]);
      setEntryList([]);
      setDictionaryList([]);
      setSelectedDictionaryId(null);
      setRandomHistory([]);
      setRandomHistoryPos(-1);
      initialPositionResolvedRef.current = false;
      setIsHistoryLoaded(false);
      setIsLearningMode(false);
      setLearningIndex(0);
      setRevealedTranslations({});
      setSearchOverrideEntry(null);
      setNewDictionaryId(null);
      setSelectedTopic('random');
    } catch (_) {}
  }, [user]);

  const selectedDictionary = useMemo(
    () => dictionaryList.find((dict) => dict.id === selectedDictionaryId) || null,
    [dictionaryList, selectedDictionaryId],
  );
  const selectedDictionaryTitle = selectedDictionary?.title ? String(selectedDictionary.title) : '';
  const selectedTopicLabel = useMemo(() => {
    const match = SENTENCE_TOPIC_OPTIONS.find((topic) => topic.value === selectedTopic);
    return match?.label ? String(match.label) : String(selectedTopic || '');
  }, [selectedTopic]);

  const activeEntries = isLearningMode ? learningEntries : entryList;
  const activeIndex = isLearningMode ? learningIndex : currentIndex;
  const currentEntry = activeEntries.length > 0 ? activeEntries[activeIndex] : null;
  const displayedEntry = (!isLearningMode && searchOverrideEntry) ? searchOverrideEntry : currentEntry;
  const displayWord = displayedEntry ? displayedEntry.word : '';
  const displayTranslation = displayedEntry ? displayedEntry.translation : '';
  const isTranslationRevealed = !isLearningMode || !displayedEntry
    ? true
    : Boolean(revealedTranslations[displayedEntry.word]);
  const isLearningAvailable = learningEntries.length > 0;
  const isEmptyDictionaryState = !isLoading
    && !errorMessage
    && !displayedEntry
    && selectedDictionaryId !== null
    && entryList.length === 0;

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
      const dict = selectedDictionary?.lang;
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: displayWord,
          dict,
          level: selectedLevel,
          topic: selectedTopic,
        }),
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

  const handleSelectSuggestion = useCallback((word) => {
    const normalized = word?.trim();
    if (!normalized) return;
    const targetEntry = allEntries.find(
      (entry) => entry?.word && entry.word.toLowerCase() === normalized.toLowerCase(),
    );
    if (!targetEntry) {
      return;
    }

    setIsLearningMode(false);
    setGeneratedSentence('');
    setIsGenerating(false);
    setIsMenuOpen(false);
    setIsSearchFocused(false);
    if (searchInputRef.current && typeof searchInputRef.current.blur === 'function') {
      searchInputRef.current.blur();
    }
    setSearchTerm('');

    setSearchOverrideEntry({
      id: targetEntry.id ?? undefined,
      word: targetEntry.word,
      translation: targetEntry.translation,
      dict_id: targetEntry.dict_id ?? undefined,
    });
  }, [allEntries]);

  // Gate: show auth UI first
  if (authLoading) {
    return (
      <>
        <Head>
          <title>Envibe Vocabulary</title>
          <meta name="description" content="Envibe Vocabulary" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
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
      </>
    );
  }

  if (!user && !accessToken) {
    return (
      <>
            <Head>
        <title>Envibe Sign In</title>
        <meta name="description" content="Envibe Sign In" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
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
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Envibe Vocabulary</title>
        <meta name="description" content="Envibe Vocabulary" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
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
      {/* Top bar */}
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 0.75rem)',
          left: 'calc(env(safe-area-inset-left) + 0.75rem)',
          right: 'calc(env(safe-area-inset-right) + 0.75rem)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: '0.8rem',
          zIndex: (isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) ? 1 : 12,
          pointerEvents: (isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
        }}
      >
        <button
          type="button"
          aria-label="Toggle menu"
          aria-pressed={isMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          style={{
            width: '44px',
            height: '26px',
            borderRadius: 'none',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            gap: '4px',
            transform: isMenuOpen ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        >
          {[0, 1, 2].map((line) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`burger-line-${line}`}
              style={{
                width: '18px',
                height: '1px',
                borderRadius: '999px',
                background: 'var(--text-primary)',
                display: 'block',
              }}
            />
          ))}
        </button>
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '520px', 
            justifySelf: 'center',
            pointerEvents: (isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
            zIndex: (isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) ? 1 : 10
            }}>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              // Allow suggestion click to fire before hiding
              setTimeout(() => setIsSearchFocused(false), 80);
            }}
            ref={searchInputRef}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search..."
            style={{
              width: '100%',
              padding: '0.55rem 0.8rem',
              borderRadius: '0.55rem',
              border: '1px solid var(--border-color)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '16px',
              boxSizing: 'border-box',
              pointerEvents: (isSettingsOpen || isAddModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
            }}
          />
          {searchTerm.trim().length >= 3 && isSearchFocused && (
            <div
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.35rem)',
                left: 0,
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.55rem',
                boxShadow: 'var(--shadow-elevated)',
                padding: '0.35rem',
                display: 'grid',
                gap: '0.25rem',
                zIndex: 13,
              }}
            >
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleSelectSuggestion(word);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {word}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openAddModal(searchTerm);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.6rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  Add +
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sliding menu */}
      {isMenuOpen && (
        <div
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen(false);
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
          transform: isMenuOpen ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 0.25s ease',
          padding: 'calc(env(safe-area-inset-top) + 1.4rem) 1.25rem 1.25rem',
          boxShadow: 'var(--shadow-elevated)',
          zIndex: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem' }}>Menu</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Dictionary</div>
          <select
            value={selectedDictionaryId ?? ''}
            onChange={(event) => {
              event.stopPropagation();
              const nextValue = event.target.value;
              if (!nextValue) {
                setSelectedDictionaryId(null);
                return;
              }
              const nextId = Number(nextValue);
              setSelectedDictionaryId(Number.isNaN(nextId) ? null : nextId);
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
        <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.15rem -0.25rem 0', paddingTop: '0.35rem' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Learning mode</div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!isLearningAvailable) {
                if (typeof window !== 'undefined') {
                  window.alert('Learning Mode unlocks after you view a few words.');
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
            style={{ ...toggleButtonStyle(isLearningMode), opacity: isLearningAvailable ? 1 : 0.6, cursor: isLearningAvailable ? 'pointer' : 'not-allowed' }}
          >
            {isLearningMode ? 'On' : 'Off'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Random order</div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              const enabled = !isRandomOrder;
              setIsRandomOrder(enabled);
              try { localStorage.setItem(LOCAL_STORAGE_RANDOM_KEY, enabled ? 'true' : 'false'); } catch (_) {}
              setRandomHistory([]);
              setRandomHistoryPos(-1);
            }}
            style={toggleButtonStyle(isRandomOrder)}
          >
            {isRandomOrder ? 'On' : 'Off'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Add new word</div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openAddModal('');
            }}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Add
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.15rem -0.25rem 0', paddingTop: '0.35rem' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Settings</div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsAddModalOpen(false);
              setIsSettingsOpen(true);
              setIsMenuOpen(false);
              blurSearchInput();
            }}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Open
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontWeight: 600 }}>Sign out</div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen(false);
              handleSignOut();
            }}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Exit
          </button>
        </div>
      </div>

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
              {isLearningMode && displayedEntry && !isTranslationRevealed ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!displayedEntry?.word) return;
                    setRevealedTranslations((prev) => ({ ...prev, [displayedEntry.word]: true }));
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
            {!isSentenceGenerationHidden && (
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
            )}
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
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  display: 'grid',
                  gap: '0.35rem',
                }}
              >
                <div>{generatedSentence}</div>
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
                          setIsSentenceCopied(true);
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
              </div>
            )}
          </div>
        )}
        {isEmptyDictionaryState && (
          <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
            <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.4 }}>
              Dictionary {selectedDictionary?.title ? `"${selectedDictionary.title}"` : 'This dictionary'} doesn't contain any words. 
              <br />Use the button below to add new words.
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openAddModal('');
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

      {/* History overlay */}
      {isHistoryOpen && (
        <div
          onClick={() => setIsHistoryOpen(false)}
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
              {filteredViewedHistory.length === 0 ? (
                <p style={{ padding: '1rem', opacity: 0.7 }}>No viewed words yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {filteredViewedHistory.map((item, index) => (
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

      {/* Add word modal */}
      {isAddModalOpen && (
        <div
          onClick={closeAddModal}
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
                maxLength={50}
                value={newWord}
                onChange={(e) => setNewWord(e.target.value.slice(0, 50))}
                placeholder="Enter a new word"
                onKeyDown={(e) => e.stopPropagation()}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
              <span style={{ fontWeight: 600 }}>Translation</span>
              <input
                maxLength={50}
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value.slice(0, 50))}
                placeholder="Enter translation"
                onKeyDown={(e) => e.stopPropagation()}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
              <span style={{ fontWeight: 600 }}>Dictionary</span>
              <select
                value={newDictionaryId ?? ''}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (!nextValue) {
                    setNewDictionaryId(null);
                    return;
                  }
                  const nextId = Number(nextValue);
                  setNewDictionaryId(Number.isNaN(nextId) ? null : nextId);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={dictionaryList.length === 0 || isDictionaryLoading}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none', opacity: isDictionaryLoading ? 0.7 : 1 }}
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
              {addSuccess && (
                <div style={{ flex: '1 1 200px', textAlign: 'left', paddingLeft: '0.65rem', color: 'var(--accent-strong)', marginRight: 'auto' }}>
                  Word successfully added
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddWord();
                  }}
                  disabled={isAddLoading}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', color: 'var(--text-on-accent)', cursor: isAddLoading ? 'default' : 'pointer', WebkitAppearance: 'none', appearance: 'none', opacity: isAddLoading ? 0.85 : 1 }}
                >
                  {isAddLoading ? (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAddModal();
                  }}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Close
                </button>
              </div>
            </div>
            {addError && (
              <div style={{ color: 'var(--danger)', textAlign: 'left', fontSize: '0.9rem' }}>{addError}</div>
            )}
          </div>
        </div>
      )}

      {/* Add dictionary modal */}
      {isAddDictionaryModalOpen && (
        <div
          onClick={closeAddDictionaryModal}
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
                maxLength={36}
                value={newDictionaryTitle}
                onChange={(e) => setNewDictionaryTitle(e.target.value.slice(0, 36))}
                placeholder="Enter dictionary title"
                onKeyDown={(e) => e.stopPropagation()}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', textAlign: 'left' }}>
              <span style={{ fontWeight: 600 }}>Language</span>
              <input
                maxLength={16}
                value={newDictionaryLanguage}
                onChange={(e) => {
                  const filtered = e.target.value.replace(/[^\p{L}]/gu, '').slice(0, 16);
                  setNewDictionaryLanguage(filtered);
                }}
                placeholder="Enter language"
                onKeyDown={(e) => e.stopPropagation()}
                style={{ padding: '0.55rem 0.65rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', alignContent: 'center' }}>
              {addDictionarySuccess && (
                <div style={{ flex: '1 1 200px', textAlign: 'left', paddingLeft: '0.65rem', color: 'var(--accent-strong)', marginRight: 'auto' }}>
                  Dictionary successfully added
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddDictionary();
                  }}
                  disabled={isAddDictionaryLoading}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', color: 'var(--text-on-accent)', cursor: isAddDictionaryLoading ? 'default' : 'pointer', WebkitAppearance: 'none', appearance: 'none', opacity: isAddDictionaryLoading ? 0.85 : 1 }}
                >
                  {isAddDictionaryLoading ? (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    closeAddDictionaryModal();
                  }}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.45rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Close
                </button>
              </div>
            </div>
            {addDictionaryError && (
              <div style={{ color: 'var(--danger)', textAlign: 'left', fontSize: '0.9rem' }}>{addDictionaryError}</div>
            )}
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
            zIndex: 100,
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
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Dark theme</div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
                  }}
                  style={toggleButtonStyle(theme === 'dark')}
                >
                  {theme === 'dark' ? 'On' : 'Off'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Hide sentence generation</div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsSentenceGenerationHidden((prev) => !prev);
                  }}
                  style={toggleButtonStyle(isSentenceGenerationHidden)}
                >
                  {isSentenceGenerationHidden ? 'On' : 'Off'}
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
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Reset cache and history</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                        localStorage.removeItem(LOCAL_STORAGE_DICTIONARY_KEY);
                        localStorage.removeItem(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
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
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Language level</div>
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
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '0.45rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
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
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '0.45rem',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    width: `calc(${Math.max(6, selectedTopicLabel.length)}ch + 1.2rem)`,
                    maxWidth: '100%',
                    textAlign: 'center',
                    textAlignLast: 'center',
                    fontSize: '0.95rem',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                >
                  {SENTENCE_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.value} value={topic.value}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0' }}>
                <div>
                  <div style={{ textAlign: 'left', margin: 0, fontWeight: 600 }}>Add new dictionary</div>
                </div>
                <button
                  type="button"
                  onClick={openAddDictionaryModal}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid var(--border-color)', background: 'var(--surface)', borderRadius: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', WebkitAppearance: 'none', appearance: 'none' }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
