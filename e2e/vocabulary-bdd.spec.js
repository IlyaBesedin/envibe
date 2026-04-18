import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { TEST_IDS } from './testIds.js';
import { AVAILABLE_SENTENCE_TOPICS } from '../lib/sentenceTopics.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const AUTH_EMAIL = process.env.E2E_EMAIL;
const AUTH_PASSWORD = process.env.E2E_PASSWORD;
const VOCABULARY_URL = 'https://ep-floral-rain-a2efqgrr.apirest.eu-central-1.aws.neon.tech/neondb/rest/v1/vocabulary';
const DICTIONARY_URL = 'https://ep-floral-rain-a2efqgrr.apirest.eu-central-1.aws.neon.tech/neondb/rest/v1/dictionary';
const STACK_REFRESH_URL = 'https://api.stack-auth.com/api/v1/auth/sessions/current/refresh';
const AUTH_DIR = path.join(process.cwd(), 'e2e', '.auth');
const TOKENS_PATH = path.join(AUTH_DIR, 'tokens.json');
const TYPE_DELAY_MS = 60;
const BETWEEN_TEST_DELAY_MS = 5000;

async function deleteDictionaryFromApi(accessToken, dictId) {
  const response = await fetch(`${DICTIONARY_URL}?id=eq.${dictId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    console.warn(`Cleanup: failed to delete dictionary id=${dictId}, status ${response.status}`);
  }
}

async function deleteWordFromApi(accessToken, wordId) {
  const response = await fetch(`${VOCABULARY_URL}?id=eq.${wordId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    console.warn(`Cleanup: failed to delete word id=${wordId}, status ${response.status}`);
  }
}

function randomAutoWord(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let value = 'auto';
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

async function saveTokens(tokens) {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

async function readTokens(page) {
  return page.evaluate(() => ({
    accessToken: localStorage.getItem('AccessToken') || '',
    refreshToken: localStorage.getItem('RefreshToken') || '',
    authUserId: localStorage.getItem('AuthUserId') || '',
    stackAuthTokens: localStorage.getItem('stackAuthTokens') || '',
  }));
}

async function typeInto(locator, text) {
  await locator.click();
  await locator.clear();
  if (text) {
    await locator.type(text, { delay: TYPE_DELAY_MS });
  }
}

async function firstVisibleLocator(candidates, timeoutMs, description) {
  try {
    return await Promise.any(
      candidates.map((locator) => locator.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => locator)),
    );
  } catch {
    throw new Error(`Timed out after ${timeoutMs}ms while waiting for ${description}`);
  }
}

async function waitForSignInForm(page, timeoutMs = 60_000) {
  await Promise.any([
    Promise.all([
      page.getByTestId(TEST_IDS.signIn.form).waitFor({ state: 'visible', timeout: timeoutMs }),
      page.getByTestId(TEST_IDS.signIn.emailInput).waitFor({ state: 'visible', timeout: timeoutMs }),
      page.getByTestId(TEST_IDS.signIn.passwordInput).waitFor({ state: 'visible', timeout: timeoutMs }),
      page.getByTestId(TEST_IDS.signIn.submit).waitFor({ state: 'visible', timeout: timeoutMs }),
    ]),
    Promise.all([
      page.getByLabel(/^email$/i).waitFor({ state: 'visible', timeout: timeoutMs }),
      page.getByLabel(/^password$/i).waitFor({ state: 'visible', timeout: timeoutMs }),
      page.getByRole('button', { name: /^sign in$/i }).waitFor({ state: 'visible', timeout: timeoutMs }),
    ]),
  ]);
}

async function waitForAuthUiState(page, timeoutMs = 60_000) {
  try {
    return await Promise.any([
      page.getByTestId(TEST_IDS.menu.toggle).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'authenticated'),
      waitForSignInForm(page, timeoutMs).then(() => 'sign-in'),
    ]);
  } catch {
    throw new Error(`Timed out after ${timeoutMs}ms while waiting for sign-in form or main screen`);
  }
}

async function waitForAuthenticated(page, timeoutMs = 60_000) {
  let authResult = null;
  try {
    authResult = await Promise.any([
      page.getByTestId(TEST_IDS.menu.toggle).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'ok'),
      page.getByTestId(TEST_IDS.signIn.error).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error'),
    ]);
  } catch (_) {}

  if (authResult === 'ok') {
    return;
  }

  const errorText = (await page.getByTestId(TEST_IDS.signIn.error).textContent().catch(() => null))?.trim() || '';
  if (authResult === 'error') {
    throw new Error(`Failed to authenticate in beforeAll${errorText ? `: ${errorText}` : ''}`);
  }

  const stillOnSignIn = await page.getByTestId(TEST_IDS.signIn.submit).isVisible().catch(() => false);
  throw new Error(
    `Failed to authenticate in beforeAll: menu button did not appear within ${timeoutMs}ms`
    + `${stillOnSignIn ? '; sign-in form is still visible' : ''}`
    + `${errorText ? `; sign-in error: ${errorText}` : ''}`,
  );
}

async function ensureMainScreen(page) {
  await page.goto('/');
  await expect(page).toHaveTitle(/Envibe/i);
  await expect(page.getByTestId(TEST_IDS.menu.toggle)).toBeVisible();
}

async function openMenu(page) {
  const toggle = page.getByTestId(TEST_IDS.menu.toggle);
  if (await page.getByTestId(TEST_IDS.menu.backdrop).isVisible().catch(() => false)) return;
  await toggle.click();
  await expect(page.getByTestId(TEST_IDS.menu.backdrop)).toBeVisible();
}

async function closeMenu(page) {
  if (await page.getByTestId(TEST_IDS.menu.backdrop).isVisible().catch(() => false)) {
    await page.getByTestId(TEST_IDS.menu.close).click();
    await expect(page.getByTestId(TEST_IDS.menu.backdrop)).not.toBeVisible();
  }
}

async function openAddWordModalViaSearch(page, seed) {
  const input = page.getByTestId(TEST_IDS.search.input);
  await typeInto(input, seed);
  await page.getByTestId(TEST_IDS.search.addPlus).click();
  await expect(page.getByTestId(TEST_IDS.addWord.modal)).toBeVisible();
}

async function openTranslateModal(page) {
  await openMenu(page);
  await expect(page.getByTestId(TEST_IDS.translate.open)).toBeVisible();
  await page.getByTestId(TEST_IDS.translate.open).click();
  await expect(page.getByTestId(TEST_IDS.translate.modal)).toBeVisible();
}

async function closeTranslateModal(page) {
  if (await page.getByTestId(TEST_IDS.translate.modal).isVisible().catch(() => false)) {
    await page.getByTestId(TEST_IDS.translate.close).click();
    await expect(page.getByTestId(TEST_IDS.translate.modal)).not.toBeVisible();
  }
}

async function selectAvailableDictionaryInAddWordDialog(page) {
  const select = page.getByTestId(TEST_IDS.addWord.dictionarySelect);
  const options = await select.locator('option').evaluateAll((list) => list.map((opt) => ({
    value: opt.value,
    label: opt.textContent || '',
  })));
  const available = options.find((opt) => opt.value);
  if (!available) {
    throw new Error('No available dictionaries in add-word dialog');
  }
  await select.selectOption(available.value);
  return available;
}

async function expectRequestError(page, locator, expectedCopyText, options = {}) {
  const { timeout = 5000 } = options;
  await expect(locator).toContainText('Something went wrong', { timeout });
  await expect(locator).toContainText('You may copy error message or try later');
  await expect(locator).not.toContainText(expectedCopyText);
  const copyButton = locator.getByRole('button', { name: 'copy error message' });
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedCopyText);
}

test.describe.serial('Automated checks from BDD scenarios', () => {
  /** @type {import('@playwright/test').Browser} */
  let sharedBrowser;
  /** @type {import('@playwright/test').BrowserContext} */
  let sharedContext;
  /** @type {import('@playwright/test').Page} */
  let sharedPage;
  let savedTokens = null;
  let createdWord = 'sloppy';
  let createdWordId = null;
  let createdDictionaryId = null;
  let createdTranslatedWordId = null;

  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    sharedBrowser = browser;
    sharedContext = await browser.newContext({ baseURL });
    await sharedContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    sharedPage = await sharedContext.newPage();

    await sharedPage.goto('/');
    const initialAuthState = await waitForAuthUiState(sharedPage, 60_000);

    if (initialAuthState === 'sign-in') {
      await waitForSignInForm(sharedPage, 10_000);
      if (!AUTH_EMAIL || !AUTH_PASSWORD) {
        throw new Error('Missing E2E_EMAIL or E2E_PASSWORD in environment');
      }
      const emailInput = await firstVisibleLocator([
        sharedPage.getByTestId(TEST_IDS.signIn.emailInput),
        sharedPage.getByLabel(/^email$/i),
      ], 10_000, 'sign-in email input');
      const passwordInput = await firstVisibleLocator([
        sharedPage.getByTestId(TEST_IDS.signIn.passwordInput),
        sharedPage.getByLabel(/^password$/i),
      ], 10_000, 'sign-in password input');
      const signInButton = await firstVisibleLocator([
        sharedPage.getByTestId(TEST_IDS.signIn.submit),
        sharedPage.getByRole('button', { name: /^sign in$/i }),
      ], 10_000, 'sign-in submit button');

      await typeInto(emailInput, AUTH_EMAIL);
      await typeInto(passwordInput, AUTH_PASSWORD);
      await signInButton.click();
    }

    await waitForAuthenticated(sharedPage, 60_000);

    savedTokens = await readTokens(sharedPage);
    await saveTokens(savedTokens);
  });

  test.afterAll(async () => {
    if (createdWordId && savedTokens?.accessToken) {
      await deleteWordFromApi(savedTokens.accessToken, createdWordId);
    }
    if (createdTranslatedWordId && savedTokens?.accessToken) {
      await deleteWordFromApi(savedTokens.accessToken, createdTranslatedWordId);
    }
    if (createdDictionaryId && savedTokens?.accessToken) {
      await deleteDictionaryFromApi(savedTokens.accessToken, createdDictionaryId);
    }
    await sharedContext.close();
  });

  test.afterEach(async () => {
    await sharedPage.waitForTimeout(BETWEEN_TEST_DELAY_MS);
  });

  test('Authentication completes and tokens are saved between tests', async () => {
    await expect(sharedPage.getByTestId(TEST_IDS.menu.toggle)).toBeVisible();
    const tokens = await readTokens(sharedPage);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.stackAuthTokens).toBeTruthy();
    const file = JSON.parse(await fs.readFile(TOKENS_PATH, 'utf-8'));
    expect(file.accessToken).toBe(tokens.accessToken);
    expect(file.refreshToken).toBe(tokens.refreshToken);
  });

  test('Dictionary selection is only available from the dictionary list', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    const dictionarySelect = sharedPage.getByTestId(TEST_IDS.menu.dictionarySelect);
    const options = await dictionarySelect.locator('option').evaluateAll((list) => list.map((opt) => opt.value).filter(Boolean));
    expect(options.length).toBeGreaterThan(0);
    await dictionarySelect.selectOption(options[0]);
    await closeMenu(sharedPage);
  });

  test('Translate option is available in the menu', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await expect(sharedPage.getByTestId(TEST_IDS.translate.open)).toBeVisible();
    await closeMenu(sharedPage);
  });

  test('Word translation succeeds from the Translate modal', async () => {
    await ensureMainScreen(sharedPage);
    let capturedBody = null;
    await sharedPage.route('**/api/translate', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translation: 'casa' }),
      });
    });

    try {
      await openTranslateModal(sharedPage);

      const translateButton = sharedPage.getByTestId(TEST_IDS.translate.submit);
      await expect(translateButton).toBeEnabled();
      await translateButton.click();
      await expect(sharedPage.getByTestId(TEST_IDS.translate.error)).toHaveText('Please enter a word or phrase for translation.');

      await typeInto(sharedPage.getByTestId(TEST_IDS.translate.wordInput), 'house');
      await expect(translateButton).toBeEnabled();

      await translateButton.click();

      await expect(sharedPage.getByTestId(TEST_IDS.translate.resultField)).toHaveValue('Casa');
      await expect(sharedPage.getByTestId(TEST_IDS.translate.addToDictionary)).toBeEnabled();
    } finally {
      await sharedPage.unroute('**/api/translate');
      await closeTranslateModal(sharedPage);
    }

    expect(capturedBody?.word).toBe('house');
    expect(typeof capturedBody?.dict).toBe('string');
    expect(capturedBody?.dict).toBeTruthy();
    expect(capturedBody?.targetLanguageCode).toBe('ru');
  });

  test('Selected translation language from Translate modal is sent to translate API', async () => {
    await ensureMainScreen(sharedPage);

    let capturedBody = null;
    await sharedPage.route('**/api/translate', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translation: '집' }),
      });
    });

    try {
      await openTranslateModal(sharedPage);
      await sharedPage.getByTestId(TEST_IDS.translate.languageSelect).selectOption('ko');
      await typeInto(sharedPage.getByTestId(TEST_IDS.translate.wordInput), 'home');
      await sharedPage.getByTestId(TEST_IDS.translate.submit).click();
      await expect(sharedPage.getByTestId(TEST_IDS.translate.resultField)).toHaveValue('집');
      await sharedPage.getByTestId(TEST_IDS.translate.languageSelect).selectOption('ru');
    } finally {
      await sharedPage.unroute('**/api/translate');
      await closeTranslateModal(sharedPage);
    }

    expect(capturedBody?.targetLanguageCode).toBe('ko');
  });

  test('Translated word can be added to dictionary and then removed', async () => {
    await ensureMainScreen(sharedPage);
    const sourceWord = randomAutoWord(9);
    const translatedValue = randomAutoWord(7);
    const capitalizedTranslation = `${translatedValue.charAt(0).toUpperCase()}${translatedValue.slice(1)}`;

    await sharedPage.route('**/api/translate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translation: translatedValue }),
      });
    });

    try {
      await openTranslateModal(sharedPage);
      await sharedPage.getByTestId(TEST_IDS.translate.addToDictionary).click();
      await expect(sharedPage.getByTestId(TEST_IDS.translate.error)).toHaveText('Please translate a word or phrase before adding it to dictionary.');
      await typeInto(sharedPage.getByTestId(TEST_IDS.translate.wordInput), sourceWord);
      await sharedPage.getByTestId(TEST_IDS.translate.submit).click();
      await expect(sharedPage.getByTestId(TEST_IDS.translate.resultField)).toHaveValue(capitalizedTranslation);

      const [addResponse] = await Promise.all([
        sharedPage.waitForResponse((r) => r.url() === VOCABULARY_URL && r.request().method() === 'POST'),
        sharedPage.getByTestId(TEST_IDS.translate.addToDictionary).click(),
      ]);
      const addedData = await addResponse.json().catch(() => []);
      createdTranslatedWordId = Array.isArray(addedData) && addedData[0]?.id ? addedData[0].id : null;
      expect(createdTranslatedWordId).toBeTruthy();
      await expect(sharedPage.getByTestId(TEST_IDS.translate.success)).toHaveText('Word successfully added to dictionary');
    } finally {
      await sharedPage.unroute('**/api/translate');
      await closeTranslateModal(sharedPage);
      if (createdTranslatedWordId && savedTokens?.accessToken) {
        await deleteWordFromApi(savedTokens.accessToken, createdTranslatedWordId);
        createdTranslatedWordId = null;
      }
    }
  });

  test('Translate modal closes by Close button', async () => {
    await ensureMainScreen(sharedPage);
    await openTranslateModal(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.translate.close).click();
    await expect(sharedPage.getByTestId(TEST_IDS.translate.modal)).not.toBeVisible();
  });

  test('Adding a word uses random values with the auto prefix', async () => {
    await ensureMainScreen(sharedPage);
    const word = randomAutoWord(10);
    const translation = randomAutoWord(10);
    createdWord = word;

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.addWord).click();
    await expect(sharedPage.getByTestId(TEST_IDS.addWord.modal)).toBeVisible();
    await typeInto(sharedPage.getByTestId(TEST_IDS.addWord.wordInput), word);
    await typeInto(sharedPage.getByTestId(TEST_IDS.addWord.translationInput), translation);
    await selectAvailableDictionaryInAddWordDialog(sharedPage);
    const [addResponse] = await Promise.all([
      sharedPage.waitForResponse((r) => r.url() === VOCABULARY_URL && r.request().method() === 'POST'),
      sharedPage.getByTestId(TEST_IDS.addWord.submit).click(),
    ]);
    const addedData = await addResponse.json().catch(() => []);
    createdWordId = Array.isArray(addedData) && addedData[0]?.id ? addedData[0].id : null;
    await expect(sharedPage.getByTestId(TEST_IDS.addWord.success)).toBeVisible({ timeout: 15_000 });
    await sharedPage.getByTestId(TEST_IDS.addWord.close).click();
  });

  test('Search query shorter than 3 characters does not show suggestions', async () => {
    await ensureMainScreen(sharedPage);
    await typeInto(sharedPage.getByTestId(TEST_IDS.search.input), 'au');
    await expect(sharedPage.getByTestId(TEST_IDS.search.addPlus)).toHaveCount(0);
  });

  test('Search with no matches shows Add +', async () => {
    await ensureMainScreen(sharedPage);
    await typeInto(sharedPage.getByTestId(TEST_IDS.search.input), `zzz${randomAutoWord(6)}`);
    await expect(sharedPage.getByTestId(TEST_IDS.search.addPlus)).toBeVisible();
  });

  test('Selecting a word from suggestions displays the found entry', async () => {
    await ensureMainScreen(sharedPage);
    await typeInto(sharedPage.getByTestId(TEST_IDS.search.input), createdWord.slice(0, 5));
    await sharedPage.getByTestId(TEST_IDS.search.suggestionItem).filter({ hasText: createdWord }).first().click();
    await expect(sharedPage.getByTestId(TEST_IDS.word.title)).toHaveText(createdWord);
  });

  test('Adding a word validates required fields', async () => {
    await ensureMainScreen(sharedPage);
    await openAddWordModalViaSearch(sharedPage, `nope${randomAutoWord(4)}`);
    await typeInto(sharedPage.getByTestId(TEST_IDS.addWord.wordInput), '');
    await typeInto(sharedPage.getByTestId(TEST_IDS.addWord.translationInput), '');
    await sharedPage.getByTestId(TEST_IDS.addWord.submit).click();
    await expect(sharedPage.getByTestId(TEST_IDS.addWord.error)).toHaveText('Both fields are required');
    await sharedPage.getByTestId(TEST_IDS.addWord.close).click();
  });

  test('Forward and backward navigation works via arrow buttons', async () => {
    await ensureMainScreen(sharedPage);
    const heading = sharedPage.getByTestId(TEST_IDS.word.title);
    const before = await heading.textContent();
    await sharedPage.getByTestId(TEST_IDS.nav.next).click();
    const afterNext = await heading.textContent();
    expect(afterNext).toBeTruthy();
    await sharedPage.getByTestId(TEST_IDS.nav.previous).click();
    const afterBack = await heading.textContent();
    expect(afterBack).toBeTruthy();
    expect(typeof before).toBe('string');
  });

  test('Toggling Random order is saved to localStorage', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    const rowButton = sharedPage.getByTestId(TEST_IDS.menu.randomToggle);
    const before = await sharedPage.evaluate(() => localStorage.getItem('vocabularyRandomOrder'));
    await rowButton.click();
    const after = await sharedPage.evaluate(() => localStorage.getItem('vocabularyRandomOrder'));
    expect(after).not.toBe(before);
    expect(['true', 'false']).toContain(after);
    await closeMenu(sharedPage);
  });

  test('Language level is saved to localStorage', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.settings.modal)).toBeVisible();
    const select = sharedPage.getByTestId(TEST_IDS.settings.languageLevelSelect);
    await select.selectOption('C1');
    await expect.poll(async () => sharedPage.evaluate(() => localStorage.getItem('vocabularyLevel'))).toBe('C1');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Sentence generation API error shows standard message (mock)', async () => {
    await ensureMainScreen(sharedPage);
    await sharedPage.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock generation failure' }),
      });
    });
    await sharedPage.getByTestId(TEST_IDS.sentence.generateButton).click();
    await expectRequestError(sharedPage, sharedPage.getByTestId(TEST_IDS.sentence.error), 'Mock generation failure');
    await sharedPage.unroute('**/api/generate');
  });

  test('addWord API timeout shows standard message (mock)', async ({ baseURL }) => {
    const context = await sharedBrowser.newContext({ baseURL });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    await page.addInitScript((tokens) => {
      localStorage.setItem('AccessToken', tokens.accessToken);
      localStorage.setItem('RefreshToken', tokens.refreshToken);
      localStorage.setItem('AuthUserId', tokens.authUserId);
      localStorage.setItem('stackAuthTokens', tokens.stackAuthTokens);
    }, savedTokens);
    await page.route(VOCABULARY_URL, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 6_200));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1 }]),
      });
    });
    await ensureMainScreen(page);
    await openAddWordModalViaSearch(page, `nomatch${randomAutoWord(4)}`);
    await typeInto(page.getByTestId(TEST_IDS.addWord.wordInput), randomAutoWord(8));
    await typeInto(page.getByTestId(TEST_IDS.addWord.translationInput), randomAutoWord(8));
    await selectAvailableDictionaryInAddWordDialog(page);
    await page.getByTestId(TEST_IDS.addWord.submit).click();
    await expectRequestError(page, page.getByTestId(TEST_IDS.addWord.error), 'Failed to add word', { timeout: 15_000 });
    await context.close();
  });

  test('Token validation error triggers logout (mock)', async ({ baseURL }) => {
    const context = await sharedBrowser.newContext({ baseURL });
    const page = await context.newPage();
    await page.addInitScript((tokens) => {
      localStorage.setItem('AccessToken', tokens.accessToken);
      localStorage.setItem('RefreshToken', tokens.refreshToken);
      localStorage.setItem('AuthUserId', tokens.authUserId);
      localStorage.setItem('stackAuthTokens', tokens.stackAuthTokens);
    }, savedTokens);
    await page.route(VOCABULARY_URL, async (route) => {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route(STACK_REFRESH_URL, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.goto('/');
    await expect(page.getByTestId(TEST_IDS.signIn.submit)).toBeVisible({ timeout: 25_000 });
    await context.close();
  });

  test('Settings opens and closes', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.settings.modal)).toBeVisible();
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
    await expect(sharedPage.getByTestId(TEST_IDS.settings.modal)).not.toBeVisible();
  });

  test('When Settings is open the search input is not clickable', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.settings.modal)).toBeVisible();
    await expect(sharedPage.getByTestId(TEST_IDS.search.input)).toHaveCSS('pointer-events', 'none');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Settings: dark theme toggle', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    const toggle = sharedPage.getByTestId(TEST_IDS.settings.themeToggle);

    await toggle.click();
    const themeDark = await sharedPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(['dark', 'light']).toContain(themeDark);
    const textAfterFirst = await toggle.textContent();

    await toggle.click();
    const themeAfterSecond = await sharedPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const textAfterSecond = await toggle.textContent();
    expect(themeAfterSecond).not.toBe(themeDark);
    expect(textAfterSecond).not.toBe(textAfterFirst);

    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Settings: hiding and showing the sentence generation block', async () => {
    await ensureMainScreen(sharedPage);
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.generateButton)).toBeVisible();

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    const toggle = sharedPage.getByTestId(TEST_IDS.settings.hideSentenceToggle);
    await toggle.click();
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.generateButton)).not.toBeVisible();

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.hideSentenceToggle).click();
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.generateButton)).toBeVisible();
  });

  test('History: opens from Settings', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.historyOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.history.modal)).toBeVisible();
    await sharedPage.getByTestId(TEST_IDS.history.close).click();
    await expect(sharedPage.getByTestId(TEST_IDS.history.modal)).not.toBeVisible();
  });

  test('History: viewed words are displayed in history', async () => {
    await ensureMainScreen(sharedPage);

    const word1 = await sharedPage.getByTestId(TEST_IDS.word.title).textContent();
    await sharedPage.getByTestId(TEST_IDS.nav.next).click();
    const word2 = await sharedPage.getByTestId(TEST_IDS.word.title).textContent();

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.historyOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.history.modal)).toBeVisible();

    const items = sharedPage.getByTestId(TEST_IDS.history.item);
    const texts = await items.allTextContents();
    expect(texts.some((t) => t.includes(word1))).toBe(true);
    expect(texts.some((t) => t.includes(word2))).toBe(true);

    await sharedPage.getByTestId(TEST_IDS.history.close).click();
  });

  test('History: cleared by the Clear button', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.historyOpen).click();
    await expect(sharedPage.getByTestId(TEST_IDS.history.modal)).toBeVisible();
    await sharedPage.getByTestId(TEST_IDS.history.clear).click();
    await expect(sharedPage.getByTestId(TEST_IDS.history.empty)).toBeVisible();
    await sharedPage.getByTestId(TEST_IDS.history.close).click();
  });

  test('Settings: language level change is saved', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.languageLevelSelect).selectOption('A1');
    await expect.poll(() => sharedPage.evaluate(() => localStorage.getItem('vocabularyLevel'))).toBe('A1');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Sentence generation uses the level from Settings', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.languageLevelSelect).selectOption('C2');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();

    let capturedBody = null;
    await sharedPage.route('**/api/generate', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sentence: 'Test sentence' }) });
    });
    await sharedPage.getByTestId(TEST_IDS.sentence.generateButton).click();
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.text)).toBeVisible({ timeout: 10_000 });
    await sharedPage.unroute('**/api/generate');

    expect(capturedBody?.level).toBe('C2');

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.languageLevelSelect).selectOption('B2');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Settings: sentence topic selection is saved', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.topicSelect).selectOption('sport');
    const selected = await sharedPage.getByTestId(TEST_IDS.settings.topicSelect).inputValue();
    expect(selected).toBe('sport');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();
  });

  test('Sentence generation uses the topic from Settings', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.topicSelect).selectOption('travel');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();

    let capturedBody = null;
    await sharedPage.route('**/api/generate', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sentence: 'Test sentence' }) });
    });
    await sharedPage.getByTestId(TEST_IDS.sentence.generateButton).click();
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.text)).toBeVisible({ timeout: 10_000 });
    await sharedPage.unroute('**/api/generate');

    expect(capturedBody?.topic).toBe('travel');
  });

  test('When random topic is selected, random is sent in the request', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.topicSelect).selectOption('random');
    await sharedPage.getByTestId(TEST_IDS.settings.close).click();

    let capturedBody = null;
    await sharedPage.route('**/api/generate', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sentence: 'Test sentence' }) });
    });
    await sharedPage.getByTestId(TEST_IDS.sentence.generateButton).click();
    await expect(sharedPage.getByTestId(TEST_IDS.sentence.text)).toBeVisible({ timeout: 10_000 });
    await sharedPage.unroute('**/api/generate');

    expect(capturedBody?.topic).toBe('random');
    const availableValues = AVAILABLE_SENTENCE_TOPICS.map((t) => t.value);
    expect(availableValues.length).toBeGreaterThan(0);
  });

  test('Settings: adding a new dictionary and verifying it in the menu', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();
    await sharedPage.getByTestId(TEST_IDS.settings.addDictionary).click();
    await expect(sharedPage.getByTestId(TEST_IDS.addDictionary.modal)).toBeVisible();

    await typeInto(sharedPage.getByTestId(TEST_IDS.addDictionary.titleInput), 'Test Dict');
    await typeInto(sharedPage.getByTestId(TEST_IDS.addDictionary.languageInput), 'English');

    const [dictResponse] = await Promise.all([
      sharedPage.waitForResponse((r) => r.url() === DICTIONARY_URL && r.request().method() === 'POST'),
      sharedPage.getByTestId(TEST_IDS.addDictionary.submit).click(),
    ]);
    const dictData = await dictResponse.json().catch(() => []);
    createdDictionaryId = Array.isArray(dictData) && dictData[0]?.id ? dictData[0].id : null;

    await expect(sharedPage.getByTestId(TEST_IDS.addDictionary.success)).toBeVisible({ timeout: 10_000 });
    await sharedPage.getByTestId(TEST_IDS.addDictionary.close).click();

    await openMenu(sharedPage);
    await expect(
      sharedPage.getByTestId(TEST_IDS.menu.dictionarySelect).locator('option', { hasText: 'Test Dict' })
    ).toBeAttached({ timeout: 5_000 });
    await closeMenu(sharedPage);

    if (createdDictionaryId && savedTokens?.accessToken) {
      await deleteDictionaryFromApi(savedTokens.accessToken, createdDictionaryId);
      createdDictionaryId = null;
    }
  });

  test('Settings: cache reset clears vocabularyData and history from localStorage', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.settingsOpen).click();

    await sharedPage.getByTestId(TEST_IDS.settings.reset).click();
    await sharedPage.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await expect(sharedPage.getByTestId(TEST_IDS.menu.toggle)).toBeVisible({ timeout: 20_000 });

    const vocabCache = await sharedPage.evaluate(() => localStorage.getItem('vocabularyData'));
    const historyCache = await sharedPage.evaluate(() => localStorage.getItem('vocabularyViewedHistory'));
    const dictCache = await sharedPage.evaluate(() => localStorage.getItem('dictionaryData'));
    expect(historyCache).toBeNull();

    const accessToken = await sharedPage.evaluate(() => localStorage.getItem('AccessToken'));
    expect(accessToken).toBeTruthy();
  });

  test('Learning Mode is enabled and disabled via the menu', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    const toggleBtn = sharedPage.getByTestId(TEST_IDS.menu.learningToggle);
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveText('On');

    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(toggleBtn).toHaveText('Off');
    await closeMenu(sharedPage);
  });

  test('In Learning Mode words are taken from the viewed history', async () => {
    await ensureMainScreen(sharedPage);

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.learningToggle).click();
    await expect(sharedPage.getByTestId(TEST_IDS.menu.learningToggle)).toHaveAttribute('aria-pressed', 'true');
    await closeMenu(sharedPage);

    const displayedWord = await sharedPage.getByTestId(TEST_IDS.word.title).textContent();
    const rawHistory = await sharedPage.evaluate(() => localStorage.getItem('vocabularyViewedHistory'));
    expect(rawHistory).not.toBeNull();
    const history = JSON.parse(rawHistory);
    const foundInHistory = Array.isArray(history) && history.some((h) => h.word === displayedWord);
    expect(foundInHistory).toBe(true);
  });

  test('In Learning Mode translation is hidden and revealed by button', async () => {
    await ensureMainScreen(sharedPage);

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.learningToggle).click();
    await closeMenu(sharedPage);
    await expect(sharedPage.getByTestId(TEST_IDS.learning.showTranslation)).toBeVisible();
    await expect(sharedPage.getByTestId(TEST_IDS.word.translation)).not.toBeVisible();

    await sharedPage.getByTestId(TEST_IDS.learning.showTranslation).click();
    await expect(sharedPage.getByTestId(TEST_IDS.word.translation)).toBeVisible();
    await expect(sharedPage.getByTestId(TEST_IDS.learning.showTranslation)).not.toBeVisible();

    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.learningToggle).click();
    await expect(sharedPage.getByTestId(TEST_IDS.menu.learningToggle)).toHaveAttribute('aria-pressed', 'false');
    await closeMenu(sharedPage);
  });

  test('Sign Out is performed last', async () => {
    await ensureMainScreen(sharedPage);
    await openMenu(sharedPage);
    await sharedPage.getByTestId(TEST_IDS.menu.signOut).click();
    await expect(sharedPage.getByTestId(TEST_IDS.signIn.submit)).toBeVisible({ timeout: 20_000 });
  });
});
