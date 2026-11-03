import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { AppException } from '../common/app-exception';
import { VaccinationsService } from './vaccinations.service';
import {
  CreateVaccinationDto,
  ListUpcomingVaccinationsQueryDto,
  ListVaccinationsQueryDto,
} from './dto/vaccinations.dto';

@ApiTags('vaccinations')
@ApiBearerAuth()
@Controller('horses/:id/vaccinations')
@UseGuards(HorseOwnershipGuard)
export class HorseVaccinationsController {
  constructor(private readonly vaccinations: VaccinationsService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateVaccinationDto,
  ) {
    return this.vaccinations.create(horseId, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListVaccinationsQueryDto,
  ) {
    return this.vaccinations.listByHorse(horseId, q);
  }
}

@ApiTags('vaccinations')
@ApiBearerAuth()
@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinations: VaccinationsService) {}

  @Get()
  list(
    @Query() q: ListUpcomingVaccinationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Club-wide view (UC-18) — no per-horse ownership filter exists for it,
    // so OWNER is blocked outright rather than silently scoped/empty.
    if (user.role === Role.OWNER) {
      throw new AppException(
        'FORBIDDEN',
        'Use GET /horses/:id/vaccinations to see your own horses',
      );
    }
    return this.vaccinations.listUpcoming(q);
  }

  @Post('check-due')
  @Roles(Role.VET, Role.MANAGER)
  checkDue() {
    return this.vaccinations.checkDueAndNotify();
  }
}
