import { IsInt, IsISO8601, Min } from 'class-validator';

export class SetMatchScheduleDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsInt()
  @Min(1)
  ring!: number;
}
