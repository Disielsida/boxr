import { useEffect, useState } from 'react';

interface Props {
  onClick: () => void;
}

export const AiFloatingButton = ({ onClick }: Props) => {
  const [hovered, setHovered] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(32);

  useEffect(() => {
    const update = () => {
      const candidates = [
        document.querySelector('footer'),
        document.querySelector('[data-bottom-anchor]'),
      ].filter(Boolean) as Element[];

      if (candidates.length === 0) { setBottomOffset(32); return; }

      const maxOverlap = candidates.reduce((max, el) => {
        const overlap = window.innerHeight - el.getBoundingClientRect().top;
        return overlap > max ? overlap : max;
      }, 0);

      setBottomOffset(maxOverlap > 0 ? maxOverlap + 16 : 32);
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    const observer = new ResizeObserver(update);
    const observe = () => {
      ['footer', '[data-bottom-anchor]'].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) observer.observe(el);
      });
    };
    observe();

    const mo = new MutationObserver(() => { observe(); update(); });
    mo.observe(document.body, { childList: true, subtree: true });

    update();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: bottomOffset,
        right: 32,
        zIndex: 400,
        height: 48,
        padding: '0 20px',
        background: hovered ? 'var(--ring-700)' : 'var(--ink-900)',
        color: 'var(--paper-100)',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        boxShadow: 'var(--shadow-lg)',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M3 10a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /><circle cx="8.5" cy="13" r="1" /><circle cx="15.5" cy="13" r="1" /><path d="M8 17v1a2 2 0 0 0 4 0" />
      </svg>
      AI-помощник
    </button>
  );
};
