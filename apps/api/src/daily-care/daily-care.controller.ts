import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { DailyCareService } from './daily-care.service';
import {
  CreateDailyCareDto,
  GenerateDailyChecklistDto,
  ListDailyCareQueryDto,
  UpdateDailyCareDto,
} from './dto/daily-care.dto';

@ApiTags('daily-care')
@ApiBearerAuth()
@Controller('daily-care')
export class DailyCareController {
  constructor(private readonly dailyCare: DailyCareService) {}

  @ApiOperation({ summary: 'Lấy danh sách công việc chăm sóc hàng ngày' })
  @Get()
  list(
    @Query() q: ListDailyCareQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dailyCare.list(q, user);
  }

  @ApiOperation({ summary: 'Tạo công việc chăm sóc thủ công' })
  @Post()
  @Roles(Role.GROOM, Role.MANAGER)
  create(
    @Body() dto: CreateDailyCareDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dailyCare.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Khởi tạo checklist chăm sóc ngày hôm nay' })
  @Post('generate')
  @Roles(Role.GROOM, Role.MANAGER)
  generate(
    @Body() dto: GenerateDailyChecklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dailyCare.generateChecklist(dto, user.id);
  }

  @ApiOperation({ summary: 'Bật/tắt trạng thái hoàn thành công việc' })
  @Patch(':id/toggle')
  @Roles(Role.GROOM, Role.MANAGER, Role.TRAINER)
  toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dailyCare.toggle(id, user);
  }

  @ApiOperation({ summary: 'Cập nhật ghi chú hoặc trạng thái công việc' })
  @Patch(':id')
  @Roles(Role.GROOM, Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDailyCareDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dailyCare.update(id, dto, user);
  }
}
