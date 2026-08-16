# 🌊 Ocean Flow — Photobooth Application

A modern, interactive ocean-themed photobooth web application built with **React**, **TypeScript**, and **Vite**, featuring dynamic generative wave animations, bilingual localization (English & Indonesian), and automated GitHub Actions CI/CD with a customized **Gemini AI Code Reviewer**.

---

## ✨ Features

### 📸 Photobooth Experience
* **Ocean-Themed Aesthetic**: Glassmorphism UI, tailored sea-blue color palettes, and ambient water particle animations.
* **Interactive Generative Wave Canvas**:
  * **Dynamic Wave Mode**: Real-time sinewave simulation with fluid turbulence and splash droplets.
  * **Splash Explosions**: Water splashes generated on screen transitions and user interactions.
  * **Kuyup (Drench) Effect**: Special overlay effect per photo slot.
* **Flexible Frame Layouts**:
  * Vertical Strip (3 cuts)
  * 2x2 Grid (4 cuts)
  * Single Classic (1 cut)
* **Bilingual Localization (i18n)**: Seamless language switcher between **English (EN)** and **Bahasa Indonesia (ID)**.
* **State Persistence**: Session state saved to `localStorage` with safety fallbacks.

---

## 🛠️ Tech Stack & Engineering Practices

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS / Vanilla CSS Variables, Lucide React Icons.
* **Linting & Code Standards**: ESLint 9 Flat Config with React Hooks & TypeScript rules.
* **Pre-commit Automation**: Husky 9 + `lint-staged` for automatic pre-commit lint verification.
* **CI Quality Checks**: GitHub Actions workflow testing ESLint and TypeScript builds on every PR.
* **AI Code Review**: Automated Pull Request code review powered by Google Gemini (Interactions API).

---

## 🚀 Getting Started

### Prerequisites
* Node.js 20+
* npm or yarn

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/ltnzz/photobooth.git
cd photobooth

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The application will be running at `http://localhost:5173`.

### Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start local Vite development server |
| `npm run build` | Compile TypeScript and build production bundle |
| `npm run lint` | Run ESLint across TypeScript and TSX source files |
| `npm run preview` | Preview production build locally |

---

## 🤖 Automated Gemini AI Code Review

This repository is equipped with an automated AI code review bot that analyzes Pull Request diffs against custom project guidelines (`GEMINI.md`).

### How to trigger a review:
1. Open a Pull Request.
2. Comment **`review`** or **`/review`** on the PR conversation.
3. The bot will:
   * Instantly acknowledge with an **`👀` (eyes)** emoji reaction.
   * Display a **live progress checklist** while analyzing.
   * Post a structured review breaking down **Code Correctness**, **React Best Practices**, **Architecture**, **TypeScript Consistency**, and **Project Guidelines Compliance**.
   * Add a **`🚀` (rocket)** emoji reaction upon completion.

---

## 📂 Project Structure

```
photobooth/
├── .github/
│   ├── scripts/
│   │   └── review-pr.js          # Node.js AI PR Review engine (Gemini API)
│   └── workflows/
│       ├── ci.yml                # CI Quality Checks (Lint & TypeCheck)
│       └── gemini-pr-review.yml  # AI Review trigger on PR comments
├── .husky/
│   └── pre-commit                # Local pre-commit Git hook (lint-staged)
├── src/
│   ├── components/
│   │   └── photobooth/
│   │       └── WaveCanvas.tsx    # Interactive HTML5 Canvas wave & splash engine
│   ├── hooks/
│   │   ├── usePhotoSession.ts    # Photo session state & storage management
│   │   └── useTranslation.ts     # Bilingual localization (ID / EN)
│   ├── App.tsx                   # Main Photobooth flow controller
│   └── main.tsx                  # Application entry point
├── GEMINI.md                     # Engineering standards & code review guidelines
└── package.json
```

---

## 📄 License
MIT License. Created with ❤️ for modern interactive web experiences.
