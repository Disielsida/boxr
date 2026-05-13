import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SubmitApplicationItemDto {
  @IsUUID()
  boxerId!: string;

  @IsOptional()
  @IsNumber()
  category?: number;
}

export class SubmitApplicationsDto {
  @IsString()
  @IsUUID()
  tournamentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitApplicationItemDto)
  items!: SubmitApplicationItemDto[];
}
