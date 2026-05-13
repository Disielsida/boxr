import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { MatchOutcome, MatchSlot } from '@prisma/client';

export class SetMatchResultDto {
  @IsIn(['RED', 'BLUE'])
  winner!: MatchSlot;

  @IsIn(['KO', 'WP', 'RSC', 'DSQ', 'WO'])
  outcome!: MatchOutcome;

  @IsOptional()
  @IsInt()
  @Min(1)
  endRound?: number;
}
