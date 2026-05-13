// @ts-nocheck — фронт-jest не настроен; файл готов к запуску при подключении vitest
import { liveScoringReducer } from './reducer';
import { initialState, type LiveScoringState, type ReducerParams } from './types';

const params: ReducerParams = {
  rounds: 3,
  roundDurationSec: 180,
  breakSec: 60,
  startScore: 10,
  minScore: 7,
};

describe('liveScoringReducer', () => {
  let s: LiveScoringState;
  beforeEach(() => { s = initialState(params); });

  it('START_FIGHT из prefight → active, время = roundDurationSec, таймер идёт', () => {
    const next = liveScoringReducer(s, { type: 'START_FIGHT' }, params);
    expect(next.fightState).toBe('active');
    expect(next.time).toBe(180);
    expect(next.isRunning).toBe(true);
  });

  it('TICK уменьшает время на 1', () => {
    s = { ...s, fightState: 'active', isRunning: true, time: 100 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.time).toBe(99);
  });

  it('TICK при времени 1 в active с round < rounds → scoring, останавливает таймер', () => {
    s = { ...s, fightState: 'active', isRunning: true, round: 1, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('scoring');
    expect(next.isRunning).toBe(false);
    expect(next.time).toBe(0);
  });

  it('TICK при времени 1 в active с последним раундом → scoring', () => {
    s = { ...s, fightState: 'active', isRunning: true, round: 3, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('scoring');
    expect(next.isRunning).toBe(false);
  });

  it('TICK при времени 1 в break → останавливает таймер, ждёт START_ROUND', () => {
    s = { ...s, fightState: 'break', isRunning: true, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('break');
    expect(next.isRunning).toBe(false);
  });

  it('START_ROUND из break → active, round + 1, time = roundDurationSec', () => {
    s = { ...s, fightState: 'break', round: 1, time: 0, isRunning: false };
    const next = liveScoringReducer(s, { type: 'START_ROUND' }, params);
    expect(next.fightState).toBe('active');
    expect(next.round).toBe(2);
    expect(next.time).toBe(180);
    expect(next.isRunning).toBe(true);
  });

  it('TOGGLE_TIMER инвертирует isRunning', () => {
    s = { ...s, fightState: 'active', isRunning: true };
    const next = liveScoringReducer(s, { type: 'TOGGLE_TIMER' }, params);
    expect(next.isRunning).toBe(false);
    const back = liveScoringReducer(next, { type: 'TOGGLE_TIMER' }, params);
    expect(back.isRunning).toBe(true);
  });

  it('ADD_EVENT warning red уменьшает redScore на 1, добавляет event', () => {
    s = { ...s, fightState: 'active', time: 150 };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
    expect(next.redScore).toBe(9);
    expect(next.events).toHaveLength(1);
    expect(next.events[0].type).toBe('warning');
    expect(next.events[0].corner).toBe('red');
    expect(next.events[0].time).toBe('00:30'); // 180 - 150 = 30 секунд
  });

  it('ADD_EVENT warning red 4 раза не уводит ниже minScore', () => {
    s = { ...s, fightState: 'active' };
    let cur = s;
    for (let i = 0; i < 4; i++) {
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
    }
    expect(cur.redScore).toBe(7);
  });

  it('ADD_EVENT remark не меняет score', () => {
    s = { ...s, fightState: 'active' };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'remark', corner: 'red' }, params);
    expect(next.redScore).toBe(10);
    expect(next.events).toHaveLength(1);
  });

  it('ADD_EVENT stop → ended, isRunning=false', () => {
    s = { ...s, fightState: 'active', isRunning: true };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'stop', corner: 'red' }, params);
    expect(next.fightState).toBe('ended');
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
    expect(next.redScore).toBe(10);
    expect(next.blueScore).toBe(10);
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

  it('RESET возвращает в initialState', () => {
    s = { ...s, fightState: 'active', round: 2, time: 100, redScore: 8, events: [] };
    const next = liveScoringReducer(s, { type: 'RESET' }, params);
    expect(next).toEqual(initialState(params));
  });

  it('инвариант: scores ∈ [minScore, startScore] после любого ADD_EVENT', () => {
    let cur = { ...s, fightState: 'active' as const };
    for (let i = 0; i < 10; i++) {
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'knockdown', corner: 'blue' }, params);
    }
    expect(cur.redScore).toBeGreaterThanOrEqual(7);
    expect(cur.redScore).toBeLessThanOrEqual(10);
    expect(cur.blueScore).toBeGreaterThanOrEqual(7);
    expect(cur.blueScore).toBeLessThanOrEqual(10);
  });

  it('START_FIGHT из не-prefight состояния — игнорируется', () => {
    s = { ...s, fightState: 'active', isRunning: true };
    const next = liveScoringReducer(s, { type: 'START_FIGHT' }, params);
    expect(next).toBe(s); // same reference = no change
  });

  it('START_ROUND из не-break состояния — игнорируется', () => {
    s = { ...s, fightState: 'active', round: 1 };
    const next = liveScoringReducer(s, { type: 'START_ROUND' }, params);
    expect(next).toBe(s);
  });

  it('COMMIT_ROUND_SCORE из не-scoring состояния — игнорируется', () => {
    s = { ...s, fightState: 'active' };
    const next = liveScoringReducer(s, { type: 'COMMIT_ROUND_SCORE', red: 10, blue: 9 }, params);
    expect(next).toBe(s);
  });

  it('ADD_EVENT knockdown blue уменьшает blueScore на 1', () => {
    s = { ...s, fightState: 'active', time: 120 };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'knockdown', corner: 'blue' }, params);
    expect(next.blueScore).toBe(9);
    expect(next.events[0].type).toBe('knockdown');
  });

  it('ADD_EVENT в не-active состоянии — игнорируется', () => {
    s = { ...s, fightState: 'break' };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
    expect(next).toBe(s);
  });
});
