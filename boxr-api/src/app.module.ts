import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AiModule } from './ai/ai.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { BoxersModule } from './boxers/boxers.module';
import { MatchesModule } from './matches/matches.module';
import { PrismaModule } from './prisma/prisma.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_TTL: Joi.string().default('15m'),
        JWT_REFRESH_TTL: Joi.string().default('30d'),
        BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),
        PORT: Joi.number().port().default(3000),
        CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
        GEMINI_API_KEY: Joi.string().required(),
        AI_MODEL: Joi.string().default('gemini-2.5-flash'),
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TournamentsModule,
    BoxersModule,
    ApplicationsModule,
    MatchesModule,
    AiModule,
  ],
})
export class AppModule {}
