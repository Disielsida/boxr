import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TournamentLevel, TournamentType } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsEnum(TournamentType)
  type!: TournamentType;

  @IsEnum(TournamentLevel)
  level!: TournamentLevel;

  @IsDateString({ strict: true })
  dateStart!: string;

  @IsDateString({ strict: true })
  dateEnd!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  categories!: number[];

  @IsInt()
  @Min(1)
  @Max(12)
  rounds!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  roundDuration!: number;

  @IsBoolean()
  helmets!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  ringCount?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dayStartTime должен быть в формате HH:MM' })
  dayStartTime?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minRestMinutes?: number;
}
