import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignJudgeDto {
  @IsNotEmpty()
  @IsUUID()
  judgeId!: string;
}
