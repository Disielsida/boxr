// boxr/src/app/router/AppRouter.tsx
import { useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { BoxerProfilePage } from '@/pages/boxer-profile';
import { CreateTournamentPage } from '@/pages/create-tournament';
import { DashboardPage } from '@/pages/dashboard';
import { LandingPage } from '@/pages/landing';
import { LiveScoringPage } from '@/pages/live-scoring';
import { LoginPage } from '@/pages/login';
import { PublicTournamentPage } from '@/pages/public-tournament';
import { PublicTournamentsPage } from '@/pages/public-tournaments';
import { RegisterBoxerPage } from '@/pages/register-boxer';
import { TournamentManagePage } from '@/pages/tournament-manage';
import { AdminDashboardPage } from '@/pages/admin-dashboard';
import { JudgeDashboardPage } from '@/pages/judge-dashboard';
import { TrainerDashboardPage } from '@/pages/trainer-dashboard';
import { PrintBracketPage } from '@/pages/print-bracket';
import { PrintResultsPage } from '@/pages/print-results';
import { PrintSchedulePage } from '@/pages/print-schedule';
import { AiAssistantPanel, AiFloatingButton } from '@/widgets/ai-assistant';
import { AppShell } from '@/widgets/app-shell';

import { RedirectIfAuth, RequireAuth, RequireRole } from './guards';

const AiOverlay = () => {
  const [aiOpen, setAiOpen] = useState(false);
  const { pathname } = useLocation();

  if (pathname.includes('/print/')) return null;

  return (
    <>
      {aiOpen && (
        <>
          <div
            onClick={() => setAiOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(26,20,61,0.35)',
              backdropFilter: 'blur(4px)',
              zIndex: 490,
            }}
          />
          <AiAssistantPanel onClose={() => setAiOpen(false)} />
        </>
      )}
      {!aiOpen && <AiFloatingButton onClick={() => setAiOpen(true)} />}
    </>
  );
};

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedirectIfAuth><LandingPage /></RedirectIfAuth>} />
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/register" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/tournaments" element={<PublicTournamentsPage />} />
        <Route path="/public/tournaments/:id" element={<PublicTournamentPage />} />

        <Route
          path="/tournaments/new"
          element={
            <RequireRole role="organizer">
              <AppShell><CreateTournamentPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <RequireRole role="organizer">
              <AppShell><TournamentManagePage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireRole role={['organizer', 'judge']}>
              <AppShell><DashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/trainer"
          element={
            <RequireRole role="trainer">
              <AppShell><TrainerDashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/judge"
          element={
            <RequireRole role="judge">
              <AppShell><JudgeDashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AppShell><AdminDashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/boxers/new"
          element={
            <RequireRole role="trainer">
              <AppShell><RegisterBoxerPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/boxers/:id"
          element={
            <RequireRole role="trainer">
              <AppShell><BoxerProfilePage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/me"
          element={
            <RequireAuth>
              <AppShell><DashboardPage /></AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/scoring/:matchId"
          element={
            <RequireRole role={['organizer', 'judge']}>
              <AppShell><LiveScoringPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/tournaments/:id/print/schedule"
          element={
            <RequireAuth>
              <PrintSchedulePage />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments/:id/print/bracket"
          element={
            <RequireAuth>
              <PrintBracketPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments/:id/print/results"
          element={
            <RequireAuth>
              <PrintResultsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<LandingPage />} />
      </Routes>

      <AiOverlay />
    </BrowserRouter>
  );
};
