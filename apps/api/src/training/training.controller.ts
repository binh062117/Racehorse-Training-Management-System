import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { TrainingService } from './training.service';
import {
  CreateSessionDto,
  CreateTrainingPlanDto,
  ListSessionsQueryDto,
  ListTrainingPlansQueryDto,
  UpdateSessionDto,
  UpdateTrainingPlanDto,
} from './dto/training.dto';

@ApiTags('training')
@ApiBearerAuth()
@Controller('horses/:id/sessions')
@UseGuards(HorseOwnershipGuard)
export class HorseSessionsController {
  constructor(private readonly training: TrainingService) {}

  @Post()
  @Roles(Role.TRAINER)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.training.create(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListSessionsQueryDto,
  ) {
    return this.training.listByHorse(horseId, q);
  }
}

@ApiTags('training')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly training: TrainingService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.training.get(id, user);
  }

  @Patch(':id')
  @Roles(Role.TRAINER, Role.GROOM)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.training.update(id, dto, user);
  }
}

@ApiTags('training')
@ApiBearerAuth()
@Controller('horses/:id/training-plans')
@UseGuards(HorseOwnershipGuard)
export class HorseTrainingPlansController {
  constructor(private readonly training: TrainingService) {}

  @Post()
  @Roles(Role.TRAINER)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateTrainingPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.training.createPlan(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListTrainingPlansQueryDto,
  ) {
    return this.training.listPlansByHorse(horseId, q);
  }
}

@ApiTags('training')
@ApiBearerAuth()
@Controller('training-plans')
export class TrainingPlansController {
  constructor(private readonly training: TrainingService) {}

  @Get()
  list(@Query() q: ListTrainingPlansQueryDto, @CurrentUser() user: AuthUser) {
    return this.training.listAllPlans(q, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.training.getPlan(id, user);
  }

  @Patch(':id')
  @Roles(Role.TRAINER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrainingPlanDto,
  ) {
    return this.training.updatePlan(id, dto);
  }
}
