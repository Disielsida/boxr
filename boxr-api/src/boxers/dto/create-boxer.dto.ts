import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BoxerRank, Gender } from '@prisma/client';

export class CreateBoxerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsDateString({ strict: true })
  dob!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsNumber()
  @Min(0.1)
  @Max(200)
  weight!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  club?: string;

  @IsOptional()
  @IsEnum(BoxerRank)
  rank?: BoxerRank;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'passportSeries: 4 цифры' })
  passportSeries?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'passportNumber: 6 цифр' })
  passportNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  passportIssuedBy?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  passportIssuedAt?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}-\d{3}$/, { message: 'passportDivisionCode: формат xxx-xxx' })
  passportDivisionCode?: string;
}
