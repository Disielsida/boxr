import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AiService } from './ai.service';

const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    mockSendMessage.mockReset();
    mockStartChat.mockClear();
    mockGetGenerativeModel.mockClear();
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'GEMINI_API_KEY') return 'test-key';
              if (key === 'AI_MODEL') return 'gemini-2.0-flash';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AiService);
  });

  it('возвращает content из ответа Gemini', async () => {
    mockSendMessage.mockResolvedValueOnce({
      response: { text: () => 'Ответ ассистента' },
    });

    const result = await service.chat(
      [{ role: 'user', content: 'Привет' }],
      Role.ORGANIZER,
    );

    expect(result).toEqual({ content: 'Ответ ассистента' });
  });

  it('передаёт историю в startChat, последнее сообщение — в sendMessage', async () => {
    mockSendMessage.mockResolvedValueOnce({
      response: { text: () => 'ok' },
    });

    await service.chat(
      [
        { role: 'user', content: 'Первый вопрос' },
        { role: 'assistant', content: 'Первый ответ' },
        { role: 'user', content: 'Второй вопрос' },
      ],
      Role.JUDGE,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { history } = (mockStartChat.mock.calls[0] as any[])[0];
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ role: 'model', parts: [{ text: 'Первый ответ' }] });
    expect(mockSendMessage).toHaveBeenCalledWith('Второй вопрос');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { systemInstruction } = (mockGetGenerativeModel.mock.calls[0] as any[])[0];
    expect(systemInstruction).toContain('судья');
  });

  it('пробрасывает ошибку SDK', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('API недоступен'));

    await expect(
      service.chat([{ role: 'user', content: 'Привет' }], Role.TRAINER),
    ).rejects.toThrow('AI сервис временно недоступен');
  });
});
