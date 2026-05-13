import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { ApplicationsService } from './applications.service';
import {
  ListForTournamentDto,
  ListMineApplicationsDto,
} from './dto/list-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { SubmitApplicationsDto } from './dto/submit-applications.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // TRAINER

  @Roles(Role.TRAINER)
  @Post('applications')
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitApplicationsDto) {
    return this.service.submit(user.id, dto);
  }

  @Roles(Role.TRAINER)
  @Get('applications/mine')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMineApplicationsDto,
  ) {
    return this.service.listMine(user.id, query);
  }

  @Roles(Role.TRAINER)
  @Post('applications/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.withdraw(user.id, id);
  }

  @Roles(Role.TRAINER)
  @Delete('applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }

  // ORGANIZER

  @Roles(Role.ORGANIZER)
  @Get('tournaments/:id/applications')
  listForTournament(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: ListForTournamentDto,
  ) {
    return this.service.listForTournament(user.id, tournamentId, query);
  }

  @Roles(Role.ORGANIZER)
  @Post('applications/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.approve(user.id, id);
  }

  @Roles(Role.ORGANIZER)
  @Post('applications/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.service.reject(user.id, id, dto);
  }
}
