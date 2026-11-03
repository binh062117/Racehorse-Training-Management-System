import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, unlink, writeFileSync } from 'fs';
import { join } from 'path';
import {
  HEALTH_ATTACHMENT_KIND,
  HORSE_PHOTO_KIND,
  INCIDENT_PHOTO_KIND,
  uploadKindDir,
} from './upload';

/**
 * Filesystem-only helper for local uploads. Knows nothing about domain models;
 * ownership checks live in the controller that serves a given kind.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger('Files');

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    for (const kind of [
      HORSE_PHOTO_KIND,
      HEALTH_ATTACHMENT_KIND,
      INCIDENT_PHOTO_KIND,
    ]) {
      const dir = uploadKindDir(this.config, kind);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  /** Absolute path for a stored file of the given kind. */
  absolutePath(kind: string, filename: string): string {
    return join(uploadKindDir(this.config, kind), filename);
  }

  exists(kind: string, filename: string): boolean {
    return existsSync(this.absolutePath(kind, filename));
  }

  /** Dev-only fallback for when Cloudinary isn't configured (see CloudinaryService). */
  saveBuffer(kind: string, filename: string, buffer: Buffer): void {
    writeFileSync(this.absolutePath(kind, filename), buffer);
  }

  /** Best-effort delete; a stored path is "<kind>/<filename>". */
  removeQuietly(relativePath: string | null | undefined): void {
    if (!relativePath) return;
    const base = this.config.get<string>('UPLOAD_DIR') ?? './uploads';
    const abs = join(process.cwd(), base, relativePath);
    unlink(abs, (err) => {
      if (err) this.logger.warn(`could not delete ${abs}: ${err.message}`);
    });
  }
}
