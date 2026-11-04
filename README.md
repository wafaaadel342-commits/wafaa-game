# تحدّي المعرفة

Build a modern Arabic general-knowledge quiz game web app named "تحدّي المعرفة".

## Language & RTL

- The entire UI must be in Arabic. Set <html lang="ar" dir="rtl">.

- Use the Cairo font (Google Fonts).

- Use RTL-safe Tailwind utilities (ms-_, me-_, ps-_, pe-_, text-start, text-end) instead of left/right. Mirror direction-based icons (arrows, next buttons).

## Screens

1. Home: app title, short tagline, and 3 large level cards: سهل (green), متوسط (amber), صعب (red), each with an icon and a short description. Show the best score per level. A gear icon opens Settings.

2. Quiz: 10 questions per round, one at a time. Progress bar, question counter, current score, a 20-second timer per question (timeout = wrong answer), and 4 large tap-friendly answer buttons. After answering: highlight correct (green) and wrong (red), show a one-line explanation and a "التالي" button. Show a skeleton and "جاري تجهيز الأسئلة..." while loading.

3. Results: score, percentage, an encouraging message based on score, buttons "العب مرة أخرى" and "الرئيسية", and a review list of missed questions with the correct answers.

## Levels

- Easy (10 pts): very well-known facts most people know.

- Medium (15 pts): needs decent general knowledge.

- Hard (20 pts): tricky, specialized, or detail-oriented questions.

## Question generation (AI)

Generate all 10 questions in ONE request per round to minimize cost. Create a small provider abstraction (one function: generateQuestions(level, provider, settings)). Settings dialog lets the user choose the provider:

1. Lovable AI (default, no key needed) – via a single secure backend edge function.

2. Google AI Studio (Gemini) – user pastes their API key; editable model name field with a sensible default.

3. OpenRouter – user pastes their API key; editable model ID text field.

API keys: store only in the browser's localStorage, never hardcode or log them. Use a password input with show/hide and a "حذف المفتاح" button. Save the selected provider and model too.

Prompt sent to the AI model: ask for Modern Standard Arabic questions across mixed categories (history, geography, science, literature, sports, technology, general culture, Arab world), matching the selected difficulty. Return ONLY a valid JSON array of 10 objects:

{ "question": string, "options": [4 strings], "correctIndex": 0-3, "explanation": one short sentence, "category": string }

Rules for the model: exactly one correct answer, plausible distractors, vary the correct answer position, no repeated questions, avoid controversial political or sensitive topics. Also send the last 30 questions seen in this session so the model avoids repeating them.

Robust parsing: strip markdown fences, validate the structure, retry once if invalid, then show a friendly Arabic error with a retry button. Handle missing key, rate limit, and network errors with clear Arabic messages.

## Design

Professional, modern and clean: soft gradient background, glass-style cards (subtle blur and border), rounded-2xl, generous spacing, subtle shadows, smooth CSS transitions (fade/slide, button press scale, correct/wrong feedback). Light/dark mode toggle. Use shadcn/ui and lucide-react icons. Mobile-first and fully responsive.

## Strict constraints (save credits)

- Do NOT generate or add any images, illustrations, or stock photos. Use only lucide icons, emoji, gradients, and CSS.

- Do NOT write tests, set up testing frameworks, or run automated/browser verification.

- Do NOT add extra features: no auth, accounts, database, leaderboard, audio, or multiplayer. The only backend piece allowed is the single edge function needed for Lovable AI.

- Do NOT create README or docs files.

- Keep the code compact: few files, reusable components, no unnecessary dependencies.

- Build everything in one pass and don't ask follow-up questions; make reasonable decisions yourself.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7b9472f-f049-4a64-b286-e487efb009a9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
