import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HorsesModule } from './horses/horses.module';
import { TrainingModule } from './training/training.module';
import { HealthRecordsModule } from './health/health-records.module';
import { RacesModule } from './races/races.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IncidentsModule } from './incidents/incidents.module';
import { InjuriesModule } from './injuries/injuries.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';
import { FeedingModule } from './feeding/feeding.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    HorsesModule,
    TrainingModule,
    HealthRecordsModule,
    RacesModule,
    NotificationsModule,
    IncidentsModule,
    InjuriesModule,
    VaccinationsModule,
    FeedingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
