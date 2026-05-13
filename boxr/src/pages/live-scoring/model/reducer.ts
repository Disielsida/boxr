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
      // time reached 0
      if (state.fightState === 'active') {
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
      if (state.fightState !== 'active') return state;
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
