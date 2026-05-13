import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
