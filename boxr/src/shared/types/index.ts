export type UserRole = 'organizer' | 'trainer' | 'judge';

export type TournamentType = 'regional' | 'national' | 'international';
export type TournamentLevel = 'amateur' | 'professional' | 'mixed';
export type TournamentStatus = 'draft' | 'published' | 'in_progress' | 'finished' | 'cancelled';
export type TournamentPhase = 'open' | 'active' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  level: TournamentLevel;
  status: TournamentStatus;
  dateStart: string;
  dateEnd: string;
  city: string;
  address: string | null;
  categories: number[];
  rounds: number;
  roundDuration: number;
  helmets: boolean;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  ringCount: number;
  dayStartTime: string;
  slotMinutes: number;
  minRestMinutes: number;
}

export interface PublicTournament extends Tournament {
  phase: TournamentPhase;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  club?: string;
}

export type Gender = 'male' | 'female';

export type BoxerRank =
  | 'none'
  | 'third_class'
  | 'second_class'
  | 'first_class'
  | 'cms'
  | 'ms'
  | 'msic';

export interface Boxer {
  id: string;
  fullName: string;
  dob: string;
  gender: Gender;
  weight: number;
  club: string | null;
  rank: BoxerRank;
  passportSeries: string | null;
  passportNumber: string | null;
  passportIssuedBy: string | null;
  passportIssuedAt: string | null;
  passportDivisionCode: string | null;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PassportOcrResult {
  fullName?: string;
  dob?: string;
  gender?: 'MALE' | 'FEMALE';
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  passportDivisionCode?: string;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface Application {
  id: string;
  boxerId: string;
  tournamentId: string;
  category: number;
  status: ApplicationStatus;
  rejectReason: string | null;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  boxer?: Boxer;          // когда сервер inлайнит
  tournament?: Tournament;
}

export type MatchOutcome = 'ko' | 'wp' | 'rsc' | 'dsq' | 'wo';
export type MatchSlot = 'red' | 'blue';
export type MatchStatus = 'pending' | 'ready' | 'completed';

export interface MatchBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: BoxerRank;
}

export interface MatchResult {
  winnerId: string;
  outcome: MatchOutcome;
  endRound: number | null;
  decidedAt: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  status: MatchStatus;
  red: MatchBoxer | null;
  blue: MatchBoxer | null;
  nextMatchId: string | null;
  nextSlot: MatchSlot | null;
  scheduledAt: string | null;
  ring: number | null;
  judgeId: string | null;
  result: MatchResult | null;
}

export interface BracketCategory {
  weight: number;
  rounds: number;
  matches: BracketMatch[];
}

export interface Bracket {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: BracketCategory[];
}

export interface PodiumBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
}

export interface CategoryFinal {
  round: number;
  winner: { boxerId: string; fullName: string };
  loser: { boxerId: string; fullName: string };
  outcome: MatchOutcome;
  endRound: number | null;
}

export interface CategoryResults {
  weight: number;
  finished: boolean;
  podium: {
    gold: PodiumBoxer | null;
    silver: PodiumBoxer | null;
    bronze: PodiumBoxer[];
  };
  finals: CategoryFinal[];
}

export interface Results {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: CategoryResults[];
}

export interface JudgeInfo {
  id: string;
  fullName: string;
  email: string;
}

export interface JudgeMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  category: number;
  round: number;
  position: number;
  status: MatchStatus;
  red: { fullName: string } | null;
  blue: { fullName: string } | null;
  scheduledAt: string | null;
  ring: number | null;
}

export interface MatchForScoringBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: BoxerRank;
}

export interface MatchForScoring {
  match: {
    id: string;
    round: number;
    position: number;
    status: MatchStatus;
    red: MatchForScoringBoxer | null;
    blue: MatchForScoringBoxer | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: {
    id: string;
    name: string;
    rounds: number;
    roundDuration: number;
  };
}
