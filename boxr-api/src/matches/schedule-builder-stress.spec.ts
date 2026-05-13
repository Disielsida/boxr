/**
 * Стресс-тест планировщика расписания.
 * Полный турнир: 13 весовых категорий IBA, 8 участников в каждой.
 * 13 × 7 матчей = 91 матч, 3 раунда на категорию.
 */
import { planSchedule, PlannerInputMatch, PlannerParams } from './schedule-builder';

// 13 весовых категорий IBA (мужчины)
const IBA_CATEGORIES = [46, 48, 51, 54, 57, 60, 63.5, 67, 71, 75, 80, 86, 92];

/**
 * Генерирует матчи для категории с 8 участниками:
 *   Раунд 1: 4 четвертьфинала (позиции 0-3)
 *   Раунд 2: 2 полуфинала (позиции 0-1), зависят от пар QF
 *   Раунд 3: 1 финал (позиция 0), зависит от SF
 */
function buildCategoryMatches(category: number, boxerOffset: number): PlannerInputMatch[] {
  const matches: PlannerInputMatch[] = [];
  const id = (round: number, pos: number) => `${category}_R${round}_P${pos}`;

  // Раунд 1: 4 четвертьфинала
  for (let pos = 0; pos < 4; pos++) {
    matches.push({
      id: id(1, pos),
      category,
      round: 1,
      position: pos,
      redBoxerId: `boxer_${boxerOffset + pos * 2}`,
      blueBoxerId: `boxer_${boxerOffset + pos * 2 + 1}`,
      prevMatchIds: [],
    });
  }

  // Раунд 2: 2 полуфинала
  for (let pos = 0; pos < 2; pos++) {
    matches.push({
      id: id(2, pos),
      category,
      round: 2,
      position: pos,
      redBoxerId: null,
      blueBoxerId: null,
      prevMatchIds: [id(1, pos * 2), id(1, pos * 2 + 1)],
    });
  }

  // Раунд 3: финал
  matches.push({
    id: id(3, 0),
    category,
    round: 3,
    position: 0,
    redBoxerId: null,
    blueBoxerId: null,
    prevMatchIds: [id(2, 0), id(2, 1)],
  });

  return matches;
}

function buildFullTournament(): PlannerInputMatch[] {
  const all: PlannerInputMatch[] = [];
  IBA_CATEGORIES.forEach((cat, i) => {
    all.push(...buildCategoryMatches(cat, i * 8));
  });
  return all;
}

// Базовые параметры: 14-дневный турнир, 2 ринга, стандартный регламент IBA
const stressParams: PlannerParams = {
  dateStart: '2099-06-01',
  dateEnd:   '2099-06-14',
  ringCount: 2,
  dayStartTime: '10:00',
  dayEndTime: '22:00',
  slotMinutes: 30,
  minRestMinutes: 60,
  matchDuration: 11, // 3 раунда × 3 мин + 2 перерыва
};

describe('planSchedule — стресс-тест (13 категорий × 8 участников = 91 матч)', () => {
  let result: ReturnType<typeof planSchedule>;
  const matches = buildFullTournament();

  beforeAll(() => {
    result = planSchedule(matches, stressParams);
  });

  it('генерирует расписание без ошибок', () => {
    if ('error' in result) throw new Error(`Планировщик вернул ошибку: ${result.error}`);
    expect('assignments' in result).toBe(true);
  });

  it(`все ${matches.length} матчей получили слот`, () => {
    if ('error' in result) return;
    expect(result.assignments).toHaveLength(matches.length);
    const scheduled = new Set(result.assignments.map((a) => a.matchId));
    for (const m of matches) {
      expect(scheduled.has(m.id)).toBe(true);
    }
  });

  it('нет конфликтов слотов: (день+ринг+время) уникальны', () => {
    if ('error' in result) return;
    const seen = new Set<string>();
    for (const a of result.assignments) {
      const key = `${a.scheduledAt}:${a.ring}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('ринг всегда в диапазоне 1..ringCount', () => {
    if ('error' in result) return;
    for (const a of result.assignments) {
      expect(a.ring).toBeGreaterThanOrEqual(1);
      expect(a.ring).toBeLessThanOrEqual(stressParams.ringCount);
    }
  });

  it('каждый матч начинается в рамках рабочего дня', () => {
    if ('error' in result) return;
    const dayStart = 10 * 60; // 10:00 в минутах
    const dayEnd   = 22 * 60; // 22:00
    for (const a of result.assignments) {
      const d = new Date(a.scheduledAt);
      const minOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
      expect(minOfDay).toBeGreaterThanOrEqual(dayStart);
      expect(minOfDay + stressParams.matchDuration).toBeLessThanOrEqual(dayEnd);
    }
  });

  it('предшественники заканчиваются до начала следующего матча', () => {
    if ('error' in result) return;
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, new Date(a.scheduledAt).getTime()]));
    for (const m of matches) {
      const mStart = startByMatchId.get(m.id)!;
      for (const prevId of m.prevMatchIds) {
        const prevStart = startByMatchId.get(prevId)!;
        const prevEnd = prevStart + stressParams.matchDuration * 60_000;
        expect(mStart).toBeGreaterThanOrEqual(prevEnd);
      }
    }
  });

  it('боксёры отдыхают ≥ minRestMinutes между своими матчами', () => {
    if ('error' in result) return;
    // Строим прямые матчи только для участников с фиксированными boxerId
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, new Date(a.scheduledAt).getTime()]));
    const boxerTimes = new Map<string, number[]>();
    for (const m of matches) {
      for (const boxerId of [m.redBoxerId, m.blueBoxerId]) {
        if (!boxerId) continue;
        const start = startByMatchId.get(m.id)!;
        const arr = boxerTimes.get(boxerId) ?? [];
        arr.push(start);
        boxerTimes.set(boxerId, arr);
      }
    }
    const rest = stressParams.minRestMinutes * 60_000;
    const dur  = stressParams.matchDuration * 60_000;
    for (const [, times] of boxerTimes) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - (times[i - 1] + dur);
        expect(gap).toBeGreaterThanOrEqual(rest);
      }
    }
  });

  it('ограничение: в один день для одной категории — только один раунд', () => {
    if ('error' in result) return;
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, a.scheduledAt.slice(0, 10)]));
    for (const cat of IBA_CATEGORIES) {
      const dayToRound = new Map<string, number>();
      for (const m of matches.filter((x) => x.category === cat)) {
        const day = startByMatchId.get(m.id)!;
        const existing = dayToRound.get(day);
        if (existing === undefined) {
          dayToRound.set(day, m.round);
        } else {
          expect(existing).toBe(m.round);
        }
      }
    }
  });

  it('раунд 2 всегда позже раунда 1 внутри категории', () => {
    if ('error' in result) return;
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, new Date(a.scheduledAt).getTime()]));
    for (const cat of IBA_CATEGORIES) {
      const byRound = new Map<number, number[]>(); // round → list of start times
      for (const m of matches.filter((x) => x.category === cat)) {
        const t = startByMatchId.get(m.id)!;
        const arr = byRound.get(m.round) ?? [];
        arr.push(t);
        byRound.set(m.round, arr);
      }
      const maxR1 = Math.max(...(byRound.get(1) ?? [0]));
      const minR2 = Math.min(...(byRound.get(2) ?? [Infinity]));
      const minR3 = Math.min(...(byRound.get(3) ?? [Infinity]));
      expect(minR2).toBeGreaterThan(maxR1);
      if (minR3 !== Infinity) expect(minR3).toBeGreaterThan(minR2);
    }
  });

  it('все даты укладываются в период турнира', () => {
    if ('error' in result) return;
    const start = new Date(stressParams.dateStart + 'T00:00:00.000Z').getTime();
    const end   = new Date(stressParams.dateEnd   + 'T23:59:59.000Z').getTime();
    for (const a of result.assignments) {
      const t = new Date(a.scheduledAt).getTime();
      expect(t).toBeGreaterThanOrEqual(start);
      expect(t).toBeLessThanOrEqual(end);
    }
  });
});

describe('планировщик — 9 категорий по умолчанию, 1 ринг, 14 дней', () => {
  const DEFAULT_CATS = [51, 57, 63.5, 67, 71, 75, 80, 86, 92];
  const matches = DEFAULT_CATS.flatMap((cat, i) => buildCategoryMatches(cat, i * 8));
  const params: PlannerParams = { ...stressParams, ringCount: 1 };
  let result: ReturnType<typeof planSchedule>;

  beforeAll(() => { result = planSchedule(matches, params); });

  it('генерирует расписание без ошибок (1 ринг)', () => {
    if ('error' in result) throw new Error(`Ошибка: ${result.error}`);
  });

  it(`все ${matches.length} матчей получили слот`, () => {
    if ('error' in result) return;
    expect(result.assignments).toHaveLength(matches.length);
  });

  it('нет конфликтов слотов при одном ринге', () => {
    if ('error' in result) return;
    const seen = new Set<string>();
    for (const a of result.assignments) {
      const key = `${a.scheduledAt}:${a.ring}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('ограничение одного раунда в день соблюдается', () => {
    if ('error' in result) return;
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, a.scheduledAt.slice(0, 10)]));
    for (const cat of DEFAULT_CATS) {
      const dayToRound = new Map<string, number>();
      for (const m of matches.filter((x) => x.category === cat)) {
        const day = startByMatchId.get(m.id)!;
        const existing = dayToRound.get(day);
        if (existing !== undefined) expect(existing).toBe(m.round);
        else dayToRound.set(day, m.round);
      }
    }
  });
});

describe('планировщик — граничные случаи', () => {
  it('2 категории, 2 ринга, 3 дня: все инварианты', () => {
    const matches = [
      ...buildCategoryMatches(60, 0),
      ...buildCategoryMatches(75, 8),
    ];
    const params: PlannerParams = { ...stressParams, dateEnd: '2099-06-03', ringCount: 2 };
    const result = planSchedule(matches, params);
    if ('error' in result) throw new Error(result.error);
    expect(result.assignments).toHaveLength(14);

    // нет конфликтов
    const seen = new Set<string>();
    for (const a of result.assignments) {
      const key = `${a.scheduledAt}:${a.ring}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }

    // один раунд на категорию в день
    const startByMatchId = new Map(result.assignments.map((a) => [a.matchId, a.scheduledAt.slice(0, 10)]));
    for (const cat of [60, 75]) {
      const dayToRound = new Map<string, number>();
      for (const m of matches.filter((x) => x.category === cat)) {
        const day = startByMatchId.get(m.id)!;
        const existing = dayToRound.get(day);
        if (existing !== undefined) expect(existing).toBe(m.round);
        else dayToRound.set(day, m.round);
      }
    }
  });

  it('не хватает дней для всех раундов → ошибка', () => {
    const matches = buildCategoryMatches(60, 0); // 3 раунда
    // 2 дня: раунд 1 в день 1, раунд 2 в день 2, раунд 3 некуда
    const params: PlannerParams = { ...stressParams, dateEnd: '2099-06-02' };
    const result = planSchedule(matches, params);
    expect('error' in result).toBe(true);
  });

  it('ровно 3 дня на 3 раунда одной категории', () => {
    const matches = buildCategoryMatches(60, 0);
    const params: PlannerParams = { ...stressParams, dateEnd: '2099-06-03' };
    const result = planSchedule(matches, params);
    if ('error' in result) throw new Error(result.error);
    expect(result.assignments).toHaveLength(7);
  });
});
