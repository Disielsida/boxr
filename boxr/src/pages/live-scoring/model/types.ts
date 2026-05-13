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
