// boxr/src/shared/api/matches.ts
import { request } from './client';

import type {
  Bracket,
  BracketMatch,
  JudgeMatch,
  MatchBoxer,
  MatchForScoring,
  MatchForScoringBoxer,
  Results,
  MatchOutcome,
  MatchSlot,
} from '../types';

// Хелпер: API возвращает upper-case enum-ы, фронт работает с lower-case
type ApiBoxer = { boxerId: string; fullName: string; club: string | null; rank: string };
type ApiMatch = {
  id: string;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: ApiBoxer | null;
  blue: ApiBoxer | null;
  nextMatchId: string | null;
  nextSlot: 'RED' | 'BLUE' | null;
  result:
    | null
    | { winnerId: string; outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO'; endRound: number | null; decidedAt: string };
  scheduledAt: string | null;
  ring: number | null;
  judgeId: string | null;
};
type ApiBracket = {
  tournament: { id: string; name: string; status: string };
  categories: Array<{ weight: number; rounds: number; matches: ApiMatch[] }>;
};

const toBracket = (api: ApiBracket): Bracket => ({
  tournament: {
    id: api.tournament.id,
    name: api.tournament.name,
    status: api.tournament.status.toLowerCase() as Bracket['tournament']['status'],
  },
  categories: api.categories.map((c) => ({
    weight: c.weight,
    rounds: c.rounds,
    matches: c.matches.map(toMatch),
  })),
});

const toMatch = (m: ApiMatch): BracketMatch => ({
  id: m.id,
  round: m.round,
  position: m.position,
  status: m.status.toLowerCase() as BracketMatch['status'],
  red: m.red && {
    boxerId: m.red.boxerId,
    fullName: m.red.fullName,
    club: m.red.club,
    rank: m.red.rank.toLowerCase() as MatchBoxer['rank'],
  },
  blue: m.blue && {
    boxerId: m.blue.boxerId,
    fullName: m.blue.fullName,
    club: m.blue.club,
    rank: m.blue.rank.toLowerCase() as MatchBoxer['rank'],
  },
  nextMatchId: m.nextMatchId,
  nextSlot: m.nextSlot ? (m.nextSlot.toLowerCase() as MatchSlot) : null,
  scheduledAt: m.scheduledAt,
  ring: m.ring,
  judgeId: m.judgeId,
  result: m.result && {
    winnerId: m.result.winnerId,
    outcome: m.result.outcome.toLowerCase() as MatchOutcome,
    endRound: m.result.endRound,
    decidedAt: m.result.decidedAt,
  },
});

type ApiResults = {
  tournament: { id: string; name: string; status: string };
  categories: Array<{
    weight: number;
    finished: boolean;
    podium: {
      gold: { boxerId: string; fullName: string; club: string | null } | null;
      silver: { boxerId: string; fullName: string; club: string | null } | null;
      bronze: Array<{ boxerId: string; fullName: string; club: string | null }>;
    };
    finals: Array<{
      round: number;
      winner: { boxerId: string; fullName: string };
      loser: { boxerId: string; fullName: string };
      outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
      endRound: number | null;
    }>;
  }>;
};

const toResults = (api: ApiResults): Results => ({
  tournament: {
    id: api.tournament.id,
    name: api.tournament.name,
    status: api.tournament.status.toLowerCase() as Results['tournament']['status'],
  },
  categories: api.categories.map((c) => ({
    weight: c.weight,
    finished: c.finished,
    podium: c.podium,
    finals: c.finals.map((f) => ({ ...f, outcome: f.outcome.toLowerCase() as MatchOutcome })),
  })),
});

type ApiMatchForScoring = {
  match: {
    id: string;
    round: number;
    position: number;
    status: 'PENDING' | 'READY' | 'COMPLETED';
    red: { boxerId: string; fullName: string; club: string | null; rank: string } | null;
    blue: { boxerId: string; fullName: string; club: string | null; rank: string } | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: { id: string; name: string; rounds: number; roundDuration: number };
};

type ApiJudgeMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  category: number;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: { fullName: string } | null;
  blue: { fullName: string } | null;
  scheduledAt: string | null;
  ring: number | null;
};

const toJudgeMatch = (m: ApiJudgeMatch): JudgeMatch => ({
  id: m.id,
  tournamentId: m.tournamentId,
  tournamentName: m.tournamentName,
  category: m.category,
  round: m.round,
  position: m.position,
  status: m.status.toLowerCase() as JudgeMatch['status'],
  red: m.red,
  blue: m.blue,
  scheduledAt: m.scheduledAt,
  ring: m.ring,
});

const toMatchForScoring = (api: ApiMatchForScoring): MatchForScoring => ({
  match: {
    id: api.match.id,
    round: api.match.round,
    position: api.match.position,
    status: api.match.status.toLowerCase() as MatchForScoring['match']['status'],
    red: api.match.red && {
      boxerId: api.match.red.boxerId,
      fullName: api.match.red.fullName,
      club: api.match.red.club,
      rank: api.match.red.rank.toLowerCase() as MatchForScoringBoxer['rank'],
    },
    blue: api.match.blue && {
      boxerId: api.match.blue.boxerId,
      fullName: api.match.blue.fullName,
      club: api.match.blue.club,
      rank: api.match.blue.rank.toLowerCase() as MatchForScoringBoxer['rank'],
    },
    ring: api.match.ring,
    scheduledAt: api.match.scheduledAt,
  },
  tournament: api.tournament,
});

export interface SetResultInput {
  winner: 'red' | 'blue';
  outcome: MatchOutcome;
  endRound?: number;
}

export const matchesApi = {
  generateBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/bracket`, { method: 'POST' }).then(toBracket),
  getBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/bracket`).then(toBracket),
  getPublicBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/public/${tournamentId}/bracket`, { auth: false }).then(toBracket),
  getPublicResults: (tournamentId: string) =>
    request<ApiResults>(`/tournaments/public/${tournamentId}/results`, { auth: false }).then(toResults),
  setResult: (matchId: string, input: SetResultInput) =>
    request<ApiBracket>(`/matches/${matchId}`, {
      method: 'PATCH',
      body: {
        winner: input.winner.toUpperCase(),
        outcome: input.outcome.toUpperCase(),
        ...(input.endRound !== undefined ? { endRound: input.endRound } : {}),
      },
    }).then(toBracket),
  clearResult: (matchId: string) =>
    request<ApiBracket>(`/matches/${matchId}/result`, { method: 'DELETE' }).then(toBracket),
  generateSchedule: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/schedule`, { method: 'POST' }).then(toBracket),
  clearSchedule: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/schedule`, { method: 'DELETE' }).then(toBracket),
  setSchedule: (matchId: string, scheduledAt: string, ring: number) =>
    request<ApiBracket>(`/matches/${matchId}/schedule`, {
      method: 'PATCH',
      body: { scheduledAt, ring },
    }).then(toBracket),
  getMatchForScoring: (matchId: string) =>
    request<ApiMatchForScoring>(`/matches/${matchId}`).then(toMatchForScoring),
  getMyMatches: () =>
    request<ApiJudgeMatch[]>('/judge/matches').then((list) => list.map(toJudgeMatch)),
  assignJudge: (tournamentId: string, matchId: string, judgeId: string) =>
    request<{ matchId: string; judgeId: string; judgeName: string }>(
      `/tournaments/${tournamentId}/matches/${matchId}/assign-judge`,
      { method: 'PATCH', body: { judgeId } },
    ),
};
