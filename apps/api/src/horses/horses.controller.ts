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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { AppException } from '../common/app-exception';
import { HorsesService } from './horses.service';
import {
  CreateHorseDto,
  ListHorsesQueryDto,
  LockHorseDto,
  UpdateHorseDto,
} from './dto/horses.dto';
import { HORSE_PHOTO_KIND } from '../files/upload';

@ApiTags('horses')
@ApiBearerAuth()
@Controller('horses')
export class HorsesController {
  constructor(private readonly horses: HorsesService) {}

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateHorseDto) {
    return this.horses.create(dto);
  }

  @Get()
  list(@Query() q: ListHorsesQueryDto, @CurrentUser() user: AuthUser) {
    return this.horses.list(q, user);
  }

  @Get(':id')
  @UseGuards(HorseOwnershipGuard)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.horses.get(id);
  }

  @Get(':id/pedigree')
  @UseGuards(HorseOwnershipGuard)
  pedigree(@Param('id', ParseUUIDPipe) id: string) {
    return this.horses.pedigree(id);
  }

  @Post(':id/ai-insight')
  @Roles(Role.VET, Role.MANAGER)
  @UseGuards(HorseOwnershipGuard)
  aiInsight(@Param('id', ParseUUIDPipe) id: string) {
    return this.horses.aiInsight(id);
  }

  @Post(':id/feeding-suggestion')
  @Roles(Role.VET, Role.MANAGER, Role.GROOM)
  @UseGuards(HorseOwnershipGuard)
  feedingSuggestion(@Param('id', ParseUUIDPipe) id: string) {
    return this.horses.feedingSuggestion(id);
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHorseDto) {
    return this.horses.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.horses.remove(id);
  }

  @Patch(':id/lock')
  @Roles(Role.VET)
  @UseGuards(HorseOwnershipGuard)
  lock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LockHorseDto) {
    return this.horses.lock(id, dto);
  }

  @Post(':id/photo')
  @Roles(Role.MANAGER)
  @UseGuards(HorseOwnershipGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException('VALIDATION_ERROR', 'A "file" field is required');
    }
    return this.horses.setPhoto(id, `${HORSE_PHOTO_KIND}/${file.filename}`);
  }
}
