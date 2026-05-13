import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @Matches(/[A-Za-zА-Яа-яЁё]/, { message: 'Пароль должен содержать хотя бы одну букву' })
  @Matches(/\d/, { message: 'Пароль должен содержать хотя бы одну цифру' })
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum([Role.ORGANIZER, Role.TRAINER, Role.JUDGE], { message: 'Роль должна быть ORGANIZER, TRAINER или JUDGE' })
  role!: Role;
}
