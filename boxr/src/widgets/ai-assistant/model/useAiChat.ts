import { useState } from 'react';

import { aiApi, ApiError, type ChatMessage } from '@/shared/api';

import { clearHistory as storageClear, loadHistory, saveHistory } from './storage';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    'Привет! Я AI-помощник BOXR. Знаю правила IBA, могу помочь с жеребьёвкой, документами и любыми вопросами о приложении. Чем могу помочь?',
};

function initMessages(): ChatMessage[] {
  const history = loadHistory();
  return history.length > 0 ? history : [WELCOME];
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initMessages);
  const [loading, setLoading] = useState(false);

  async function sendMessage(text: string): Promise<void> {
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const { content } = await aiApi.chat(next);
      const withReply = [...next, { role: 'assistant' as const, content }];
      setMessages(withReply);
      saveHistory(withReply);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Произошла ошибка. Попробуйте ещё раз.';
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory(): void {
    storageClear();
    setMessages([WELCOME]);
  }

  return { messages, loading, sendMessage, clearHistory };
}
