# Bizora — Photography business manager

Bizora helps freelance photographers manage clients, invoices, payments, expenses and cash flow.
It is a React + TypeScript single-page app built with Vite, React Router and Recharts.

## Getting started

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Build for production: `npm run build` (runs `tsc -b` then `vite build`)
4. Preview the build: `npm run preview`

Works the same on Windows PowerShell, cmd and macOS/Linux shells.

## Project layout

- `src/main.tsx` — mounts the app with BrowserRouter, StoreProvider and ToastProvider
- `src/App.tsx` — route table
- `src/components/` — layout shell, sidebar, top bar, logo, icons, modal, toast, skeletons, charts
- `src/pages/` — one file per route
- `src/services/store.ts` — in-memory store (context + reducer) and pure selectors
- `src/data/sampleData.ts` — fictional sample data and shared data types
- `src/styles/theme.css` — the six palette colours as CSS variables
- `src/styles/global.css` — layout, components, responsive rules, reduced motion

## Palette

Midnight Eclipse `#0E0B1D` (base), `#2A1E4D` (surface), `#5A3B8C` (accent),
`#8B7CC7` (secondary accent, focus rings, chart series), `#C9C2E3` (text),
`#3A3A52` (neutral, dividers, inputs).

## Sample data & next stage: persistence

Every screen currently reads from in-memory sample data defined in `src/data/sampleData.ts`.
All of it is fictional (example.test e-mails, invented companies).

The single place to plug in real persistence is `src/services/store.ts`:

- `loadSample()` simulates a 600 ms load. Replace its body with a fetch from your API or a local database call.
- The reducer in `store.ts` is the only code that changes state. To persist, write each action's result to your backend (or IndexedDB) inside `StoreProvider`, after the dispatch.
- Invoice numbering (`settings.nextInvoiceNumber`) is assigned inside the reducer; move it server-side when you add real storage so numbers stay unique across devices.

Until then, a page refresh resets all changes to the sample data.
