import type { ChatMessage } from '@/shared/api';

const KEY = 'boxr.ai.history';
const MAX = 50;

export function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]): void {
  const trimmed = messages.slice(-MAX);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
