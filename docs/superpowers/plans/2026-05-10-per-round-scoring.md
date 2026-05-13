# Per-Round Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить пораундовую оценку по IBA: после каждого раунда судья подтверждает счёт (10:9, 10:8 и т.д.), итог по всем раундам определяет победителя WP.

**Architecture:** Добавляем состояние `'scoring'` в `FightState` — когда таймер раунда достигает 0, показывается модальная форма `RoundScorecardModal` где судья подтверждает/корректирует счёт раунда. Оценка коммитится экшном `COMMIT_ROUND_SCORE`, который сохраняет `roundScores[]`, сбрасывает текущие очки до 10:10 и переходит в `break` (или `ended` после последнего раунда). `EndFightPanel` при WP-исходе автоматически подсчитывает победителя по сумме раундов.

**Tech Stack:** React 19, TypeScript, CSS-in-JS (inline styles в стиле проекта), vitest (тесты в `reducer.spec.ts`)

---

## File Structure

| Файл | Действие | Роль |
|------|----------|------|
| `boxr/src/pages/live-scoring/model/types.ts` | Modify | Добавить `RoundScore`, `'scoring'` в `FightState`, `COMMIT_ROUND_SCORE` в actions, `roundScores` в state |
| `boxr/src/pages/live-scoring/model/reducer.ts` | Modify | TICK → `scoring` вместо `break`; новый кейс `COMMIT_ROUND_SCORE` |
| `boxr/src/pages/live-scoring/model/use-live-scoring.ts` | Modify | Обновить `isValidState` — добавить проверку `roundScores` |
| `boxr/src/pages/live-scoring/model/reducer.spec.ts` | Modify | Добавить тесты для `scoring`, `COMMIT_ROUND_SCORE`, `roundScores` |
| `boxr/src/pages/live-scoring/ui/RoundScorecardModal.tsx` | Create | Новый компонент: форма оценки раунда |
| `boxr/src/pages/live-scoring/ui/LiveScoringPage.tsx` | Modify | Рендерить `RoundScorecardModal` при `fightState === 'scoring'` |
| `boxr/src/pages/live-scoring/ui/EndFightPanel.tsx` | Modify | Показывать разбивку по раундам; авто-определять победителя WP по `roundScores` |

---

## Task 1: Обновить типы

**Files:**
- Modify: `boxr/src/pages/live-scoring/model/types.ts`

- [ ] **Step 1: Открыть файл и заменить содержимое**

```typescript
export type FightState = 'prefight' | 'active' | 'break' | 'scoring' | 'ended';

export type ScoringEventType = 'remark' | 'warning' | 'knockdown' | 'stop';
export type Corner = 'red' | 'blue';

export interface ScoringEvent {
  id: string;
  time: string;
  type: ScoringEventType;
  corner: Corner;
  round: number;
}

export interface RoundScore {
  round: number;
  red: number;
  blue: number;
}

export interface LiveScoringState {
  fightState: FightState;
  round: number;
  time: number;
  isRunning: boolean;
  redScore: number;
  blueScore: number;
  roundScores: RoundScore[];
  events: ScoringEvent[];
}

export type LiveScoringAction =
  | { type: 'START_FIGHT' }
  | { type: 'TICK' }
  | { type: 'TOGGLE_TIMER' }
  | { type: 'START_ROUND' }
  | { type: 'ADD_EVENT'; eventType: ScoringEventType; corner: Corner }
  | { type: 'COMMIT_ROUND_SCORE'; red: number; blue: number }
  | { type: 'RESET' };

export interface ReducerParams {
  rounds: number;
  roundDurationSec: number;
  breakSec: number;
  startScore: number;
  minScore: number;
}

export function initialState(params: ReducerParams): LiveScoringState {
  return {
    fightState: 'prefight',
    round: 1,
    time: params.roundDurationSec,
    isRunning: false,
    redScore: params.startScore,
    blueScore: params.startScore,
    roundScores: [],
    events: [],
  };
}

export const DEFAULT_PARAMS: Omit<ReducerParams, 'rounds' | 'roundDurationSec'> = {
  breakSec: 60,
  startScore: 10,
  minScore: 7,
};
```

- [ ] **Step 2: Убедиться что TypeScript не ругается**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx tsc --noEmit 2>&1 | head -20
```

Ожидание: ошибки только в `reducer.ts` и `use-live-scoring.ts` (они ещё не обновлены) — но не в `types.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/model/types.ts
git commit -m "feat(scoring): add RoundScore type, 'scoring' FightState, COMMIT_ROUND_SCORE action"
```

---

## Task 2: Обновить reducer

**Files:**
- Modify: `boxr/src/pages/live-scoring/model/reducer.ts`

- [ ] **Step 1: Написать failing тест для нового поведения TICK**

В файле `boxr/src/pages/live-scoring/model/reducer.spec.ts` добавить тест **перед** существующим `it('TICK при времени 1 в active с round < rounds → break...')`:

```typescript
it('TICK при времени 1 в active с round < rounds → scoring (не break)', () => {
  s = { ...s, fightState: 'active', isRunning: true, round: 1, time: 1 };
  const next = liveScoringReducer(s, { type: 'TICK' }, params);
  expect(next.fightState).toBe('scoring');
  expect(next.isRunning).toBe(false);
});

it('TICK при времени 1 в active с последним раундом → scoring (не ended)', () => {
  s = { ...s, fightState: 'active', isRunning: true, round: 3, time: 1 };
  const next = liveScoringReducer(s, { type: 'TICK' }, params);
  expect(next.fightState).toBe('scoring');
  expect(next.isRunning).toBe(false);
});

it('COMMIT_ROUND_SCORE не в последнем раунде → break, сбрасывает очки, сохраняет roundScores', () => {
  s = { ...s, fightState: 'scoring', round: 1, redScore: 9, blueScore: 10 };
  const next = liveScoringReducer(
    s,
    { type: 'COMMIT_ROUND_SCORE', red: 9, blue: 10 },
    params,
  );
  expect(next.fightState).toBe('break');
  expect(next.time).toBe(60);
  expect(next.isRunning).toBe(true);
  expect(next.redScore).toBe(10);   // сброс до startScore
  expect(next.blueScore).toBe(10);  // сброс до startScore
  expect(next.roundScores).toEqual([{ round: 1, red: 9, blue: 10 }]);
});

it('COMMIT_ROUND_SCORE в последнем раунде → ended', () => {
  s = { ...s, fightState: 'scoring', round: 3, redScore: 8, blueScore: 10 };
  const next = liveScoringReducer(
    s,
    { type: 'COMMIT_ROUND_SCORE', red: 8, blue: 10 },
    params,
  );
  expect(next.fightState).toBe('ended');
  expect(next.isRunning).toBe(false);
  expect(next.roundScores).toEqual([{ round: 3, red: 8, blue: 10 }]);
});

it('COMMIT_ROUND_SCORE накапливает roundScores по раундам', () => {
  s = {
    ...s,
    fightState: 'scoring',
    round: 2,
    roundScores: [{ round: 1, red: 10, blue: 9 }],
  };
  const next = liveScoringReducer(
    s,
    { type: 'COMMIT_ROUND_SCORE', red: 9, blue: 10 },
    params,
  );
  expect(next.roundScores).toEqual([
    { round: 1, red: 10, blue: 9 },
    { round: 2, red: 9, blue: 10 },
  ]);
});
```

- [ ] **Step 2: Запустить тесты — убедиться что они падают**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx vitest run src/pages/live-scoring/model/reducer.spec.ts 2>&1 | tail -20
```

Ожидание: FAIL (новые тесты красные, старые тесты на TICK → break тоже упадут после изменения логики).

- [ ] **Step 3: Заменить содержимое reducer.ts**

```typescript
import {
  initialState,
  type LiveScoringAction,
  type LiveScoringState,
  type ReducerParams,
  type ScoringEvent,
} from './types';

export function liveScoringReducer(
  state: LiveScoringState,
  action: LiveScoringAction,
  params: ReducerParams,
): LiveScoringState {
  switch (action.type) {
    case 'START_FIGHT':
      if (state.fightState !== 'prefight') return state;
      return { ...state, fightState: 'active', time: params.roundDurationSec, isRunning: true };

    case 'TOGGLE_TIMER':
      if (state.fightState === 'ended') return state;
      return { ...state, isRunning: !state.isRunning };

    case 'START_ROUND':
      if (state.fightState !== 'break') return state;
      return {
        ...state,
        fightState: 'active',
        round: state.round + 1,
        time: params.roundDurationSec,
        isRunning: true,
      };

    case 'TICK': {
      if (!state.isRunning || state.fightState === 'ended') return state;
      if (state.time > 1) {
        return { ...state, time: state.time - 1 };
      }
      // time достиг 0
      if (state.fightState === 'active') {
        // Всегда переходим в scoring — для последнего раунда тоже нужна оценка
        return { ...state, fightState: 'scoring', time: 0, isRunning: false };
      }
      if (state.fightState === 'break') {
        return { ...state, time: 0, isRunning: false };
      }
      return state;
    }

    case 'COMMIT_ROUND_SCORE': {
      if (state.fightState !== 'scoring') return state;
      const roundScores = [
        ...state.roundScores,
        { round: state.round, red: action.red, blue: action.blue },
      ];
      const isLastRound = state.round >= params.rounds;
      if (isLastRound) {
        return {
          ...state,
          fightState: 'ended',
          isRunning: false,
          roundScores,
        };
      }
      return {
        ...state,
        fightState: 'break',
        time: params.breakSec,
        isRunning: true,
        redScore: params.startScore,
        blueScore: params.startScore,
        roundScores,
      };
    }

    case 'ADD_EVENT': {
      const elapsedSec = params.roundDurationSec - state.time;
      const minutes = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const seconds = String(elapsedSec % 60).padStart(2, '0');
      const event: ScoringEvent = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: `${minutes}:${seconds}`,
        type: action.eventType,
        corner: action.corner,
        round: state.round,
      };
      let { redScore, blueScore } = state;
      if (action.eventType === 'warning' || action.eventType === 'knockdown') {
        if (action.corner === 'red') {
          redScore = Math.max(params.minScore, redScore - 1);
        } else {
          blueScore = Math.max(params.minScore, blueScore - 1);
        }
      }
      let next = { ...state, events: [event, ...state.events], redScore, blueScore };
      if (action.eventType === 'stop') {
        next = { ...next, fightState: 'ended', isRunning: false };
      }
      return next;
    }

    case 'RESET':
      return initialState(params);

    default:
      return state;
  }
}
```

- [ ] **Step 4: Обновить старые тесты, которые проверяли переход TICK → break/ended**

В `reducer.spec.ts` найти и обновить два теста — теперь TICK идёт в `scoring`, а не `break`/`ended`:

```typescript
// Старый тест (строка ~30): TICK при времени 1 в active с round < rounds → break
// Заменить на:
it('TICK при времени 1 в active с round < rounds → scoring, останавливает таймер', () => {
  s = { ...s, fightState: 'active', isRunning: true, round: 1, time: 1 };
  const next = liveScoringReducer(s, { type: 'TICK' }, params);
  expect(next.fightState).toBe('scoring');
  expect(next.isRunning).toBe(false);
  expect(next.time).toBe(0);
});

// Старый тест (строка ~38): TICK при времени 1 в active с последним раундом → ended
// Заменить на:
it('TICK при времени 1 в active с последним раундом → scoring', () => {
  s = { ...s, fightState: 'active', isRunning: true, round: 3, time: 1 };
  const next = liveScoringReducer(s, { type: 'TICK' }, params);
  expect(next.fightState).toBe('scoring');
  expect(next.isRunning).toBe(false);
});
```

- [ ] **Step 5: Запустить тесты — все должны пройти**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx vitest run src/pages/live-scoring/model/reducer.spec.ts 2>&1 | tail -20
```

Ожидание: все тесты PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/model/reducer.ts src/pages/live-scoring/model/reducer.spec.ts
git commit -m "feat(scoring): per-round scoring — TICK→scoring, add COMMIT_ROUND_SCORE"
```

---

## Task 3: Обновить isValidState в use-live-scoring.ts

**Files:**
- Modify: `boxr/src/pages/live-scoring/model/use-live-scoring.ts`

- [ ] **Step 1: Обновить `isValidState` — добавить проверку `roundScores`**

Найти функцию `isValidState` (строки 13-24) и заменить:

```typescript
function isValidState(value: unknown): value is LiveScoringState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.fightState === 'string' &&
    typeof s.round === 'number' &&
    typeof s.time === 'number' &&
    typeof s.isRunning === 'boolean' &&
    typeof s.redScore === 'number' &&
    typeof s.blueScore === 'number' &&
    Array.isArray(s.events) &&
    Array.isArray(s.roundScores)
  );
}
```

- [ ] **Step 2: Проверить TypeScript**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx tsc --noEmit 2>&1 | grep "live-scoring" | head -10
```

Ожидание: ошибок в live-scoring нет (кроме возможных ошибок в ещё не обновлённых UI-файлах).

- [ ] **Step 3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/model/use-live-scoring.ts
git commit -m "feat(scoring): update isValidState to validate roundScores field"
```

---

## Task 4: Создать RoundScorecardModal

**Files:**
- Create: `boxr/src/pages/live-scoring/ui/RoundScorecardModal.tsx`

- [ ] **Step 1: Создать файл**

```typescript
import { useState } from 'react';
import type { LiveScoringAction, LiveScoringState, ReducerParams } from '../model/types';

interface Props {
  state: LiveScoringState;
  params: ReducerParams;
  dispatch: (a: LiveScoringAction) => void;
  redName: string;
  blueName: string;
}

const SCORE_OPTIONS = [10, 9, 8, 7] as const;
type ScoreOption = (typeof SCORE_OPTIONS)[number];

export const RoundScorecardModal = ({ state, params, dispatch, redName, blueName }: Props) => {
  const [redScore, setRedScore] = useState<ScoreOption>(
    Math.max(params.minScore, Math.min(params.startScore, state.redScore)) as ScoreOption,
  );
  const [blueScore, setBlueScore] = useState<ScoreOption>(
    Math.max(params.minScore, Math.min(params.startScore, state.blueScore)) as ScoreOption,
  );

  const commit = () => {
    dispatch({ type: 'COMMIT_ROUND_SCORE', red: redScore, blue: blueScore });
  };

  const scoreBtn = (
    value: ScoreOption,
    selected: ScoreOption,
    onSelect: (v: ScoreOption) => void,
    color: string,
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => onSelect(value)}
      style={{
        width: 52,
        height: 52,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${selected === value ? color : 'rgba(242,238,229,0.15)'}`,
        background: selected === value ? `${color}33` : 'transparent',
        color: selected === value ? color : 'rgba(242,238,229,0.6)',
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {value}
    </button>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        background: 'rgba(10,10,10,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--ink-dark-surface)',
          border: '1px solid rgba(242,238,229,0.12)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '32px 40px',
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: 'rgba(242,238,229,0.4)',
              marginBottom: 6,
            }}
          >
            ОЦЕНКА РАУНДА
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Раунд {state.round}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
          {/* Красный угол */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: 'var(--ring-600)',
              }}
            >
              ● КРАСНЫЙ
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'rgba(242,238,229,0.6)',
                textAlign: 'center',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {redName}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCORE_OPTIONS.map((v) => scoreBtn(v, redScore, setRedScore, 'var(--ring-600)'))}
            </div>
          </div>

          <div
            style={{
              width: 1,
              background: 'rgba(242,238,229,0.08)',
              alignSelf: 'stretch',
            }}
          />

          {/* Синий угол */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: '#3b82f6',
              }}
            >
              ● СИНИЙ
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'rgba(242,238,229,0.6)',
                textAlign: 'center',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {blueName}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCORE_OPTIONS.map((v) => scoreBtn(v, blueScore, setBlueScore, '#3b82f6'))}
            </div>
          </div>
        </div>

        {redScore === blueScore && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'rgba(242,238,229,0.5)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ⚠ Счёт равный — в IBA один боксёр всегда получает 10
          </div>
        )}

        <button
          type="button"
          onClick={commit}
          style={{
            padding: '14px 28px',
            background: 'var(--ring-600)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.08em',
            alignSelf: 'stretch',
          }}
        >
          {state.round >= 0 ? `ПОДТВЕРДИТЬ ОЦЕНКУ РАУНДА ${state.round}` : 'ПОДТВЕРДИТЬ'}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Проверить TypeScript**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx tsc --noEmit 2>&1 | grep "RoundScorecardModal" | head -10
```

Ожидание: ошибок нет.

- [ ] **Step 3: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/ui/RoundScorecardModal.tsx
git commit -m "feat(scoring): add RoundScorecardModal component"
```

---

## Task 5: Подключить RoundScorecardModal в LiveScoringPage

**Files:**
- Modify: `boxr/src/pages/live-scoring/ui/LiveScoringPage.tsx`

- [ ] **Step 1: Добавить импорт и передать `params` в `ActiveLiveScoring`**

В начале файла добавить импорт:

```typescript
import { RoundScorecardModal } from './RoundScorecardModal';
```

- [ ] **Step 2: Обновить компонент `ActiveLiveScoring`**

Найти блок после закрытия `<div style={{ flex: 1, display: 'flex'... }}>` (строки 160-164) и добавить рендер модального окна. Итоговый JSX тела компонента:

```tsx
return (
  <div
    style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--ink-dark-bg)',
      color: 'var(--ink-dark-text)',
      fontFamily: 'var(--font-body)',
      overflow: 'hidden',
    }}
  >
    <div className={s.landscapeHint}>
      <div className={s.hintIcon}>📱</div>
      <div className={s.hintText}>
        Поверни устройство<br />для удобного<br />судейства
      </div>
    </div>

    {/* Header */}
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid rgba(242,238,229,0.08)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(242,238,229,0.4)',
          letterSpacing: '0.1em',
        }}
      >
        {match.tournament.name.toUpperCase()}{match.match.ring ? ` · РИНГ ${match.match.ring}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: match.tournament.rounds }, (_, i) => i + 1).map((r) => (
          <div
            key={r}
            style={{
              width: 32,
              height: 6,
              borderRadius: 3,
              background:
                r < state.round
                  ? 'var(--ring-600)'
                  : r === state.round
                    ? state.isRunning
                      ? 'var(--ring-600)'
                      : 'rgba(178,58,47,0.4)'
                    : 'rgba(242,238,229,0.08)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(242,238,229,0.4)',
          letterSpacing: '0.1em',
        }}
      >
        БОЙ {match.match.position + 1} · РАУНД {state.round}
      </div>
    </div>

    {/* Main area */}
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <CornerPanel side="red"  boxer={match.match.red}  score={state.redScore}  startScore={params.startScore} />
      <CenterControls state={state} dispatch={dispatch} totalRounds={params.rounds} />
      <CornerPanel side="blue" boxer={match.match.blue} score={state.blueScore} startScore={params.startScore} />
    </div>

    {/* Bottom panel */}
    {state.fightState === 'ended' ? (
      <EndFightPanel state={state} match={match} onFinished={onFinished} />
    ) : (
      <EventActionsPanel
        events={state.events}
        dispatch={dispatch}
        disabled={state.fightState === 'prefight' || state.fightState === 'scoring'}
      />
    )}

    {/* Round scorecard modal — overlay поверх всего */}
    {state.fightState === 'scoring' && (
      <RoundScorecardModal
        state={state}
        params={params}
        dispatch={dispatch}
        redName={match.match.red?.fullName ?? '—'}
        blueName={match.match.blue?.fullName ?? '—'}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Проверить TypeScript**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx tsc --noEmit 2>&1 | grep "live-scoring" | head -10
```

Ожидание: ошибок нет.

- [ ] **Step 4: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/ui/LiveScoringPage.tsx
git commit -m "feat(scoring): render RoundScorecardModal in scoring state"
```

---

## Task 6: Обновить EndFightPanel — разбивка по раундам и авто-победитель

**Files:**
- Modify: `boxr/src/pages/live-scoring/ui/EndFightPanel.tsx`

- [ ] **Step 1: Добавить helper-функцию для подсчёта итоговых очков**

В начале файла (после импортов) добавить:

```typescript
function calcTotals(roundScores: import('../model/types').RoundScore[]) {
  return roundScores.reduce(
    (acc, r) => ({ red: acc.red + r.red, blue: acc.blue + r.blue }),
    { red: 0, blue: 0 },
  );
}
```

- [ ] **Step 2: Обновить `useState` для `winner` — авто-определение по roundScores**

Найти строку:
```typescript
const [winner, setWinner] = useState<'red' | 'blue'>(
  state.redScore >= state.blueScore ? 'red' : 'blue',
);
```

Заменить на:
```typescript
const totals = calcTotals(state.roundScores);
const [winner, setWinner] = useState<'red' | 'blue'>(
  state.roundScores.length > 0
    ? totals.red >= totals.blue ? 'red' : 'blue'
    : state.redScore >= state.blueScore ? 'red' : 'blue',
);
```

- [ ] **Step 3: Добавить блок разбивки по раундам в JSX**

Найти блок `{tied && (...)}` (строка ~136) и добавить **перед ним** блок с разбивкой:

```tsx
{state.roundScores.length > 0 && (
  <div
    style={{
      background: 'rgba(242,238,229,0.03)',
      border: '1px solid rgba(242,238,229,0.08)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        color: 'rgba(242,238,229,0.4)',
        marginBottom: 4,
      }}
    >
      ПРОТОКОЛ РАУНДОВ
    </div>
    {state.roundScores.map((rs) => (
      <div
        key={rs.round}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
      >
        <span style={{ color: 'rgba(242,238,229,0.4)', minWidth: 64 }}>Раунд {rs.round}</span>
        <span
          style={{
            color: rs.red > rs.blue ? 'var(--ring-600)' : 'rgba(242,238,229,0.6)',
            fontWeight: rs.red > rs.blue ? 700 : 400,
          }}
        >
          {rs.red}
        </span>
        <span style={{ color: 'rgba(242,238,229,0.2)', margin: '0 8px' }}>:</span>
        <span
          style={{
            color: rs.blue > rs.red ? '#3b82f6' : 'rgba(242,238,229,0.6)',
            fontWeight: rs.blue > rs.red ? 700 : 400,
          }}
        >
          {rs.blue}
        </span>
      </div>
    ))}
    <div
      style={{
        borderTop: '1px solid rgba(242,238,229,0.08)',
        paddingTop: 8,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      <span style={{ color: 'rgba(242,238,229,0.4)' }}>ИТОГО</span>
      <span style={{ color: totals.red > totals.blue ? 'var(--ring-600)' : 'rgba(242,238,229,0.8)' }}>
        {totals.red}
      </span>
      <span style={{ color: 'rgba(242,238,229,0.2)', margin: '0 8px' }}>:</span>
      <span style={{ color: totals.blue > totals.red ? '#3b82f6' : 'rgba(242,238,229,0.8)' }}>
        {totals.blue}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 4: Обновить `tied` — учитывать roundScores если они есть**

Найти строку:
```typescript
const tied = state.redScore === state.blueScore && outcome === 'wp';
```

Заменить на:
```typescript
const tied = outcome === 'wp' && (
  state.roundScores.length > 0
    ? totals.red === totals.blue
    : state.redScore === state.blueScore
);
```

- [ ] **Step 5: Проверить TypeScript**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx tsc --noEmit 2>&1 | grep "EndFightPanel\|live-scoring" | head -10
```

Ожидание: ошибок нет.

- [ ] **Step 6: Запустить все тесты reducer**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npx vitest run src/pages/live-scoring/model/reducer.spec.ts 2>&1 | tail -10
```

Ожидание: все тесты PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/ui/EndFightPanel.tsx
git commit -m "feat(scoring): show round-by-round breakdown and auto-select WP winner in EndFightPanel"
```

---

## Task 7: Smoke-тест в браузере

**Files:** (нет изменений кода — только проверка)

- [ ] **Step 1: Запустить dev-сервер фронтенда**

```bash
cd /Users/andreisidorcenko/diplom/boxr
npm run dev
```

- [ ] **Step 2: Создать тестовый матч через API (если нет готового)**

Нужен матч со статусом `READY`. Если есть — взять его `id` из `matchesApi` или из базы:
```bash
cd /Users/andreisidorcenko/diplom/boxr-api
npx prisma studio
# Таблица Match → найти запись со status=READY
```

- [ ] **Step 3: Открыть страницу скоринга**

```
http://localhost:5173/scoring/{matchId}
```

Войти как ORGANIZER или JUDGE (назначенный на матч).

- [ ] **Step 4: Провести тестовый бой**

Проверить последовательность:
1. Нажать СТАРТ → таймер пошёл
2. Нажать ПАУЗА → таймер остановился
3. Выдать 1 предупреждение красному → счёт стал 9
4. Нажать СТАРТ → таймер пошёл
5. Дождаться конца раунда (или выставить `roundDurationSec: 10` в params для ускорения через DevTools)
6. Убедиться что появился `RoundScorecardModal` с кнопками 10/9/8/7
7. Проверить предзаполнение: красный = 9 (с учётом предупреждения), синий = 10
8. Нажать ПОДТВЕРДИТЬ → модальное закрылось, таймер перерыва 60 сек
9. После перерыва нажать СЛЕД. РАУНД → счёт красного сбросился до 10
10. После последнего раунда + ПОДТВЕРДИТЬ → показывается `EndFightPanel` с таблицей раундов
11. Проверить что в `EndFightPanel` показывается протокол раундов и правильно выбран победитель
12. Нажать УТВЕРДИТЬ РЕЗУЛЬТАТ → редирект на страницу турнира

---

## Self-Review

### 1. Spec Coverage

Требования пользователя:
- ✅ Форма оценки при переходе в `break` → реализовано как модальное окно при `fightState === 'scoring'`
- ✅ Хранение `roundScores[]` по раундам → добавлено в `LiveScoringState`
- ✅ Автоматический подсчёт победителя по сумме → `calcTotals()` в `EndFightPanel`, автопредзаполнение `winner`
- ✅ Отправка пораундовых очков на бэкенд — **НЕ реализовано**: `PATCH /matches/:id` принимает только `winner`, `outcome`, `endRound`. Бэкенд не имеет поля для round scores. Текущая реализация сохраняет `roundScores` только в localStorage. Это соответствует текущей архитектуре.

### 2. Placeholder Scan

Нет TBD, нет "handle edge cases", все шаги содержат код.

### 3. Type Consistency

- `RoundScore` определён в Task 1, используется в Task 2 (`reducer.ts`), Task 3 (`isValidState`), Task 6 (`calcTotals`)
- `COMMIT_ROUND_SCORE` action определён в Task 1, обрабатывается в Task 2, диспатчится в Task 4
- `'scoring'` FightState определён в Task 1, обрабатывается в Task 2, рендерится в Task 5
- `params` (тип `ReducerParams`) передаётся в `RoundScorecardModal` — Task 4 принимает его, Task 5 передаёт его
- `totals` объявлен внутри компонента `EndFightPanel` — используется и для `winner` init, и для `tied`, и для рендера таблицы: всё в одном scope, конфликтов нет
