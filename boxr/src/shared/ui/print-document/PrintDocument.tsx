import { useEffect } from 'react';

import s from './PrintDocument.module.css';

interface Props {
  tournamentName: string;
  city: string;
  dateStart: string;
  dateEnd: string;
  docTitle: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', timeZone: 'UTC',
    });
  return start === end ? fmt(start) : `${fmt(start)} — ${fmt(end)}`;
}

export const PrintDocument = ({
  tournamentName, city, dateStart, dateEnd, docTitle,
  loading, error, children,
}: Props) => {
  useEffect(() => {
    if (!loading && !error) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading, error]);

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.loading}>ЗАГРУЗКА…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.root}>
        <div className={s.error}>
          <div>{error}</div>
          <button type="button" className={s.button} onClick={() => window.close()}>
            Закрыть вкладку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.noPrint}>
        <button type="button" className={s.button} onClick={() => window.print()}>
          Распечатать
        </button>
        <button type="button" className={s.button} onClick={() => window.close()}>
          Закрыть
        </button>
      </div>
      <div className={s.header}>
        <div>
          <div className={s.tournamentName}>{tournamentName}</div>
          <div className={s.meta}>{formatDateRange(dateStart, dateEnd)} · {city}</div>
        </div>
        <div className={s.docTitle}>{docTitle}</div>
      </div>
      <div className={s.body}>
        {children}
        <div className={s.footer}>
          <span>Главный судья: ________________________________</span>
          <span>BOXR · Платформа ФБР</span>
        </div>
      </div>
    </div>
  );
};
