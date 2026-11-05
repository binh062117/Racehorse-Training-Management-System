import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SuppliesService } from './supplies.service';
import {
  CreateSupplyItemDto,
  CreateSupplyRequestDto,
  ListSupplyItemsQueryDto,
  ListSupplyRequestsQueryDto,
  ReviewSupplyRequestDto,
  UpdateSupplyItemDto,
} from './dto/supplies.dto';

@ApiTags('supplies')
@ApiBearerAuth()
@Controller('supplies')
export class SuppliesController {
  constructor(private readonly supplies: SuppliesService) {}

  // Stable staff all see stock; owners have no business with it.
  @Get()
  @Roles(Role.MANAGER, Role.GROOM, Role.VET, Role.TRAINER)
  list(@Query() q: ListSupplyItemsQueryDto) {
    return this.supplies.listItems(q);
  }

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateSupplyItemDto) {
    return this.supplies.createItem(dto);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplyItemDto,
  ) {
    return this.supplies.updateItem(id, dto);
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supplies.removeItem(id);
  }
}

@ApiTags('supplies')
@ApiBearerAuth()
@Controller('supply-requests')
export class SupplyRequestsController {
  constructor(private readonly supplies: SuppliesService) {}

  @Get()
  @Roles(Role.MANAGER, Role.GROOM)
  list(@Query() q: ListSupplyRequestsQueryDto, @CurrentUser() user: AuthUser) {
    return this.supplies.listRequests(q, user);
  }

  @Post()
  @Roles(Role.GROOM)
  create(@Body() dto: CreateSupplyRequestDto, @CurrentUser() user: AuthUser) {
    return this.supplies.createRequest(dto, user);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSupplyRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.supplies.reviewRequest(id, dto, user);
  }
}
