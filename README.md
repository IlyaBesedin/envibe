# envibe

An English vocabulary learning app with AI-generated example sentences, word
translation, and multi-dictionary support. Built with Next.js (Pages Router),
backed by Neon PostgreSQL, authenticated with Stack Auth, and powered by Google
Gemini for AI generation.

**🔗 Live demo: https://envibe.vercel.app**

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Tests: Playwright](https://img.shields.io/badge/Tests-Playwright-2EAD33?logo=playwright)

## Overview

- Browse vocabulary cards one word at a time and study AI-generated example
  sentences tailored to your English level and a chosen topic.
- Manage multiple dictionaries (e.g. per language pair) and add new words —
  manually or via AI translation.
- Data lives in Neon PostgreSQL and is accessed through the Neon Data API, with
  local caching in `localStorage` for fast loads and offline-friendly browsing.

## Features

- **Vocabulary management**
  - Fetches words and dictionaries from the Neon Data API.
  - Word format: `{ id, key, translate, dict_id }`.
  - Local caching in `localStorage` (words, dictionaries, selected dictionary,
    history, settings, auth tokens, theme).
- **Multiple dictionaries**
  - Select between dictionaries; add a new dictionary with a title and language.
- **Navigation modes**
  - Sequential (in-order) and random selection, with random-history back/forward.
  - Keyboard, click, and arrow navigation.
- **AI sentence generation**
  - Google Gemini integration (`gemini-2.5-flash`).
  - Level-based output (A1–C2) and selectable sentence topic (sport, work,
    travel, food, etc., or a random topic).
  - API endpoint: `POST /api/generate`.
- **Word translation**
  - Translate a word into a target language and optionally add it to a
    dictionary; copy the result to the clipboard.
  - Supported target languages: Russian, English, Serbian, Korean.
  - API endpoint: `POST /api/translate`.
- **Authentication**
  - Email/password sign-in via Stack Auth, with automatic session-token refresh.
- **View history**
  - Tracks viewed words with de-duplication; reviewable in a modal.
- **Settings & appearance**
  - Select English level (A1–C2), sentence topic, and translation language.
  - Toggle random order; clear cache and history.
  - Light/dark theme toggle (persisted).

## Tech Stack

- **Frontend:** Next.js ^15.5.7 (Pages Router), React ^19.1.1
- **AI:** Google Gemini via `@google/genai`
- **Database:** Neon PostgreSQL (Neon Data API / REST)
- **Authentication:** Stack Auth (`@stackframe/js`)
- **Styling:** Inline CSS + `styles/global.css`
- **Testing:** Playwright (e2e)

## Project Structure

```
envibe/
├── package.json              # Project config (Next.js + React)
├── generate.js               # CLI utility for sentence generation
├── README.md                 # Getting started and docs
│
├── pages/                    # Next.js pages (Pages Router)
│   ├── _app.js               # App wrapper
│   ├── index.js              # Main app page
│   └── api/
│       ├── generate.js       # AI sentence-generation API route
│       └── translate.js      # AI word-translation API route
│
├── components/               # UI components
│   ├── WordCard.js           # Vocabulary card
│   ├── SideMenu.js           # Navigation / actions menu
│   ├── SettingsModal.js      # Level, topic, language, theme, reset
│   ├── HistoryModal.js       # Viewed-word history
│   ├── AddWordModal.js       # Add a word manually
│   ├── AddDictionaryModal.js # Create a new dictionary
│   ├── TranslateModal.js     # Translate a word and add it
│   ├── SignInForm.js         # Email/password sign-in
│   └── RequestErrorMessage.js# Standardized API error display
│
├── lib/                      # Utilities and integrations
│   ├── constants.js          # API URLs and localStorage keys
│   ├── generateSentence.js   # Gemini sentence-generation module
│   ├── translateWord.js      # Gemini word-translation module
│   ├── sentenceTopics.js     # Sentence topic options & resolver
│   ├── translationLanguages.js # Translation target languages
│   ├── storage.js            # Safe localStorage wrapper (SSR-aware)
│   └── utils.js              # Shared helpers (nonce, clipboard, errors)
│
├── stack/                    # Stack Auth configuration
│   ├── client.js             # Client-side app config
│   └── server.js             # Server-side app config
│
├── styles/
│   └── global.css            # Global styles
│
├── e2e/                      # Playwright end-to-end tests
│   ├── vocabulary-bdd.spec.js
│   └── testIds.js            # Shared test-id constants
│
└── neon-auth-nextjs-template/ # Neon Auth reference template (TypeScript)
```

## Environment Variables

Copy the example file and fill in your own values (`.env.local` is git-ignored):

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key (AI sentence generation & translation) |
| `NEXT_PUBLIC_STACK_PROJECT_ID` | ✅ | Stack Auth project id |
| `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` | ✅ | Stack Auth publishable client key |
| `STACK_SECRET_SERVER_KEY` | ✅ | Stack Auth secret server key |
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_NEON_REST_URL` | ✅ | Neon Data API base URL (e.g. `https://<endpoint>.apirest.<region>.aws.neon.tech/neondb/rest/v1`) |
| `PLAYWRIGHT_BASE_URL` | ⬜ | Override e2e base URL (default `http://127.0.0.1:3000`) |

> Get Stack Auth keys from https://app.stack-auth.com

## Getting Started

- Install dependencies:
  - `npm install`
- Run the dev server:
  - `npm run dev`
- Open the app:
  - http://localhost:3000

## CLI Sentence Generation

Generate a sentence directly from the command line (uses `GEMINI_API_KEY`):

```bash
node generate.js "despair" B2
```

Outputs JSON: `{ "word", "level", "sentence" }`.

## E2E Testing (Playwright)

- Install the Playwright browser (once after install):
  - `npm run playwright:install`
- Run e2e tests:
  - `npm run test:e2e`
- Run e2e tests in headed mode:
  - `npm run test:e2e:headed`
- Run e2e tests in UI mode:
  - `npm run test:e2e:ui`
- Run a selected test in UI mode:
  - `npx playwright test --ui --grep "adding a new dictionary"`

The Playwright config (`playwright.config.js`) starts the dev server
automatically and runs the Chromium project against `PLAYWRIGHT_BASE_URL`
(default `http://127.0.0.1:3000`).

## CI

- Workflow file: `.github/workflows/e2e-on-main-merge.yml`
- Trigger: on pull requests targeting `main`.
- Action: installs dependencies, caches and installs Chromium for Playwright,
  and runs the e2e suite. Secrets (Stack Auth, Neon `DATABASE_URL`,
  `GEMINI_API_KEY`, and `E2E_EMAIL`/`E2E_PASSWORD`) are provided via GitHub
  Actions secrets.

## Contact

Found a bug or have feedback? Reach out at
[envibe.dev@gmail.com](mailto:envibe.dev@gmail.com).

## License

This project is a personal portfolio project, released under the
[MIT License](LICENSE).
