import { request } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (messages: ChatMessage[]) =>
    request<{ content: string }>('/ai/chat', { method: 'POST', body: { messages } }),
};
