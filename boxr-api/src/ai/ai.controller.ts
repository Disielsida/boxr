import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { AuthUser } from '../common/types/auth-user';
import { AiService } from './ai.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@UseGuards(OptionalJwtGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('chat')
  chat(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.service.chat(dto.messages, user?.role ?? Role.ORGANIZER);
  }
}
