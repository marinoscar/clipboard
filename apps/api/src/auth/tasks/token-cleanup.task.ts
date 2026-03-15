import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from '../auth.service';

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleTokenCleanup() {
    this.logger.log('Running token cleanup...');
    const count = await this.authService.cleanupExpiredTokens();
    this.logger.log(`Token cleanup completed: ${count} tokens removed`);
  }
}
