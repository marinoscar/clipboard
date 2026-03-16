import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const SETTING_KEYS = {
  ARCHIVE_AFTER_DAYS: 'retention.archiveAfterDays',
  DELETE_AFTER_ARCHIVE_DAYS: 'retention.deleteAfterArchiveDays',
} as const;

export interface RetentionConfig {
  archiveAfterDays: number | null;
  deleteAfterArchiveDays: number | null;
}

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.ARCHIVE_AFTER_DAYS]: null,
  [SETTING_KEYS.DELETE_AFTER_ARCHIVE_DAYS]: null,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all system settings as a key→value map.
   * Missing keys fall back to their default values.
   */
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.systemSettings.findMany();

    const result: Record<string, unknown> = { ...DEFAULTS };

    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        this.logger.warn(`Failed to parse setting "${row.key}" — using raw string`);
        result[row.key] = row.value;
      }
    }

    return result;
  }

  /**
   * Returns the parsed value for a single setting key.
   * Falls back to the default if the key is not in the database.
   */
  async get(key: string): Promise<unknown> {
    const row = await this.prisma.systemSettings.findUnique({ where: { key } });

    if (!row) {
      return key in DEFAULTS ? DEFAULTS[key] : null;
    }

    try {
      return JSON.parse(row.value);
    } catch {
      this.logger.warn(`Failed to parse setting "${key}" — returning raw string`);
      return row.value;
    }
  }

  /**
   * Upserts a setting key with the given value (JSON-serialised).
   */
  async set(key: string, value: unknown): Promise<void> {
    const serialised = JSON.stringify(value);

    await this.prisma.systemSettings.upsert({
      where: { key },
      create: { key, value: serialised },
      update: { value: serialised },
    });

    this.logger.debug(`Setting updated: ${key} = ${serialised}`);
  }

  /**
   * Returns the retention configuration with typed fields and defaults.
   */
  async getRetentionConfig(): Promise<RetentionConfig> {
    const [archiveAfterDays, deleteAfterArchiveDays] = await Promise.all([
      this.get(SETTING_KEYS.ARCHIVE_AFTER_DAYS),
      this.get(SETTING_KEYS.DELETE_AFTER_ARCHIVE_DAYS),
    ]);

    return {
      archiveAfterDays:
        typeof archiveAfterDays === 'number' ? archiveAfterDays : null,
      deleteAfterArchiveDays:
        typeof deleteAfterArchiveDays === 'number'
          ? deleteAfterArchiveDays
          : null,
    };
  }
}
