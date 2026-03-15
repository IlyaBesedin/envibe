**Project Structure**

```
envibe/
├── Core Files
│   ├── package.json        # Project config (Next.js + React)
│   ├── generate.js         # CLI utility for sentence generation
│   └── README.md           # Getting started and docs
│
├── pages/                  # Next.js pages (Pages Router)
│   ├── index.js            # Main app page (~556 lines)
│   └── api/
│       └── generate.js     # AI generation API route
│
├── lib/                    # Utilities
│   └── generateSentence.js # Gemini AI integration module
│
├── stack/                  # Stack Auth configuration
│   ├── client.js           # Client-side config
│   └── server.js           # Server-side config
│
└── neon-auth-nextjs-template/ # Neon Auth template
    └── src/                # TypeScript app with authentication
```

**Overview**
- English vocabulary learning app with AI-generated example sentences.

**Features**
- Vocabulary management:
  - Fetches data from Neon DB
  - Data format: `[{ id, key, translate }]`
  - Local caching in `localStorage`
- Navigation modes:
  - Sequential: in-order browsing
  - Random: random selection
  - Keyboard, click, and arrow navigation
- AI sentence generation:
  - Google Gemini integration
  - Level-based output (A1–C2)
  - API endpoint: `/api/generate`
- View history:
  - Tracks viewed words with de-duplication
  - Modal to review history
- Settings:
  - Select English level (A1–C2)
  - Toggle random order
  - Clear cache and history

**Tech Stack**
- Frontend: Next.js 15.4.5, React 19.1.1
- AI: Google Gemini AI
- Database: Neon PostgreSQL (Data API)
- Authentication: Stack Auth
- Styling: Inline CSS

**Key Components**
- `pages/index.js` (main app)
  - Vocabulary state management and navigation
  - AI sentence generation
  - Settings and history modals
- `lib/generateSentence.js` (AI module)
  - Gemini API integration
  - Level-based prompts
- `pages/api/generate.js` (API route)
  - Handles `POST` requests
  - Calls AI generation

**Getting Started**
- Install dependencies:
  - `npm install`
- Run the dev server:
  - `npm run dev`
- Open the app:
  - http://localhost:3000

**E2E Testing (Playwright)**
- Install Playwright browser (once after install):
  - `npm run playwright:install`
- Run e2e tests:
  - `npm run test:e2e`
- Run e2e tests in UI mode:
  - `npm run test:e2e:ui`

**CI**
- Workflow file: `.github/workflows/e2e-on-main-merge.yml`
- Trigger: after PR is merged into `main`
- Action: installs dependencies, installs Chromium for Playwright, runs e2e tests.
