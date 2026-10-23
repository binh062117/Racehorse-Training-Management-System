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
  INCIDENT_PHOTO_KIND,
  SAFE_FILENAME,
  buildImageMemoryMulterOptions,
} from '../files/upload';
import { IncidentsService } from './incidents.service';
import {
  CreateIncidentDto,
  ListIncidentsQueryDto,
  UpdateIncidentDto,
} from './dto/incidents.dto';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('horses/:id/incidents')
@UseGuards(HorseOwnershipGuard)
export class HorseIncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @Roles(Role.GROOM)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidents.create(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListIncidentsQueryDto,
  ) {
    return this.incidents.listByHorse(horseId, q);
  }
}

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.incidents.get(id, user);
  }

  @Patch(':id')
  @Roles(Role.VET)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(id, dto);
  }

  @Post(':id/photo')
  @Roles(Role.GROOM)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', buildImageMemoryMulterOptions()))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException('VALIDATION_ERROR', 'A "file" field is required');
    }
    return this.incidents.savePhoto(id, file);
  }
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class IncidentFilesController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly storage: FileStorageService,
  ) {}

  @Get('incident-photos/:filename')
  async photo(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    if (!SAFE_FILENAME.test(filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    if (!this.storage.exists(INCIDENT_PHOTO_KIND, filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    await this.incidents.findForPhoto(
      `${INCIDENT_PHOTO_KIND}/${filename}`,
      user,
    );
    res.sendFile(this.storage.absolutePath(INCIDENT_PHOTO_KIND, filename));
  }
}
