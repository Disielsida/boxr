import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { AppShell } from './AppShell';

vi.mock('@/app/providers', () => ({
  useAuthContext: vi.fn(() => ({
    user: { fullName: 'Иван Петров', role: 'organizer', email: 'ivan@test.com' },
    logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    register: vi.fn(),
    initializing: false,
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

const renderShell = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell><div>контент</div></AppShell>
    </MemoryRouter>,
  );

describe('AppShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('хедер отсутствует в DOM на десктопе (matchMedia → false)', () => {
    mockMQ(false);
    renderShell();
    expect(screen.queryByTestId('mobile-header')).not.toBeInTheDocument();
  });

  it('хедер присутствует в DOM на мобильном (matchMedia → true)', () => {
    mockMQ(true);
    renderShell();
    expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
  });

  it('drawer открывается по клику на кнопку меню', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('drawer закрывается по клику на backdrop', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    fireEvent.click(screen.getByTestId('backdrop'));
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
  });

  it('nav-ссылки для ORGANIZER: Мои турниры и Создать турнир', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByText('Мои турниры')).toBeInTheDocument();
    expect(screen.getByText('Создать турнир')).toBeInTheDocument();
  });

  it('nav-ссылки для TRAINER: Мои боксёры и Добавить боксёра', async () => {
    const { useAuthContext } = await import('@/app/providers');
    vi.mocked(useAuthContext).mockReturnValue({
      user: { id: 'trainer-1', fullName: 'Тренер', role: 'trainer', email: 't@test.com', createdAt: '2024-01-01T00:00:00.000Z' },
      logout: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      initializing: false,
    });
    mockMQ(true);
    renderShell('/trainer');
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByText('Мои боксёры')).toBeInTheDocument();
    expect(screen.getByText('Добавить боксёра')).toBeInTheDocument();
  });

  it('nav-ссылки для JUDGE: Мои бои', async () => {
    const { useAuthContext } = await import('@/app/providers');
    vi.mocked(useAuthContext).mockReturnValue({
      user: { id: 'judge-1', fullName: 'Судья', role: 'judge', email: 'j@test.com', createdAt: '2024-01-01T00:00:00.000Z' },
      logout: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      initializing: false,
    });
    mockMQ(true);
    renderShell('/judge');
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByText('Мои бои')).toBeInTheDocument();
  });
});
