import { useNavigate } from 'react-router-dom';

import { CreateTournamentWizard } from '@/features/tournament-create';

export const CreateTournamentPage = () => {
  const navigate = useNavigate();
  return (
    <CreateTournamentWizard
      onSubmitted={(t) => navigate(`/tournaments/${t.id}`, { replace: true })}
      onCancel={() => navigate('/dashboard')}
    />
  );
};
