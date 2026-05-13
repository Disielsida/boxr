import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface IssueTokensMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Date;
}

const INVALID_CREDENTIALS = 'Неверный email или пароль';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: IssueTokensMeta = {}): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }
    const rounds = parseInt(this.config.getOrThrow<string>('BCRYPT_ROUNDS'), 10);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });
    const tokens = await this.issueTokens(user, meta);
    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: IssueTokensMeta = {}): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    // Проверяем пароль ВСЕГДА, даже если юзера нет — чтобы не выдать существование
    // email через разницу во времени ответа.
    const fakeHash = '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? fakeHash);
    if (!user || !ok) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const tokens = await this.issueTokens(user, meta);
    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(plaintext: string, meta: IssueTokensMeta = {}): Promise<AuthResult> {
    const tokenHash = hashToken(plaintext);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) {
      throw new UnauthorizedException('Refresh-токен не найден');
    }

    // Если токен уже отозван — это попытка переиспользования.
    // Считаем сессию скомпрометированной и сносим все refresh пользователя.
    if (record.revokedAt) {
      this.logger.warn(`Повторное использование refresh-токена пользователя ${record.userId}`);
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh-токен скомпрометирован');
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh-токен просрочен');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(record.user, meta);
    return { user: toPublicUser(record.user), ...tokens };
  }

  async logout(plaintext: string): Promise<void> {
    const tokenHash = hashToken(plaintext);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }

  private async issueTokens(
    user: User,
    meta: IssueTokensMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'),
      },
    );

    const refreshToken = `${randomUUID()}.${randomBytes(24).toString('hex')}`;
    const ttl = this.config.getOrThrow<string>('JWT_REFRESH_TTL');
    const expiresAt = new Date(Date.now() + parseDurationMs(ttl));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken };
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

// Парсит '15m', '30d', '12h', '3600s', либо число миллисекунд.
function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(input.trim());
  if (!match) {
    const asNumber = Number(input);
    if (Number.isFinite(asNumber)) return asNumber;
    throw new Error(`Некорректный формат длительности: ${input}`);
  }
  const value = parseInt(match[1], 10);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}
