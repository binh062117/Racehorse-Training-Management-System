import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateExpenseDto, FinanceReportQueryDto } from './dto/reports.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('finances')
  @Roles(Role.MANAGER, Role.OWNER)
  getFinances(
    @Query() q: FinanceReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.getFinanceReport(q, user);
  }
  @Post('expenses')
  @Roles(Role.MANAGER)
  createExpense(@Body() dto: CreateExpenseDto) {
    return this.reports.createExpense(dto);
  }
}
