import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface PassportOcrResult {
  fullName?: string;
  dob?: string;             // ISO date YYYY-MM-DD
  passportSeries?: string;  // 4 digits
  passportNumber?: string;  // 6 digits
  passportIssuedBy?: string;
  passportIssuedAt?: string; // ISO date YYYY-MM-DD
  passportDivisionCode?: string; // xxx-xxx
  gender?: 'MALE' | 'FEMALE';
}

const PROMPT = `Ты — система распознавания российских паспортов. На изображении разворот паспорта РФ (страницы 2-3 с основными данными).

Извлеки следующие данные и верни их СТРОГО в формате JSON без markdown-блоков:
{
  "fullName": "Фамилия Имя Отчество полностью (строка)",
  "dob": "дата рождения в формате YYYY-MM-DD",
  "gender": "MALE или FEMALE",
  "passportSeries": "4 цифры серии",
  "passportNumber": "6 цифр номера",
  "passportIssuedBy": "наименование органа, выдавшего паспорт",
  "passportIssuedAt": "дата выдачи в формате YYYY-MM-DD",
  "passportDivisionCode": "код подразделения в формате xxx-xxx"
}

Правила:
- Если поле не удаётся распознать — не включай его в ответ (не пиши null или пустую строку).
- Серия и номер паспорта часто указаны в верхнем правом углу разворота. Серия — первые 4 цифры, номер — следующие 6.
- Пол: «МУЖ» → MALE, «ЖЕН» → FEMALE.
- Дату выдачи и дату рождения переводи в ISO 8601 (YYYY-MM-DD).
- ФИО пиши в нормальном регистре (не все заглавные).
- Верни ТОЛЬКО валидный JSON, никакого текста вокруг.`;

@Injectable()
export class PassportOcrService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(config.get<string>('GEMINI_API_KEY') ?? '');
    this.modelName = config.get<string>('AI_MODEL') ?? 'gemini-2.5-flash';
  }

  async recognize(imageBuffer: Buffer, mimeType: string): Promise<PassportOcrResult> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException('Поддерживаются форматы: JPEG, PNG, WEBP, HEIC');
    }

    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    let raw: string;
    try {
      const result = await model.generateContent([
        PROMPT,
        {
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ]);
      raw = result.response.text().trim();
    } catch (e) {
      throw new InternalServerErrorException('Ошибка при обращении к AI: ' + String(e));
    }

    // strip possible ```json fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed: PassportOcrResult;
    try {
      parsed = JSON.parse(cleaned) as PassportOcrResult;
    } catch {
      throw new InternalServerErrorException('Не удалось распознать паспорт — попробуйте другое фото');
    }

    return parsed;
  }
}
