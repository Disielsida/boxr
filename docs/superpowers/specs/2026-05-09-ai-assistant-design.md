# AI-помощник BOXR — Спецификация

**Дата:** 2026-05-09  
**Статус:** Утверждён

---

## Обзор

Контекстный чат-помощник, встроенный в BOXR. Знает правила IBA и функции приложения. Отвечает на вопросы организаторов, тренеров и судей прямо во время работы с платформой.

---

## Бэкенд

### Модуль `boxr-api/src/ai/`

**Файлы:**
```
ai/
  ai.module.ts
  ai.controller.ts
  ai.service.ts
  ai.service.spec.ts
  dto/
    chat.dto.ts          — ChatMessageDto, ChatRequestDto, ChatResponseDto
```

### Эндпоинт

```
POST /api/v1/ai/chat
Authorization: Bearer <access_token>
```

**Тело запроса:**
```json
{
  "messages": [
    { "role": "user", "content": "Сколько нокдаунов до остановки боя?" }
  ]
}
```

**Ответ:**
```json
{
  "content": "По правилу трёх нокдаунов IBA (Правило 5.3): три нокдауна в одном раунде — бой останавливается."
}
```

**Охрана:** `JwtAuthGuard` — доступен всем авторизованным ролям (`ORGANIZER`, `TRAINER`, `JUDGE`). Роль передаётся в сервис из `@CurrentUser()` для формирования контекстного system prompt.

### AiService

- Принимает `messages: ChatMessageDto[]` и `userRole: Role`
- Формирует system prompt (фиксированный текст про BOXR + IBA правила + инструкция на русском)
- Вызывает `anthropic.messages.create()` из `@anthropic-ai/sdk`
- Возвращает `{ content: string }`
- Stateless — никакого состояния в БД

**System prompt включает:**
- Описание BOXR и ролей (организатор / тренер / судья)
- Правила IBA: весовые категории мужчин (46–92 кг), раунды (3×3 мин для разрядных), правило трёх нокдаунов, RSC, предупреждения, шлемы (не используются у мужчин 19–40 с 2016)
- Инструкцию цитировать правила как «Правило X.X»
- Инструкцию отвечать кратко, по-русски

### Переменные окружения

| Переменная | Обязательная | По умолчанию |
|---|---|---|
| `ANTHROPIC_API_KEY` | Да | — |
| `AI_MODEL` | Нет | `claude-haiku-4-5-20251001` |

Добавить в Joi-схему валидации в `app.module.ts`.

### Тесты (`ai.service.spec.ts`)

- Успешный вызов: мок Anthropic SDK, проверить что возвращается `content`
- Передача истории: убедиться, что все сообщения из `messages[]` попадают в вызов SDK
- Ошибка SDK: проверить что пробрасывается исключение

---

## Фронтенд

### Структура по FSD

```
widgets/ai-assistant/
  index.ts
  ui/
    AiAssistantPanel.tsx
    AiFloatingButton.tsx
  model/
    useAiChat.ts
    storage.ts

shared/api/ai.ts
```

### `shared/api/ai.ts`

```ts
export const aiApi = {
  chat: (messages: ChatMessage[]) =>
    apiClient.post<{ content: string }>('/ai/chat', { messages }),
};
```

### `model/storage.ts`

- Ключ `boxr.ai.history` в localStorage
- `loadHistory(): ChatMessage[]` — читает и парсит, возвращает `[]` при ошибке
- `saveHistory(messages: ChatMessage[]): void` — сохраняет последние 50 сообщений

### `model/useAiChat.ts`

Хук инкапсулирует:
- `messages: ChatMessage[]` — инициализируется из `loadHistory()` + приветственное сообщение если история пуста
- `sendMessage(text: string): Promise<void>` — добавляет user-сообщение, вызывает `aiApi.chat`, добавляет ответ, сохраняет в localStorage
- `loading: boolean`
- `clearHistory(): void` — очищает messages и localStorage

### `ui/AiAssistantPanel.tsx`

Точное воспроизведение прототипа (`index.html`, Screen 12):
- Фиксированная панель: `position: fixed`, `right: 0`, `top: 0`, `bottom: 0`, `width: 480px`
- Header: аватар (bot-иконка), «AI-помощник BOXR», зелёная точка онлайн
- Suggestion-чипсы (показываются только при пустой истории, зависят от `user.role`):
  - `organizer`: «Как провести жеребьёвку?», «Что такое рассеивание в сетке?», «Какие документы нужны от боксёра?»
  - `trainer`: «Срок действия мед. справки», «Требования МРТ по IBA», «Документы для иностранца»
  - `judge`: «Сколько нокдаунов до остановки?», «Что такое RSC?», «Правила предупреждений»
- Область сообщений: user-сообщения справа (тёмный пузырь), assistant-сообщения слева (текст с левой полосой)
- Индикатор загрузки: три анимированные точки (как в прототипе)
- Input: `textarea` + кнопка отправки; Enter — отправить, Shift+Enter — перенос
- Анимация входа: `slideInRight 0.4s`

### `ui/AiFloatingButton.tsx`

- `position: fixed`, `bottom: 32px`, `right: 32px`, `z-index: 400`
- Pill-кнопка: bot-иконка + «AI-помощник»
- Hover: `translateY(-2px)`

### Интеграция в приложение

В `app/router/AppRouter.tsx` (или провайдерах) добавить глобальный оверлей:

```tsx
// Состояние aiOpen на уровне AppRouter
{aiOpen && (
  <>
    <div onClick={() => setAiOpen(false)} style={{ /* backdrop */ }} />
    <AiAssistantPanel onClose={() => setAiOpen(false)} />
  </>
)}
{isAuthenticated && !aiOpen && (
  <AiFloatingButton onClick={() => setAiOpen(true)} />
)}
```

- Сайдбар: добавить пункт `{ id: 'ai', icon: 'bot', label: 'AI-помощник', badge: 'new' }` — клик открывает панель
- Топбар: кнопка «AI-помощник» — клик открывает панель

### Тесты (`useAiChat.test.ts`)

- Инициализация: при пустом localStorage — messages содержит только приветственное сообщение
- Инициализация: при наличии истории в localStorage — messages восстанавливаются
- `sendMessage`: user-сообщение добавляется немедленно, `loading` выставляется в `true`, после ответа добавляется assistant-сообщение
- `sendMessage`: history сохраняется в localStorage после каждого ответа
- `sendMessage`: при ошибке API добавляется сообщение об ошибке, `loading` снимается
- `clearHistory`: очищает messages и localStorage

---

## Data flow

```
Пользователь вводит текст
  → useAiChat.sendMessage()
    → добавляет { role: 'user', content } в messages
    → aiApi.chat(messages) → POST /api/v1/ai/chat
      → AiController → AiService
        → anthropic.messages.create(systemPrompt, messages)
        → возвращает { content }
    → добавляет { role: 'assistant', content } в messages
    → saveHistory(messages)
```

---

## Что не входит в scope

- Стриминг (SSE / WebSocket)
- Хранение истории в БД
- Голосовой ввод (кнопка микрофона не реализуется, только в дизайне прототипа)
- Контекстные данные из БД (турниры, боксёры и т.д.)
