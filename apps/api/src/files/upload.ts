import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Request } from 'express';
import { MulterModuleOptions } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage, memoryStorage } from 'multer';
import { AppException } from '../common/app-exception';

export const HORSE_PHOTO_KIND = 'horse-photos';
export const HEALTH_ATTACHMENT_KIND = 'health-attachments';
export const INCIDENT_PHOTO_KIND = 'incident-photos';

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Health attachments also accept PDF (lab results, X-rays). */
export const ATTACHMENT_MIME_TO_EXT: Record<string, string> = {
  ...MIME_TO_EXT,
  'application/pdf': 'pdf',
};

/** Absolute path of the folder that holds a given upload kind. */
export function uploadKindDir(config: ConfigService, kind: string): string {
  const base = config.get<string>('UPLOAD_DIR') ?? './uploads';
  return join(process.cwd(), base, kind);
}

/** Regex for a safe served filename (blocks path traversal). */
export const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;
export const SAFE_ATTACHMENT_FILENAME =
  /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|pdf)$/;

/**
 * Multer options for the health-record attachment route. Built from `process.env`
 * (ConfigModule has already loaded `.env`) so it can be used inline in a
 * `FileInterceptor` decorator without injecting ConfigService.
 */
export function buildAttachmentMulterOptions(): MulterModuleOptions {
  const base = process.env.UPLOAD_DIR ?? './uploads';
  const dir = join(process.cwd(), base, HEALTH_ATTACHMENT_KIND);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const maxMb = Number(process.env.UPLOAD_MAX_MB) || 5;

  return {
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ATTACHMENT_MIME_TO_EXT[file.mimetype]) {
        cb(
          new AppException(
            'VALIDATION_ERROR',
            'Only JPEG, PNG, WebP or PDF files are allowed',
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (req: Request, file, cb) => {
        const ext = ATTACHMENT_MIME_TO_EXT[file.mimetype];
        const raw = req.params.id;
        const recordId = typeof raw === 'string' && raw ? raw : 'record';
        cb(null, `${recordId}-${randomBytes(4).toString('hex')}.${ext}`);
      },
    }),
  };
}

/**
 * Multer options for image-upload routes (horse photos, incident photos),
 * kept in memory (not written to disk) so the buffer can go straight to
 * Cloudinary when configured. Built from `process.env` for the same reason
 * as buildAttachmentMulterOptions().
 */
/** Memory-storage counterpart of buildAttachmentMulterOptions() — see buildImageMemoryMulterOptions(). */
export function buildAttachmentMemoryMulterOptions(): MulterModuleOptions {
  const maxMb = Number(process.env.UPLOAD_MAX_MB) || 5;
  return {
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ATTACHMENT_MIME_TO_EXT[file.mimetype]) {
        cb(
          new AppException(
            'VALIDATION_ERROR',
            'Only JPEG, PNG, WebP or PDF files are allowed',
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
    storage: memoryStorage(),
  };
}

export function buildImageMemoryMulterOptions(): MulterModuleOptions {
  const maxMb = Number(process.env.UPLOAD_MAX_MB) || 5;
  return {
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!MIME_TO_EXT[file.mimetype]) {
        cb(
          new AppException(
            'VALIDATION_ERROR',
            'Only JPEG, PNG or WebP images are allowed',
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
    storage: memoryStorage(),
  };
}

export function buildMulterOptions(config: ConfigService): MulterModuleOptions {
  const dir = uploadKindDir(config, HORSE_PHOTO_KIND);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const maxMb = config.get<number>('UPLOAD_MAX_MB') ?? 5;

  return {
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!MIME_TO_EXT[file.mimetype]) {
        cb(
          new AppException(
            'VALIDATION_ERROR',
            'Only JPEG, PNG or WebP images are allowed',
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (req: Request, file, cb) => {
        const ext = MIME_TO_EXT[file.mimetype];
        const raw = req.params.id;
        const horseId = typeof raw === 'string' && raw ? raw : 'horse';
        cb(null, `${horseId}-${randomBytes(4).toString('hex')}.${ext}`);
      },
    }),
  };
}

/**
 * Multer options for the incident-report photo route (Phase 10, UC-19).
 * Built from `process.env` for the same reason as
 * buildAttachmentMulterOptions() — usable inline in a FileInterceptor
 * decorator without injecting ConfigService.
 */
export function buildIncidentPhotoMulterOptions(): MulterModuleOptions {
  const base = process.env.UPLOAD_DIR ?? './uploads';
  const dir = join(process.cwd(), base, INCIDENT_PHOTO_KIND);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const maxMb = Number(process.env.UPLOAD_MAX_MB) || 5;

  return {
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!MIME_TO_EXT[file.mimetype]) {
        cb(
          new AppException(
            'VALIDATION_ERROR',
            'Only JPEG, PNG or WebP images are allowed',
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (req: Request, file, cb) => {
        const ext = MIME_TO_EXT[file.mimetype];
        const raw = req.params.id;
        const incidentId = typeof raw === 'string' && raw ? raw : 'incident';
        cb(null, `${incidentId}-${randomBytes(4).toString('hex')}.${ext}`);
      },
    }),
  };
}
