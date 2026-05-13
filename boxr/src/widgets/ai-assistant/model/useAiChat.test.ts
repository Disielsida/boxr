import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as api from '@/shared/api';

import * as storage from './storage';
import { useAiChat } from './useAiChat';

vi.mock('@/shared/api', () => ({
  aiApi: {
    chat: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

vi.mock('./storage', () => ({
  loadHistory: vi.fn(() => []),
  saveHistory: vi.fn(),
  clearHistory: vi.fn(),
}));

const mockChat = vi.mocked(api.aiApi.chat);
const mockLoad = vi.mocked(storage.loadHistory);
const mockSave = vi.mocked(storage.saveHistory);
const mockClear = vi.mocked(storage.clearHistory);

describe('useAiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockReturnValue([]);
  });

  it('при пустом localStorage — messages содержит только приветственное сообщение', () => {
    const { result } = renderHook(() => useAiChat());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('assistant');
  });

  it('при наличии истории в localStorage — messages восстанавливаются', () => {
    mockLoad.mockReturnValue([
      { role: 'user', content: 'Привет' },
      { role: 'assistant', content: 'Здравствуйте' },
    ]);
    const { result } = renderHook(() => useAiChat());
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Привет');
  });

  it('sendMessage: user-сообщение добавляется немедленно, loading выставляется', async () => {
    mockChat.mockResolvedValue({ content: 'Ответ' });
    const { result } = renderHook(() => useAiChat());

    act(() => { void result.current.sendMessage('Тест'); });

    expect(result.current.messages.at(-1)?.content).toBe('Тест');
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('sendMessage: после ответа добавляется assistant-сообщение', async () => {
    mockChat.mockResolvedValue({ content: 'Ответ ассистента' });
    const { result } = renderHook(() => useAiChat());

    await act(() => result.current.sendMessage('Вопрос'));

    const last = result.current.messages.at(-1);
    expect(last?.role).toBe('assistant');
    expect(last?.content).toBe('Ответ ассистента');
  });

  it('sendMessage: история сохраняется в localStorage после ответа', async () => {
    mockChat.mockResolvedValue({ content: 'ok' });
    const { result } = renderHook(() => useAiChat());

    await act(() => result.current.sendMessage('Вопрос'));

    expect(mockSave).toHaveBeenCalledWith(result.current.messages);
  });

  it('sendMessage: при ошибке API добавляется сообщение об ошибке, loading снимается', async () => {
    mockChat.mockRejectedValue(new Error('Сеть недоступна'));
    const { result } = renderHook(() => useAiChat());

    await act(() => result.current.sendMessage('Вопрос'));

    expect(result.current.loading).toBe(false);
    const last = result.current.messages.at(-1);
    expect(last?.role).toBe('assistant');
    expect(last?.content).toContain('ошибка');
  });

  it('clearHistory: очищает messages и localStorage', () => {
    mockLoad.mockReturnValue([{ role: 'user', content: 'old' }]);
    const { result } = renderHook(() => useAiChat());

    act(() => result.current.clearHistory());

    expect(result.current.messages).toHaveLength(1); // только приветствие
    expect(mockClear).toHaveBeenCalled();
  });
});
