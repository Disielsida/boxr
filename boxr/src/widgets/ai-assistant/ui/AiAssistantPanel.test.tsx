import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import '@testing-library/jest-dom';
import { AiAssistantPanel } from './AiAssistantPanel';

vi.mock('@/app/providers', () => ({
  useAuthContext: vi.fn(() => ({
    user: { fullName: 'Тест', role: 'organizer', email: 'test@test.com' },
  })),
}));

vi.mock('../model/useAiChat', () => ({
  useAiChat: vi.fn(() => ({
    messages: [{ role: 'assistant', content: 'Привет!' }],
    loading: false,
    sendMessage: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

function mockMQ(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: vi.fn((q: string) => ({
      matches,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('AiAssistantPanel', () => {
  it('drag handle отсутствует на десктопе (matchMedia → false)', () => {
    mockMQ(false);
    render(<AiAssistantPanel onClose={vi.fn()} />);
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });

  it('drag handle присутствует на мобильном (matchMedia → true)', () => {
    mockMQ(true);
    render(<AiAssistantPanel onClose={vi.fn()} />);
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });
});
