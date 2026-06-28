import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import { stackClientApp } from '../stack/client';
import { SENTENCE_TOPIC_OPTIONS } from '../lib/sentenceTopics';
import { TRANSLATION_LANGUAGE_OPTIONS, DEFAULT_TRANSLATION_LANGUAGE_CODE } from '../lib/translationLanguages';
import {
  VOCABULARY_URL,
  DICTIONARY_URL,
  LOCAL_STORAGE_KEY,
  LOCAL_STORAGE_DICTIONARY_KEY,
  LOCAL_STORAGE_SELECTED_DICTIONARY_KEY,
  LOCAL_STORAGE_HISTORY_KEY,
  LOCAL_STORAGE_LEVEL_KEY,
  LOCAL_STORAGE_RANDOM_KEY,
  LOCAL_STORAGE_THEME_KEY,
  LOCAL_STORAGE_TRANSLATION_LANGUAGE_KEY,
  LOCAL_STORAGE_AUTH_KEY,
  WORD_INPUT_MAX_LENGTH,
  STACK_REFRESH_URL,
  STACK_CLIENT_VERSION,
} from '../lib/constants';
import { safeStorage } from '../lib/storage';
import {
  generateRandomNonce,
  pickFirstString,
  getErrorMessage,
  readApiErrorMessage,
} from '../lib/utils';
import RequestErrorMessage from '../components/RequestErrorMessage';
import SignInForm from '../components/SignInForm';
import SideMenu from '../components/SideMenu';
import HistoryModal from '../components/HistoryModal';
import AddWordModal from '../components/AddWordModal';
import AddDictionaryModal from '../components/AddDictionaryModal';
import TranslateModal from '../components/TranslateModal';
import SettingsModal from '../components/SettingsModal';
import WordCard from '../components/WordCard';

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
      let storedAccess = safeStorage.get('AccessToken') || '';
      let storedRefresh = safeStorage.get('RefreshToken') || '';
      let storedUserId = safeStorage.get('AuthUserId') || '';

      if (!storedAccess || !storedRefresh || !storedUserId) {
        const raw = safeStorage.get(LOCAL_STORAGE_AUTH_KEY);
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
    } catch (_) {}
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = safeStorage.get(LOCAL_STORAGE_THEME_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    try {
      const raw = safeStorage.get(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
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
    safeStorage.set(LOCAL_STORAGE_THEME_KEY, theme);
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
        // Store both the bundled object and explicit keys as requested
        safeStorage.set(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(payload));
        safeStorage.set('AccessToken', payload.access_token || '');
        safeStorage.set('RefreshToken', payload.refresh_token || '');
        safeStorage.set('AuthUserId', payload.user_id || '');
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
  const [selectedTranslationLanguageCode, setSelectedTranslationLanguageCode] = useState(DEFAULT_TRANSLATION_LANGUAGE_CODE);
  const [generatedSentence, setGeneratedSentence] = useState('');
  const [generatedSentenceError, setGeneratedSentenceError] = useState('');
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
  const [isAddRequestError, setIsAddRequestError] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [isAddLoading, setIsAddLoading] = useState(false);
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);
  const [translateWordInput, setTranslateWordInput] = useState('');
  const [translatedWord, setTranslatedWord] = useState('');
  const [translatedSourceWord, setTranslatedSourceWord] = useState('');
  const [translatedDictionaryId, setTranslatedDictionaryId] = useState(null);
  const [translateError, setTranslateError] = useState('');
  const [isTranslateRequestError, setIsTranslateRequestError] = useState(false);
  const [translateSuccess, setTranslateSuccess] = useState('');
  const [isTranslateLoading, setIsTranslateLoading] = useState(false);
  const [isAddTranslatedLoading, setIsAddTranslatedLoading] = useState(false);
  const [isTranslatedWordCopied, setIsTranslatedWordCopied] = useState(false);
  const [isAddDictionaryModalOpen, setIsAddDictionaryModalOpen] = useState(false);
  const [newDictionaryTitle, setNewDictionaryTitle] = useState('');
  const [newDictionaryLanguage, setNewDictionaryLanguage] = useState('');
  const [addDictionaryError, setAddDictionaryError] = useState('');
  const [isAddDictionaryRequestError, setIsAddDictionaryRequestError] = useState(false);
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

    safeStorage.set('AccessToken', nextAccessToken);
    safeStorage.set('RefreshToken', resolvedRefreshToken);
    safeStorage.set(
      LOCAL_STORAGE_AUTH_KEY,
      JSON.stringify({
        access_token: nextAccessToken,
        refresh_token: resolvedRefreshToken,
        user_id: authUserId || '',
      }),
    );

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
    safeStorage.remove(LOCAL_STORAGE_AUTH_KEY);
    safeStorage.remove('AccessToken');
    safeStorage.remove('RefreshToken');
    safeStorage.remove('AuthUserId');
    safeStorage.remove(LOCAL_STORAGE_HISTORY_KEY);
  }, [user]);

  function buildDefaultOrder(length) {
    return Array.from({ length }, (_, i) => i);
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

  // Generic authenticated JSON request against the Neon REST API.
  // Handles bearer auth, a single 400 -> token-refresh -> retry cycle,
  // optional abort timeout and consistent error-message extraction.
  const apiRequest = useCallback(async (url, options = {}) => {
    const {
      method = 'GET',
      body,
      headers: extraHeaders,
      timeoutMs,
      allowRefresh = true,
      abortErrorMessage = 'Request timed out',
    } = options;

    const headers = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    };
    const currentAccessToken = tokenStore.accessToken || accessToken;
    if (currentAccessToken) {
      headers.Authorization = `Bearer ${currentAccessToken}`;
    }

    let controller;
    let timeoutId;
    if (timeoutMs) {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.status === 400 && allowRefresh) {
        if (tokenStore.refreshToken) {
          try {
            await refreshAccessToken();
          } catch (refreshError) {
            await logoutDueToRefreshFailure();
            throw refreshError;
          }
          return apiRequest(url, { ...options, allowRefresh: false });
        }
        await logoutDueToRefreshFailure();
        throw new TokenRefreshError('Refresh token missing for retry');
      }

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, `Request failed with status ${response.status}`));
      }

      return response.json();
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        throw new Error(abortErrorMessage);
      }
      throw error;
    }
  }, [accessToken, refreshAccessToken, logoutDueToRefreshFailure]);

  const fetchVocabularyFromApi = useCallback(
    (allowRefresh = true) => apiRequest(VOCABULARY_URL, { allowRefresh }),
    [apiRequest],
  );

  const fetchDictionaryFromApi = useCallback(
    (allowRefresh = true) => apiRequest(DICTIONARY_URL, { allowRefresh }),
    [apiRequest],
  );

  const loadDictionary = useCallback(async (options = {}) => {
    const { skipCache = false, isActiveRef } = options;
    const isActive = () => !isActiveRef || isActiveRef.active;
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) return;
    try {
      setIsDictionaryLoading(true);
      if (!skipCache) {
        const cached = safeStorage.get(LOCAL_STORAGE_DICTIONARY_KEY);
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

      safeStorage.set(LOCAL_STORAGE_DICTIONARY_KEY, JSON.stringify(data));

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
      if (!skipCache) {
        const cached = safeStorage.get(LOCAL_STORAGE_KEY);
        if (cached) {
          const cachedObject = JSON.parse(cached);
          if (!isActive()) return;
          const entriesFromCache = mapApiDataToEntries(cachedObject);
          setAllEntries(entriesFromCache);
          setIsLoading(false);
        }
      }

      const data = await fetchVocabularyFromApi(true);

      safeStorage.set(LOCAL_STORAGE_KEY, JSON.stringify(data));

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

  const addWordToApi = useCallback(
    (payload, allowRefresh = true) => apiRequest(VOCABULARY_URL, {
      method: 'POST',
      body: payload,
      headers: { Prefer: 'return=representation' },
      timeoutMs: 5000,
      allowRefresh,
      abortErrorMessage: 'Failed to add word',
    }),
    [apiRequest],
  );

  const addDictionaryToApi = useCallback(
    (payload, allowRefresh = true) => apiRequest(DICTIONARY_URL, {
      method: 'POST',
      body: payload,
      headers: { Prefer: 'return=representation' },
      timeoutMs: 5000,
      allowRefresh,
      abortErrorMessage: 'Failed to add dictionary',
    }),
    [apiRequest],
  );

  const openAddModal = useCallback((prefill = '') => {
    const normalized = prefill.trim().slice(0, WORD_INPUT_MAX_LENGTH);
    setNewWord(normalized);
    setNewTranslation('');
    setNewDictionaryId(selectedDictionaryId);
    setAddError('');
    setIsAddRequestError(false);
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
    setIsAddRequestError(false);
    setAddSuccess(false);
    setIsAddLoading(false);
  }, []);

  const openTranslateModal = useCallback(() => {
    setTranslateWordInput('');
    setTranslatedWord('');
    setTranslatedSourceWord('');
    setTranslatedDictionaryId(null);
    setTranslateError('');
    setIsTranslateRequestError(false);
    setTranslateSuccess('');
    setIsTranslateLoading(false);
    setIsAddTranslatedLoading(false);
    setIsTranslatedWordCopied(false);
    setIsTranslateModalOpen(true);
    setIsMenuOpen(false);
    setIsSettingsOpen(false);
    blurSearchInput();
  }, [blurSearchInput]);

  const closeTranslateModal = useCallback(() => {
    setIsTranslateModalOpen(false);
    setTranslateError('');
    setIsTranslateRequestError(false);
    setTranslateSuccess('');
    setIsTranslateLoading(false);
    setIsAddTranslatedLoading(false);
    setIsTranslatedWordCopied(false);
  }, []);

  const openAddDictionaryModal = useCallback(() => {
    setNewDictionaryTitle('');
    setNewDictionaryLanguage('');
    setAddDictionaryError('');
    setIsAddDictionaryRequestError(false);
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
    setIsAddDictionaryRequestError(false);
    setAddDictionarySuccess(false);
    setIsAddDictionaryLoading(false);
  }, []);

  const handleAddWord = useCallback(async () => {
    const key = newWord.trim();
    const translate = newTranslation.trim();
    if (!key || !translate) {
      setAddError('Both fields are required');
      setIsAddRequestError(false);
      return;
    }
    if (!newDictionaryId) {
      setAddError('Dictionary is required');
      setIsAddRequestError(false);
      return;
    }
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) {
      setAddError('Authorization required');
      setIsAddRequestError(false);
      return;
    }
    try {
      setAddError('');
      setIsAddRequestError(false);
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
      setAddError(getErrorMessage(error, 'Failed to add word'));
      setIsAddRequestError(true);
    } finally {
      setIsAddLoading(false);
    }
  }, [newWord, newTranslation, newDictionaryId, addWordToApi, loadVocabulary, accessToken, user]);

  const handleTranslateWord = useCallback(async () => {
    const key = translateWordInput.trim();
    const activeDictionary = dictionaryList.find((item) => item.id === selectedDictionaryId) || null;
    const dict = `${activeDictionary?.title || 'Unnamed dictionary'} (${activeDictionary?.lang || 'unknown source language'})`;
    const targetLanguageCode = selectedTranslationLanguageCode.trim();

    if (!key) {
      setTranslateError('Please enter a word or phrase for translation.');
      setIsTranslateRequestError(false);
      setTranslateSuccess('');
      return;
    }

    if (!selectedDictionaryId || !dict) {
      setTranslateError('Active dictionary is required');
      setIsTranslateRequestError(false);
      return;
    }
    if (!targetLanguageCode) {
      setTranslateError('Language is required');
      setIsTranslateRequestError(false);
      return;
    }

    try {
      setTranslateError('');
      setIsTranslateRequestError(false);
      setTranslateSuccess('');
      setIsTranslateLoading(true);
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: key,
          dict,
          targetLanguageCode,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, `Failed with status ${response.status}`));
      }

      const data = await response.json();
      const rawResult = typeof data?.translation === 'string' ? data.translation.trim() : '';
      if (!rawResult) {
        throw new Error('Translation result is empty');
      }
      const resultChars = Array.from(rawResult);
      resultChars[0] = resultChars[0].toLocaleUpperCase();
      const result = resultChars.join('');

      setTranslatedWord(result);
      setTranslatedSourceWord(key);
      setTranslatedDictionaryId(selectedDictionaryId);
      setTranslateSuccess('');
      setIsTranslatedWordCopied(false);
    } catch (error) {
      setTranslatedWord('');
      setTranslatedSourceWord('');
      setTranslatedDictionaryId(null);
      setTranslateError(getErrorMessage(error, 'Failed to translate word'));
      setIsTranslateRequestError(true);
    } finally {
      setIsTranslateLoading(false);
    }
  }, [translateWordInput, dictionaryList, selectedDictionaryId, selectedTranslationLanguageCode]);

  const handleAddTranslatedWord = useCallback(async () => {
    const key = translatedSourceWord.trim();
    const translate = translatedWord.trim();
    if (!key || !translate || !translatedDictionaryId) {
      setTranslateError('Please translate a word or phrase before adding it to dictionary.');
      setIsTranslateRequestError(false);
      setTranslateSuccess('');
      return;
    }

    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) {
      setTranslateError('Authorization required');
      setIsTranslateRequestError(false);
      return;
    }

    try {
      setTranslateError('');
      setIsTranslateRequestError(false);
      setTranslateSuccess('');
      setIsTranslateLoading(false);
      setIsAddTranslatedLoading(true);
      await addWordToApi({ key, translate, dict_id: translatedDictionaryId });
      setTranslateSuccess('Word successfully added to dictionary');
      await loadVocabulary({ skipCache: true });
    } catch (error) {
      setTranslateError(getErrorMessage(error, 'Failed to add word'));
      setIsTranslateRequestError(true);
    } finally {
      setIsAddTranslatedLoading(false);
    }
  }, [
    translatedSourceWord,
    translatedWord,
    translatedDictionaryId,
    accessToken,
    user,
    addWordToApi,
    loadVocabulary,
  ]);

  const handleAddDictionary = useCallback(async () => {
    const title = newDictionaryTitle.trim();
    const language = newDictionaryLanguage.trim();
    if (!title) {
      setAddDictionaryError('Title is required');
      setIsAddDictionaryRequestError(false);
      return;
    }
    if (!language) {
      setAddDictionaryError('Language is required');
      setIsAddDictionaryRequestError(false);
      return;
    }
    if (!/^\p{L}+$/u.test(language)) {
      setAddDictionaryError('Language must contain only letters');
      setIsAddDictionaryRequestError(false);
      return;
    }
    const effectiveAccessToken = tokenStore.accessToken || accessToken;
    if (!user && !effectiveAccessToken) {
      setAddDictionaryError('Authorization required');
      setIsAddDictionaryRequestError(false);
      return;
    }
    try {
      setAddDictionaryError('');
      setIsAddDictionaryRequestError(false);
      setAddDictionarySuccess(false);
      setIsAddDictionaryLoading(true);
      await addDictionaryToApi({ title, lang: language.toLowerCase() });
      setNewDictionaryTitle('');
      setNewDictionaryLanguage('');
      setAddDictionarySuccess(true);
      await loadDictionary({ skipCache: true });
      await loadVocabulary({ skipCache: true });
    } catch (error) {
      setAddDictionaryError(getErrorMessage(error, 'Failed to add dictionary'));
      setIsAddDictionaryRequestError(true);
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
    if (isMenuOpen || isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) {
      blurSearchInput();
    }
  }, [isMenuOpen, isSettingsOpen, isAddModalOpen, isTranslateModalOpen, isAddDictionaryModalOpen, blurSearchInput]);

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
    if (selectedDictionaryId === null) {
      safeStorage.remove(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
      return;
    }
    safeStorage.set(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY, String(selectedDictionaryId));
  }, [selectedDictionaryId]);

  useEffect(() => {
    if (newDictionaryId !== null) return;
    if (selectedDictionaryId === null) return;
    setNewDictionaryId(selectedDictionaryId);
  }, [newDictionaryId, selectedDictionaryId]);

  // Load history on mount
  useEffect(() => {
    try {
      const raw = safeStorage.get(LOCAL_STORAGE_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setViewedHistory(parsed);
        }
      }
      const savedLevel = safeStorage.get(LOCAL_STORAGE_LEVEL_KEY);
      if (savedLevel) setSelectedLevel(savedLevel);
      const savedRandom = safeStorage.get(LOCAL_STORAGE_RANDOM_KEY);
      if (savedRandom === 'true') setIsRandomOrder(true);
      const savedTranslationLanguageCode = safeStorage.get(LOCAL_STORAGE_TRANSLATION_LANGUAGE_KEY);
      if (savedTranslationLanguageCode && TRANSLATION_LANGUAGE_OPTIONS.some((lang) => lang.code === savedTranslationLanguageCode)) {
        setSelectedTranslationLanguageCode(savedTranslationLanguageCode);
      }
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
      safeStorage.set(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(next));
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
    setGeneratedSentenceError('');
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
      safeStorage.remove(LOCAL_STORAGE_AUTH_KEY);
      safeStorage.remove('AccessToken');
      safeStorage.remove('RefreshToken');
      safeStorage.remove('AuthUserId');
      safeStorage.remove(LOCAL_STORAGE_HISTORY_KEY);
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
      setIsTranslateModalOpen(false);
      setTranslateWordInput('');
      setTranslatedWord('');
      setTranslatedSourceWord('');
      setTranslatedDictionaryId(null);
      setTranslateError('');
      setIsTranslateRequestError(false);
      setTranslateSuccess('');
      setIsTranslateLoading(false);
      setIsAddTranslatedLoading(false);
      setIsTranslatedWordCopied(false);
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
  const selectedTranslationLanguageLabel = useMemo(() => {
    const match = TRANSLATION_LANGUAGE_OPTIONS.find((lang) => lang.code === selectedTranslationLanguageCode);
    return match?.label ? String(match.label) : '';
  }, [selectedTranslationLanguageCode]);

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
  const isTranslateActionDisabled = isTranslateLoading;
  const isAddTranslatedDisabled = isTranslateLoading || isAddTranslatedLoading;

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
      setGeneratedSentenceError('');
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
        throw new Error(await readApiErrorMessage(response, `Failed with status ${response.status}`));
      }
      const data = await response.json();
      setGeneratedSentence(data.sentence || '');
      setGeneratedSentenceError('');
    } catch (e) {
      setGeneratedSentence('');
      setGeneratedSentenceError(getErrorMessage(e));
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
    setGeneratedSentenceError('');
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
      <SignInForm
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        isPasswordVisible={isPasswordVisible}
        onTogglePasswordVisibility={() => setIsPasswordVisible((prev) => !prev)}
        authError={authError}
        onSubmit={handleEmailPasswordSignIn}
      />
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
          zIndex: (isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) ? 1 : 12,
          pointerEvents: (isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
        }}
      >
        <button
          type="button"
          data-testid="menu-toggle"
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
            pointerEvents: (isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
            zIndex: (isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) ? 1 : 10
            }}>
          <input
            data-testid="search-input"
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
              pointerEvents: (isSettingsOpen || isAddModalOpen || isTranslateModalOpen || isAddDictionaryModalOpen) ? 'none' : 'auto',
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
                    data-testid="search-suggestion-item"
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
                  data-testid="search-add-plus"
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
      <SideMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        dictionaryList={dictionaryList}
        selectedDictionaryId={selectedDictionaryId}
        selectedDictionaryTitle={selectedDictionaryTitle}
        isDictionaryLoading={isDictionaryLoading}
        onSelectDictionary={setSelectedDictionaryId}
        toggleButtonStyle={toggleButtonStyle}
        isLearningMode={isLearningMode}
        isLearningAvailable={isLearningAvailable}
        onToggleLearning={() => {
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
        isRandomOrder={isRandomOrder}
        onToggleRandom={() => {
          const enabled = !isRandomOrder;
          setIsRandomOrder(enabled);
          safeStorage.set(LOCAL_STORAGE_RANDOM_KEY, enabled ? 'true' : 'false');
          setRandomHistory([]);
          setRandomHistoryPos(-1);
        }}
        onOpenAddWord={() => openAddModal('')}
        onOpenTranslate={openTranslateModal}
        onOpenSettings={() => {
          setIsAddModalOpen(false);
          setIsSettingsOpen(true);
          setIsMenuOpen(false);
          blurSearchInput();
        }}
        onSignOut={() => {
          setIsMenuOpen(false);
          handleSignOut();
        }}
      />

      {/* Left arrow */}
      <button
        type="button"
        data-testid="nav-previous"
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
        data-testid="nav-next"
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
      <WordCard
        isLoading={isLoading}
        errorMessage={errorMessage}
        displayedEntry={displayedEntry}
        displayWord={displayWord}
        displayTranslation={displayTranslation}
        isLearningMode={isLearningMode}
        isTranslationRevealed={isTranslationRevealed}
        onRevealTranslation={(word) => setRevealedTranslations((prev) => ({ ...prev, [word]: true }))}
        isSentenceGenerationHidden={isSentenceGenerationHidden}
        onGenerateSentence={handleGenerateSentence}
        isGenerating={isGenerating}
        generatedSentence={generatedSentence}
        generatedSentenceError={generatedSentenceError}
        isSentenceCopied={isSentenceCopied}
        onSentenceCopied={() => setIsSentenceCopied(true)}
        isEmptyDictionaryState={isEmptyDictionaryState}
        dictionaryTitle={selectedDictionary?.title}
        onAddWord={() => openAddModal('')}
      />

      {/* History overlay */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onClear={() => {
          setViewedHistory([]);
          safeStorage.remove(LOCAL_STORAGE_HISTORY_KEY);
        }}
        items={filteredViewedHistory}
      />

      {/* Add word modal */}
      <AddWordModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        word={newWord}
        onWordChange={setNewWord}
        translation={newTranslation}
        onTranslationChange={setNewTranslation}
        dictionaryId={newDictionaryId}
        onDictionaryChange={setNewDictionaryId}
        dictionaryList={dictionaryList}
        isDictionaryLoading={isDictionaryLoading}
        success={addSuccess}
        isLoading={isAddLoading}
        error={addError}
        isRequestError={isAddRequestError}
        onSubmit={handleAddWord}
      />

      {/* Translate modal */}
      <TranslateModal
        isOpen={isTranslateModalOpen}
        onClose={closeTranslateModal}
        selectedLanguageCode={selectedTranslationLanguageCode}
        selectedLanguageLabel={selectedTranslationLanguageLabel}
        onLanguageChange={(code) => {
          setSelectedTranslationLanguageCode(code);
          safeStorage.set(LOCAL_STORAGE_TRANSLATION_LANGUAGE_KEY, code);
        }}
        wordInput={translateWordInput}
        onWordInputChange={(value) => {
          setTranslateWordInput(value);
          setTranslatedWord('');
          setTranslatedSourceWord('');
          setTranslatedDictionaryId(null);
          setTranslateError('');
          setIsTranslateRequestError(false);
          setTranslateSuccess('');
          setIsTranslatedWordCopied(false);
        }}
        translatedWord={translatedWord}
        isCopied={isTranslatedWordCopied}
        onCopied={() => setIsTranslatedWordCopied(true)}
        isTranslateDisabled={isTranslateActionDisabled}
        isTranslateLoading={isTranslateLoading}
        onTranslate={handleTranslateWord}
        isAddDisabled={isAddTranslatedDisabled}
        isAddLoading={isAddTranslatedLoading}
        onAddToDictionary={handleAddTranslatedWord}
        success={translateSuccess}
        error={translateError}
        isRequestError={isTranslateRequestError}
      />

      {/* Add dictionary modal */}
      <AddDictionaryModal
        isOpen={isAddDictionaryModalOpen}
        onClose={closeAddDictionaryModal}
        title={newDictionaryTitle}
        onTitleChange={setNewDictionaryTitle}
        language={newDictionaryLanguage}
        onLanguageChange={setNewDictionaryLanguage}
        success={addDictionarySuccess}
        isLoading={isAddDictionaryLoading}
        error={addDictionaryError}
        isRequestError={isAddDictionaryRequestError}
        onSubmit={handleAddDictionary}
      />

      {/* Settings overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        isSentenceGenerationHidden={isSentenceGenerationHidden}
        onToggleSentenceGeneration={() => setIsSentenceGenerationHidden((prev) => !prev)}
        onOpenHistory={() => { setIsHistoryOpen(true); setIsSettingsOpen(false); }}
        onReset={() => {
          safeStorage.remove(LOCAL_STORAGE_KEY);
          safeStorage.remove(LOCAL_STORAGE_DICTIONARY_KEY);
          safeStorage.remove(LOCAL_STORAGE_SELECTED_DICTIONARY_KEY);
          safeStorage.remove(LOCAL_STORAGE_HISTORY_KEY);
          safeStorage.remove(LOCAL_STORAGE_TRANSLATION_LANGUAGE_KEY);
          window.location.reload();
        }}
        selectedLevel={selectedLevel}
        onLevelChange={(level) => {
          setSelectedLevel(level);
          safeStorage.set(LOCAL_STORAGE_LEVEL_KEY, level);
        }}
        selectedTopic={selectedTopic}
        selectedTopicLabel={selectedTopicLabel}
        onTopicChange={setSelectedTopic}
        onAddDictionary={openAddDictionaryModal}
        toggleButtonStyle={toggleButtonStyle}
      />
    </div>
    </>
  );
}
