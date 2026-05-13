import { buildCategoryBracket, BuiltMatch } from './bracket-builder';

describe('buildCategoryBracket', () => {
  it('одиночный участник: один финальный матч с WO', () => {
    const result = buildCategoryBracket(['boxer-A']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<Partial<BuiltMatch>>({
      round: 1,
      position: 0,
      redBoxerId: 'boxer-A',
      blueBoxerId: null,
      status: 'COMPLETED',
      outcome: 'WO',
      winnerId: 'boxer-A',
      nextRef: null,
    });
  });

  it('два участника: один финал, оба слота заполнены, READY', () => {
    const result = buildCategoryBracket(['A', 'B']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      round: 1,
      position: 0,
      status: 'READY',
      redBoxerId: expect.stringMatching(/^[AB]$/),
      blueBoxerId: expect.stringMatching(/^[AB]$/),
      nextRef: null,
    });
    const seats = [result[0].redBoxerId, result[0].blueBoxerId].sort();
    expect(seats).toEqual(['A', 'B']);
  });

  it('четыре участника: 2 матча 1/2 + финал, все 1/2 в READY', () => {
    const result = buildCategoryBracket(['A', 'B', 'C', 'D']);
    expect(result).toHaveLength(3);
    const round1 = result.filter((m) => m.round === 1);
    const round2 = result.filter((m) => m.round === 2);
    expect(round1).toHaveLength(2);
    expect(round2).toHaveLength(1);
    expect(round1.every((m) => m.status === 'READY')).toBe(true);
    expect(round1.every((m) => m.nextRef?.round === 2 && m.nextRef.position === 0)).toBe(true);
    const slots = round1.map((m) => m.nextRef!.slot).sort();
    expect(slots).toEqual(['BLUE', 'RED']);
    expect(round2[0].status).toBe('PENDING');
    expect(round2[0].nextRef).toBeNull();
  });

  it('три участника: bracketSize=4, ровно один bye, финал PENDING', () => {
    const result = buildCategoryBracket(['A', 'B', 'C']);
    expect(result).toHaveLength(3);
    const round1 = result.filter((m) => m.round === 1);
    const byeMatches = round1.filter((m) => m.status === 'COMPLETED');
    expect(byeMatches).toHaveLength(1);
    expect(byeMatches[0].outcome).toBe('WO');
    expect(byeMatches[0].winnerId).not.toBeNull();
    const final = result.find((m) => m.round === 2)!;
    const filledSlots = [final.redBoxerId, final.blueBoxerId].filter((x) => x !== null);
    expect(filledSlots).toHaveLength(1);
    expect(final.status).toBe('PENDING');
  });

  it('пять участников: bracketSize=8, три bye-матча, два полуфинала', () => {
    const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E']);
    expect(result).toHaveLength(7);
    const round1 = result.filter((m) => m.round === 1);
    expect(round1).toHaveLength(4);
    const byes = round1.filter((m) => m.status === 'COMPLETED');
    expect(byes).toHaveLength(3);
    byes.forEach((m) => {
      const filled = [m.redBoxerId, m.blueBoxerId].filter((x) => x !== null);
      expect(filled).toHaveLength(1);
    });
  });

  it('шесть участников: bracketSize=8, два bye-матча', () => {
    const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result).toHaveLength(7);
    const byes = result.filter((m) => m.round === 1 && m.status === 'COMPLETED');
    expect(byes).toHaveLength(2);
  });

  it('инвариант: каждый боксёр появляется ровно один раз в первом раунде', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const result = buildCategoryBracket(ids);
    const seats = result
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.redBoxerId, m.blueBoxerId])
      .filter((x): x is string => x !== null);
    expect(seats.sort()).toEqual([...ids].sort());
  });

  it('инвариант: каждый non-final матч имеет валидный nextRef', () => {
    const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    result.forEach((m) => {
      if (m.nextRef) {
        const next = result.find(
          (x) => x.round === m.nextRef!.round && x.position === m.nextRef!.position,
        );
        expect(next).toBeDefined();
      }
    });
    expect(result.filter((m) => m.nextRef === null)).toHaveLength(1);
  });
});
