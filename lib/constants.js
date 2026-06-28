// Shared configuration and storage-key constants for the vocabulary app.

// Base URL of the Neon Data API. Must be provided via env so the repo stays
// free of deployment-specific infrastructure. See .env.example.
const NEON_REST_BASE_URL = process.env.NEXT_PUBLIC_NEON_REST_URL;

if (!NEON_REST_BASE_URL) {
  throw new Error(
    'Missing NEXT_PUBLIC_NEON_REST_URL env variable. '
    + 'Set it to your Neon Data API base URL (see .env.example).',
  );
}

export const VOCABULARY_URL = `${NEON_REST_BASE_URL}/vocabulary`;
export const DICTIONARY_URL = `${NEON_REST_BASE_URL}/dictionary`;

export const LOCAL_STORAGE_KEY = 'vocabularyData';
export const LOCAL_STORAGE_DICTIONARY_KEY = 'dictionaryData';
export const LOCAL_STORAGE_SELECTED_DICTIONARY_KEY = 'selectedDictionaryId';
export const LOCAL_STORAGE_HISTORY_KEY = 'vocabularyViewedHistory';
export const LOCAL_STORAGE_LEVEL_KEY = 'vocabularyLevel';
export const LOCAL_STORAGE_RANDOM_KEY = 'vocabularyRandomOrder';
export const LOCAL_STORAGE_THEME_KEY = 'envibeTheme';
export const LOCAL_STORAGE_TRANSLATION_LANGUAGE_KEY = 'translationLanguageCode';
export const LOCAL_STORAGE_AUTH_KEY = 'stackAuthTokens';

export const WORD_INPUT_MAX_LENGTH = 50;

export const STACK_REFRESH_URL = 'https://api.stack-auth.com/api/v1/auth/sessions/current/refresh';
export const STACK_CLIENT_VERSION = 'js @stackframe/js@2.8.27';
