import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    // Convert BigInt fields to Number for JSON serialization safety.
    // All file sizes fit comfortably within Number.MAX_SAFE_INTEGER (~9 PB).
    this.$use(async (params, next) => {
      const result = await next(params);
      return this.convertBigInts(result);
    });

    await this.$connect();
    this.logger.log('Database connected');

    // Enable WAL mode for better concurrent access
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await this.$queryRawUnsafe('PRAGMA foreign_keys=ON;');

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore - Prisma event typing
      this.$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  private convertBigInts(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'bigint') return Number(data);
    if (Array.isArray(data)) return data.map((item) => this.convertBigInts(item));
    if (typeof data === 'object' && data !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.convertBigInts(value);
      }
      return result;
    }
    return data;
  }
}
