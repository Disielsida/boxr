import { PartialType } from '@nestjs/mapped-types';
import { CreateBoxerDto } from './create-boxer.dto';

export class UpdateBoxerDto extends PartialType(CreateBoxerDto) {}
