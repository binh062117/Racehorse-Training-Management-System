import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Uploads to Cloudinary so files survive a backend redeploy — Render's web
 * service disk is ephemeral and wipes `UPLOAD_DIR` on every deploy/restart
 * unless a paid persistent disk is attached. Leave the three CLOUDINARY_*
 * env vars blank to fall back to local disk storage (fine for local dev,
 * not for Render — see docs/DEPLOY.md).
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger('Cloudinary');
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    const cloud_name = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const api_key = config.get<string>('CLOUDINARY_API_KEY');
    const api_secret = config.get<string>('CLOUDINARY_API_SECRET');
    this.enabled = Boolean(cloud_name && api_key && api_secret);
    if (this.enabled) {
      cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    }
  }

  uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'image',
          overwrite: true,
        },
        (err, result) => {
          if (err || !result) {
            reject(
              err instanceof Error
                ? err
                : new Error('Cloudinary upload failed'),
            );
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }

  /** Best-effort delete; `url` is a secure_url previously returned by uploadBuffer(). */
  async destroyByUrl(url: string): Promise<void> {
    const publicId = this.publicIdFromUrl(url);
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      this.logger.warn(
        `could not delete ${publicId}: ${(err as Error).message}`,
      );
    }
  }

  /** Cloudinary secure_url shape: .../upload/v<version>/<folder>/<public_id>.<ext> */
  private publicIdFromUrl(url: string): string | null {
    const match = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/.exec(url);
    return match ? match[1] : null;
  }
}
