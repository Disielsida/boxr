import { useEffect, useReducer } from 'react';

import { liveScoringReducer } from './reducer';
import {
  initialState,
  type LiveScoringAction,
  type LiveScoringState,
  type ReducerParams,
} from './types';

const storageKey = (matchId: string) => `boxr.scoring.${matchId}`;

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

export function loadFromStorage(matchId: string): LiveScoringState | null {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveToStorage(matchId: string, state: LiveScoringState): void {
  try {
    localStorage.setItem(storageKey(matchId), JSON.stringify(state));
  } catch {
    /* quota exceeded — игнорируем */
  }
}

export function clearStorage(matchId: string): void {
  try {
    localStorage.removeItem(storageKey(matchId));
  } catch {
    /* пустим */
  }
}

export function useLiveScoring(matchId: string, params: ReducerParams) {
  const [state, dispatch] = useReducer(
    (s: LiveScoringState, a: LiveScoringAction): LiveScoringState =>
      liveScoringReducer(s, a, params),
    null,
    (_: null): LiveScoringState => loadFromStorage(matchId) ?? initialState(params),
  );

  useEffect(() => {
    saveToStorage(matchId, state);
  }, [matchId, state]);

  useEffect(() => {
    if (!state.isRunning || state.fightState === 'ended') return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.isRunning, state.fightState]);

  return { state, dispatch };
}
