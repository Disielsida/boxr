import { useEffect, useState } from 'react';

import { ApiError, matchesApi, usersApi } from '@/shared/api';

import type { BracketMatch, JudgeInfo } from '@/shared/types';

interface Props {
  match: BracketMatch;
  tournamentId: string;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignJudgeDialog = ({ match, tournamentId, onClose, onAssigned }: Props) => {
  const [judges, setJudges] = useState<JudgeInfo[]>([]);
  const [selected, setSelected] = useState<string>(match.judgeId ?? '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    usersApi
      .listJudges()
      .then(setJudges)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await matchesApi.assignJudge(tournamentId, match.id, selected);
      onAssigned();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка назначения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,12,29,0.6)',
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal={true}
        aria-labelledby="assign-judge-title"
        style={{
          background: 'var(--paper-100)',
          borderRadius: 'var(--radius-md)',
          padding: 32,
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="assign-judge-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
          }}
        >
          Назначить судью
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
          {match.red?.fullName ?? 'BYE'} vs {match.blue?.fullName ?? 'BYE'}
        </div>

        {loading && (
          <p style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            Загрузка судей…
          </p>
        )}

        {!loading && judges.length === 0 && !error && (
          <p style={{ color: 'var(--ink-400)' }}>Нет зарегистрированных судей.</p>
        )}

        {!loading && judges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Поиск по имени…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--paper-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--paper-200)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid var(--paper-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--paper-200)',
              }}
            >
              {judges
                .filter((j) =>
                  j.fullName.toLowerCase().includes(search.toLowerCase()) ||
                  j.email.toLowerCase().includes(search.toLowerCase()),
                )
                .map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setSelected(j.id)}
                    style={{
                      all: 'unset',
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      background: selected === j.id ? 'var(--ink-900)' : 'transparent',
                      color: selected === j.id ? 'var(--paper-100)' : 'var(--ink-900)',
                      boxSizing: 'border-box',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ fontWeight: selected === j.id ? 600 : 400 }}>{j.fullName}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: selected === j.id ? 'var(--paper-400)' : 'var(--ink-400)',
                      }}
                    >
                      {j.email}
                    </span>
                  </button>
                ))}
              {judges.filter((j) =>
                j.fullName.toLowerCase().includes(search.toLowerCase()) ||
                j.email.toLowerCase().includes(search.toLowerCase()),
              ).length === 0 && (
                <p
                  style={{
                    padding: '10px 14px',
                    color: 'var(--ink-400)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  Ничего не найдено
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--ring-600)', fontSize: 'var(--text-sm)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: 'unset',
              padding: '8px 20px',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            style={{
              all: 'unset',
              padding: '8px 20px',
              background: selected && !saving ? 'var(--ink-900)' : 'var(--paper-300)',
              color: selected && !saving ? 'var(--paper-100)' : 'var(--ink-400)',
              borderRadius: 'var(--radius-sm)',
              cursor: selected && !saving ? 'pointer' : 'default',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            {saving ? 'Сохранение…' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  );
};
