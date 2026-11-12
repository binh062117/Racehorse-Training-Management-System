import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { AppException } from '../common/app-exception';
import { FileStorageService } from '../files/file-storage.service';
import {
  MEDIA_MIME,
  ReportsService,
  TRAINING_MEDIA_KIND,
} from './reports.service';
import { CreateExpenseDto, FinanceReportQueryDto } from './dto/reports.dto';

const MEDIA_MAX_MB = 50;
const mediaUpload = {
  storage: memoryStorage(),
  limits: { fileSize: MEDIA_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (e: Error | null, ok: boolean) => void,
  ) => {
    if (!MEDIA_MIME[file.mimetype]) {
      cb(
        new AppException(
          'VALIDATION_ERROR',
          'Chỉ nhận ảnh JPEG/PNG/WebP hoặc video MP4/WebM/MOV.',
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class FinanceReportsController {
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

@ApiTags('reports')
@ApiBearerAuth()
@Controller('horses/:id')
@UseGuards(HorseOwnershipGuard)
export class HorseReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Photos / videos of training — trainers and grooms upload, everyone allowed to see the horse can look. */
  @Post('media')
  @Roles(Role.TRAINER, Role.GROOM)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', mediaUpload))
  addMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { caption?: string; sessionId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!file)
      throw new AppException('VALIDATION_ERROR', 'A "file" field is required');
    return this.reports.addMedia(id, file, body, user);
  }

  @Get('media')
  listMedia(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.listMedia(id);
  }

  /** The owner's monthly report for one horse (?month=YYYY-MM, default this month). */
  @Get('report')
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month?: string,
  ) {
    return this.reports.horseReport(id, month);
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: FileStorageService,
  ) {}

  @Delete('media/:id')
  @Roles(Role.TRAINER, Role.GROOM, Role.MANAGER)
  removeMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.removeMedia(id, user);
  }

  /** What is waiting for the signed-in user today (dashboard to-do list). */
  @Get('me/tasks')
  tasks(@CurrentUser() user: AuthUser) {
    return this.reports.tasks(user);
  }

  /** Local-disk fallback when Cloudinary isn't configured (dev only). */
  @Get(`files/${TRAINING_MEDIA_KIND}/:filename`)
  async mediaFile(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (
      !/^[a-zA-Z0-9_-]+\.(jpg|png|webp|mp4|webm|mov)$/.test(filename) ||
      !this.storage.exists(TRAINING_MEDIA_KIND, filename)
    ) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    await this.reports.findMediaFile(filename, user);
    res.sendFile(this.storage.absolutePath(TRAINING_MEDIA_KIND, filename));
  }
}
