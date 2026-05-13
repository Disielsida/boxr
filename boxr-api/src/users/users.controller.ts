import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;
}

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('judges')
  listJudges() {
    return this.service.listJudges();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  listAll(@Query('search') search?: string) {
    return this.service.listAll(search);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/role')
  async updateRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const user = await this.service.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    await this.service.updateRole(id, dto.role);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.service.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    await this.service.deleteUser(id);
    return { ok: true };
  }
}
