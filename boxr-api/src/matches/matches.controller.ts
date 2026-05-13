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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { AssignJudgeDto } from './dto/assign-judge.dto';
import { SetMatchResultDto } from './dto/set-result.dto';
import { SetMatchScheduleDto } from './dto/set-schedule.dto';
import { MatchesService } from './matches.service';

@Controller()
export class MatchesController {
  constructor(private readonly service: MatchesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Post('tournaments/:id/bracket')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.generateBracket(user.id, tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Get('tournaments/:id/bracket')
  getBracketOwner(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.getBracketForOwner(user.id, tournamentId);
  }

  @Get('tournaments/public/:id/bracket')
  getBracketPublic(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.service.getPublicBracket(tournamentId);
  }

  @Get('tournaments/public/:id/results')
  getResultsPublic(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.service.getPublicResults(tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.JUDGE)
  @Get('matches/:matchId')
  getMatchForScoring(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
  ) {
    return this.service.getMatchForScoring(user, matchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.JUDGE)
  @Patch('matches/:matchId')
  setResult(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Body() dto: SetMatchResultDto,
  ) {
    return this.service.setResult(user, matchId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Delete('matches/:matchId/result')
  @HttpCode(HttpStatus.OK)
  clearResult(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
  ) {
    return this.service.clearResult(user.id, matchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Post('tournaments/:id/schedule')
  @HttpCode(HttpStatus.OK)
  generateSchedule(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.generateSchedule(user.id, tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Delete('tournaments/:id/schedule')
  @HttpCode(HttpStatus.OK)
  clearSchedule(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.clearSchedule(user.id, tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Patch('matches/:matchId/schedule')
  setMatchSchedule(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Body() dto: SetMatchScheduleDto,
  ) {
    return this.service.setSchedule(user.id, matchId, dto.scheduledAt, dto.ring);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Patch('tournaments/:id/matches/:matchId/assign-judge')
  assignJudge(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Body() dto: AssignJudgeDto,
  ) {
    return this.service.assignJudge(user.id, tournamentId, matchId, dto.judgeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JUDGE)
  @Get('judge/matches')
  getMyMatches(@CurrentUser() user: AuthUser) {
    return this.service.getMatchesForJudge(user.id);
  }
}
