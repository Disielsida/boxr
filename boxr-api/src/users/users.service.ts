import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data: input });
  }

  listJudges(): Promise<{ id: string; fullName: string; email: string }[]> {
    return this.prisma.user.findMany({
      where: { role: Role.JUDGE },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
  }

  listAll(search?: string): Promise<{ id: string; fullName: string; email: string; role: Role; createdAt: Date }[]> {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: string, role: Role): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { role } });
  }

  async deleteUser(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.application.deleteMany({ where: { trainerId: id } }),
      this.prisma.boxer.deleteMany({ where: { trainerId: id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }
}
