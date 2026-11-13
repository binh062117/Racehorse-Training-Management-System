import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DailyCareService } from './daily-care.service';

/**
 * Closes yesterday's checklist soon after midnight (Vietnam time). The list and
 * generate endpoints also close it on demand, so a sleeping server catches up.
 */
@Injectable()
export class DailyCareJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(DailyCareJob.name);

  constructor(private readonly dailyCare: DailyCareService) {}

  onApplicationBootstrap() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.dailyCare.closePastDays();
    } catch (error: unknown) {
      this.logger.warn(
        `Closing past care checklists failed; retrying later: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
