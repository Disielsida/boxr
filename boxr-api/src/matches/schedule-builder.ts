// boxr-api/src/matches/schedule-builder.ts
export interface PlannerInputMatch {
  id: string;
  category: number;
  round: number;
  position: number;
  redBoxerId: string | null;
  blueBoxerId: string | null;
  prevMatchIds: string[];
}

export interface PlannerParams {
  dateStart: string;
  dateEnd: string;
  ringCount: number;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes: number;
  minRestMinutes: number;
  matchDuration: number;
}

export interface ScheduleAssignment {
  matchId: string;
  scheduledAt: string;
  ring: number;
}

export type PlanResult = { assignments: ScheduleAssignment[] } | { error: string };

export function planSchedule(
  matches: readonly PlannerInputMatch[],
  params: PlannerParams,
): PlanResult {
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.position - b.position);

  const days = enumerateDays(params.dateStart, params.dateEnd);
  const dayStartMin = parseHHMM(params.dayStartTime);
  const dayEndMin = parseHHMM(params.dayEndTime);

  const ringBusy = new Map<string, true>();
  const matchEndById = new Map<string, number>();
  const boxerLastFinish = new Map<string, number>();
  // ключ: `${dayIndex}:${category}` → номер раунда, запланированного в этот день
  const categoryRoundOnDay = new Map<string, number>();

  const assignments: ScheduleAssignment[] = [];

  for (const match of sorted) {
    const candidate = findEarliestSlot(
      match, days, dayStartMin, dayEndMin, params,
      ringBusy, matchEndById, boxerLastFinish, sorted, categoryRoundOnDay,
    );
    if (!candidate) {
      return { error: 'Не помещается в указанные даты — добавьте дни, ринги или уменьшите шаг между боями' };
    }
    const startAbsMin = candidate.dayIndex * 24 * 60 + candidate.slotMin;
    const endAbsMin = startAbsMin + params.matchDuration;
    matchEndById.set(match.id, endAbsMin);
    for (const boxerId of potentialBoxerIds(match, sorted)) {
      const prev = boxerLastFinish.get(boxerId) ?? -Infinity;
      if (endAbsMin > prev) boxerLastFinish.set(boxerId, endAbsMin);
    }
    ringBusy.set(`${candidate.dayIndex}:${candidate.ring}:${candidate.slotMin}`, true);
    categoryRoundOnDay.set(`${candidate.dayIndex}:${match.category}`, match.round);

    const dateStr = days[candidate.dayIndex];
    const hh = String(Math.floor(candidate.slotMin / 60)).padStart(2, '0');
    const mm = String(candidate.slotMin % 60).padStart(2, '0');
    assignments.push({
      matchId: match.id,
      scheduledAt: `${dateStr}T${hh}:${mm}:00.000Z`,
      ring: candidate.ring,
    });
  }

  return { assignments };
}

function findEarliestSlot(
  match: PlannerInputMatch,
  days: string[],
  dayStartMin: number,
  dayEndMin: number,
  params: PlannerParams,
  ringBusy: Map<string, true>,
  matchEndById: Map<string, number>,
  boxerLastFinish: Map<string, number>,
  allMatches: readonly PlannerInputMatch[],
  categoryRoundOnDay: Map<string, number>,
) {
  const predecessorEnds = match.prevMatchIds
    .map((pid) => matchEndById.get(pid))
    .filter((x): x is number => x !== undefined);
  const earliestByPredecessors = predecessorEnds.length === 0 ? -Infinity : Math.max(...predecessorEnds);

  const boxers = potentialBoxerIds(match, allMatches);
  const earliestByRest = boxers.reduce((acc, b) => {
    const last = boxerLastFinish.get(b);
    if (last === undefined) return acc;
    return Math.max(acc, last + params.minRestMinutes);
  }, -Infinity);

  const earliestAbsMin = Math.max(earliestByPredecessors, earliestByRest);

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    // В этот день для данной весовой категории уже запланирован другой раунд — пропускаем день
    const roundOnDay = categoryRoundOnDay.get(`${dayIndex}:${match.category}`);
    if (roundOnDay !== undefined && roundOnDay !== match.round) continue;

    for (let slotMin = dayStartMin; slotMin + params.matchDuration <= dayEndMin; slotMin += params.slotMinutes) {
      const absMin = dayIndex * 24 * 60 + slotMin;
      if (absMin < earliestAbsMin) continue;
      for (let ring = 1; ring <= params.ringCount; ring++) {
        if (ringBusy.has(`${dayIndex}:${ring}:${slotMin}`)) continue;
        return { dayIndex, slotMin, ring };
      }
    }
  }
  return null;
}

function potentialBoxerIds(match: PlannerInputMatch, all: readonly PlannerInputMatch[]): string[] {
  if (match.redBoxerId && match.blueBoxerId) {
    return [match.redBoxerId, match.blueBoxerId];
  }
  const result: string[] = [];
  for (const prevId of match.prevMatchIds) {
    const prev = all.find((m) => m.id === prevId);
    if (prev) {
      for (const b of potentialBoxerIds(prev, all)) {
        if (!result.includes(b)) result.push(b);
      }
    }
  }
  if (match.redBoxerId && !result.includes(match.redBoxerId)) result.push(match.redBoxerId);
  if (match.blueBoxerId && !result.includes(match.blueBoxerId)) result.push(match.blueBoxerId);
  return result;
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function enumerateDays(start: string, end: string): string[] {
  const result: string[] = [];
  const d = new Date(start + 'T00:00:00.000Z');
  const last = new Date(end + 'T00:00:00.000Z');
  while (d <= last) {
    result.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}
