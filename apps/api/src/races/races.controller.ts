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
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { RacesService } from './races.service';
import {
  CreateRaceDto,
  CreateRaceEntryDto,
  ListRaceEntriesQueryDto,
  ListRacesQueryDto,
  UpdateRaceDto,
  UpdateRaceEntryDto,
} from './dto/races.dto';

@ApiTags('races')
@ApiBearerAuth()
@Controller('races')
export class RacesController {
  constructor(private readonly races: RacesService) {}

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateRaceDto) {
    return this.races.create(dto);
  }

  @Get()
  list(@Query() q: ListRacesQueryDto) {
    return this.races.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.races.get(id);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRaceDto) {
    return this.races.update(id, dto);
  }

  @Post(':id/entries')
  @Roles(Role.MANAGER, Role.TRAINER)
  addEntry(
    @Param('id', ParseUUIDPipe) raceId: string,
    @Body() dto: CreateRaceEntryDto,
  ) {
    return this.races.addEntry(raceId, dto);
  }
}

@ApiTags('races')
@ApiBearerAuth()
@Controller('horses/:id/race-entries')
@UseGuards(HorseOwnershipGuard)
export class HorseRaceEntriesController {
  constructor(private readonly races: RacesService) {}

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListRaceEntriesQueryDto,
  ) {
    return this.races.listByHorse(horseId, q);
  }
}

@ApiTags('races')
@ApiBearerAuth()
@Controller('race-entries')
export class RaceEntriesController {
  constructor(private readonly races: RacesService) {}

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRaceEntryDto,
  ) {
    return this.races.updateEntry(id, dto);
  }
}
