import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';

import s from './AiAssistantPanel.module.css';
import { useAiChat } from '../model/useAiChat';

import type { UserRole } from '@/shared/types';

const SUGGESTIONS: Record<UserRole, string[]> = {
  organizer: [
    'Как провести жеребьёвку?',
    'Что такое рассеивание в сетке?',
    'Какие документы нужны от боксёра?',
  ],
  trainer: [
    'Срок действия мед. справки',
    'Требования МРТ по IBA',
    'Документы для иностранца',
  ],
  judge: [
    'Сколько нокдаунов до остановки?',
    'Что такое RSC?',
    'Правила предупреждений',
  ],
};

const BotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M3 10a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /><circle cx="8.5" cy="13" r="1" /><circle cx="15.5" cy="13" r="1" /><path d="M8 17v1a2 2 0 0 0 4 0" />
  </svg>
);

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

interface Props {
  onClose: () => void;
}

export const AiAssistantPanel = ({ onClose }: Props) => {
  const { user } = useAuthContext();
  const { messages, loading, sendMessage, clearHistory } = useAiChat();
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const role: UserRole = user?.role ?? 'organizer';
  const suggestions = SUGGESTIONS[role];
  const showSuggestions = messages.length <= 1;

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, window.innerHeight / 3)}px`;
  }, [input]);

  const handleSend = async (text?: string) => {
    const t = text ?? input.trim();
    if (!t || loading) return;
    setInput('');
    await sendMessage(t);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      <style>{`
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes aiPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div className={s.panel}>
        {isMobile && <div className={s.dragHandle} data-testid="drag-handle" />}
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--paper-300)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--ink-900)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--paper-100)',
                }}
              >
                <BotIcon />
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>AI-помощник BOXR</div>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  animation: 'aiPulse 2s infinite',
                }}
              />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-300)',
                letterSpacing: '0.08em',
              }}
            >
              ЗНАЕТ ПРАВИЛА IBA · ОТВЕЧАЕТ НА РУССКОМ
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {messages.length > 1 && (
              <button
                onClick={clearHistory}
                title="Очистить историю"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--ink-300)',
                  padding: 8,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                }}
              >
                ОЧИСТИТЬ
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-300)',
                padding: 8,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--paper-300)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void handleSend(s)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--paper-200)',
                  border: '1px solid var(--paper-300)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--ink-700)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 10,
                animation: 'msgFadeIn 0.3s var(--ease-out-quart)',
              }}
            >
              {msg.role === 'assistant' && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--ink-900)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                    color: 'var(--paper-100)',
                  }}
                >
                  <BotIcon />
                </div>
              )}
              <div style={{ maxWidth: '80%' }}>
                <div
                  style={{
                    paddingTop: 10,
                    paddingBottom: 10,
                    paddingLeft: 16,
                    paddingRight: 16,
                    background: msg.role === 'user' ? 'var(--ink-900)' : 'transparent',
                    color: msg.role === 'user' ? 'var(--paper-100)' : 'var(--ink-900)',
                    borderRadius: msg.role === 'user' ? 'var(--radius-md)' : 0,
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.65,
                    borderLeft: msg.role === 'assistant' ? '2px solid var(--paper-300)' : 'none',
                  }}
                >
                  {msg.role === 'user' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                        ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                        code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--paper-200)', padding: '1px 5px', borderRadius: 3 }}>{children}</code>,
                        a: ({ href, children }) => href?.startsWith('/') ? (
                          <Link
                            to={href}
                            style={{ color: 'var(--ring-600)', fontWeight: 500, textDecoration: 'underline' }}
                          >
                            {children}
                          </Link>
                        ) : (
                          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ring-600)', fontWeight: 500 }}>
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 10, animation: 'msgFadeIn 0.3s var(--ease-out-quart)' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--ink-900)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--paper-100)',
                }}
              >
                <BotIcon />
              </div>
              <div
                style={{
                  borderLeft: '2px solid var(--paper-300)',
                  paddingLeft: 16,
                  paddingTop: 8,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--ink-300)',
                      animation: `typing 1.2s ${j * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--paper-300)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
              background: 'var(--paper-200)',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросите о правилах или приложении..."
              rows={1}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-900)',
                resize: 'none',
                lineHeight: 1.5,
                overflowY: 'auto',
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: input.trim() && !loading ? 'var(--ink-900)' : 'var(--paper-300)',
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
                color: input.trim() && !loading ? 'var(--paper-100)' : 'var(--ink-300)',
                flexShrink: 0,
              }}
            >
              <SendIcon />
            </button>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-300)',
              marginTop: 8,
              textAlign: 'center',
              letterSpacing: '0.06em',
            }}
          >
            ENTER — ОТПРАВИТЬ · SHIFT+ENTER — ПЕРЕНОС
          </div>
        </div>
      </div>
    </>
  );
};
