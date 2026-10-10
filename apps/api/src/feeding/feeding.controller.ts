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
import { FeedingService } from './feeding.service';
import {
  CreateFeedingRecordDto,
  ListFeedingRecordsQueryDto,
} from './dto/feeding.dto';

@ApiTags('feeding')
@ApiBearerAuth()
@Controller('horses/:id/feeding-records')
@UseGuards(HorseOwnershipGuard)
export class HorseFeedingRecordsController {
  constructor(private readonly feeding: FeedingService) {}

  @Post()
  @Roles(Role.GROOM)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateFeedingRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feeding.create(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListFeedingRecordsQueryDto,
  ) {
    return this.feeding.listByHorse(horseId, q);
  }
}
