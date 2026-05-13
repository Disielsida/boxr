import { Pill } from '@/shared/ui';

import { PHASE_LABEL, STATUS_LABEL, computePhase } from '../model/types';

import type {
  Tournament,
  TournamentPhase,
  TournamentStatus,
} from '@/shared/types';

interface StatusPillProps {
  tournament: Tournament;
  showPhase?: boolean;
}

const STATUS_VARIANT: Record<TournamentStatus, 'default' | 'pending' | 'active' | 'danger'> = {
  draft: 'pending',
  published: 'active',
  in_progress: 'active',
  finished: 'default',
  cancelled: 'danger',
};

const PHASE_VARIANT: Record<TournamentPhase, 'default' | 'pending' | 'active'> = {
  open: 'pending',
  active: 'active',
  finished: 'default',
};

export const StatusPill = ({ tournament, showPhase = false }: StatusPillProps) => {
  if (showPhase && tournament.status === 'published') {
    const phase = computePhase(tournament);
    return (
      <Pill variant={PHASE_VARIANT[phase]} pulse={phase === 'active'}>
        {PHASE_LABEL[phase]}
      </Pill>
    );
  }
  return (
    <Pill variant={STATUS_VARIANT[tournament.status]}>
      {STATUS_LABEL[tournament.status]}
    </Pill>
  );
};
