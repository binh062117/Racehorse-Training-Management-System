import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/audit.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Roles(Role.MANAGER)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @ApiOperation({ summary: 'Lấy thống kê hoạt động nhật ký hệ thống' })
  @Get('stats')
  stats() {
    return this.audit.getStats();
  }

  @ApiOperation({ summary: 'Truy vấn danh sách nhật ký thao tác (Audit Log)' })
  @Get()
  list(@Query() q: ListAuditLogsQueryDto) {
    return this.audit.list(q);
  }

  @ApiOperation({ summary: 'Xem chi tiết một bản ghi nhật ký' })
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(id);
  }
}
