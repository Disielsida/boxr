import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { BoxersService } from './boxers.service';
import { CreateBoxerDto } from './dto/create-boxer.dto';
import { ListBoxersDto } from './dto/list-boxers.dto';
import { UpdateBoxerDto } from './dto/update-boxer.dto';
import { PassportOcrService } from './passport-ocr.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER)
@Controller('boxers')
export class BoxersController {
  constructor(
    private readonly service: BoxersService,
    private readonly ocr: PassportOcrService,
  ) {}

  @Post('ocr-passport')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  ocrPassport(@UploadedFile() file: Express.Multer.File) {
    return this.ocr.recognize(file.buffer, file.mimetype);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBoxersDto) {
    return this.service.list(user.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findMine(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoxerDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBoxerDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }
}
