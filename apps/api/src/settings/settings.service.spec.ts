import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      systemSettings: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------
  describe('getAll', () => {
    it('should return defaults when database has no rows', async () => {
      prisma.systemSettings.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual({
        'retention.archiveAfterDays': null,
        'retention.deleteAfterArchiveDays': null,
      });
    });

    it('should merge db rows with defaults', async () => {
      prisma.systemSettings.findMany.mockResolvedValue([
        { key: 'retention.archiveAfterDays', value: '30' },
      ]);

      const result = await service.getAll();

      expect(result['retention.archiveAfterDays']).toBe(30);
      expect(result['retention.deleteAfterArchiveDays']).toBeNull();
    });

    it('should parse JSON values from rows', async () => {
      prisma.systemSettings.findMany.mockResolvedValue([
        { key: 'retention.archiveAfterDays', value: '90' },
        { key: 'retention.deleteAfterArchiveDays', value: '7' },
      ]);

      const result = await service.getAll();

      expect(result['retention.archiveAfterDays']).toBe(90);
      expect(result['retention.deleteAfterArchiveDays']).toBe(7);
    });

    it('should include extra keys from the database not in defaults', async () => {
      prisma.systemSettings.findMany.mockResolvedValue([
        { key: 'some.custom.key', value: '"hello"' },
      ]);

      const result = await service.getAll();

      expect(result['some.custom.key']).toBe('hello');
    });

    it('should fall back to raw string when JSON.parse fails', async () => {
      prisma.systemSettings.findMany.mockResolvedValue([
        { key: 'bad.key', value: 'not-json' },
      ]);

      const result = await service.getAll();

      expect(result['bad.key']).toBe('not-json');
    });
  });

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------
  describe('get', () => {
    it('should return the default null for archiveAfterDays when not in db', async () => {
      prisma.systemSettings.findUnique.mockResolvedValue(null);

      const result = await service.get(SETTING_KEYS.ARCHIVE_AFTER_DAYS);

      expect(result).toBeNull();
    });

    it('should return null for unknown keys not in db', async () => {
      prisma.systemSettings.findUnique.mockResolvedValue(null);

      const result = await service.get('unknown.key');

      expect(result).toBeNull();
    });

    it('should return parsed value from db', async () => {
      prisma.systemSettings.findUnique.mockResolvedValue({
        key: 'retention.archiveAfterDays',
        value: '30',
      });

      const result = await service.get(SETTING_KEYS.ARCHIVE_AFTER_DAYS);

      expect(result).toBe(30);
    });

    it('should return raw string when JSON.parse fails', async () => {
      prisma.systemSettings.findUnique.mockResolvedValue({
        key: 'bad.key',
        value: 'not-valid-json{',
      });

      const result = await service.get('bad.key');

      expect(result).toBe('not-valid-json{');
    });
  });

  // ---------------------------------------------------------------------------
  // set
  // ---------------------------------------------------------------------------
  describe('set', () => {
    it('should upsert the serialised value', async () => {
      prisma.systemSettings.upsert.mockResolvedValue({});

      await service.set('retention.archiveAfterDays', 30);

      expect(prisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { key: 'retention.archiveAfterDays' },
        create: { key: 'retention.archiveAfterDays', value: '30' },
        update: { value: '30' },
      });
    });

    it('should serialise null correctly', async () => {
      prisma.systemSettings.upsert.mockResolvedValue({});

      await service.set('retention.archiveAfterDays', null);

      expect(prisma.systemSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ value: 'null' }),
          update: { value: 'null' },
        }),
      );
    });

    it('should serialise objects to JSON', async () => {
      prisma.systemSettings.upsert.mockResolvedValue({});

      await service.set('some.object', { foo: 'bar' });

      expect(prisma.systemSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ value: '{"foo":"bar"}' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getRetentionConfig
  // ---------------------------------------------------------------------------
  describe('getRetentionConfig', () => {
    it('should return null/null when both settings are absent', async () => {
      prisma.systemSettings.findUnique.mockResolvedValue(null);

      const config = await service.getRetentionConfig();

      expect(config).toEqual({
        archiveAfterDays: null,
        deleteAfterArchiveDays: null,
      });
    });

    it('should return numeric values when set', async () => {
      prisma.systemSettings.findUnique
        .mockResolvedValueOnce({ key: SETTING_KEYS.ARCHIVE_AFTER_DAYS, value: '30' })
        .mockResolvedValueOnce({ key: SETTING_KEYS.DELETE_AFTER_ARCHIVE_DAYS, value: '7' });

      const config = await service.getRetentionConfig();

      expect(config).toEqual({
        archiveAfterDays: 30,
        deleteAfterArchiveDays: 7,
      });
    });

    it('should coerce non-numeric values to null', async () => {
      prisma.systemSettings.findUnique
        .mockResolvedValueOnce({ key: SETTING_KEYS.ARCHIVE_AFTER_DAYS, value: '"invalid"' })
        .mockResolvedValueOnce(null);

      const config = await service.getRetentionConfig();

      expect(config.archiveAfterDays).toBeNull();
      expect(config.deleteAfterArchiveDays).toBeNull();
    });
  });
});
