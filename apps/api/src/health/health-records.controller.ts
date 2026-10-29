import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { AppException } from '../common/app-exception';
import { FileStorageService } from '../files/file-storage.service';
import {
  HEALTH_ATTACHMENT_KIND,
  SAFE_ATTACHMENT_FILENAME,
  buildAttachmentMemoryMulterOptions,
} from '../files/upload';
import { HealthRecordsService } from './health-records.service';
import {
  CreateHealthRecordDto,
  ListHealthRecordsQueryDto,
  UpdateHealthRecordDto,
} from './dto/health.dto';

@ApiTags('health')
@ApiBearerAuth()
@Controller('horses/:id/health-records')
@UseGuards(HorseOwnershipGuard)
export class HorseHealthRecordsController {
  constructor(private readonly health: HealthRecordsService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateHealthRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.health.create(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListHealthRecordsQueryDto,
  ) {
    return this.health.listByHorse(horseId, q);
  }
}

@ApiTags('health')
@ApiBearerAuth()
@Controller('health-records')
export class HealthRecordsController {
  constructor(private readonly health: HealthRecordsService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.health.get(id, user);
  }

  @Patch(':id')
  @Roles(Role.VET)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHealthRecordDto,
  ) {
    return this.health.update(id, dto);
  }

  @Post(':id/attachment')
  @Roles(Role.VET)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', buildAttachmentMemoryMulterOptions()),
  )
  uploadAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException('VALIDATION_ERROR', 'A "file" field is required');
    }
    return this.health.saveAttachment(id, file);
  }
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class HealthFilesController {
  constructor(
    private readonly health: HealthRecordsService,
    private readonly storage: FileStorageService,
  ) {}

  @Get('health-attachments/:filename')
  async attachment(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    if (!SAFE_ATTACHMENT_FILENAME.test(filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    if (!this.storage.exists(HEALTH_ATTACHMENT_KIND, filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    await this.health.findForAttachment(
      `${HEALTH_ATTACHMENT_KIND}/${filename}`,
      user,
    );
    res.sendFile(this.storage.absolutePath(HEALTH_ATTACHMENT_KIND, filename));
  }
}
