import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { StallsService } from './stalls.service';
import {
  ApproveStallStatusDto,
  CreateStallDto,
  RequestStallStatusDto,
  UpdateStallDto,
} from './dto/stalls.dto';

@Controller('stalls')
export class StallsController {
  constructor(private readonly stallsService: StallsService) {}

  /**
   * Lấy danh sách chuồng trại.
   * Phân quyền tích hợp: OWNER chỉ thấy thông tin ngựa của mình.
   */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.stallsService.listStalls(user);
  }

  /**
   * Gợi ý mã chuồng tiếp theo theo dãy (A-11, B-11...)
   */
  @Get('next-code')
  @Roles(Role.MANAGER)
  getNextCode(@Query('barn') barn: string) {
    return this.stallsService.getNextCode(barn);
  }

  /**
   * Thêm ô chuồng mới (Chỉ Manager)
   */
  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateStallDto) {
    return this.stallsService.createStall(dto);
  }

  /**
   * Cập nhật thông tin ô chuồng
   */
  @Patch(':id')
  @Roles(Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateStallDto) {
    return this.stallsService.updateStall(id, dto);
  }

  /**
   * Xóa ô chuồng (Kiểm tra có ngựa thì cấm xóa)
   */
  @Delete(':id')
  @Roles(Role.MANAGER)
  delete(@Param('id') id: string) {
    return this.stallsService.deleteStall(id);
  }

  /**
   * Yêu cầu chuyển trạng thái ô chuồng (Manager, Vet, Groom)
   */
  @Post(':id/request-status')
  @Roles(Role.MANAGER, Role.VET, Role.GROOM)
  requestStatus(
    @Param('id') id: string,
    @Body() dto: RequestStallStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stallsService.requestStatus(id, dto, user);
  }

  /**
   * Phê duyệt trạng thái (VET hoặc GROOM)
   */
  @Post(':id/approve-status')
  @Roles(Role.VET, Role.GROOM)
  approveStatus(
    @Param('id') id: string,
    @Body() dto: ApproveStallStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stallsService.approveStatus(id, dto, user);
  }

  /**
   * Xếp hoặc dọn chuồng cho ngựa (Kiểm tra double-booking và an toàn sinh học)
   */
  @Patch('horses/:horseId/assign')
  @Roles(Role.MANAGER, Role.TRAINER, Role.GROOM)
  assignHorse(
    @Param('horseId') horseId: string,
    @Body('stallCode') stallCode: string | null,
  ) {
    return this.stallsService.assignHorseToStall(horseId, stallCode);
  }
}
