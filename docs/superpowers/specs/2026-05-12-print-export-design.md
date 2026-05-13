# Print Export Design

**Date:** 2026-05-12  
**Project:** boxr (frontend SPA)

## Overview

Three printable documents for tournament organizers:
1. **Расписание** — full schedule grouped by day
2. **Жеребьёвка** — draw table grouped by weight category and round
3. **Результаты** — podium + match results grouped by weight category

## Decisions

| Question | Decision |
|---|---|
| Print mechanism | `window.print()` — browser native print/PDF dialog |
| Button placement | In each tab header (Жеребьёвка / Расписание / Результаты) |
| Document style | Branded: dark header, sans-serif, like the app |
| Bracket format | Table listing (not visual tree) |
| Architecture | Dedicated print routes, open in new tab |

## Architecture

### New Routes

```
/tournaments/:id/print/schedule   — расписание
/tournaments/:id/print/bracket    — жеребьёвка
/tournaments/:id/print/results    — результаты
```

Each route:
- Is a standalone React page component
- Fetches two things on mount: `tournamentsApi.findOne(id)` for header info (name, city, dates), plus its document-specific data (bracket or results)
- Calls `window.print()` automatically once **both** fetches complete
- Is accessible to any authenticated user (wrapped in `<RequireAuth>`, no role restriction)

### FSD Layer Placement

```
src/pages/
  print-schedule/ui/PrintSchedulePage.tsx
  print-bracket/ui/PrintBracketPage.tsx
  print-results/ui/PrintResultsPage.tsx

src/shared/ui/
  print-document/
    PrintDocument.tsx     — shared wrapper (dark header, footer, @media print CSS)
    PrintDocument.module.css
```

### Trigger: Print Buttons in Tabs

`TournamentManagePage.tsx` — three locations:

- `ScheduleTab` — кнопка «🖨 Расписание» (visible when `hasSchedule`)
- `BracketTab` — кнопка «🖨 Жеребьёвка» (visible when `bracket !== null`)
- Results tab inline — кнопка «🖨 Результаты» (visible when `results !== null`)

Each button opens the corresponding route in a new tab:
```ts
window.open(`/tournaments/${id}/print/schedule`, '_blank')
```

## Print Document Structure

### Shared wrapper `<PrintDocument>`

Props: `tournamentName`, `city`, `dateStart`, `dateEnd`, `docTitle`, `children`

Renders:
```
┌─────────────────────────────────────────────────────────┐
│  [dark bg]  НАЗВАНИЕ ТУРНИРА — ГОД         ТИП ДОКУМЕНТА│
│             14–16 ИЮНЯ · МОСКВА                         │
├─────────────────────────────────────────────────────────┤
│  {children}                                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Главный судья: _______________    BOXR · Платформа ФБР │
└─────────────────────────────────────────────────────────┘
```

CSS:
```css
@page { size: A4 portrait; margin: 15mm; }
@media print { .no-print { display: none; } body { background: white; } }
```

A "Print" button and "Close" button are visible in `.no-print` wrapper before printing.

### 1. Расписание (`PrintSchedulePage`)

Data: `matchesApi.getBracket(id)` → flatten `BracketMatch[]` sorted by `scheduledAt`

Layout — grouped by day, each day:
- Section header: `14 ИЮНЯ 2025` (bold, uppercase, light separator line)
- Table columns: `ВРЕМЯ | БОЙ | РИНГ | КРАСНЫЙ УГОЛ | СИНИЙ УГОЛ | КАТ. | РАУНД`
- Round label: `1/8`, `1/4`, `1/2`, `Финал`
- Rows with `scheduledAt === null` are excluded

### 2. Жеребьёвка (`PrintBracketPage`)

Data: `matchesApi.getBracket(id)`

Layout — grouped by `category.weight`, each category:
- Section header: `60 КГ` (bold, uppercase, separator)
- Table columns: `РАУНД | № | КРАСНЫЙ УГОЛ | СИНИЙ УГОЛ | ПОБЕДИТЕЛЬ`
- `ПОБЕДИТЕЛЬ` column is blank underline for unplayed matches, filled name for completed
- Round label: `1/8`, `1/4`, `1/2`, `Финал`
- Bye matches (one boxer is null) are excluded

### 3. Результаты (`PrintResultsPage`)

Data: `matchesApi.getPublicResults(id)`

Layout — grouped by category, each category:
- Section header: `60 КГ`
- **Podium block** (horizontal, 3 cards): `1` dark bg | `2` light | `3` light — fullName + club
- **Finals table** columns: `РАУНД | ПОБЕДИТЕЛЬ | ПРОИГРАВШИЙ | ИСХОД`
- `ИСХОД` format: `KO · Р2`, `WP`, `RSC · Р1`, etc.
- Categories with no completed matches are still shown (podium shows `—`)

## Round Label Helper

Shared pure function `roundLabel(round: number, totalRounds: number): string`:
```
totalRounds - round === 0  →  "Финал"
totalRounds - round === 1  →  "1/2"
totalRounds - round === 2  →  "1/4"
totalRounds - round === 3  →  "1/8"
default                    →  `Раунд ${round}`
```

(Already exists in `BracketView.tsx` — extract to `src/shared/lib/roundLabel.ts`)

## Error & Loading States

Each print page shows:
- Loading: `ЗАГРУЗКА…` centered, no auto-print yet
- Error: error message + "Закрыть вкладку" button, no auto-print

## Out of Scope

- PDF generation on backend
- Multi-language support
- Custom paper sizes
- Saving/downloading as file (browser "Save as PDF" covers this)
