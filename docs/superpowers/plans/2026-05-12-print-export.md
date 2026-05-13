# Print Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-print export for three documents (расписание, жеребьёвка, результаты) accessible from the tournament management page.

**Architecture:** Three dedicated React pages at `/tournaments/:id/print/{schedule,bracket,results}` open in a new tab, fetch data, render a branded print-optimized document, and auto-call `window.print()`. A shared `PrintDocument` wrapper provides the dark header, footer, and `@media print` CSS. Print buttons appear in each tab of `TournamentManagePage`.

**Tech Stack:** React 19, TypeScript, CSS Modules, React Router v6, existing `matchesApi` / `tournamentsApi` from `@/shared/api`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/shared/lib/roundLabel.ts` | Pure helper: round number → label string |
| Create | `src/shared/ui/print-document/PrintDocument.tsx` | Shared wrapper: dark header, footer, print CSS, auto-print |
| Create | `src/shared/ui/print-document/PrintDocument.module.css` | `@page`, `@media print`, layout styles |
| Create | `src/pages/print-schedule/ui/PrintSchedulePage.tsx` | Schedule print page |
| Create | `src/pages/print-bracket/ui/PrintBracketPage.tsx` | Bracket/draw print page |
| Create | `src/pages/print-results/ui/PrintResultsPage.tsx` | Results print page |
| Modify | `src/shared/ui/index.ts` | Export `PrintDocument` |
| Modify | `src/widgets/bracket-view/ui/BracketView.tsx` | Replace local `roundLabel` with shared import |
| Modify | `src/app/router/AppRouter.tsx` | Register 3 new print routes |
| Modify | `src/pages/tournament-manage/ui/TournamentManagePage.tsx` | Add print buttons in ScheduleTab, BracketTab, results tab |

---

## Task 1: Extract `roundLabel` helper

**Files:**
- Create: `src/shared/lib/roundLabel.ts`
- Modify: `src/widgets/bracket-view/ui/BracketView.tsx` (remove local copy, import shared)

- [ ] **Step 1.1: Create the helper**

```ts
// src/shared/lib/roundLabel.ts
export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return '1/2';
  if (fromEnd === 2) return '1/4';
  if (fromEnd === 3) return '1/8';
  return `Раунд ${round}`;
}
```

- [ ] **Step 1.2: Remove local `roundLabel` from `BracketView.tsx` and import the shared one**

In `src/widgets/bracket-view/ui/BracketView.tsx`, remove the local function:
```ts
// DELETE this block:
const roundLabel = (round: number, totalRounds: number): string => {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return 'Полуфинал';
  if (fromEnd === 2) return '1/4 финала';
  if (fromEnd === 3) return '1/8 финала';
  return `Раунд ${round}`;
};
```

Add import at the top:
```ts
import { roundLabel } from '@/shared/lib/roundLabel';
```

Note: the old local version used "Полуфинал" / "1/4 финала" — the new shared version uses "1/2" / "1/4" for consistency with print documents. Both are correct; the shorter form is more standard.

- [ ] **Step 1.3: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 1.4: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/shared/lib/roundLabel.ts src/widgets/bracket-view/ui/BracketView.tsx
git commit -m "refactor: extract roundLabel to shared/lib"
```

---

## Task 2: Create `PrintDocument` shared wrapper

**Files:**
- Create: `src/shared/ui/print-document/PrintDocument.tsx`
- Create: `src/shared/ui/print-document/PrintDocument.module.css`
- Modify: `src/shared/ui/index.ts`

- [ ] **Step 2.1: Create CSS module**

```css
/* src/shared/ui/print-document/PrintDocument.module.css */
.root {
  min-height: 100vh;
  background: white;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  color: #111;
}

.noPrint {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  background: #f5f4f0;
  border-bottom: 1px solid #ddd;
}

.header {
  background: #1a1a1a;
  color: white;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.tournamentName {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 3px;
}

.meta {
  font-size: 9px;
  opacity: 0.55;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.docTitle {
  font-size: 9px;
  opacity: 0.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.body {
  padding: 20px 24px;
}

.footer {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #aaa;
}

.loading {
  padding: 60px;
  text-align: center;
  font-family: monospace;
  color: #888;
  letter-spacing: 0.1em;
}

.error {
  padding: 40px;
  text-align: center;
  color: #c00;
}

@media print {
  .noPrint {
    display: none !important;
  }
  .root {
    font-size: 10px;
  }
}

@page {
  size: A4 portrait;
  margin: 15mm;
}
```

- [ ] **Step 2.2: Create component**

```tsx
// src/shared/ui/print-document/PrintDocument.tsx
import { useEffect } from 'react';

import s from './PrintDocument.module.css';

interface Props {
  tournamentName: string;
  city: string;
  dateStart: string;
  dateEnd: string;
  docTitle: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', timeZone: 'UTC',
    });
  return start === end ? fmt(start) : `${fmt(start)} — ${fmt(end)}`;
}

export const PrintDocument = ({
  tournamentName, city, dateStart, dateEnd, docTitle,
  loading, error, children,
}: Props) => {
  useEffect(() => {
    if (!loading && !error) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading, error]);

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.loading}>ЗАГРУЗКА…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.error}>
          <div>{error}</div>
          <button onClick={() => window.close()} style={{ marginTop: 16, cursor: 'pointer' }}>
            Закрыть вкладку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.noPrint}>
        <button onClick={() => window.print()} style={{ cursor: 'pointer', padding: '4px 12px' }}>
          Распечатать
        </button>
        <button onClick={() => window.close()} style={{ cursor: 'pointer', padding: '4px 12px' }}>
          Закрыть
        </button>
      </div>
      <div className={s.header}>
        <div>
          <div className={s.tournamentName}>{tournamentName}</div>
          <div className={s.meta}>{formatDateRange(dateStart, dateEnd)} · {city}</div>
        </div>
        <div className={s.docTitle}>{docTitle}</div>
      </div>
      <div className={s.body}>
        {children}
        <div className={s.footer}>
          <span>Главный судья: ________________________________</span>
          <span>BOXR · Платформа ФБР</span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2.3: Export from `src/shared/ui/index.ts`**

Add this line to `src/shared/ui/index.ts`:
```ts
export { PrintDocument } from './print-document/PrintDocument';
```

- [ ] **Step 2.4: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 2.5: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/shared/ui/print-document/ src/shared/ui/index.ts
git commit -m "feat: add PrintDocument shared wrapper component"
```

---

## Task 3: Create `PrintSchedulePage`

**Files:**
- Create: `src/pages/print-schedule/ui/PrintSchedulePage.tsx`

The page fetches `tournamentsApi.findOne(id)` and `matchesApi.getBracket(id)` in parallel, then renders the schedule grouped by day.

- [ ] **Step 3.1: Create the page**

```tsx
// src/pages/print-schedule/ui/PrintSchedulePage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { roundLabel } from '@/shared/lib/roundLabel';
import { PrintDocument } from '@/shared/ui';

import type { Bracket, BracketMatch, Tournament } from '@/shared/types';

interface FlatMatch {
  match: BracketMatch;
  category: number;
  totalRounds: number;
  bout: number;
}

function buildFlat(bracket: Bracket): FlatMatch[] {
  const arr: Omit<FlatMatch, 'bout'>[] = [];
  for (const cat of bracket.categories) {
    for (const m of cat.matches) {
      if (m.scheduledAt !== null) {
        arr.push({ match: m, category: cat.weight, totalRounds: cat.rounds });
      }
    }
  }
  arr.sort((a, b) =>
    a.match.scheduledAt!.localeCompare(b.match.scheduledAt!) ||
    (a.match.ring ?? 0) - (b.match.ring ?? 0),
  );
  return arr.map((x, i) => ({ ...x, bout: i + 1 }));
}

function groupByDay(flat: FlatMatch[]): Map<string, FlatMatch[]> {
  const map = new Map<string, FlatMatch[]>();
  for (const f of flat) {
    const day = f.match.scheduledAt!.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(f);
    map.set(day, arr);
  }
  return map;
}

function formatDay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).toUpperCase();
}

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

export const PrintSchedulePage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([tournamentsApi.findOne(id), matchesApi.getBracket(id)])
      .then(([t, b]) => { setTournament(t); setBracket(b); })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [id]);

  const flat = bracket ? buildFlat(bracket) : [];
  const byDay = groupByDay(flat);
  const days = [...byDay.keys()].sort();

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="РАСПИСАНИЕ СОРЕВНОВАНИЙ"
      loading={loading}
      error={error}
    >
      {flat.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Расписание ещё не сгенерировано.
        </div>
      ) : (
        days.map((day) => (
          <div key={day} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: '#888', marginBottom: 8, paddingBottom: 4,
              borderBottom: '1px solid #eee',
            }}>
              {formatDay(day)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f5f4f0' }}>
                  {['ВРЕМЯ', 'БОЙ', 'РИНГ', 'КРАСНЫЙ УГОЛ', 'СИНИЙ УГОЛ', 'КАТ.', 'РАУНД'].map((h) => (
                    <th key={h} style={{
                      padding: '5px 6px', textAlign: h === 'КРАСНЫЙ УГОЛ' ? 'right' : 'left',
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDay.get(day)!.map(({ match, category, totalRounds, bout }) => (
                  <tr key={match.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{formatTime(match.scheduledAt!)}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{bout}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{match.ring}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      {match.red?.fullName ?? <em style={{ color: '#bbb' }}>TBD</em>}
                    </td>
                    <td style={{ padding: '5px 6px' }}>
                      {match.blue?.fullName ?? <em style={{ color: '#bbb' }}>TBD</em>}
                    </td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{category} кг</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>
                      {roundLabel(match.round, totalRounds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </PrintDocument>
  );
};
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3.3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/print-schedule/
git commit -m "feat: add PrintSchedulePage"
```

---

## Task 4: Create `PrintBracketPage`

**Files:**
- Create: `src/pages/print-bracket/ui/PrintBracketPage.tsx`

- [ ] **Step 4.1: Create the page**

```tsx
// src/pages/print-bracket/ui/PrintBracketPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { roundLabel } from '@/shared/lib/roundLabel';
import { PrintDocument } from '@/shared/ui';

import type { Bracket, BracketCategory, BracketMatch, Tournament } from '@/shared/types';

function isBye(m: BracketMatch): boolean {
  return m.result?.outcome === 'wo' && (m.red === null || m.blue === null);
}

function winnerName(m: BracketMatch): string {
  if (!m.result) return '___________';
  const winner = m.result.winnerId === m.red?.boxerId ? m.red : m.blue;
  return winner?.fullName ?? '___________';
}

function renderCategory(cat: BracketCategory) {
  const visible = cat.matches
    .filter((m) => !isBye(m))
    .sort((a, b) => a.round - b.round || a.position - b.position);

  return (
    <div key={cat.weight} style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: '#888', marginBottom: 6, paddingBottom: 4,
        borderBottom: '1px solid #eee',
      }}>
        {cat.weight} КГ
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f5f4f0' }}>
            {['РАУНД', '№', 'КРАСНЫЙ УГОЛ', 'СИНИЙ УГОЛ', 'ПОБЕДИТЕЛЬ'].map((h) => (
              <th key={h} style={{
                padding: '4px 6px', textAlign: 'left',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((m, i) => (
            <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 6px', color: '#888' }}>
                {roundLabel(m.round, cat.rounds)}
              </td>
              <td style={{ padding: '4px 6px', color: '#aaa' }}>{i + 1}</td>
              <td style={{ padding: '4px 6px' }}>
                {m.red?.fullName ?? <em style={{ color: '#bbb' }}>Победитель предыдущего</em>}
              </td>
              <td style={{ padding: '4px 6px' }}>
                {m.blue?.fullName ?? <em style={{ color: '#bbb' }}>Победитель предыдущего</em>}
              </td>
              <td style={{ padding: '4px 6px', color: m.result ? '#111' : '#ccc', fontStyle: m.result ? 'normal' : 'italic' }}>
                {winnerName(m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PrintBracketPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([tournamentsApi.findOne(id), matchesApi.getBracket(id)])
      .then(([t, b]) => { setTournament(t); setBracket(b); })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="ЖЕРЕБЬЁВКА"
      loading={loading}
      error={error}
    >
      {bracket?.categories.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Сетка ещё не сгенерирована.
        </div>
      ) : (
        bracket?.categories.map((cat) => renderCategory(cat))
      )}
    </PrintDocument>
  );
};
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 4.3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/print-bracket/
git commit -m "feat: add PrintBracketPage"
```

---

## Task 5: Create `PrintResultsPage`

**Files:**
- Create: `src/pages/print-results/ui/PrintResultsPage.tsx`

- [ ] **Step 5.1: Create the page**

```tsx
// src/pages/print-results/ui/PrintResultsPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { PrintDocument } from '@/shared/ui';

import type { CategoryResults, Results, Tournament } from '@/shared/types';

const OUTCOME_LABEL: Record<string, string> = {
  ko: 'KO', wp: 'WP', rsc: 'RSC', dsq: 'DSQ', wo: 'WO',
};

function renderCategory(cat: CategoryResults) {
  const { podium, finals } = cat;
  const maxRound = finals.length > 0 ? Math.max(...finals.map((f) => f.round)) : 0;

  const podiumCards: { place: number; name: string | null; club: string | null }[] = [
    { place: 1, name: podium.gold?.fullName ?? null, club: podium.gold?.club ?? null },
    { place: 2, name: podium.silver?.fullName ?? null, club: podium.silver?.club ?? null },
    ...podium.bronze.map((b) => ({ place: 3, name: b.fullName, club: b.club })),
  ];

  return (
    <div key={cat.weight} style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: '#888', marginBottom: 8, paddingBottom: 4,
        borderBottom: '1px solid #eee',
      }}>
        {cat.weight} КГ {!cat.finished && <span style={{ fontWeight: 400 }}>(в ходе)</span>}
      </div>

      {/* Podium */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {podiumCards.map((p, i) => (
          <div key={i} style={{
            flex: 1, padding: '8px 10px', borderRadius: 3,
            background: p.place === 1 ? '#1a1a1a' : '#f5f4f0',
            color: p.place === 1 ? 'white' : '#111',
            border: p.place !== 1 ? '1px solid #ddd' : 'none',
          }}>
            <div style={{ fontSize: 18, fontWeight: 300, opacity: 0.3 }}>{p.place}</div>
            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>
              {p.name ?? '—'}
            </div>
            {p.club && (
              <div style={{ fontSize: 8, opacity: 0.5, marginTop: 1 }}>{p.club}</div>
            )}
          </div>
        ))}
      </div>

      {/* Finals table */}
      {finals.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['РАУНД', 'ПОБЕДИТЕЛЬ', 'ПРОИГРАВШИЙ', 'ИСХОД'].map((h) => (
                <th key={h} style={{
                  padding: '4px 6px', textAlign: 'left',
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...finals].sort((a, b) => b.round - a.round).map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '4px 6px', color: '#888' }}>
                  {f.round === maxRound ? 'Финал' : '1/2'}
                </td>
                <td style={{ padding: '4px 6px', fontWeight: 600 }}>{f.winner.fullName}</td>
                <td style={{ padding: '4px 6px', color: '#666' }}>{f.loser.fullName}</td>
                <td style={{ padding: '4px 6px', color: '#888' }}>
                  {OUTCOME_LABEL[f.outcome]}{f.endRound ? ` · Р${f.endRound}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export const PrintResultsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([tournamentsApi.findOne(id), matchesApi.getPublicResults(id)])
      .then(([t, r]) => { setTournament(t); setResults(r); })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="ИТОГОВЫЕ РЕЗУЛЬТАТЫ"
      loading={loading}
      error={error}
    >
      {results?.categories.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Результатов пока нет.
        </div>
      ) : (
        results?.categories.map((cat) => renderCategory(cat))
      )}
    </PrintDocument>
  );
};
```

- [ ] **Step 5.2: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 5.3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/print-results/
git commit -m "feat: add PrintResultsPage"
```

---

## Task 6: Register routes in `AppRouter`

**Files:**
- Modify: `src/app/router/AppRouter.tsx`

- [ ] **Step 6.1: Add imports and routes**

In `src/app/router/AppRouter.tsx`, add three imports after existing page imports:

```ts
import { PrintSchedulePage } from '@/pages/print-schedule';
import { PrintBracketPage } from '@/pages/print-bracket';
import { PrintResultsPage } from '@/pages/print-results';
```

But first create the barrel `index.ts` for each page:

```ts
// src/pages/print-schedule/index.ts
export { PrintSchedulePage } from './ui/PrintSchedulePage';
```

```ts
// src/pages/print-bracket/index.ts
export { PrintBracketPage } from './ui/PrintBracketPage';
```

```ts
// src/pages/print-results/index.ts
export { PrintResultsPage } from './ui/PrintResultsPage';
```

Then add three routes inside `<Routes>`, before the `path="*"` fallback:

```tsx
<Route
  path="/tournaments/:id/print/schedule"
  element={
    <RequireAuth>
      <PrintSchedulePage />
    </RequireAuth>
  }
/>
<Route
  path="/tournaments/:id/print/bracket"
  element={
    <RequireAuth>
      <PrintBracketPage />
    </RequireAuth>
  }
/>
<Route
  path="/tournaments/:id/print/results"
  element={
    <RequireAuth>
      <PrintResultsPage />
    </RequireAuth>
  }
/>
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 6.3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/print-schedule/index.ts src/pages/print-bracket/index.ts \
        src/pages/print-results/index.ts src/app/router/AppRouter.tsx
git commit -m "feat: register print routes"
```

---

## Task 7: Add print buttons in `TournamentManagePage`

**Files:**
- Modify: `src/pages/tournament-manage/ui/TournamentManagePage.tsx`

Three locations to update: `ScheduleTab`, `BracketTab`, and the results section.

- [ ] **Step 7.1: Add print button in `ScheduleTab`**

In the `ScheduleTab` component (near line 433 in `TournamentManagePage.tsx`), find the div with buttons `Перерасставить` and `Очистить расписание` and add a print button alongside them:

```tsx
{canMutate && (
  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
    <Button variant="ghost" onClick={onGenerate}>Перерасставить</Button>
    <Button variant="ghost" onClick={onClear}>Очистить расписание</Button>
  </div>
)}
{hasSchedule && (
  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
    <Button variant="ghost" onClick={onPrint}>🖨 Расписание</Button>
  </div>
)}
```

Add `onPrint` to `ScheduleTab` props:
```tsx
const ScheduleTab = ({
  tournament, bracket, onMatchClick, onGenerate, onClear, onPrint,
}: {
  tournament: Tournament;
  bracket: Bracket;
  onMatchClick: (m: BracketMatch) => void;
  onGenerate: () => void;
  onClear: () => void;
  onPrint: () => void;
}) => {
```

Pass `onPrint` in the JSX where `ScheduleTab` is used:
```tsx
<ScheduleTab
  tournament={tournament}
  bracket={bracket}
  onMatchClick={setScheduleMatch}
  onGenerate={async () => { ... }}
  onClear={async () => { ... }}
  onPrint={() => window.open(`/tournaments/${tournament.id}/print/schedule`, '_blank')}
/>
```

- [ ] **Step 7.2: Add print button in `BracketTab`**

In `BracketTab`, add `onPrint` prop and a button visible when `bracket !== null`:

```tsx
const BracketTab = ({
  tournament, bracket, loading, error, onMatchClick, onAssignJudge, onGenerate, onPrint,
}: {
  tournament: { id: string; status: string };
  bracket: Bracket | null;
  loading: boolean;
  error: string | null;
  onMatchClick: (m: BracketMatch) => void;
  onAssignJudge: (m: BracketMatch) => void;
  onGenerate: () => void;
  onPrint: () => void;
}) => {
```

Add print button in the return where `bracket !== null`, right before `<BracketView`:
```tsx
return (
  <div>
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      {canRegenerate && (
        <Button variant="ghost" onClick={onGenerate}>Перегенерировать сетку</Button>
      )}
      <Button variant="ghost" onClick={onPrint}>🖨 Жеребьёвка</Button>
    </div>
    <BracketView bracket={bracket} onMatchClick={onMatchClick} onAssignJudge={onAssignJudge} />
  </div>
);
```

Pass `onPrint` where `BracketTab` is used:
```tsx
<BracketTab
  ...
  onPrint={() => window.open(`/tournaments/${tournament.id}/print/bracket`, '_blank')}
/>
```

- [ ] **Step 7.3: Add print button in results tab**

In the results tab section (near `{tab === 'results' && results && <ResultsView results={results} />}`), wrap with a print button:

```tsx
{tab === 'results' && results && (
  <div>
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
      <Button
        variant="ghost"
        onClick={() => window.open(`/tournaments/${tournament.id}/print/results`, '_blank')}
      >
        🖨 Результаты
      </Button>
    </div>
    <ResultsView results={results} />
  </div>
)}
```

- [ ] **Step 7.4: Verify TypeScript compiles**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 7.5: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/tournament-manage/ui/TournamentManagePage.tsx
git commit -m "feat: add print buttons in tournament manage tabs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Browser print via `window.print()` — `PrintDocument` calls it on mount
- ✅ Buttons in each tab — Task 7
- ✅ Branded dark header — `PrintDocument` header styles
- ✅ Bracket as table listing — `PrintBracketPage`
- ✅ Dedicated routes opening in new tab — Tasks 3–6
- ✅ `RequireAuth` wrapping — Task 6
- ✅ Loading/error states — `PrintDocument`
- ✅ Footer with judge signature line — `PrintDocument`
- ✅ `roundLabel` extracted to shared — Task 1
- ✅ `@page` A4 print CSS — `PrintDocument.module.css`

**Type consistency:**
- `roundLabel(round, totalRounds)` used consistently in Tasks 1, 3, 4
- `matchesApi.getBracket(id)` returns `Bracket`, used in Tasks 3, 4
- `matchesApi.getPublicResults(id)` returns `Results`, used in Task 5
- `BracketCategory.rounds` used as `totalRounds` in Task 3 ✅
- `BracketMatch.result?.winnerId` compared to `BracketMatch.red?.boxerId` in Task 4 ✅
