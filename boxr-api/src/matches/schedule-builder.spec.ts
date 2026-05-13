import { planSchedule, PlannerInputMatch, PlannerParams } from './schedule-builder';

const baseParams: PlannerParams = {
  dateStart: '2099-06-14',
  dateEnd: '2099-06-14',
  ringCount: 1,
  dayStartTime: '10:00',
  slotMinutes: 30,
  minRestMinutes: 60,
  matchDuration: 11,
  dayEndTime: '22:00',
};

describe('planSchedule', () => {
  it('два независимых матча в один день, один ринг: 10:00 и 10:30', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'M1', category: 60, round: 1, position: 0, redBoxerId: 'A', blueBoxerId: 'B', prevMatchIds: [] },
      { id: 'M2', category: 60, round: 1, position: 1, redBoxerId: 'C', blueBoxerId: 'D', prevMatchIds: [] },
    ];
    const result = planSchedule(matches, baseParams);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0]).toMatchObject({ matchId: 'M1', ring: 1, scheduledAt: '2099-06-14T10:00:00.000Z' });
    expect(result.assignments[1]).toMatchObject({ matchId: 'M2', ring: 1, scheduledAt: '2099-06-14T10:30:00.000Z' });
  });

  it('4 матча, 2 ринга, 2 дня: 1/4 параллельно в день 1, полуфинал в день 2', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'Q1', category: 60, round: 1, position: 0, redBoxerId: 'A', blueBoxerId: 'B', prevMatchIds: [] },
      { id: 'Q2', category: 60, round: 1, position: 1, redBoxerId: 'C', blueBoxerId: 'D', prevMatchIds: [] },
      { id: 'S1', category: 60, round: 2, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['Q1', 'Q2'] },
    ];
    const result = planSchedule(matches, { ...baseParams, dateEnd: '2099-06-15', ringCount: 2 });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    const q1 = result.assignments.find((a) => a.matchId === 'Q1')!;
    const q2 = result.assignments.find((a) => a.matchId === 'Q2')!;
    expect(q1.scheduledAt).toBe('2099-06-14T10:00:00.000Z');
    expect(q2.scheduledAt).toBe('2099-06-14T10:00:00.000Z');
    expect(q1.ring).not.toBe(q2.ring);
    const s1 = result.assignments.find((a) => a.matchId === 'S1')!;
    // полуфинал той же категории не может быть в день 1/4 — переносится на день 2
    expect(s1.scheduledAt.startsWith('2099-06-15')).toBe(true);
  });

  it('1 ринг, мало времени → 422 «не помещается»', () => {
    const tooMany: PlannerInputMatch[] = Array.from({ length: 50 }, (_, i) => ({
      id: `M${i}`, category: 60, round: 1, position: i, redBoxerId: `A${i}`, blueBoxerId: `B${i}`, prevMatchIds: [],
    }));
    const result = planSchedule(tooMany, baseParams);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Не помещается');
    }
  });

  it('размазывание по 3 дням: раунд 1 в день 1, раунд 2 в день 2, финал в день 3', () => {
    const matches: PlannerInputMatch[] = [];
    for (let i = 0; i < 4; i++) {
      matches.push({ id: `Q${i}`, category: 60, round: 1, position: i, redBoxerId: `A${i}`, blueBoxerId: `B${i}`, prevMatchIds: [] });
    }
    matches.push({ id: 'S0', category: 60, round: 2, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['Q0', 'Q1'] });
    matches.push({ id: 'S1', category: 60, round: 2, position: 1, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['Q2', 'Q3'] });
    matches.push({ id: 'F', category: 60, round: 3, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['S0', 'S1'] });

    const result = planSchedule(matches, { ...baseParams, dateEnd: '2099-06-16', ringCount: 1 });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.assignments).toHaveLength(7);
    const qs = result.assignments.filter((a) => a.matchId.startsWith('Q'));
    expect(qs.every((a) => a.scheduledAt.startsWith('2099-06-14'))).toBe(true);
    const ss = result.assignments.filter((a) => a.matchId.startsWith('S'));
    expect(ss.every((a) => a.scheduledAt.startsWith('2099-06-15'))).toBe(true);
    const f = result.assignments.find((a) => a.matchId === 'F')!;
    expect(f.scheduledAt.startsWith('2099-06-16')).toBe(true);
  });

  it('инвариант: никакие два матча не делят (день, ринг, слот)', () => {
    const matches: PlannerInputMatch[] = Array.from({ length: 6 }, (_, i) => ({
      id: `M${i}`, category: 60, round: 1, position: i,
      redBoxerId: `A${i}`, blueBoxerId: `B${i}`,
      prevMatchIds: [],
    }));
    const result = planSchedule(matches, { ...baseParams, ringCount: 2 });
    if ('error' in result) throw new Error(result.error);
    const seen = new Set<string>();
    for (const a of result.assignments) {
      const key = `${a.scheduledAt}:${a.ring}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('инвариант: предшественник заканчивается до начала следующего матча', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'A', category: 60, round: 1, position: 0, redBoxerId: 'X', blueBoxerId: 'Y', prevMatchIds: [] },
      { id: 'B', category: 60, round: 1, position: 1, redBoxerId: 'Z', blueBoxerId: 'W', prevMatchIds: [] },
      { id: 'C', category: 60, round: 2, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['A', 'B'] },
    ];
    const result = planSchedule(matches, { ...baseParams, dateEnd: '2099-06-15', ringCount: 2 });
    if ('error' in result) throw new Error(result.error);
    const a = result.assignments.find((x) => x.matchId === 'A')!;
    const c = result.assignments.find((x) => x.matchId === 'C')!;
    const aEnd = new Date(a.scheduledAt).getTime() + baseParams.matchDuration * 60_000;
    const cStart = new Date(c.scheduledAt).getTime();
    expect(cStart).toBeGreaterThanOrEqual(aEnd);
  });

  it('инвариант: боксёр отдыхает ≥ minRestMinutes между матчами', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'Q0', category: 60, round: 1, position: 0, redBoxerId: 'X', blueBoxerId: 'Y', prevMatchIds: [] },
      { id: 'Q1', category: 60, round: 1, position: 1, redBoxerId: 'X', blueBoxerId: 'Z', prevMatchIds: [] },
    ];
    const result = planSchedule(matches, baseParams);
    if ('error' in result) throw new Error(result.error);
    const q0 = result.assignments.find((a) => a.matchId === 'Q0')!;
    const q1 = result.assignments.find((a) => a.matchId === 'Q1')!;
    const q0End = new Date(q0.scheduledAt).getTime() + baseParams.matchDuration * 60_000;
    const q1Start = new Date(q1.scheduledAt).getTime();
    expect(q1Start - q0End).toBeGreaterThanOrEqual(baseParams.minRestMinutes * 60_000);
  });

  it('разные весовые категории могут иметь разные раунды в один день', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'A60_Q', category: 60, round: 1, position: 0, redBoxerId: 'A', blueBoxerId: 'B', prevMatchIds: [] },
      { id: 'A75_Q', category: 75, round: 1, position: 0, redBoxerId: 'C', blueBoxerId: 'D', prevMatchIds: [] },
      { id: 'A75_S', category: 75, round: 2, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['A75_Q'] },
    ];
    const result = planSchedule(matches, { ...baseParams, dateEnd: '2099-06-15' });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    // 60кг: раунд 1 в день 1; 75кг: раунд 1 в день 1, раунд 2 в день 2
    const a60q = result.assignments.find((a) => a.matchId === 'A60_Q')!;
    const a75q = result.assignments.find((a) => a.matchId === 'A75_Q')!;
    const a75s = result.assignments.find((a) => a.matchId === 'A75_S')!;
    expect(a60q.scheduledAt.startsWith('2099-06-14')).toBe(true);
    expect(a75q.scheduledAt.startsWith('2099-06-14')).toBe(true);
    expect(a75s.scheduledAt.startsWith('2099-06-15')).toBe(true);
  });

  it('ограничение: один раунд на категорию в день — раунд 2 не может быть в тот же день, что раунд 1', () => {
    const matches: PlannerInputMatch[] = [
      { id: 'Q', category: 60, round: 1, position: 0, redBoxerId: 'A', blueBoxerId: 'B', prevMatchIds: [] },
      { id: 'F', category: 60, round: 2, position: 0, redBoxerId: null, blueBoxerId: null, prevMatchIds: ['Q'] },
    ];
    // Только один день — финал не помещается из-за ограничения
    const oneDayResult = planSchedule(matches, baseParams);
    expect('error' in oneDayResult).toBe(true);

    // Два дня — всё помещается
    const twoDayResult = planSchedule(matches, { ...baseParams, dateEnd: '2099-06-15' });
    expect('error' in twoDayResult).toBe(false);
    if ('error' in twoDayResult) return;
    const q = twoDayResult.assignments.find((a) => a.matchId === 'Q')!;
    const f = twoDayResult.assignments.find((a) => a.matchId === 'F')!;
    expect(q.scheduledAt.startsWith('2099-06-14')).toBe(true);
    expect(f.scheduledAt.startsWith('2099-06-15')).toBe(true);
  });
});
