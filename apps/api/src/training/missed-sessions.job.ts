import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { TrainingService } from './training.service';

function sanitizeError(text: string): string {
  const secrets = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value &&
      /PASSWORD|SECRET|TOKEN|API_KEY|DATABASE_URL|DIRECT_URL/i.test(key)
    ) {
      secrets.add(value);
    }
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    try {
      const url = new URL(process.env[key] ?? '');
      for (const value of [url.username, url.password]) {
        if (value) {
          secrets.add(value);
          secrets.add(decodeURIComponent(value));
        }
      }
    } catch {
      // A malformed URL must not prevent error reporting or the next tick.
    }
  }
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(
      /\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1=[REDACTED]',
    );
}

/** One idempotent SQL update per minute. No overlapping runs or notifications. */
@Injectable()
export class MissedSessionsJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(MissedSessionsJob.name);

  constructor(private readonly training: TrainingService) {}

  onApplicationBootstrap() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.training.reconcileMissed();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Overdue session reconciliation failed; retrying next minute: ${sanitizeError(message)}`,
        stack ? sanitizeError(stack) : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
