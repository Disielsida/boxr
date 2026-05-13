export type BuiltMatchStatus = 'PENDING' | 'READY' | 'COMPLETED';
export type BuiltMatchOutcome = 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
export type BuiltMatchSlot = 'RED' | 'BLUE';

export interface BuiltMatch {
  round: number;
  position: number;
  redBoxerId: string | null;
  blueBoxerId: string | null;
  status: BuiltMatchStatus;
  outcome: BuiltMatchOutcome | null;
  winnerId: string | null;
  /**
   * Координаты следующего матча для победителя.
   * null у финала и у одиночки. Сервис превратит координаты в nextMatchId после INSERT.
   */
  nextRef: { round: number; position: number; slot: BuiltMatchSlot } | null;
}

export function buildCategoryBracket(boxerIds: readonly string[]): BuiltMatch[] {
  const n = boxerIds.length;
  if (n === 0) return [];
  if (n === 1) {
    return [
      {
        round: 1,
        position: 0,
        redBoxerId: boxerIds[0],
        blueBoxerId: null,
        status: 'COMPLETED',
        outcome: 'WO',
        winnerId: boxerIds[0],
        nextRef: null,
      },
    ];
  }

  const bracketSize = nextPow2(n);
  const byes = bracketSize - n;
  const rounds = Math.log2(bracketSize);

  const matches: BuiltMatch[] = [];
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = bracketSize / 2 ** r;
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        round: r,
        position: p,
        redBoxerId: null,
        blueBoxerId: null,
        status: 'PENDING',
        outcome: null,
        winnerId: null,
        nextRef:
          r < rounds
            ? { round: r + 1, position: Math.floor(p / 2), slot: p % 2 === 0 ? 'RED' : 'BLUE' }
            : null,
      });
    }
  }

  const index = new Map<string, BuiltMatch>();
  for (const m of matches) index.set(`${m.round}:${m.position}`, m);

  const seats = arrangeWithByes(boxerIds, bracketSize, byes);
  for (let p = 0; p < bracketSize / 2; p++) {
    const m = index.get(`1:${p}`)!;
    m.redBoxerId = seats[2 * p];
    m.blueBoxerId = seats[2 * p + 1];
    if (m.redBoxerId && m.blueBoxerId) {
      m.status = 'READY';
    } else if (m.redBoxerId || m.blueBoxerId) {
      const sole = (m.redBoxerId ?? m.blueBoxerId)!;
      m.winnerId = sole;
      m.outcome = 'WO';
      m.status = 'COMPLETED';
      propagate(index, m);
    }
  }

  return matches;
}

function nextPow2(x: number): number {
  let p = 1;
  while (p < x) p *= 2;
  return p;
}

/**
 * Расставляет boxerIds + byes (как null) в bracketSize слотов так, чтобы:
 *  - не было двух bye в одной паре первого раунда (то есть индексы 2p и 2p+1 не оба null);
 *  - результат шафлится случайно (но bye-инвариант сохраняется).
 */
function arrangeWithByes(
  boxerIds: readonly string[],
  bracketSize: number,
  byes: number,
): (string | null)[] {
  const shuffled = shuffle([...boxerIds]);
  const seats: (string | null)[] = new Array(bracketSize).fill(null);

  // bye помещаем в нечётные позиции (BLUE-слоты) первых byes пар;
  // если byes < bracketSize/2 — это всегда даёт «один человек + bye» в этих парах,
  // никогда «bye vs bye».
  for (let i = 0; i < byes; i++) {
    seats[2 * i] = shuffled[i];
  }
  let cursor = byes;
  for (let s = 2 * byes; s < bracketSize; s++) {
    seats[s] = shuffled[cursor++];
  }
  return seats;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function propagate(index: Map<string, BuiltMatch>, m: BuiltMatch): void {
  if (!m.nextRef || !m.winnerId) return;
  const next = index.get(`${m.nextRef.round}:${m.nextRef.position}`);
  if (!next) return;
  if (m.nextRef.slot === 'RED') next.redBoxerId = m.winnerId;
  else next.blueBoxerId = m.winnerId;
  if (next.redBoxerId && next.blueBoxerId) next.status = 'READY';
}
