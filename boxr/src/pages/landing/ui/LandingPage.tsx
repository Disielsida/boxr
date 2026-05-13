import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Hairline, Logo, MonoLabel, Pill } from '@/shared/ui';

import s from './LandingPage.module.css';

const FEATURES = [
  {
    index: '01.',
    title: 'Документы без ошибок',
    desc: 'AI сам распознаёт ФИО, дату рождения и реквизиты из документов — быстро, точно и без ручного ввода.'
  },
  {
    index: '02.',
    title: 'AI-помощник 24/7',
    desc: 'Получайте мгновенные ответы по регламенту, спорным ситуациям и судейству в любое время.'
  },
  {
    index: '03.',
    title: 'Быстрая жеребьёвка',
    desc: 'Турнирная сетка, пары и расписание по рингам формируются автоматически за секунды.'
  },
];

const STEPS = [
  { num: '01', title: 'Создайте турнир', desc: 'Категории, ринги, даты — пошаговый мастер за 5 минут. Всё, что нужно для официального соревнования, в одной форме.' },
  { num: '02', title: 'Зарегистрируйте участников', desc: 'Тренеры подают заявки онлайн, паспорт сканируется автоматически. Организатор одобряет одним кликом — без бумаг и звонков.' },
  { num: '03', title: 'Проведите соревнования', desc: 'Жеребьёвка, расписание по рингам, онлайн-судейство, итоговые протоколы. Всё — в одном месте, в реальном времени.' },
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const ctaRef = useRef<HTMLElement | null>(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setCtaVisible(true); observer.disconnect(); } },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const quoteRef = useRef<HTMLDivElement | null>(null);
  const [quoteVisible, setQuoteVisible] = useState(false);
  useEffect(() => {
    const el = quoteRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setQuoteVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(s.stepInView);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const animBase = {
    opacity: loaded ? 1 : 0,
    transition: 'opacity 0.9s var(--ease-out-expo), transform 0.9s var(--ease-out-expo)',
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)', minHeight: '100vh' }}>
      {/* NAVBAR */}
      <nav
        className={s.nav}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          height: 72,
          background: scrolled ? 'rgba(250, 249, 246, 0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'var(--paper-300)' : 'transparent'}`,
          transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        <div className={s.navBrand} onClick={() => navigate('/')}>
          <Logo height={27} color={scrolled ? '#1a143d' : '#F0F4F9'} />
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 800,
              color: !scrolled ? 'var(--paper-100)' : 'var(--ink-900)',
              letterSpacing: '-0.01em',
              transition: 'color 0.3s',
            }}
          >
            BOXR
          </div>
        </div>
        <div className={s.navLinks}>
          {([
            ['Турниры', () => navigate('/tournaments')],
            ['Возможности', () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })],
            ['О проекте', () => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })],
          ] as [string, () => void][]).map(([label, handler]) => (
            <button
              key={label}
              onClick={handler}
              className={s.navLink}
              style={{ color: !scrolled ? 'rgba(242,238,229,0.7)' : 'var(--ink-500)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={s.navAction}>
          <Button onClick={() => navigate('/login')} size="sm">
            Авторизоваться
          </Button>
        </div>
      </nav>

      {/* HERO */}
      <section
        className={s.heroSection}
        style={{
          minHeight: '100vh',
          marginTop: -72,
          background: 'var(--ink-900)',
          color: 'var(--paper-100)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className={s.heroInner}
        >
          <div className={s.heroContent}>
            <div
              style={{
                ...animBase,
                transform: loaded ? 'none' : 'translateY(16px)',
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem',
                color: 'rgba(242,238,229,0.5)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 20,
                transitionDelay: '0.1s',
              }}
            >
              ©ФЕДЕРАЦИЯ БОКСА РОССИИ
            </div>

            <h1
              style={{
                ...animBase,
                transform: loaded ? 'none' : 'translateY(24px)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(60px, 7vw, 112px)',
                fontWeight: 700,
                lineHeight: 1.0,
                letterSpacing: '-0.03em',
                marginBottom: 24,
                transitionDelay: '0.2s',
              }}
            >
              Турниры по боксу
              <br />
              <em style={{ fontStyle: 'italic', fontWeight: 300, letterSpacing: "0.1rem" }}>
                {'Без хаоса'.split('').map((char, i) => (
                  <span
                    key={i}
                    className={s.heroLetter}
                    style={{ animationDelay: `${1.1 + i * 0.07}s` }}
                  >
                    {char === ' ' ? ' ' : char}
                  </span>
                ))}
                <span className={s.exclaim}>.</span>
              </em>
            </h1>

            <p
              style={{
                ...animBase,
                transform: loaded ? 'none' : 'translateY(16px)',
                fontSize: 'var(--text-lg)',
                color: 'rgba(242,238,229,0.65)',
                maxWidth: 480,
                lineHeight: 1.55,
                marginBottom: 40,
                transitionDelay: '0.35s',
              }}
            >
              Единая платформа для организации официальных соревнований по боксу
              с AI-ассистентом.
            </p>

            <div
              className={s.heroCta}
              style={{
                ...animBase,
                transform: loaded ? 'none' : 'translateY(12px)',
                transitionDelay: '0.45s',
              }}
            >
              <button onClick={() => navigate('/login')} className={s.btnPrimary}>
                Войти в систему
              </button>
              <button onClick={() => navigate('/tournaments')} className={s.btnGhost}>
                Посмотреть турниры
              </button>
            </div>
          </div>

          {/* Right: editorial composition */}
          <div
            className={s.heroIllustration}
            style={{
              ...animBase,
              transform: loaded ? 'rotate(-2deg)' : 'rotate(-6deg) translateY(20px)',
              position: 'relative',
              transitionDelay: '0.55s',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -20,
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(80px, 10vw, 160px)',
                fontWeight: 300,
                color: 'rgba(242,238,229,0.07)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
                userSelect: 'none',
              }}
            >
              2026
            </div>
            <div
              style={{
                background: 'var(--paper-100)',
                color: 'var(--ink-900)',
                borderRadius: 'var(--radius-md)',
                padding: 24,
                boxShadow: 'var(--shadow-elevated)',
                position: 'relative',
                zIndex: 1,
                maxWidth: 320,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 16,
                }}
              >
                <MonoLabel>№ 047 · БОКСЁР</MonoLabel>
                <Pill variant="active">КМС</Pill>
              </div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--paper-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 20,
                  color: 'var(--ink-500)',
                  marginBottom: 12,
                }}
              >
                АС
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Алексей Соколов
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--ink-500)',
                  marginBottom: 20,
                }}
              >
                БК «Динамо» · Москва
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  borderTop: '1px solid var(--paper-300)',
                  paddingTop: 16,
                }}
              >
                {[
                  ['ВЕС', '75 кг'],
                  ['КАТ.', 'Средняя'],
                  ['БОЁВ', '23'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--ink-300)',
                        letterSpacing: '0.1em',
                        marginBottom: 3,
                      }}
                    >
                      {l}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES STRIP */}
      <section
        style={{
          background: 'var(--paper-100)',
          borderTop: '1px solid var(--paper-300)',
          borderBottom: '1px solid var(--paper-300)',
        }}
      >
        <div className={s.featuresStrip}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={s.featureItem}
              style={{
                borderRight: i < FEATURES.length - 1 ? '1px solid var(--paper-300)' : 'none',
                paddingLeft: i > 0 ? 40 : 0,
              }}
            >
              <MonoLabel style={{ marginBottom: 12 }}>{f.index}</MonoLabel>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink-900)',
                  marginBottom: 10,
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)', lineHeight: 1.65 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="features" className={s.howSection}>
        <MonoLabel style={{ marginBottom: 16 }}>КАК ЭТО РАБОТАЕТ</MonoLabel>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(48px, 5vw, 80px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--ink-900)',
            marginBottom: 80,
            lineHeight: 1.05,
          }}
        >
          Сценарий
        </h2>

        {STEPS.map((step, i) => (
          <div
            key={i}
            ref={(el) => { stepRefs.current[i] = el; }}
            className={s.step}
            style={{
              paddingBottom: 60,
              marginBottom: 60,
              borderBottom: i < STEPS.length - 1 ? '1px dashed var(--paper-300)' : 'none',
              transitionDelay: `${i * 0.12}s`,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(64px, 8vw, 120px)',
                fontWeight: 300,
                color: 'var(--paper-300)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
                flexShrink: 0,
                minWidth: 160,
              }}
            >
              {step.num}
            </div>
            <div style={{ flex: 1, paddingTop: 16 }}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  marginBottom: 12,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--ink-500)',
                  lineHeight: 1.7,
                  maxWidth: 480,
                }}
              >
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* QUOTE */}
      <section
        className={s.quoteSection}
        style={{
          background: 'var(--paper-200)',
          borderTop: '1px solid var(--paper-300)',
          borderBottom: '1px solid var(--paper-300)',
        }}
      >
        <div ref={quoteRef} style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <blockquote
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 52px)',
              fontStyle: 'italic',
              fontWeight: 400,
              lineHeight: 1.3,
              color: 'var(--ink-900)',
              letterSpacing: '0.1em',
              marginBottom: 20,
            }}
          >
            <>
              {([
                { text: '«Ра-', delay: '0.1s' },
                { text: 'бо-',  delay: '0.55s' },
                { text: 'та-',  delay: '1.0s' },
                { text: 'ем',   delay: '1.45s' },
              ] as { text: string; delay: string }[]).map(({ text, delay }) => (
                <span
                  key={text}
                  className={`${s.quoteSyllable} ${quoteVisible ? s.quoteSyllableActive : ''}`}
                  style={{ animationDelay: delay }}
                >
                  {text}
                </span>
              ))}
              <span
                className={`${s.quoteExclaim} ${quoteVisible ? s.quoteExclaimActive : ''}`}
                style={{ animationDelay: '1.9s' }}
              >!</span>
              <span
                className={`${s.quoteSyllable} ${quoteVisible ? s.quoteSyllableActive : ''}`}
                style={{ animationDelay: '2.1s' }}
              >»</span>
            </>
          </blockquote>
          <svg
            viewBox="0 0 120 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${s.quoteFadeIn} ${quoteVisible ? s.quoteFadeInVisible : ''}`}
            style={{ display: 'block', width: 120, height: 32, margin: '0 auto 24px', transitionDelay: '2.2s' }}
          >
            <path
              d="M 0 4 L 60 28 L 120 4"
              stroke="#991B1B"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            className={`${s.quoteFadeIn} ${quoteVisible ? s.quoteFadeInVisible : ''}`}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--ink-500)',
              fontStyle: 'italic',
              transitionDelay: '2.6s',
            }}
          >
            Олег Владимирович Меньшиков, главный тренер БК «Торпедо»
          </div>
          <div
            className={`${s.quoteFadeIn} ${quoteVisible ? s.quoteFadeInVisible : ''}`}
            style={{ marginTop: 8, transitionDelay: '2.8s' }}
          >
            <MonoLabel>№ 001</MonoLabel>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        id="about"
        ref={ctaRef}
        className={s.ctaSection}
        style={{
          background: 'var(--ink-900)',
          color: 'var(--paper-100)',
          textAlign: 'center',
        }}
      >
        <MonoLabel
          style={{
            color: 'rgba(242,238,229,0.4)',
            marginBottom: 24,
            ...(!ctaVisible ? { opacity: 0 } : {}),
            transition: 'opacity 0.7s var(--ease-out-expo) 0.1s',
          }}
        >
          НАЧАЛО ИСТОРИИ
        </MonoLabel>
        <h2
          className={`${s.ctaFadeUp} ${ctaVisible ? s.ctaFadeUpVisible : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(40px, 5vw, 80px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 48,
            maxWidth: 700,
            margin: '0 auto 48px',
            transitionDelay: '0.2s',
          }}
        >
          Готовы провести
          <br />
          <em style={{ fontStyle: 'italic', fontWeight: 300 }}>идеальный турнир?</em>
        </h2>
        <div
          className={`${s.ctaFadeUp} ${ctaVisible ? s.ctaFadeUpVisible : ''}`}
          style={{ transitionDelay: '0.4s' }}
        >
          <button onClick={() => navigate('/login')} className={s.btnPrimaryLg}>
            Войти в систему
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: 'var(--ink-900)',
          borderTop: '1px solid rgba(242,238,229,0.1)',
          padding: '32px 48px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'rgba(242,238,229,0.3)',
          letterSpacing: '0.1em',
        }}
      >
        © ПЛАТФОРМА ФЕДЕРАЦИИ БОКСА РОССИИ
      </footer>

      <Hairline style={{ display: 'none' }} />
    </div>
  );
};
