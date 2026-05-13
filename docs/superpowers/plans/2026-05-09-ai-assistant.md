# AI-помощник BOXR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить AI-чат-помощника (знает правила IBA и BOXR) доступного всем авторизованным пользователям через плавающую панель справа.

**Architecture:** Фронтенд вызывает `POST /api/v1/ai/chat` с массивом сообщений; NestJS-сервис формирует system prompt и вызывает Anthropic SDK; история хранится в localStorage на 50 сообщений. Бэкенд полностью stateless.

**Tech Stack:** NestJS 10, `@anthropic-ai/sdk`, class-validator, Jest (бэкенд); React 19, Vitest, `@testing-library/react`, localStorage (фронтенд).

---

## Карта файлов

### Создать
- `boxr-api/src/ai/dto/chat.dto.ts` — `ChatMessageDto`, `ChatRequestDto`, `ChatResponseDto`
- `boxr-api/src/ai/ai.service.ts` — вызов Anthropic SDK
- `boxr-api/src/ai/ai.service.spec.ts` — unit-тесты сервиса
- `boxr-api/src/ai/ai.controller.ts` — `POST /ai/chat`
- `boxr-api/src/ai/ai.module.ts` — NestJS модуль
- `boxr/src/shared/api/ai.ts` — `aiApi.chat()`
- `boxr/src/widgets/ai-assistant/model/storage.ts` — localStorage helpers
- `boxr/src/widgets/ai-assistant/model/useAiChat.ts` — хук чата
- `boxr/src/widgets/ai-assistant/model/useAiChat.test.ts` — тесты хука
- `boxr/src/widgets/ai-assistant/ui/AiFloatingButton.tsx`
- `boxr/src/widgets/ai-assistant/ui/AiAssistantPanel.tsx`
- `boxr/src/widgets/ai-assistant/index.ts`

### Изменить
- `boxr-api/src/app.module.ts` — импорт `AiModule`, `ANTHROPIC_API_KEY` и `AI_MODEL` в Joi
- `boxr-api/.env.example` — добавить `ANTHROPIC_API_KEY`, `AI_MODEL`
- `boxr/src/shared/api/index.ts` — экспорт `aiApi`
- `boxr/src/app/router/AppRouter.tsx` — глобальный оверлей панели + кнопка
- `boxr/vite.config.ts` — добавить vitest конфиг
- `boxr/package.json` — добавить скрипт `"test": "vitest run"`

---

## Task 1: Установить `@anthropic-ai/sdk` и обновить .env.example

**Files:**
- Modify: `boxr-api/.env.example`

- [ ] **Step 1: Установить пакет**

```bash
cd boxr-api && npm install @anthropic-ai/sdk
```

Ожидаемый вывод: `added 1 package` (или аналогичный без ошибок).

- [ ] **Step 2: Обновить .env.example**

Добавить в конец файла `boxr-api/.env.example`:

```
# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-replace_me
AI_MODEL=claude-haiku-4-5-20251001
```

- [ ] **Step 3: Коммит**

```bash
cd boxr-api && git add package.json package-lock.json .env.example
git commit -m "chore(ai): install @anthropic-ai/sdk"
```

---

## Task 2: DTO бэкенда

**Files:**
- Create: `boxr-api/src/ai/dto/chat.dto.ts`

- [ ] **Step 1: Создать DTO файл**

```typescript
// boxr-api/src/ai/dto/chat.dto.ts
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class ChatResponseDto {
  content: string;
}
```

- [ ] **Step 2: Коммит**

```bash
cd boxr-api && git add src/ai/dto/chat.dto.ts
git commit -m "feat(ai): add chat DTOs"
```

---

## Task 3: AiService с тестами

**Files:**
- Create: `boxr-api/src/ai/ai.service.ts`
- Create: `boxr-api/src/ai/ai.service.spec.ts`

- [ ] **Step 1: Написать падающий тест**

```typescript
// boxr-api/src/ai/ai.service.spec.ts
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AiService } from './ai.service';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    mockCreate.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'test-key';
              if (key === 'AI_MODEL') return 'claude-haiku-4-5-20251001';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AiService);
  });

  it('возвращает content из ответа Anthropic', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Ответ ассистента' }],
    });

    const result = await service.chat(
      [{ role: 'user', content: 'Привет' }],
      Role.ORGANIZER,
    );

    expect(result).toEqual({ content: 'Ответ ассистента' });
  });

  it('передаёт все сообщения из истории в SDK', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
    });

    await service.chat(
      [
        { role: 'user', content: 'Первый вопрос' },
        { role: 'assistant', content: 'Первый ответ' },
        { role: 'user', content: 'Второй вопрос' },
      ],
      Role.JUDGE,
    );

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.messages).toHaveLength(3);
    expect(callArg.messages[2]).toEqual({ role: 'user', content: 'Второй вопрос' });
  });

  it('пробрасывает ошибку SDK', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API недоступен'));

    await expect(
      service.chat([{ role: 'user', content: 'Привет' }], Role.TRAINER),
    ).rejects.toThrow('API недоступен');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```bash
cd boxr-api && npm test -- ai.service.spec.ts --no-coverage
```

Ожидаемый вывод: `FAIL src/ai/ai.service.spec.ts` — `Cannot find module './ai.service'`

- [ ] **Step 3: Реализовать AiService**

```typescript
// boxr-api/src/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Role } from '@prisma/client';
import { ChatMessageDto, ChatResponseDto } from './dto/chat.dto';

const ROLE_CONTEXT: Record<Role, string> = {
  [Role.ORGANIZER]: 'организатор турнира — управляет жеребьёвкой, участниками, расписанием',
  [Role.TRAINER]: 'тренер — регистрирует боксёров, следит за расписанием боёв',
  [Role.JUDGE]: 'судья — ведёт судейство боёв на ринге в реальном времени',
};

const SYSTEM_PROMPT = (role: Role) => `Ты — AI-помощник BOXR, платформы для организации боксёрских соревнований.

Пользователь: ${ROLE_CONTEXT[role]}.

Твои знания:
- Правила IBA (International Boxing Association) для любительского бокса
- Весовые категории мужчин (кг): 46, 48, 51, 54, 57, 60, 63.5, 67, 71, 75, 80, 86, 92
- Раунды: 3 раунда по 3 минуты для разрядных боёв
- Шлемы: мужчины 19–40 лет не используют шлемы (правило IBA с 2016)
- Правило трёх нокдаунов: 3 нокдауна в одном раунде — бой останавливается
- RSC (Referee Stops Contest): остановка боя судьёй при явном преимуществе
- Предупреждение: −1 балл; дисквалификация после 3 предупреждений (Правило 5.1)
- Система жеребьёвки: рассеивание сеяных боксёров по сетке
- Функции BOXR: жеребьёвка, OCR-регистрация боксёров, расписание, live-судейство

Отвечай кратко и по делу. При цитировании правил указывай номер как "Правило X.X".
Используй структуру: сначала суть, потом детали.
Отвечай на русском языке.`;

@Injectable()
export class AiService {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({ apiKey: config.get<string>('ANTHROPIC_API_KEY') });
    this.model = config.get<string>('AI_MODEL') ?? 'claude-haiku-4-5-20251001';
  }

  async chat(messages: ChatMessageDto[], role: Role): Promise<ChatResponseDto> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT(role),
      messages,
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return { content: text };
  }
}
```

- [ ] **Step 4: Запустить тест — убедиться что проходит**

```bash
cd boxr-api && npm test -- ai.service.spec.ts --no-coverage
```

Ожидаемый вывод: `PASS src/ai/ai.service.spec.ts` — 3 теста прошли.

- [ ] **Step 5: Коммит**

```bash
cd boxr-api && git add src/ai/ai.service.ts src/ai/ai.service.spec.ts
git commit -m "feat(ai): implement AiService with Anthropic SDK"
```

---

## Task 4: AiController, AiModule, регистрация в AppModule

**Files:**
- Create: `boxr-api/src/ai/ai.controller.ts`
- Create: `boxr-api/src/ai/ai.module.ts`
- Modify: `boxr-api/src/app.module.ts`

- [ ] **Step 1: Создать контроллер**

```typescript
// boxr-api/src/ai/ai.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user';
import { AiService } from './ai.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.service.chat(dto.messages, user.role);
  }
}
```

- [ ] **Step 2: Создать модуль**

```typescript
// boxr-api/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
```

- [ ] **Step 3: Зарегистрировать в AppModule**

В `boxr-api/src/app.module.ts`:

1. Добавить импорт: `import { AiModule } from './ai/ai.module';`
2. В `validationSchema` добавить две строки после `CORS_ORIGIN`:
```typescript
ANTHROPIC_API_KEY: Joi.string().required(),
AI_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),
```
3. В массив `imports` добавить `AiModule`.

Итоговый `app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AiModule } from './ai/ai.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { BoxersModule } from './boxers/boxers.module';
import { MatchesModule } from './matches/matches.module';
import { PrismaModule } from './prisma/prisma.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_TTL: Joi.string().default('15m'),
        JWT_REFRESH_TTL: Joi.string().default('30d'),
        BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),
        PORT: Joi.number().port().default(3000),
        CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
        ANTHROPIC_API_KEY: Joi.string().required(),
        AI_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TournamentsModule,
    BoxersModule,
    ApplicationsModule,
    MatchesModule,
    AiModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Добавить `ANTHROPIC_API_KEY` в `.env` (локально)**

В файл `boxr-api/.env` добавить:
```
ANTHROPIC_API_KEY=<ваш ключ из console.anthropic.com>
AI_MODEL=claude-haiku-4-5-20251001
```

- [ ] **Step 5: Проверить что бэкенд запускается**

```bash
cd boxr-api && npm run start:dev
```

Ожидаемый вывод: `Nest application successfully started` на порту 3000 без ошибок валидации env.

Остановить (Ctrl+C).

- [ ] **Step 6: Коммит**

```bash
cd boxr-api && git add src/ai/ai.controller.ts src/ai/ai.module.ts src/app.module.ts
git commit -m "feat(ai): add AiController, AiModule, register in AppModule"
```

---

## Task 5: Настроить Vitest на фронтенде

**Files:**
- Modify: `boxr/vite.config.ts`
- Modify: `boxr/package.json`

- [ ] **Step 1: Установить vitest и зависимости**

```bash
cd boxr && npm install -D vitest @vitest/globals jsdom @testing-library/react @testing-library/user-event
```

Ожидаемый вывод: установка без ошибок.

- [ ] **Step 2: Обновить `vite.config.ts`**

```typescript
/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 3: Добавить скрипт в `package.json`**

В секцию `"scripts"` добавить:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Проверить что vitest работает**

```bash
cd boxr && npm test
```

Ожидаемый вывод: `No test files found` или тесты из `reducer.spec.ts` проходят (там `@ts-nocheck`).

- [ ] **Step 5: Коммит**

```bash
cd boxr && git add vite.config.ts package.json package-lock.json
git commit -m "chore(frontend): setup vitest"
```

---

## Task 6: `shared/api/ai.ts`

**Files:**
- Create: `boxr/src/shared/api/ai.ts`
- Modify: `boxr/src/shared/api/index.ts`

- [ ] **Step 1: Создать `ai.ts`**

```typescript
// boxr/src/shared/api/ai.ts
import { request } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (messages: ChatMessage[]) =>
    request<{ content: string }>('/ai/chat', { method: 'POST', body: { messages } }),
};
```

- [ ] **Step 2: Экспортировать из `index.ts`**

Добавить в конец `boxr/src/shared/api/index.ts`:
```typescript
export { aiApi, type ChatMessage } from './ai';
```

- [ ] **Step 3: Коммит**

```bash
cd boxr && git add src/shared/api/ai.ts src/shared/api/index.ts
git commit -m "feat(ai): add aiApi client"
```

---

## Task 7: `storage.ts` и хук `useAiChat` с тестами

**Files:**
- Create: `boxr/src/widgets/ai-assistant/model/storage.ts`
- Create: `boxr/src/widgets/ai-assistant/model/useAiChat.ts`
- Create: `boxr/src/widgets/ai-assistant/model/useAiChat.test.ts`

- [ ] **Step 1: Создать `storage.ts`**

```typescript
// boxr/src/widgets/ai-assistant/model/storage.ts
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
```

- [ ] **Step 2: Написать падающий тест для `useAiChat`**

```typescript
// boxr/src/widgets/ai-assistant/model/useAiChat.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAiChat } from './useAiChat';
import * as storage from './storage';
import * as api from '@/shared/api';

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
```

- [ ] **Step 3: Запустить тест — убедиться что падает**

```bash
cd boxr && npm test -- useAiChat
```

Ожидаемый вывод: `FAIL` — `Cannot find module './useAiChat'`

- [ ] **Step 4: Реализовать `useAiChat.ts`**

```typescript
// boxr/src/widgets/ai-assistant/model/useAiChat.ts
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
```

- [ ] **Step 5: Запустить тест — убедиться что проходит**

```bash
cd boxr && npm test -- useAiChat
```

Ожидаемый вывод: `PASS` — 6 тестов прошли.

- [ ] **Step 6: Коммит**

```bash
cd boxr && git add src/widgets/ai-assistant/model/
git commit -m "feat(ai): add storage helpers and useAiChat hook"
```

---

## Task 8: AiFloatingButton

**Files:**
- Create: `boxr/src/widgets/ai-assistant/ui/AiFloatingButton.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// boxr/src/widgets/ai-assistant/ui/AiFloatingButton.tsx
import { useState } from 'react';

interface Props {
  onClick: () => void;
}

export const AiFloatingButton = ({ onClick }: Props) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: 32,
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
```

- [ ] **Step 2: Коммит**

```bash
cd boxr && git add src/widgets/ai-assistant/ui/AiFloatingButton.tsx
git commit -m "feat(ai): add AiFloatingButton"
```

---

## Task 9: AiAssistantPanel

**Files:**
- Create: `boxr/src/widgets/ai-assistant/ui/AiAssistantPanel.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// boxr/src/widgets/ai-assistant/ui/AiAssistantPanel.tsx
import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/app/providers';
import type { UserRole } from '@/shared/types';
import { useAiChat } from '../model/useAiChat';

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

  const role: UserRole = user?.role ?? 'organizer';
  const suggestions = SUGGESTIONS[role];
  const showSuggestions = messages.length <= 1;

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

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
        @keyframes aiPanelIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
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

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          background: 'var(--paper-100)',
          borderLeft: '1px solid var(--paper-300)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 500,
          animation: 'aiPanelIn 0.4s var(--ease-out-expo)',
        }}
      >
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
                    padding: msg.role === 'user' ? '10px 16px' : '0',
                    background: msg.role === 'user' ? 'var(--ink-900)' : 'transparent',
                    color: msg.role === 'user' ? 'var(--paper-100)' : 'var(--ink-900)',
                    borderRadius: msg.role === 'user' ? 'var(--radius-md)' : 0,
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.65,
                    borderLeft: msg.role === 'assistant' ? '2px solid var(--paper-300)' : 'none',
                    paddingLeft: msg.role === 'assistant' ? 16 : undefined,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
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
```

- [ ] **Step 2: Коммит**

```bash
cd boxr && git add src/widgets/ai-assistant/ui/AiAssistantPanel.tsx
git commit -m "feat(ai): add AiAssistantPanel component"
```

---

## Task 10: Barrel-файл виджета

**Files:**
- Create: `boxr/src/widgets/ai-assistant/index.ts`

- [ ] **Step 1: Создать `index.ts`**

```typescript
// boxr/src/widgets/ai-assistant/index.ts
export { AiAssistantPanel } from './ui/AiAssistantPanel';
export { AiFloatingButton } from './ui/AiFloatingButton';
```

- [ ] **Step 2: Коммит**

```bash
cd boxr && git add src/widgets/ai-assistant/index.ts
git commit -m "feat(ai): export widget barrel"
```

---

## Task 11: Интеграция в AppRouter

**Files:**
- Modify: `boxr/src/app/router/AppRouter.tsx`

- [ ] **Step 1: Обновить AppRouter.tsx**

```tsx
// boxr/src/app/router/AppRouter.tsx
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuthContext } from '@/app/providers';
import { BoxerProfilePage } from '@/pages/boxer-profile';
import { CreateTournamentPage } from '@/pages/create-tournament';
import { DashboardPage } from '@/pages/dashboard';
import { LandingPage } from '@/pages/landing';
import { LiveScoringPage } from '@/pages/live-scoring';
import { LoginPage } from '@/pages/login';
import { PublicTournamentPage } from '@/pages/public-tournament';
import { PublicTournamentsPage } from '@/pages/public-tournaments';
import { RegisterBoxerPage } from '@/pages/register-boxer';
import { TournamentManagePage } from '@/pages/tournament-manage';
import { TrainerDashboardPage } from '@/pages/trainer-dashboard';
import { AiAssistantPanel, AiFloatingButton } from '@/widgets/ai-assistant';
import { RequireAuth, RequireRole } from './guards';

export const AppRouter = () => {
  const { user } = useAuthContext();
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/tournaments" element={<PublicTournamentsPage />} />
        <Route
          path="/tournaments/new"
          element={
            <RequireRole role="organizer">
              <CreateTournamentPage />
            </RequireRole>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <RequireRole role="organizer">
              <TournamentManagePage />
            </RequireRole>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireRole role={['organizer', 'judge']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/trainer"
          element={
            <RequireRole role="trainer">
              <TrainerDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/boxers/new"
          element={
            <RequireRole role="trainer">
              <RegisterBoxerPage />
            </RequireRole>
          }
        />
        <Route
          path="/boxers/:id"
          element={
            <RequireRole role="trainer">
              <BoxerProfilePage />
            </RequireRole>
          }
        />
        <Route
          path="/me"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/public/tournaments/:id" element={<PublicTournamentPage />} />
        <Route
          path="/scoring/:matchId"
          element={
            <RequireRole role="organizer">
              <LiveScoringPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<LandingPage />} />
      </Routes>

      {user && (
        <>
          {aiOpen && (
            <>
              <div
                onClick={() => setAiOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(26,20,61,0.35)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 490,
                }}
              />
              <AiAssistantPanel onClose={() => setAiOpen(false)} />
            </>
          )}
          {!aiOpen && <AiFloatingButton onClick={() => setAiOpen(true)} />}
        </>
      )}
    </BrowserRouter>
  );
};
```

- [ ] **Step 2: Запустить фронтенд и проверить вручную**

```bash
cd boxr && npm run dev
```

Открыть `http://localhost:5173`, войти как любой пользователь.
Убедиться:
- Плавающая кнопка «AI-помощник» видна в правом нижнем углу
- Клик открывает панель с анимацией slide-in
- Клик на backdrop закрывает панель
- Кнопка скрывается пока панель открыта
- Suggestion-чипсы отображаются при первом открытии
- Отправка сообщения показывает user-пузырь и анимацию загрузки
- Приходит ответ от AI
- История сохраняется: закрой/открой панель — сообщения на месте
- Перезагрузка страницы — история восстанавливается из localStorage
- Кнопка «ОЧИСТИТЬ» появляется после первого сообщения

Остановить (Ctrl+C).

- [ ] **Step 3: Запустить все тесты бэкенда**

```bash
cd boxr-api && npm test -- --no-coverage
```

Ожидаемый вывод: все тесты PASS.

- [ ] **Step 4: Запустить все тесты фронтенда**

```bash
cd boxr && npm test
```

Ожидаемый вывод: все тесты PASS.

- [ ] **Step 5: Финальный коммит**

```bash
cd boxr && git add src/app/router/AppRouter.tsx
git commit -m "feat(ai): integrate AI panel into AppRouter — AI assistant complete"
```
